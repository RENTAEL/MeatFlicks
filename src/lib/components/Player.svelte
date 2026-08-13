<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { Play } from '@lucide/svelte';
	import { playerPreferences } from '$lib/state/stores/playerPreferences.svelte';
	import { sendEmbedCommand, extractYoutubeId, loadYoutubeApi } from '$lib/utils/embedCommands';

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
	let lastSyncReloadAt = 0;
	let syncReloadStreak = 0;
	let latestRemote: RemoteSync | null = null;
	let lastReload: { at: number; position: number; playing: boolean } | null = null;
	let embedBaselineDeficit: number | null = null;
	let lastHostReported = -1;
	let lastHostPost = 0;
	let hostTick: ReturnType<typeof setInterval> | null = null;
	let driftTick: ReturnType<typeof setInterval> | null = null;
	let isCoarse = $state(false);
	let lastSyncState: SyncStatus = { status: 'synced', drift: 0 };
	let reloadPending: { position: number; playing: boolean; at: number } | null = null;
	let frameBump = $state(0);
	let frameBuiltFromReload = false;

	$effect(() => {
		const base = currentUrl;
		void frameBump;
		const pending = reloadPending;
		if (pending) {
			reloadPending = null;
			const url = new URL(base);
			url.searchParams.set('autoplay', pending.playing ? 'true' : 'false');
			url.searchParams.set('_', String(pending.at));
			url.hash = '#t=' + Math.max(0, Math.round(pending.position));
			frameSrc = url.toString();
			frameBuiltFromReload = true;
		} else {
			frameSrc = base;
			frameBuiltFromReload = false;
		}
		syncReloadStreak = 0;
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

	function currentPosition(): number {
		if (ytPlayer && ytReady) return ytPlayer.getCurrentTime?.() ?? elapsedSeconds;
		if (embedEvent && Date.now() - embedEvent.at < 6000) return embedEvent.position;
		return elapsedSeconds;
	}

	// Host-side position estimate: extrapolates from the last known embed
	// state (even when PLAYER_EVENTs go stale), so reported positions stay
	// accurate through sparse event streams instead of falling back to the
	// timer-driven elapsedSeconds (which ignores pauses and reloads).
	function hostPosition(): number {
		if (ytPlayer && ytReady) return ytPlayer.getCurrentTime?.() ?? elapsedSeconds;
		if (embedEvent) {
			return embedEvent.position + (embedEvent.playing ? (Date.now() - embedEvent.at) / 1000 : 0);
		}
		if (lastReload) {
			return lastReload.position + (lastReload.playing ? (Date.now() - lastReload.at) / 1000 : 0);
		}
		return elapsedSeconds;
	}

	function embedPositionEstimate(): number {
		if (embedEvent && Date.now() - embedEvent.at < 6000) {
			// If we just reloaded (within 20s) and the embed is reporting a position
			// far from where we loaded (e.g. near 0 while #t= was 15), the embed
			// hasn't seeked yet — prefer the lastReload extrapolation to avoid a loop.
			if (lastReload && Date.now() - lastReload.at < 20000) {
				const reloadEst =
					lastReload.position + (lastReload.playing ? (Date.now() - lastReload.at) / 1000 : 0);
				if (Math.abs(embedEvent.position - lastReload.position) > 8) {
					return reloadEst;
				}
			}
			return embedEvent.position + (embedEvent.playing ? (Date.now() - embedEvent.at) / 1000 : 0);
		}
		if (lastReload) {
			return lastReload.position + (lastReload.playing ? (Date.now() - lastReload.at) / 1000 : 0);
		}
		return elapsedSeconds;
	}

	function targetOf(rs: RemoteSync): number {
		return Math.max(
			0,
			rs.playing ? rs.position + (Date.now() - rs.positionAt) / 1000 : rs.position
		);
	}

	// Once the embed is live and reporting fresh positions, a constant lag
	// (video started a few seconds behind the requested #t) is a fixed offset,
	// not a sync error we can fix by reloading — reloading only pays the cold
	// start deficit again. Only treat RATE divergence from the committed
	// baseline as a real desync. Returns true when a reload is warranted.
	function rateDiverged(target: number, current: number): boolean {
		const ev = embedEvent;
		const lr = lastReload;
		// embed silent (paused / still starting, no PLAYER_EVENTs): trust the
		// committed trajectory; reload only when the room genuinely moves away.
		if (!ev) {
			if (!lr || Date.now() - lr.at < 3000) return false;
			const def = target - current;
			if (embedBaselineDeficit === null) embedBaselineDeficit = def;
			const eff = def - embedBaselineDeficit;
			if (Math.abs(eff) > 2) {
				embedBaselineDeficit = null;
				return true;
			}
			embedBaselineDeficit = def;
			return false;
		}
		if (Date.now() - ev.at >= 6000) return Math.abs(target - current) > 2;
		// cold-start / structural-deficit check: embed far from its expected
		// trajectory (still seeking to the load point, or #t cold-start lag) —
		// outside the structural tolerance, fall back to raw gap.
		if (!lr) return Math.abs(target - current) > 2;
		const expected = lr.position + (lr.playing ? (Date.now() - lr.at) / 1000 : 0);
		if (Math.abs(ev.position - expected) > 12) return Math.abs(target - current) > 2;
		const def = target - current;
		if (embedBaselineDeficit === null) embedBaselineDeficit = def;
		const eff = def - embedBaselineDeficit;
		if (Math.abs(eff) > 2) {
			embedBaselineDeficit = null;
			return true;
		}
		embedBaselineDeficit = def;
		return false;
	}

	function setSyncState(status: SyncStatus) {
		lastSyncState = status;
		onSyncState?.(status);
	}

	function updateSyncState(current: number, target: number) {
		const drift = target - current;
		if (Math.abs(drift) <= 2) {
			setSyncState({ status: 'synced', drift: 0 });
			if (syncReloadStreak > 0) syncReloadStreak = 0;
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

	function reloadSync(position: number, playing: boolean, force = false): boolean {
		const now = Date.now();
		if (!force && (now - lastSyncReloadAt < 8000 || syncReloadStreak >= 3)) {
			const rs = latestRemote;
			updateSyncState(currentPosition(), rs ? targetOf(rs) : position);
			return false;
		}
		if (force && syncReloadStreak >= 3) syncReloadStreak = 0;
		lastSyncReloadAt = now;
		syncReloadStreak++;
		syncingToHost = true;
		needsTapToContinue = false;
		setSyncState({ status: 'syncing', drift: 0 });
		embedEvent = null;
		embedBaselineDeficit = null;
		lastReload = { at: now, position, playing };
		elapsedSeconds = position;
		reloadPending = { at: now, position, playing };
		iframeLoaded = false;
		frameBump++;
		return true;
	}

	function switchToRemoteProvider(rs: RemoteSync): boolean {
		const rp = rs.provider;
		if (!rp || !currentProvider) return false;
		if (currentProvider.id === rp.id) return false;
		const idx = workingProviders.findIndex((p) => p.id === rp.id || p.name === rp.name);
		if (idx < 0) return false;
		if (idx !== currentIndex) {
			switchTo(idx);
		}
		return true;
	}

	function applyPendingRemote() {
		const rs = latestRemote;
		if (!rs || rs.seq === remoteAppliedSeq) return;
		remoteAppliedSeq = rs.seq;
		remotePokedSeq = syncPoke;
		applyRemote(rs, true);
	}

	function applyRemote(rs: RemoteSync, forceReload = false) {
		if (switchToRemoteProvider(rs)) {
			if (!hasFullPlaybackControl) reloadSync(targetOf(rs), rs.playing, true);
			markSyncApplied(rs);
			return;
		}
		const target = targetOf(rs);
		const current = currentPosition();
		const needSeek = Math.abs(target - current) > 2;
		if (ytPlayer && ytReady) {
			if (needSeek) ytPlayer.seekTo(target, true);
			if (rs.playing) ytPlayer.playVideo();
			else ytPlayer.pauseVideo();
			playing = rs.playing;
			elapsedSeconds = target;
			updateSyncState(current, target);
			markSyncApplied(rs);
			return;
		}
		if (currentProvider?.id === 'vidlink') {
			const current = embedPositionEstimate();
			const needSeek = rateDiverged(target, current);
			// Only trust embedEvent play-state if the embed has actually reached the
			// expected position (i.e. not still cold-starting after a reload).
			const embedSettled =
				!lastReload ||
				Date.now() - lastReload.at >= 20000 ||
				(!!embedEvent && Math.abs(embedEvent.position - lastReload.position) <= 8);
			const embedFresh = !!embedEvent && Date.now() - embedEvent.at < 6000;
			const stateDiffers = embedFresh && embedSettled && embedEvent!.playing !== rs.playing;
			if (needSeek || stateDiffers || forceReload) {
				reloadSync(target, rs.playing, forceReload);
			}
			sendEmbedCommand(frameRef, rs.playing ? 'play' : 'pause');
			if (embedBaselineDeficit !== null) setSyncState({ status: 'synced', drift: 0 });
			else updateSyncState(current, target);
			markSyncApplied(rs);
			return;
		}
		if (needSeek) sendEmbedCommand(frameRef, 'seekto', target);
		sendEmbedCommand(frameRef, rs.playing ? 'play' : 'pause');
		playing = rs.playing;
		elapsedSeconds = target;
		updateSyncState(current, target);
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
		if (!readOnly || !isCoarse || !latestRemote?.playing) {
			needsTapToContinue = false;
			return;
		}
		const fresh = !!embedEvent && Date.now() - embedEvent.at < 15000;
		const isPlaying = embedEvent?.playing ?? false;
		needsTapToContinue = !fresh || !isPlaying;
	}

	function tapToContinue() {
		needsTapToContinue = false;
		if (!latestRemote) return;
		const target = targetOf(latestRemote);
		if (currentProvider?.id === 'vidlink') {
			reloadSync(target, true, true);
		} else if (ytPlayer && ytReady) {
			ytPlayer.playVideo();
		} else {
			sendEmbedCommand(frameRef, 'play');
		}
	}

	function startHostTick() {
		stopHostTick();
		hostTick = setInterval(() => {
			if (!iframeLoaded) return;
			const pos = hostPosition();
			if (Math.abs(pos - lastHostReported) < 1) return;
			lastHostReported = pos;
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
			const target = targetOf(latestRemote);
			const current = embedPositionEstimate();
			updateSyncState(current, target);
			if (Math.abs(target - current) > 2) {
				if (ytPlayer && ytReady) {
					ytPlayer.seekTo(target, true);
					if (latestRemote.playing) ytPlayer.playVideo();
					else ytPlayer.pauseVideo();
					elapsedSeconds = target;
				} else if (currentProvider?.id === 'vidlink') {
					if (rateDiverged(target, current)) {
						reloadSync(target, latestRemote.playing);
					} else {
						setSyncState({ status: 'synced', drift: 0 });
						if (syncReloadStreak > 0) syncReloadStreak = 0;
					}
				} else {
					sendEmbedCommand(frameRef, 'seekto', target);
					sendEmbedCommand(frameRef, latestRemote.playing ? 'play' : 'pause');
					elapsedSeconds = target;
				}
			} else if (currentProvider?.id === 'vidlink') {
				const embedSettled =
					!lastReload ||
					Date.now() - lastReload.at >= 20000 ||
					(!!embedEvent && Math.abs(embedEvent.position - lastReload.position) <= 8);
				const embedFresh = !!embedEvent && Date.now() - embedEvent.at < 6000;
				if (embedFresh && embedSettled && embedEvent!.playing !== latestRemote.playing) {
					reloadSync(target, latestRemote.playing);
				}
			}
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
		latestRemote = rs;
		if (rs.seq === remoteAppliedSeq && poke === remotePokedSeq) return;
		if (!iframeLoaded) return;
		const isUserResync = poke !== remotePokedSeq;
		remoteAppliedSeq = rs.seq;
		remotePokedSeq = poke;
		applyRemote(rs, isUserResync);
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
							stopAutoSwitch();
							applyVolume();
							if (latestRemote && latestRemote.seq !== remoteAppliedSeq) {
								applyPendingRemote();
							}
						},
						onStateChange: (event: any) => {
							playing = event.data === 1 || event.data === 3;
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
		syncReloadStreak = 0;
		embedEvent = null;
		lastReload = null;
		lastHostReported = -1;
		lastHostPost = 0;

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
		autoSwitchTimer = setTimeout(() => {
			if (!iframeLoaded && workingProviders.length > 1) {
				isAutoSwitching = true;
				switchToNext();
				setTimeout(() => {
					isAutoSwitching = false;
					startAutoSwitch();
				}, 500);
			}
		}, 4000);
	}

	function stopAutoSwitch() {
		if (autoSwitchTimer) {
			clearTimeout(autoSwitchTimer);
			autoSwitchTimer = null;
		}
	}

	function switchTo(index: number) {
		stopAutoSwitch();
		iframeLoaded = false;
		hasError = false;
		currentIndex = index;
		syncReloadStreak = 0;
		embedEvent = null;
		lastReload = null;
		lastHostReported = -1;
		lastHostPost = 0;
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
		loadedProviders.add(currentProvider?.id || '');
		stopAutoSwitch();
		remoteAppliedSeq = -1;
		syncingToHost = false;
		needsTapToContinue = false;
		lastHostReported = -1;
		lastHostPost = 0;
		if (latestRemote && latestRemote.seq !== remoteAppliedSeq && !frameBuiltFromReload) {
			applyPendingRemote();
		}
		frameBuiltFromReload = false;
		maybeShowTapPrompt();
	}

	function onIframeError() {
		hasError = true;
		loadedProviders.delete(currentProvider?.id || '');
		if (workingProviders.length > 1 && !isAutoSwitching) {
			isAutoSwitching = true;
			switchToNext();
			setTimeout(() => {
				isAutoSwitching = false;
				startAutoSwitch();
			}, 500);
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

		{#if !iframeLoaded && !isScanning && !scanError && currentProvider}
			<div class="overlay loading-overlay">
				<div class="spinner"></div>
				<p class="overlay-text">Loading via {currentProvider.name}...</p>
				{#if syncingToHost}
					<p class="overlay-sub">Syncing to host...</p>
				{:else if isAutoSwitching}
					<p class="overlay-sub">Auto-switching to next provider...</p>
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
