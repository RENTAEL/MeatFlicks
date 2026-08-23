<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { Play } from '@lucide/svelte';
	import { playerPreferences } from '$lib/state/stores/playerPreferences.svelte';
	import { sendEmbedCommand, extractYoutubeId, loadYoutubeApi } from '$lib/utils/embedCommands';
	import { soakEvent, soakUpdate } from '$lib/soak/soak';
	import { reportPlayback } from '$lib/playback/reportPlayback';

	let {
		tmdbId,
		type = 'movie' as 'movie' | 'tv',
		season = 1,
		episode = 1,
		title = '',
		imdbId = null as string | null,
		runtime = null as number | null,
		backdrop = null as string | null,
		next = null as {
			season_number: number;
			episode_number: number;
			name: string;
			air_date: string | null;
			still_path: string | null;
		} | null,
		onnext = undefined as (() => void) | undefined,
		onerror,
		preResolvedSource = null as string | null,
		readOnly = false as boolean,
		remoteSync = null as {
			seq: number;
			playing: boolean;
			position: number;
			positionAt: number;
			provider: { id: string; name: string } | null;
		} | null,
		syncPoke = 0 as number,
		remoteConfirmed = false as boolean,
		onPlaybackChange = undefined as
			| ((signal: {
					playing: boolean;
					position: number;
					provider: { id: string; name: string } | null;
			  }) => void)
			| undefined,
		onSyncState = undefined as
			| ((state: { status: 'synced' | 'drifted' | 'syncing'; drift: number }) => void)
			| undefined
	}: {
		tmdbId: number;
		type?: 'movie' | 'tv';
		season?: number;
		episode?: number;
		title?: string;
		imdbId?: string | null;
		runtime?: number | null;
		backdrop?: string | null;
		next?: {
			season_number: number;
			episode_number: number;
			name: string;
			air_date: string | null;
			still_path: string | null;
		} | null;
		onnext?: () => void;
		onerror?: (detail: { message: string }) => void;
		preResolvedSource?: string | null;
		readOnly?: boolean;
		remoteSync?: {
			seq: number;
			playing: boolean;
			position: number;
			positionAt: number;
			provider: { id: string; name: string } | null;
		} | null;
		syncPoke?: number;
		remoteConfirmed?: boolean;
		onPlaybackChange?: (signal: {
			playing: boolean;
			position: number;
			provider: { id: string; name: string } | null;
		}) => void;
		onSyncState?: (state: { status: 'synced' | 'drifted' | 'syncing'; drift: number }) => void;
	} = $props();

	interface ScanResult {
		id: string;
		name: string;
		movieUrl: string;
		tvUrl: string | null;
		status: 'working' | 'blocked' | 'dead';
	}

	export const TRACKING_CAPS: Record<
		string,
		{ tracksPosition: boolean; playbackControl: 'full' | 'best-effort' }
	> = {
		vidlink: { tracksPosition: false, playbackControl: 'best-effort' },
		vidsrc: { tracksPosition: false, playbackControl: 'best-effort' },
		'2embed': { tracksPosition: false, playbackControl: 'best-effort' },
		superembed: { tracksPosition: false, playbackControl: 'best-effort' },
		youtube: { tracksPosition: true, playbackControl: 'full' }
	};

	let isScanning = $state(true);
	let scanError = $state('');
	let allProviders: ScanResult[] = $state([]);
	let workingProviders: ScanResult[] = $derived(allProviders.filter((p) => p.status !== 'dead'));
	let currentIndex = $state(0);
	let currentProvider = $derived(workingProviders[currentIndex]);
	let canResumePosition = $derived(
		TRACKING_CAPS[currentProvider?.id ?? '']?.tracksPosition ?? false
	);
	let hasFullPlaybackControl = $derived(currentProvider?.id === 'youtube');
	let currentUrl = $derived(
		type === 'tv' && currentProvider?.tvUrl
			? currentProvider.tvUrl
			: currentProvider?.movieUrl || ''
	);
	let deadProviders = $derived(allProviders.filter((p) => p.status === 'dead'));
	let iframeLoaded = $state(false);
	let hasError = $state(false);
	let showServerList = $state(false);
	let autoSwitchTimer: ReturnType<typeof setTimeout> | null = $state(null);
	let isAutoSwitching = $state(false);
	let loadedProviders = $state<Set<string>>(new Set());

	let playerRoot = $state<HTMLElement | null>(null);
	let frameRef = $state<HTMLIFrameElement | null>(null);
	let ytHost = $state<HTMLElement | null>(null);
	let ytPlayer: any = null;
	let ytReady = $state(false);
	let playing = $state(false);
	// Presence reporting — admin live stats show play/pause per viewer.
	$effect(() => {
		reportPlayback(playing);
	});
	let elapsedSeconds = $state(0);
	let elapsedTick: ReturnType<typeof setInterval> | null = null;
	let effectiveVolume = $derived(playerPreferences.muted ? 0 : playerPreferences.volume);

	let nextUnavailable = $derived(
		!!next && !!next.air_date && new Date(next.air_date).getTime() > Date.now()
	);
	let nextReady = $derived(!!next && !nextUnavailable);
	let upNextThumb = $derived(
		next?.still_path
			? `https://image.tmdb.org/t/p/w500${next.still_path}`
			: backdrop
				? `https://image.tmdb.org/t/p/w1280${backdrop}`
				: ''
	);

	const AUTOPLAY_KEY = 'streamium-autoplay-next';
	let autoplayNext = $state(true);
	let upNextVisible = $state(false);
	let upNextLeft = $state(10);
	let autoTick: ReturnType<typeof setInterval> | null = null;
	let upNextTick: ReturnType<typeof setInterval> | null = null;
	let autoEndsAt = 0;
	let upNextEndsAt = 0;
	let suppressedKey: string | null = null;
	let currentKey = $derived(`${season}:${episode}`);
	let remoteAppliedSeq = -1;
	let remotePokedSeq = -1;

	interface RemoteSync {
		seq: number;
		playing: boolean;
		position: number;
		positionAt: number;
		provider: { id: string; name: string } | null;
	}
	type SyncStatus = { status: 'synced' | 'drifted' | 'syncing'; drift: number };

	let embedEvent: { playing: boolean; position: number; at: number } | null = null;
	let frameSrc = $state('');
	let syncingToHost = $state(false);
	let needsTapToContinue = $state(false);
	let connectionLost = $state(false);
	let latestRemote: RemoteSync | null = null;
	// The drift target is anchored to the member's own clock: when a new
	// SSE frame arrives, we record the local receipt time and extrapolate
	// from that. The host's positionAt is only a frame-time reference, so
	// host/member wall-clock skew cancels out instead of looking like a
	// growing drift (which used to trigger the 3-streak auto-reload loop).
	// The host is the source of truth; the member is a dumb mirror. Each host
	// event (provider switch, play/pause flip, position jump) is applied to
	// the element exactly once — no windows, no settle periods, no cooldowns,
	// no reload streaks. vidlink-class embeds accept no runtime commands
	// (empirically verified), so "seeking" on them means rebuilding the iframe
	// with #t= + autoplay= — the only control they honor. The element's real
	// position re-anchors the comparison, so a build that lands is never
	// repeated.
	let frameReceivedAt = 0;
	let frameReceivedSeq = -1;
	let lastHostReported = -1;
	let lastHostPost = 0;
	let hostTick: ReturnType<typeof setInterval> | null = null;
	let driftTick: ReturnType<typeof setInterval> | null = null;
	let isCoarse = $state(false);
	let lastSyncState: SyncStatus = { status: 'synced', drift: 0 };
	let frameBump = $state(0);
	let builtByUs = false;
	// The host event this member's element was last built to reflect. The
	// comparison is re-anchored to the element's real position on every
	// timeupdate, so `stateChanged` is effectively "|hostTarget − elementPos|
	// > SYNC_GAP_S or the play state flipped".
	let lastBuilt: {
		seq: number;
		position: number;
		playing: boolean;
		providerId: string | null;
		at: number;
	} | null = null;
	// True once the member's embed has reported a real timeupdate — the only
	// proof the video is actually advancing. Reset on every rebuild.
	let hasStartedPlayback = false;
	// When the current frame last loaded; used by the blocked-embed guard and
	// the tap prompt.
	let lastFrameLoadAt = 0;
	// The gap (seconds) that defines "in sync". The watchdog corrects only
	// beyond this.
	const SYNC_GAP_S = 5;

	// A requested element rebuild, buffered through the $effect below so the
	// URL is built from the CURRENT provider (a rebuild may follow a provider
	// switch). Setting a new src (with the `_` cache-buster) forces the iframe
	// to reload — the only control vidlink-class embeds accept.
	let buildRequest: { position: number; playing: boolean } | null = null;
	let buildNonce = 0;

	$effect(() => {
		const base = currentUrl;
		void frameBump;
		const req = buildRequest;
		if (req) {
			buildRequest = null;
			const url = new URL(base);
			url.searchParams.set('autoplay', req.playing ? 'true' : 'false');
			url.searchParams.set('_', String(++buildNonce));
			url.hash = '#t=' + Math.max(0, Math.round(req.position));
			frameSrc = url.toString();
			builtByUs = true;
		} else if (readOnly && remoteSync && remoteAppliedSeq === -1 && !hasFullPlaybackControl) {
			// Member joined with a host state before the first iframe ever
			// rendered: hold the base URL until the join build lands (see the
			// remote-sync effect), so the FIRST load already carries #t= +
			// autoplay — one load, no base-load-then-rebuild. Keyed off the
			// reactive remoteSync (not latestRemote, which is a plain let and
			// can be stale in the flush where the room state arrives) so the
			// hold is evaluated with the real room state in every flush. Only
			// for blind embeds — full-control providers load the base and seek.
			builtByUs = true;
		} else {
			frameSrc = base;
			builtByUs = false;
		}
	});

	$effect(() => {
		if (browser) {
			try {
				isCoarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
			} catch {
				isCoarse = false;
			}
		}
	});

	$effect(() => {
		let pendingPause: { position: number } | null = null;
		let pendingPauseTimer: ReturnType<typeof setTimeout> | null = null;
		function reportHostSignal(sig: { playing: boolean; position: number }) {
			if (readOnly) return;
			const now = Date.now();
			if (now - lastHostPost < 1500) return;
			lastHostPost = now;
			playing = sig.playing;
			onPlaybackChange?.({ ...sig, provider: currentProviderInfo() });
		}
		function onMessage(e: MessageEvent) {
			if (e.origin !== 'https://vidlink.pro') return;
			const d = e.data as { type?: string; data?: { event?: string; currentTime?: number } };
			if (!d || typeof d !== 'object' || d.type !== 'PLAYER_EVENT') return;
			const ev = d.data;
			if (!ev || typeof ev.event !== 'string') return;
			const pos = typeof ev.currentTime === 'number' ? ev.currentTime : 0;
			embedEvent = { playing: ev.event !== 'pause', position: pos, at: Date.now() };
			// Only timeupdate proves the video is actually advancing: a blocked
			// embed can still fire a one-shot 'play' event with play() rejected.
			// lastBuilt.position is deliberately NOT re-anchored here — it must
			// stay the applied host target, or the host-move-back check compares
			// against the member's own (possibly ahead) position.
			if (ev.event === 'timeupdate') {
				hasStartedPlayback = true;
			}
			soakEvent('embed-ev', `${ev.event} pos=${pos.toFixed(1)}`);
			elapsedSeconds = pos;
			if (ev.event === 'play') {
				needsTapToContinue = false;
				if (!readOnly) {
					if (pendingPauseTimer) {
						clearTimeout(pendingPauseTimer);
						pendingPauseTimer = null;
						pendingPause = null;
					}
					reportHostSignal({ playing: true, position: pos });
				}
			} else if (ev.event === 'pause') {
				console.info(`[player] paused at ${pos.toFixed(1)}s`);
				needsTapToContinue = false;
				if (!readOnly) {
					if (pendingPauseTimer) clearTimeout(pendingPauseTimer);
					pendingPause = { position: pos };
					pendingPauseTimer = setTimeout(() => {
						pendingPauseTimer = null;
						const p = pendingPause;
						pendingPause = null;
						if (p) reportHostSignal({ playing: false, position: p.position });
					}, 1500);
				}
			} else if (ev.event === 'seeked') {
				if (!readOnly) reportHostSignal({ playing, position: pos });
			} else if (ev.event === 'timeupdate') {
				if (!readOnly) maybeReportHost(pos);
			}
		}
		window.addEventListener('message', onMessage);
		return () => {
			if (pendingPauseTimer) clearTimeout(pendingPauseTimer);
			window.removeEventListener('message', onMessage);
		};
	});

	function currentProviderInfo(): { id: string; name: string } | null {
		return currentProvider ? { id: currentProvider.id, name: currentProvider.name } : null;
	}

	// Host-side position estimate: extrapolates from the last known embed
	// state (even when PLAYER_EVENTs go stale), so reported positions stay
	// accurate through sparse event streams instead of falling back to the
	// timer-driven elapsedSeconds (which ignores pauses).
	function hostPosition(): number {
		if (ytPlayer && ytReady) return ytPlayer.getCurrentTime?.() ?? elapsedSeconds;
		if (embedEvent) {
			return embedEvent.position + (embedEvent.playing ? (Date.now() - embedEvent.at) / 1000 : 0);
		}
		return elapsedSeconds;
	}

	// The element's REAL position, extrapolated from its last fresh event.
	// null when the embed is silent (paused / blocked / still starting) —
	// a silent element's flat position is not "behind", so nothing to sync.
	function elementPosition(): number | null {
		if (!embedEvent) return null;
		if (Date.now() - embedEvent.at > 6000) return null;
		return embedEvent.position + (embedEvent.playing ? (Date.now() - embedEvent.at) / 1000 : 0);
	}

	// The host's extrapolated position at this instant. The host's positionAt
	// is only a frame-time reference, so host/member wall-clock skew cancels
	// out instead of looking like a growing drift.
	function hostTarget(rs: RemoteSync): number {
		if (!rs.playing) return rs.position;
		const elapsed =
			rs.seq === frameReceivedSeq && frameReceivedAt > 0
				? (Date.now() - frameReceivedAt) / 1000
				: (Date.now() - rs.positionAt) / 1000;
		return Math.max(0, rs.position + elapsed);
	}

	function setSyncState(status: SyncStatus) {
		if (status.status !== lastSyncState.status) {
			soakEvent(
				'sync',
				`${status.status}${status.status === 'drifted' ? ` drift=${status.drift}` : ''}`
			);
		}
		lastSyncState = status;
		onSyncState?.(status);
	}

	function updateSyncState(current: number, target: number) {
		const drift = target - current;
		if (Math.abs(drift) <= SYNC_GAP_S) {
			setSyncState({ status: 'synced', drift: 0 });
		} else {
			setSyncState({ status: 'drifted', drift: Math.round(drift) });
		}
	}

	function maybeReportHost(pos: number) {
		if (readOnly) return;
		const now = Date.now();
		if (now - lastHostReported < 8000) return;
		lastHostReported = pos;
		onPlaybackChange?.({ playing, position: pos, provider: currentProviderInfo() });
	}

	// Rebuild the current source at the given position + play state — the ONLY
	// control vidlink-class embeds accept (load-time #t= and autoplay=). This
	// is how a host event is applied: exactly once per changed event.
	function requestBuild(position: number, playing: boolean, reason = 'unspecified') {
		console.info(
			`[player] iframe reload reason=${reason} t=${Math.max(0, Math.round(position))} playing=${playing} provider=${currentProvider?.id ?? 'none'}`
		);
		const now = Date.now();
		lastBuilt = {
			seq: latestRemote?.seq ?? 0,
			position,
			playing,
			providerId: currentProvider?.id ?? null,
			at: now
		};
		hasStartedPlayback = false;
		embedEvent = null;
		lastFrameLoadAt = now;
		elapsedSeconds = position;
		iframeLoaded = false;
		syncingToHost = true;
		needsTapToContinue = false;
		setSyncState({ status: 'syncing', drift: 0 });
		soakEvent(
			'build',
			`t=${Math.max(0, Math.round(position))} playing=${playing} provider=${currentProvider?.id ?? 'none'}`
		);
		buildRequest = { position, playing };
		frameBump++;
	}

	function switchToProviderId(id: string): boolean {
		const idx = workingProviders.findIndex((p) => p.id === id || p.name === id);
		if (idx < 0) return false;
		if (idx !== currentIndex) {
			soakEvent('provider', `switch ${currentProvider?.id ?? 'none'} -> ${id} (remote)`);
			switchTo(idx);
		}
		return true;
	}

	// Apply one host event to the mirror. Idempotent by construction: the
	// element is only ever rebuilt when the host state actually changed
	// (provider switch, play/pause flip, or |target − elementPos| > SYNC_GAP_S
	// while the element is proven to play). A silent/blocked element is never
	// rebuilt — the tap prompt covers it.
	function applyHostState(rs: RemoteSync, force = false) {
		if (!iframeLoaded || !currentProvider || !currentUrl) {
			markSyncApplied(rs);
			return;
		}
		const target = hostTarget(rs);
		const b = lastBuilt;
		// 1. Source event: the host switched provider — rebuild on the new
		//    source at the host's position + play state.
		if (rs.provider && rs.provider.id !== currentProvider.id) {
			if (switchToProviderId(rs.provider.id)) {
				soakEvent(
					'apply',
					`seq=${rs.seq} action=source-switch target=${target.toFixed(1)} playing=${rs.playing}`
				);
				requestBuild(target, rs.playing, 'host-source-switch');
			}
			markSyncApplied(rs);
			return;
		}
		// 2. Full-control providers (YouTube): command-level seek/play/pause —
		//    never rebuild.
		if (hasFullPlaybackControl) {
			if (!ytPlayer || !ytReady) {
				markSyncApplied(rs);
				return;
			}
			const cur = ytPlayer.getCurrentTime?.() ?? 0;
			if (force || Math.abs(target - cur) > SYNC_GAP_S) {
				ytPlayer.seekTo(target, true);
				soakEvent(
					'apply',
					`seq=${rs.seq} action=seek target=${target.toFixed(1)} gap=${(target - cur).toFixed(1)}`
				);
			}
			if (rs.playing !== playing) {
				if (rs.playing) ytPlayer.playVideo();
				else ytPlayer.pauseVideo();
				playing = rs.playing;
				soakEvent('apply', `seq=${rs.seq} action=${rs.playing ? 'play' : 'pause'} (yt)`);
			}
			elapsedSeconds = target;
			updateSyncState(cur, target);
			markSyncApplied(rs);
			return;
		}
		// 3. Blind embeds (vidlink-class): apply each host event exactly once.
		//    The state changed when the host emitted a new event (provider
		//    switch, play/pause flip, position move-back) or the member fell
		//    BEHIND by more than the gap. A member that is AHEAD of a paused
		//    host is never re-built: the pause event was already applied and
		//    an embed that defies autoplay=false can't be re-poked without
		//    looping forever.
		const anchor = elementPosition();
		const cur = anchor ?? b?.position ?? target;
		const stateChanged =
			force ||
			!b ||
			rs.playing !== b.playing ||
			target - cur > SYNC_GAP_S ||
			(b !== null && rs.position < b.position - SYNC_GAP_S);
		if (stateChanged) {
			// Host playing but this element never proved playback (blocked/
			// silent embed): never rebuild — the tap prompt handles it once.
			// EXCEPT when the last build was a deliberate paused mirror
			// (lastBuilt.playing === false): the embed was loaded with
			// autoplay=false on purpose, so a resume flip must build
			// (playing=true), not block.
			if (
				rs.playing &&
				b?.playing !== false &&
				!hasStartedPlayback &&
				Date.now() - lastFrameLoadAt > 4000
			) {
				soakEvent('apply', `seq=${rs.seq} action=blocked target=${target.toFixed(1)}`);
				maybeShowTapPrompt();
				updateSyncState(cur, target);
				markSyncApplied(rs);
				return;
			}
			const action = force
				? 'resync'
				: !b
					? 'join'
					: rs.playing !== b.playing
						? 'play-state'
						: 'position';
			soakEvent(
				'apply',
				`seq=${rs.seq} action=${action} target=${target.toFixed(1)} cur=${cur.toFixed(1)} gap=${(target - cur).toFixed(1)} playing=${rs.playing}`
			);
			requestBuild(target, rs.playing, `host-${action}`);
			markSyncApplied(rs);
			return;
		}
		// 4. States already match — nothing to do.
		updateSyncState(cur, target);
		markSyncApplied(rs);
	}

	function markSyncApplied(rs: RemoteSync) {
		try {
			(window as any).__swLastSyncApplied = {
				at: Date.now(),
				seq: rs.seq,
				playing: rs.playing,
				position: rs.position,
				provider: currentProvider?.id ?? null
			};
		} catch {
			// instrumentation only
		}
	}

	function maybeShowTapPrompt() {
		if (!readOnly || !latestRemote?.playing) {
			needsTapToContinue = false;
			return;
		}
		// Host is playing but this element never proved playback (silent or
		// autoplay-blocked embed): show the tap overlay once, a few seconds
		// after load, instead of rebuilding in a loop. `hasStartedPlayback`
		// (a real timeupdate) is the only proof the video advances.
		const progressed = hasStartedPlayback;
		if (progressed) {
			needsTapToContinue = false;
			return;
		}
		const loadedAt = embedEvent?.at ?? lastFrameLoadAt;
		if (Date.now() - loadedAt < 5000) return;
		const prev = needsTapToContinue;
		needsTapToContinue = true;
		if (!prev) soakEvent('tap-prompt', 'shown');
	}

	function tapToContinue() {
		needsTapToContinue = false;
		hasStartedPlayback = false;
		const rs = latestRemote;
		if (!rs) return;
		const target = hostTarget(rs);
		// A tap IS the user gesture: seek + play under it. Never rebuild just
		// to change play state.
		if (ytPlayer && ytReady) {
			ytPlayer.seekTo(target, true);
			ytPlayer.playVideo();
			playing = true;
			elapsedSeconds = target;
		} else {
			requestBuild(target, true, 'tap-continue');
		}
	}

	function startHostTick() {
		stopHostTick();
		hostTick = setInterval(() => {
			if (!iframeLoaded) return;
			const pos = hostPosition();
			if (Math.abs(pos - lastHostReported) < 1) return;
			lastHostReported = pos;
			soakUpdate({
				role: 'host',
				hostPos: pos,
				memberPos: pos,
				drift: 0,
				status: 'host',
				provider: currentProvider?.id ?? null,
				iframeLoaded: true,
				seq: latestRemote?.seq ?? 0,
				lastAction: ''
			});
			onPlaybackChange?.({ playing, position: pos, provider: currentProviderInfo() });
		}, 8000);
	}

	function stopHostTick() {
		if (hostTick) {
			clearInterval(hostTick);
			hostTick = null;
		}
	}

	function startDriftTick() {
		stopDriftTick();
		driftTick = setInterval(() => {
			if (!iframeLoaded || !latestRemote) return;
			const rs = latestRemote;
			const target = hostTarget(rs);
			// The element's real position; null when it's silent (paused,
			// blocked, or still starting) — fall back to the last built
			// position, then the target itself.
			const current = elementPosition() ?? lastBuilt?.position ?? target;
			const gap = target - current;
			updateSyncState(current, target);
			if (Math.abs(gap) > SYNC_GAP_S) {
				// Watchdog: host moved away by more than the gap — apply the
				// host event again (a seek, or a play/pause flip). Idempotent:
				// an apply that lands closes the gap; a blocked element is
				// handled by the prompt, not more rebuilds.
				soakEvent(
					'drift',
					`check target=${target.toFixed(1)} current=${current.toFixed(1)} gap=${gap.toFixed(1)} -> correct`
				);
				applyHostState(rs);
			} else {
				soakEvent(
					'drift',
					`check target=${target.toFixed(1)} current=${current.toFixed(1)} gap=${gap.toFixed(1)} -> tolerated`
				);
			}
			soakUpdate({
				role: 'member',
				hostPos: target,
				memberPos: current,
				drift: Math.round(gap),
				status: lastSyncState.status,
				provider: currentProvider?.id ?? null,
				iframeLoaded: true,
				seq: rs.seq,
				lastAction: Math.abs(gap) > SYNC_GAP_S ? 'correct' : 'tolerated'
			});
			maybeShowTapPrompt();
		}, 5000);
	}

	function stopDriftTick() {
		if (driftTick) {
			clearInterval(driftTick);
			driftTick = null;
		}
	}

	$effect(() => {
		if (readOnly && iframeLoaded) {
			startDriftTick();
		}
		return stopDriftTick;
	});

	$effect(() => {
		if (!readOnly && iframeLoaded) {
			startHostTick();
		}
		return stopHostTick;
	});

	$effect(() => {
		const rs = remoteSync;
		const poke = syncPoke;
		if (!rs) return;
		if (rs.seq !== frameReceivedSeq) {
			frameReceivedSeq = rs.seq;
			frameReceivedAt = Date.now();
		}
		latestRemote = rs;
		if (rs.seq === remoteAppliedSeq && poke === remotePokedSeq) return;
		const isUserResync = poke !== remotePokedSeq;
		if (!iframeLoaded) {
			// Join: the very first frame should land on the host's target, not
			// on the base URL (position 0) followed by a rebuild. Building the
			// initial load with #t= + autoplay turns two sequential iframe
			// loads into one — the second load is what makes a joining member
			// sit on "Syncing to host..." for minutes on slow devices.
			// Exactly ONE build: gated on remoteAppliedSeq === -1 (nothing ever
			// applied yet), and the seq is marked BEFORE the build so frames
			// arriving while the iframe is still loading are dropped. A retry
			// here would replace the in-flight src and cancel the load — a
			// slow embed would then never complete loading and the member
			// would rebuild forever.
			if (
				remoteAppliedSeq === -1 &&
				readOnly &&
				currentProvider &&
				currentUrl &&
				!hasFullPlaybackControl
			) {
				if (rs.provider && rs.provider.id !== currentProvider.id) {
					switchToProviderId(rs.provider.id);
				}
				remoteAppliedSeq = rs.seq;
				remotePokedSeq = poke;
				requestBuild(hostTarget(rs), rs.playing);
			}
			return;
		}
		remoteAppliedSeq = rs.seq;
		remotePokedSeq = poke;
		applyHostState(rs, isUserResync);
	});

	function formatAirDate(iso: string | null) {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function toggleAutoplay() {
		autoplayNext = !autoplayNext;
		if (browser) {
			try {
				localStorage.setItem(AUTOPLAY_KEY, autoplayNext ? '1' : '0');
			} catch {}
		}
	}

	$effect(() => {
		if (browser) {
			try {
				const v = localStorage.getItem(AUTOPLAY_KEY);
				autoplayNext = v === null ? true : v === '1';
			} catch {}
		}
	});

	function stopAutoTick() {
		if (autoTick) {
			clearInterval(autoTick);
			autoTick = null;
		}
	}
	function stopUpNextTick() {
		if (upNextTick) {
			clearInterval(upNextTick);
			upNextTick = null;
		}
	}

	function syncAutoTick() {
		stopAutoTick();
		if (upNextVisible) return;
		if (!autoplayNext || !iframeLoaded || !runtime || runtime <= 0) return;
		if (!next || nextUnavailable || suppressedKey === currentKey) return;

		autoEndsAt = Date.now() + Math.max(1, Math.round(runtime * 60)) * 1000;
		autoTick = setInterval(() => {
			if (Date.now() >= autoEndsAt) {
				stopAutoTick();
				openUpNext();
			}
		}, 1000);
	}

	function openUpNext() {
		if (!nextReady || upNextVisible) return;
		upNextVisible = true;
		upNextLeft = 10;
		upNextEndsAt = Date.now() + 10_000;
		stopUpNextTick();
		upNextTick = setInterval(() => {
			upNextLeft = Math.max(0, Math.ceil((upNextEndsAt - Date.now()) / 1000));
			if (Date.now() >= upNextEndsAt) {
				stopUpNextTick();
				doAdvance();
			}
		}, 250);
	}

	function doAdvance() {
		stopUpNextTick();
		upNextVisible = false;
		onnext?.();
	}

	function cancelUpNext() {
		stopUpNextTick();
		upNextVisible = false;
		suppressedKey = currentKey;
	}

	function applyVolume() {
		if (ytPlayer && ytReady) {
			ytPlayer.setVolume(effectiveVolume);
			if (playerPreferences.muted) {
				ytPlayer.mute();
			} else {
				ytPlayer.unMute();
			}
		} else if (frameRef && iframeLoaded) {
			sendEmbedCommand(frameRef, 'setvolume', effectiveVolume);
			sendEmbedCommand(frameRef, playerPreferences.muted ? 'mute' : 'unmute');
		}
	}

	function togglePlay() {
		if (readOnly) return;
		if (ytPlayer && ytReady) {
			if (playing) {
				ytPlayer.pauseVideo();
			} else {
				ytPlayer.playVideo();
			}
			onPlaybackChange?.({
				playing: !playing,
				position: ytPlayer.getCurrentTime?.() ?? elapsedSeconds,
				provider: currentProviderInfo()
			});
		} else {
			playing = !playing;
			sendEmbedCommand(frameRef, playing ? 'play' : 'pause');
			onPlaybackChange?.({ playing, position: elapsedSeconds, provider: currentProviderInfo() });
		}
	}

	function seekBy(deltaSeconds: number) {
		if (readOnly) return;
		if (ytPlayer && ytReady) {
			const target = Math.max(0, (ytPlayer.getCurrentTime?.() ?? elapsedSeconds) + deltaSeconds);
			ytPlayer.seekTo(target, true);
			elapsedSeconds = target;
			onPlaybackChange?.({ playing, position: target, provider: currentProviderInfo() });
		} else {
			elapsedSeconds = Math.max(0, elapsedSeconds + deltaSeconds);
			sendEmbedCommand(frameRef, 'seekto', elapsedSeconds);
			onPlaybackChange?.({ playing, position: elapsedSeconds, provider: currentProviderInfo() });
		}
	}

	function toggleFullscreen() {
		if (!playerRoot || !browser) return;
		try {
			if (document.fullscreenElement) {
				document.exitFullscreen();
			} else {
				playerRoot.requestFullscreen();
			}
		} catch {}
	}

	function startElapsed() {
		stopElapsed();
		elapsedTick = setInterval(() => {
			if (iframeLoaded && !upNextVisible) elapsedSeconds += 1;
		}, 1000);
	}

	function stopElapsed() {
		if (elapsedTick) {
			clearInterval(elapsedTick);
			elapsedTick = null;
		}
	}

	$effect(() => {
		playerPreferences.init();
		function onKeyDown(event: KeyboardEvent) {
			const target = event.target as HTMLElement | null;
			const inPlayer = !!target?.closest?.('.player-root');
			if (!inPlayer) return;
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target instanceof HTMLSelectElement
			) {
				return;
			}
			if (event.ctrlKey || event.metaKey || event.altKey) return;
			switch (event.key.toLowerCase()) {
				case ' ':
				case 'k':
					event.preventDefault();
					togglePlay();
					break;
				case 'arrowleft':
					event.preventDefault();
					seekBy(-10);
					break;
				case 'arrowright':
					event.preventDefault();
					seekBy(10);
					break;
				case 'arrowup':
					event.preventDefault();
					playerPreferences.setVolume(effectiveVolume + 10);
					break;
				case 'arrowdown':
					event.preventDefault();
					playerPreferences.setVolume(effectiveVolume - 10);
					break;
				case 'm':
					event.preventDefault();
					playerPreferences.toggleMute();
					break;
				case 'f':
					event.preventDefault();
					toggleFullscreen();
					break;
				case 'n':
					event.preventDefault();
					if (next && !nextUnavailable) onnext?.();
					break;
				case 'escape':
					if (showServerList) showServerList = false;
					break;
			}
		}
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});

	$effect(() => {
		playerPreferences.init();
		if (!hasFullPlaybackControl) {
			try {
				ytPlayer?.destroy?.();
			} catch {}
			ytPlayer = null;
			ytReady = false;
			if (ytHost) ytHost.innerHTML = '';
			return;
		}
		if (!currentUrl) return;
		const videoId = extractYoutubeId(currentUrl);
		if (!videoId || !ytHost) return;
		loadYoutubeApi()
			.then(() => {
				if (!ytHost) return;
				ytPlayer = new (window as any).YT.Player(ytHost, {
					videoId,
					playerVars: { autoplay: 1, rel: 0, mute: 0, modestbranding: 1 },
					events: {
						onReady: () => {
							ytReady = true;
							playing = true;
							iframeLoaded = true;
							lastFrameLoadAt = Date.now();
							stopAutoSwitch();
							applyVolume();
							// The member's YT player just became controllable:
							// apply the latest host event (position + play state)
							// right away.
							if (latestRemote && latestRemote.seq !== remoteAppliedSeq) {
								applyHostState(latestRemote, true);
							}
						},
						onStateChange: (event: any) => {
							playing = event.data === 1 || event.data === 3;
							if (event.data === 1) hasStartedPlayback = true;
						},
						onError: () => {
							onIframeError();
						}
					}
				});
			})
			.catch(() => {
				onIframeError();
			});
	});

	$effect(() => {
		if (iframeLoaded && !upNextVisible) {
			startElapsed();
		}
		return stopElapsed;
	});

	$effect(() => {
		const dep = `${season}:${episode}:${iframeLoaded}:${autoplayNext}:${next?.season_number}:${next?.episode_number}:${runtime}:${nextUnavailable}`;
		void dep;
		if (suppressedKey && suppressedKey !== currentKey) suppressedKey = null;
		if (!autoplayNext) {
			stopUpNextTick();
			upNextVisible = false;
		}
		syncAutoTick();
	});

	async function scan() {
		if (preResolvedSource) {
			allProviders = [
				{
					id: 'youtube',
					name: 'YouTube',
					movieUrl: preResolvedSource,
					tvUrl: null,
					status: 'working'
				}
			];
			currentIndex = 0;
			isScanning = false;
			return;
		}

		isScanning = true;
		scanError = '';
		loadedProviders = new Set();
		iframeLoaded = false;
		hasError = false;
		embedEvent = null;
		lastBuilt = null;
		lastHostReported = -1;
		lastHostPost = 0;
		hasStartedPlayback = false;
		lastFrameLoadAt = 0;

		try {
			const params = new URLSearchParams({
				tmdbId: tmdbId.toString(),
				type: type,
				season: season.toString(),
				episode: episode.toString()
			});
			if (imdbId) params.set('imdbId', imdbId);
			const res = await fetch(`/api/providers/scan?${params}`);
			if (!res.ok) throw new Error('Scan failed');
			const data = await res.json();
			allProviders = data.all || [];

			if (workingProviders.length === 0) {
				scanError = 'No working providers found';
				isScanning = false;
				return;
			}

			currentIndex = 0;
			startAutoSwitch();
		} catch (e: any) {
			scanError = e.message || 'Scan failed';
		} finally {
			isScanning = false;
		}
	}

	function startAutoSwitch() {
		stopAutoSwitch();
		autoSwitchTimer = setTimeout(
			() => {
				if (!iframeLoaded && workingProviders.length > 1) {
					console.info(`[player] auto-switch: ${currentProvider?.id ?? 'none'} did not load in 9s`);
					isAutoSwitching = true;
					switchToNext();
					setTimeout(() => {
						isAutoSwitching = false;
						startAutoSwitch();
					}, 500);
				}
			},
			// 9s — mobile networks routinely take longer than 4s to load an
			// embed; switching too early churns providers and kills playback.
			9000
		);
	}

	function stopAutoSwitch() {
		if (autoSwitchTimer) {
			clearTimeout(autoSwitchTimer);
			autoSwitchTimer = null;
		}
	}

	function switchTo(index: number) {
		stopAutoSwitch();
		soakEvent(
			'provider',
			`switch->${workingProviders[index]?.id ?? index} iframeLoaded=${iframeLoaded}`
		);
		iframeLoaded = false;
		hasError = false;
		currentIndex = index;
		buildRequest = null;
		embedEvent = null;
		lastBuilt = null;
		lastHostReported = -1;
		lastHostPost = 0;
		hasStartedPlayback = false;
		lastFrameLoadAt = 0;
		syncingToHost = false;
		startAutoSwitch();
		if (!readOnly) {
			onPlaybackChange?.({ playing, position: hostPosition(), provider: currentProviderInfo() });
		}
	}

	function switchToNext() {
		const next = (currentIndex + 1) % workingProviders.length;
		if (next !== currentIndex) switchTo(next);
	}

	function onIframeLoad() {
		iframeLoaded = true;
		hasError = false;
		connectionLost = false;
		loadedProviders.add(currentProvider?.id || '');
		lastFrameLoadAt = Date.now();
		soakEvent(
			'iframe',
			`loaded provider=${currentProvider?.id ?? 'none'} builtFromReload=${builtByUs}`
		);
		soakUpdate({ iframeLoaded: true });
		stopAutoSwitch();
		syncingToHost = false;
		needsTapToContinue = false;
		lastHostReported = -1;
		lastHostPost = 0;
		// Replay: a host event that arrived while this iframe was mid-reload
		// (the SSE gate drops frames while !iframeLoaded) is un-applied — apply
		// it now. A load we built ourselves is normally already marked (the
		// SSE effect marks the seq before building), so applyHostState sees a
		// matching state and does nothing; a fresh join (builtByUs=false) gets
		// the snapshot force-apply.
		if (latestRemote && latestRemote.seq !== remoteAppliedSeq) {
			remoteAppliedSeq = latestRemote.seq;
			remotePokedSeq = syncPoke;
			applyHostState(latestRemote, !builtByUs);
		}
		maybeShowTapPrompt();
		setTimeout(() => {
			// The element never proved playback within 5s of load (silent or
			// autoplay-blocked) — show the tap prompt instead of rebuilding.
			if (!hasStartedPlayback) maybeShowTapPrompt();
		}, 5000);
	}

	function onIframeError() {
		// vidlink-class embeds fire iframe errors for INTERNAL navigations
		// (redirects, ad frames) — yanking the provider mid-playback was the
		// "randomly stops playing" bug. If this element ever proved real
		// playback, treat it as a connection drop: offer a manual reconnect
		// instead of silently switching away.
		const hadPlayback = hasStartedPlayback;
		console.warn(
			`[player] iframe error provider=${currentProvider?.id ?? 'none'} hadPlayback=${hadPlayback}`
		);
		soakEvent(
			'iframe-error',
			`provider=${currentProvider?.id ?? 'none'} hadPlayback=${hadPlayback}`
		);
		loadedProviders.delete(currentProvider?.id || '');
		if (hadPlayback) {
			connectionLost = true;
			iframeLoaded = false;
			soakUpdate({ iframeLoaded: false });
			return;
		}
		hasError = true;
		soakUpdate({ iframeLoaded: false });
		if (workingProviders.length > 1 && !isAutoSwitching) {
			isAutoSwitching = true;
			switchToNext();
			setTimeout(() => {
				isAutoSwitching = false;
				startAutoSwitch();
			}, 500);
		}
	}

	function reconnectCurrent() {
		console.info(`[player] reconnect requested provider=${currentProvider?.id ?? 'none'}`);
		connectionLost = false;
		const pos = embedEvent?.position ?? 0;
		iframeLoaded = false;
		hasError = false;
		hasStartedPlayback = false;
		lastFrameLoadAt = Date.now();
		if (pos > 0) {
			requestBuild(pos, true, 'reconnect');
		} else {
			// No known position — reload the same provider fresh.
			switchTo(currentIndex);
		}
	}

	function retry() {
		scan();
	}

	let lastScanKey = '';
	$effect(() => {
		const key = `${tmdbId}:${type}:${season}:${episode}`;
		if (tmdbId && key !== lastScanKey) {
			lastScanKey = key;
			scan();
		}
	});
	onDestroy(() => {
		stopAutoSwitch();
		stopAutoTick();
		stopUpNextTick();
		stopElapsed();
		stopDriftTick();
		stopHostTick();
		try {
			ytPlayer?.destroy?.();
		} catch {}
	});
</script>

<div class="player-root" bind:this={playerRoot}>
	<div class="iframe-container">
		{#if isScanning}
			<div class="overlay">
				<div class="spinner"></div>
				<p class="overlay-text">Scanning {allProviders.length || '25'} providers...</p>
			</div>
		{/if}

		{#if scanError && !isScanning}
			<div class="overlay">
				<svg
					class="error-icon"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
						x1="12"
						y1="16"
						x2="12.01"
						y2="16"
					/>
				</svg>
				<p class="overlay-text">{scanError}</p>
				<button onclick={retry} class="retry-btn">Retry Scan</button>
			</div>
		{/if}

		{#if connectionLost}
			<div class="overlay">
				<svg
					class="error-icon"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
						x1="12"
						y1="16"
						x2="12.01"
						y2="16"
					/>
				</svg>
				<p class="overlay-text">Connection lost</p>
				<p class="overlay-sub">The stream dropped. Pick up where you left off.</p>
				<button onclick={reconnectCurrent} class="retry-btn">Reconnect</button>
			</div>
		{/if}

		{#if !iframeLoaded && !isScanning && !scanError && currentProvider && !connectionLost}
			<div class="overlay loading-overlay">
				<div class="spinner"></div>
				<p class="overlay-text">Loading via {currentProvider.name}...</p>
				{#if syncingToHost}
					<p class="overlay-sub">Syncing to host...</p>
				{:else if isAutoSwitching}
					<p class="overlay-sub">Auto-switching to next provider...</p>
				{:else}
					<p class="overlay-sub overlay-late">Taking a while? Use the server list below.</p>
				{/if}
			</div>
		{/if}

		{#if currentUrl}
			{#if hasFullPlaybackControl}
				<div bind:this={ytHost} class="player-iframe yt-host"></div>
			{:else}
				<iframe
					bind:this={frameRef}
					src={frameSrc}
					class="player-iframe"
					allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
					referrerpolicy="origin"
					title={title || 'Video Player'}
					onload={onIframeLoad}
					onerror={onIframeError}
				></iframe>
			{/if}
		{/if}

		{#if needsTapToContinue}
			<div
				class="tap-overlay"
				onclick={tapToContinue}
				onkeydown={(e) => {
					if (e.key === ' ' || e.key === 'Enter') {
						e.preventDefault();
						tapToContinue();
					}
				}}
				role="button"
				tabindex="-1"
				aria-label="Tap to continue watching"
			>
				<div class="tap-card">
					<Play size={28} />
					<p class="tap-title">Tap to continue watching</p>
					<p class="tap-sub">Playback resumes in sync with the host</p>
				</div>
			</div>
		{/if}

		{#if upNextVisible && next && !nextUnavailable}
			<div class="upnext-overlay" role="dialog" aria-label="Up next">
				{#if upNextThumb}
					<img src={upNextThumb} alt="" class="upnext-bg" />
				{/if}
				<div class="upnext-shade"></div>
				<div class="upnext-body">
					<div class="upnext-text">
						<span class="upnext-kicker">Up Next</span>
						<span class="upnext-spec">S{next.season_number}:E{next.episode_number}</span>
						<span class="upnext-name">{next.name}</span>
					</div>
					<div class="upnext-actions">
						<button class="upnext-play" onclick={doAdvance}>Play Now</button>
						<button class="upnext-cancel" onclick={cancelUpNext}>Cancel</button>
					</div>
					<div class="upnext-ring" title="Auto-playing in {upNextLeft}s">
						<svg viewBox="0 0 48 48">
							<circle class="upnext-ring-bg" cx="24" cy="24" r="20"></circle>
							<circle
								class="upnext-ring-fg"
								cx="24"
								cy="24"
								r="20"
								style={`stroke-dashoffset: ${125.66 * (1 - upNextLeft / 10)}`}
							></circle>
						</svg>
						<span class="upnext-num">{upNextLeft}</span>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<div class="provider-bar">
		<div class="provider-bar-left">
			<span
				class="dot"
				class:dot-working={iframeLoaded}
				class:dot-loading={!iframeLoaded && !isScanning}
			></span>
			<span class="provider-name">{currentProvider?.name || ''}</span>
			{#if iframeLoaded}
				<span class="badge badge-working">Live</span>
			{/if}
		</div>
		<div class="provider-bar-right">
			{#if workingProviders.length > 0}
				<span class="count"
					>{workingProviders.length} server{workingProviders.length !== 1 ? 's' : ''}</span
				>
				{#if next}
					<button
						class="next-btn"
						class:next-btn-disabled={nextUnavailable}
						disabled={nextUnavailable}
						title={nextUnavailable
							? `${next.name} airs ${formatAirDate(next.air_date)}`
							: `Play ${next.name}`}
						onclick={() => onnext?.()}
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							class="next-icon"><path d="M5 3l14 9-14 9V3z" /></svg
						>
						Next <span class="next-spec">S{next.season_number}:E{next.episode_number}</span>
					</button>
				{/if}
				{#if type === 'tv'}
					<button
						class="auto-btn"
						class:auto-btn-on={autoplayNext}
						onclick={toggleAutoplay}
						title="Auto-play the next episode after this one finishes"
					>
						Auto-next <span class="auto-pill">{autoplayNext ? 'On' : 'Off'}</span>
					</button>
				{/if}
				<button
					onclick={() => (showServerList = !showServerList)}
					class="switch-btn"
					aria-label="Switch server"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="switch-icon"
					>
						<polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline
							points="7 23 3 19 7 15"
						/><path d="M21 13v2a4 4 0 0 1-4 4H3" />
					</svg>
					Switch
				</button>
			{/if}
		</div>
	</div>

	{#if showServerList}
		<div class="server-list">
			<div class="server-list-header">
				<span>Select Server</span>
				<button onclick={() => (showServerList = false)} class="close-btn" aria-label="Close"
					>&times;</button
				>
			</div>
			<div class="server-list-body">
				{#each allProviders as p, i}
					{@const isWorking = p.status !== 'dead'}
					{@const isLoaded = loadedProviders.has(p.id)}
					{@const isCurrent = workingProviders.indexOf(p) === currentIndex && isWorking}
					{#if isWorking}
						<button
							onclick={() => {
								const idx = workingProviders.indexOf(p);
								if (idx >= 0) {
									showServerList = false;
									switchTo(idx);
								}
							}}
							class="server-item"
							class:current={isCurrent}
							class:loaded={isLoaded}
						>
							<div class="server-item-left">
								<span class="item-dot" class:dot-working={isLoaded}></span>
								<span>{p.name}</span>
								{#if isCurrent}<span class="current-label">Current</span>{/if}
							</div>
							<span
								class="server-status"
								class:working={isLoaded}
								class:failing={!isLoaded && isCurrent && !isScanning}
							>
								{isLoaded ? '✓ Working' : isCurrent ? '⟳ Trying...' : 'Ready'}
							</span>
						</button>
					{/if}
				{/each}

				{#if deadProviders.length > 0}
					<div class="dead-section">
						<button
							onclick={(e) => {
								const el = e.currentTarget.nextElementSibling as HTMLElement;
								if (el) el.classList.toggle('hidden');
							}}
							class="dead-toggle"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								class="dead-chevron"><polyline points="6 9 12 15 18 9" /></svg
							>
							{deadProviders.length} dead
						</button>
						<div class="dead-list hidden">
							{#each deadProviders as p}
								<div class="dead-item">{p.name}</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
			<div class="server-list-footer">
				<button onclick={retry} class="rescan-btn">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="rescan-icon"
						><path d="M1 4v6h6M23 20v-6h-6" /><path
							d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"
						/></svg
					>
					Rescan All
				</button>
			</div>
		</div>
	{/if}
</div>

{#if import.meta.env.DEV}
	<div class="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
		<p class="mb-1 text-xs font-medium text-zinc-500">DEBUG</p>
		<p class="text-xs text-zinc-500">Provider: {currentProvider?.name || '-'}</p>
		<p class="text-xs text-zinc-500 truncate">URL: {currentUrl || '-'}</p>
		<p class="text-xs text-zinc-500">Loaded: {iframeLoaded ? 'Yes' : 'No'}</p>
		<p class="text-xs text-zinc-500">Working: {workingProviders.length} / {allProviders.length}</p>
	</div>
{/if}

<style>
	.player-root {
		display: flex;
		flex-direction: column;
		width: 100%;
		background: #0a0a0b;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid #1f1f23;
	}
	.iframe-container {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
	}
	.player-iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: none;
	}
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		background: rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(8px);
	}
	.loading-overlay {
		background: rgba(0, 0, 0, 0.75);
		pointer-events: none;
	}
	.spinner {
		width: 36px;
		height: 36px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: #818cf8;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.overlay-text {
		color: #d4d4d8;
		font-size: 14px;
		font-weight: 500;
	}
	.overlay-sub {
		color: #71717a;
		font-size: 12px;
	}
	/* Appears after ~10s so a stalled provider never looks frozen. */
	.overlay-late {
		opacity: 0;
		animation: overlay-late-in 0.4s ease 10s forwards;
	}
	@keyframes overlay-late-in {
		to {
			opacity: 1;
		}
	}
	.error-icon {
		width: 36px;
		height: 36px;
		color: #f87171;
	}
	.retry-btn {
		padding: 8px 20px;
		background: #27272a;
		color: #d4d4d8;
		border: 1px solid #3f3f46;
		border-radius: 8px;
		font-size: 13px;
		cursor: pointer;
	}
	.retry-btn:hover {
		background: #3f3f46;
	}

	.provider-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		background: #111113;
		border-top: 1px solid #1f1f23;
		gap: 12px;
		flex-wrap: wrap;
	}
	.provider-bar-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.provider-name {
		font-size: 13px;
		font-weight: 500;
		color: #e4e4e7;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.dot-working {
		background: #22c55e;
	}
	.dot-loading {
		background: #f59e0b;
		animation: pulse 1.5s ease-in-out infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}
	.badge {
		font-size: 10px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.badge-working {
		background: #064e3b;
		color: #6ee7b7;
	}
	.count {
		font-size: 11px;
		color: #71717a;
	}
	.next-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: #27272a;
		color: #d4d4d8;
		border: 1px solid #3f3f46;
		border-radius: 6px;
		font-size: 12px;
		cursor: pointer;
		min-height: 44px;
		box-sizing: border-box;
	}
	.next-btn:hover:not(:disabled) {
		background: #3f3f46;
	}
	.next-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.next-btn:active:not(:disabled) {
		background: #18181b;
	}
	.next-icon {
		width: 14px;
		height: 14px;
	}
	.next-spec {
		color: #818cf8;
		font-weight: 700;
	}
	.auto-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: #18181b;
		color: #71717a;
		border: 1px solid #27272a;
		border-radius: 6px;
		font-size: 12px;
		cursor: pointer;
		min-height: 44px;
		box-sizing: border-box;
	}
	.auto-btn:hover {
		color: #a1a1aa;
	}
	.auto-btn-on {
		color: #d4d4d8;
		background: #27272a;
		border-color: #3f3f46;
	}
	.auto-pill {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		color: #a1a1aa;
	}
	.auto-btn-on .auto-pill {
		color: #6ee7b7;
	}
	.switch-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: #27272a;
		color: #d4d4d8;
		border: 1px solid #3f3f46;
		border-radius: 6px;
		font-size: 12px;
		cursor: pointer;
		min-height: 44px;
		box-sizing: border-box;
	}
	.switch-btn:hover {
		background: #3f3f46;
	}
	.switch-icon {
		width: 14px;
		height: 14px;
	}

	.yt-host {
		overflow: hidden;
	}

	.tap-overlay {
		position: absolute;
		inset: 0;
		z-index: 25;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(4px);
		cursor: pointer;
	}
	.tap-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 28px 36px;
		background: rgba(17, 17, 19, 0.95);
		border: 1px solid #3f3f46;
		border-radius: 14px;
		color: #e4e4e7;
	}
	.tap-card :global(svg) {
		color: #818cf8;
	}
	.tap-title {
		font-size: 15px;
		font-weight: 600;
	}
	.tap-sub {
		font-size: 12px;
		color: #71717a;
	}

	.server-list {
		border-top: 1px solid #1f1f23;
		background: #0c0c0e;
		max-height: 360px;
		overflow-y: auto;
	}
	.server-list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px 10px;
		position: sticky;
		top: 0;
		background: #0c0c0e;
		border-bottom: 1px solid #1f1f23;
		font-size: 13px;
		font-weight: 600;
		color: #e4e4e7;
	}
	.close-btn {
		background: none;
		border: none;
		color: #71717a;
		font-size: 20px;
		cursor: pointer;
		padding: 4px;
		line-height: 1;
	}
	.close-btn:hover {
		color: #e4e4e7;
	}
	.server-list-body {
		padding: 6px;
	}
	.server-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 10px 12px;
		background: none;
		border: 1px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		text-align: left;
		color: #e4e4e7;
		font-size: 13px;
	}
	.server-item:hover {
		background: #18181b;
	}
	.server-item.current {
		border-color: #3f3f46;
		background: #18181b;
	}
	.server-item.loaded {
		border-color: #064e3b;
	}
	.server-item-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.item-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #3f3f46;
		flex-shrink: 0;
	}
	.dot-working {
		background: #22c55e;
	}
	.current-label {
		font-size: 10px;
		color: #818cf8;
		margin-left: 6px;
		font-weight: 600;
	}
	.server-status {
		font-size: 11px;
		font-weight: 500;
	}
	.server-status.working {
		color: #4ade80;
	}
	.server-status.failing {
		color: #fbbf24;
	}

	.dead-section {
		margin-top: 8px;
		padding: 0 6px;
	}
	.dead-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 8px 12px;
		background: none;
		border: none;
		color: #52525b;
		font-size: 12px;
		cursor: pointer;
	}
	.dead-toggle:hover {
		color: #a1a1aa;
	}
	.dead-chevron {
		width: 14px;
		height: 14px;
	}
	.dead-list.hidden {
		display: none;
	}
	.dead-item {
		padding: 6px 20px;
		font-size: 12px;
		color: #52525b;
	}

	.server-list-footer {
		padding: 10px 14px;
		border-top: 1px solid #1f1f23;
		position: sticky;
		bottom: 0;
		background: #0c0c0e;
	}
	.rescan-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 8px 16px;
		background: #18181b;
		color: #a1a1aa;
		border: 1px solid #27272a;
		border-radius: 8px;
		font-size: 13px;
		cursor: pointer;
	}
	.rescan-btn:hover {
		background: #27272a;
		color: #e4e4e7;
	}
	.rescan-icon {
		width: 16px;
		height: 16px;
	}

	.upnext-overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		background: #000;
		overflow: hidden;
	}
	.upnext-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.5;
	}
	.upnext-shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			rgba(0, 0, 0, 0.95) 0%,
			rgba(0, 0, 0, 0.6) 55%,
			rgba(0, 0, 0, 0.2) 100%
		);
	}
	.upnext-body {
		position: relative;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		padding: 24px;
		flex-wrap: wrap;
	}
	.upnext-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.upnext-kicker {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: #a78bfa;
	}
	.upnext-spec {
		font-size: 12px;
		font-weight: 600;
		color: #818cf8;
	}
	.upnext-name {
		font-size: 20px;
		font-weight: 700;
		color: #fff;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.upnext-actions {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}
	.upnext-play {
		padding: 10px 20px;
		background: #818cf8;
		color: #fff;
		border: none;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		min-height: 44px;
	}
	.upnext-play:hover {
		background: #6d7cf0;
	}
	.upnext-cancel {
		padding: 10px 20px;
		background: rgba(255, 255, 255, 0.08);
		color: #d4d4d8;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 10px;
		font-size: 14px;
		cursor: pointer;
		font-family: inherit;
		min-height: 44px;
	}
	.upnext-cancel:hover {
		background: rgba(255, 255, 255, 0.16);
	}
	.upnext-ring {
		position: absolute;
		top: 14px;
		right: 14px;
		width: 52px;
		height: 52px;
	}
	.upnext-ring svg {
		width: 100%;
		height: 100%;
		transform: scaleX(-1);
	}
	.upnext-ring-bg {
		fill: none;
		stroke: rgba(255, 255, 255, 0.2);
		stroke-width: 4;
	}
	.upnext-ring-fg {
		fill: none;
		stroke: #818cf8;
		stroke-width: 4;
		stroke-linecap: round;
		stroke-dasharray: 125.66;
		transform: rotate(-90deg);
		transform-origin: center;
		transition: stroke-dashoffset 1s linear;
	}
	.upnext-num {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		font-size: 14px;
		font-weight: 700;
	}
	@media (max-width: 560px) {
		.upnext-body {
			padding: 16px;
			align-items: flex-start;
		}
		.upnext-name {
			font-size: 16px;
		}
		.upnext-actions {
			width: 100%;
		}
		.upnext-ring {
			top: 12px;
			right: 12px;
			width: 44px;
			height: 44px;
		}
	}
</style>
