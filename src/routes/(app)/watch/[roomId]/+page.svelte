<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import Player from '$lib/components/Player.svelte';
	import {
		playSoundEffect,
		preloadSounds,
		SOUND_PRESETS,
		getSoundVolume,
		getSoundMuted,
		setSoundVolume,
		toggleSoundMute,
		unlockAudio,
		isSoundUnlocked
	} from '$lib/watch-party/sounds';
	import { randomKickMessage } from '$lib/watch-party/kickMessages';
	import { isSoak, soakEvent, soakUpdate } from '$lib/soak/soak';
	import SoakOverlay from '$lib/components/soak/SoakOverlay.svelte';
	import {
		Users,
		Trophy,
		Copy,
		Send,
		Sparkles,
		LogOut,
		Skull,
		MessageCircle,
		ListVideo,
		ChevronUp,
		ChevronDown,
		X,
		Play,
		Plus
	} from '@lucide/svelte';
	import type { RoomState, RoomQueueItem } from '$lib/server/watch-party/types';
	import { WATCH_PARTY_URL } from '$lib/config/watchParty';

	interface WatchData {
		roomId: string;
		user: { id: string; username: string };
		initialState: RoomState;
	}

	export let data: WatchData;

	const roomId = data.roomId;
	const user = data.user;

	let state: RoomState = data.initialState;
	// False until the first LIVE room frame lands (SSE stream / onopen
	// catch-up / refetch). The SSR snapshot alone is not a confirmed host
	// state — acting on it is the join-window race. Player holds all sync
	// actions until this flips.
	let stateConfirmed = false;
	let closed = false;
	let fxAllowed =
		data.initialState.isHost ||
		(data.initialState.participants.find((p) => p.userId === data.user.id)?.canControlSounds ??
			false);
	let messages: RoomState['messages'] = data.initialState.messages;
	let lastMessageId = data.initialState.lastMessageId;
	let lastSoundSeq = data.initialState.sound?.seq ?? 0;
	let chatInput = '';
	let copied = false;
	let error = '';
	let fxVolume = getSoundVolume();
	let fxMuted = getSoundMuted();
	let chatOpen = false;
	let kicked: { by: string; at: number } | null = null;
	let lastKickAt = 0;
	let kickMessage = '';
	let kickTimer: ReturnType<typeof setTimeout> | null = null;
	let refetchTimer: ReturnType<typeof setInterval> | null = null;

	let eventSource: EventSource | null = null;
	let streamOpened = false;

	interface QueueResult {
		tmdbId: number;
		title: string;
		mediaType: 'movie' | 'tv';
		year: string;
		posterPath: string | null;
	}
	let queueSearch = '';
	let queueResults: QueueResult[] = [];
	let queueOpen = false;
	let queueBusy = false;
	let queueSubmitting = false;
	let queueSearchTimer: ReturnType<typeof setTimeout> | null = null;

	function mergeMessages(next: RoomState['messages']) {
		if (next.length === 0) return;
		const byId = new Map(messages.map((m) => [m.id, m]));
		for (const m of next) {
			byId.set(m.id, m);
		}
		messages = [...byId.values()].sort((a, b) => a.id - b.id);
	}

	function handleKick(by: string, at: number) {
		if (at === lastKickAt) return;
		lastKickAt = at;
		soakEvent('kick', `by=${by} at=${at}`);
		kickMessage = randomKickMessage(by);
		kicked = { by, at };
		if (kickTimer) clearTimeout(kickTimer);
		kickTimer = setTimeout(() => {
			kickTimer = null;
			void goto('/watch-party');
		}, 7000);
	}

	function handleState(s: RoomState) {
		stateConfirmed = true;
		if (s.closed) {
			soakEvent('closed', 'room ended');
			closed = true;
			lastSoundSeq = s.sound?.seq ?? lastSoundSeq;
			return;
		}
		if (s.kicked) {
			handleKick(s.kicked.by, s.kicked.at);
		}
		// Drop frames older than what we already applied — a slow poll response
		// or out-of-order SSE replay must never regress playback/media state.
		if (state.playback.seq > 0 && s.playback.seq < state.playback.seq) return;
		if (s.playback.seq !== state.playback.seq || s.playback.playing !== state.playback.playing) {
			soakEvent(
				'playback',
				`seq=${s.playback.seq} playing=${s.playback.playing} pos=${s.playback.position.toFixed(1)}`
			);
		}
		if (s.media && state.media && s.media.tmdbId !== state.media.tmdbId) {
			soakEvent(
				'media',
				`switch -> "${s.media.title}" (tmdb=${s.media.tmdbId} ${s.media.mediaType}${
					s.media.season ? ` s${s.media.season}e${s.media.episode}` : ''
				}) seq=${s.playback.seq} provider=${s.playback.provider?.id ?? 'null'}`
			);
		}
		if (s.sound && s.sound.seq !== lastSoundSeq) {
			lastSoundSeq = s.sound.seq;
			playSoundEffect(s.sound.effect);
		}
		if (s.messages.length > 0) {
			mergeMessages(s.messages);
			lastMessageId = Math.max(lastMessageId, s.lastMessageId);
		}
		state = s;
		fxAllowed =
			s.isHost || (s.participants.find((p) => p.userId === user.id)?.canControlSounds ?? false);
	}

	function connectStream() {
		if (eventSource) eventSource.close();
		// Standalone backend: identity travels in the query (EventSource
		// cannot send headers).
		eventSource = new EventSource(
			`${WATCH_PARTY_URL}/api/watch-party/rooms/${roomId}/stream?u=${encodeURIComponent(user.id)}&n=${encodeURIComponent(user.username)}`
		);
		eventSource.addEventListener('state', (e) => {
			if (!e.data) return;
			try {
				handleState(JSON.parse(e.data));
			} catch {
				// ignore malformed frames
			}
		});
		eventSource.addEventListener('kick', (e) => {
			if (!e.data) return;
			try {
				const ev = JSON.parse(e.data) as { type: 'kick'; userId: string; by: string; at: number };
				if (ev.userId !== user.id) return;
				handleKick(ev.by, ev.at);
			} catch {
				// ignore malformed frames
			}
		});
		eventSource.onopen = () => {
			soakEvent('sse', streamOpened ? 'reconnect (open)' : 'open');
			streamOpened = true;
			api<RoomState>(`/watch-party/rooms/${roomId}?since=${lastMessageId}`).then((s) => {
				if (s) handleState(s);
			});
		};
		eventSource.onerror = () => {
			soakEvent('sse-error', 'connection error (EventSource auto-reconnect pending)');
			// EventSource reconnects automatically; onopen catches us up
		};
		let refetchInFlight = false;
		if (!refetchTimer) {
			refetchTimer = setInterval(() => {
				// Never pile up overlapping polls — a slow response must not
				// queue a burst of stale catch-ups behind it.
				if (refetchInFlight) return;
				refetchInFlight = true;
				api<RoomState>(`/watch-party/rooms/${roomId}?since=${lastMessageId}`)
					.then((s) => {
						if (s) handleState(s);
					})
					.finally(() => {
						refetchInFlight = false;
					});
			}, 15000);
		}
	}

	async function api<T = unknown>(path: string, init?: RequestInit): Promise<T | null> {
		try {
			// Standalone backend support: when PUBLIC_WATCH_PARTY_URL points at
			// the Cloudflare Worker, route calls there and carry identity in
			// the payload (the Worker is cookie-less).
			const useWorker = Boolean(WATCH_PARTY_URL);
			const base = useWorker ? `${WATCH_PARTY_URL}/api` : '/api';
			let url = `${base}${path}`;
			let body = init?.body;
			if (useWorker) {
				const sep = url.includes('?') ? '&' : '?';
				url += `${sep}u=${encodeURIComponent(user.id)}&n=${encodeURIComponent(user.username)}`;
				if (typeof body === 'string' && body) {
					try {
						const parsed = JSON.parse(body);
						body = JSON.stringify({ ...parsed, u: user.id, n: user.username });
					} catch {}
				}
			}
			const res = await fetch(url, {
				headers: { 'content-type': 'application/json' },
				...init,
				body
			});
			if (res.status === 401 || res.status === 403) {
				await goto(`/login?next=${encodeURIComponent(`/watch/${roomId}`)}`);
				return null;
			}
			if (!res.ok)
				throw new Error(
					(await res.json().catch(() => ({ message: 'Request failed' }))).message ??
						'Request failed'
				);
			error = '';
			return (await res.json()) as T;
		} catch (e) {
			if (e instanceof Error && e.name !== 'AbortError') {
				error = e.message || 'Something went wrong';
			}
			return null;
		}
	}

	onMount(async () => {
		const role = user.id === data.initialState.host.userId ? 'host' : 'member';
		soakUpdate({ role });
		soakEvent('join', `room=${roomId} role=${role}`);
		await api(`/watch-party/join`, { method: 'POST', body: JSON.stringify({ roomId }) });
		connectStream();
		preloadSounds();
		window.addEventListener('pointerdown', unlockSound, { once: true });
		window.addEventListener('keydown', unlockSound, { once: true });
		window.addEventListener('touchstart', unlockSound, { once: true });
	});

	onDestroy(() => {
		if (kickTimer) clearTimeout(kickTimer);
		if (refetchTimer) clearInterval(refetchTimer);
		if (queueSearchTimer) clearTimeout(queueSearchTimer);
		if (eventSource) eventSource.close();
		if (browser) {
			window.removeEventListener('pointerdown', unlockSound);
			window.removeEventListener('keydown', unlockSound);
			window.removeEventListener('touchstart', unlockSound);
		}
	});

	let soundUnlocked = isSoundUnlocked();

	function unlockSound() {
		unlockAudio();
		soundUnlocked = true;
	}

	let lastPlaybackSignal: {
		playing: boolean;
		position: number;
		provider: { id: string; name: string } | null;
	} | null = null;
	let syncPoke = 0;
	let memberSyncState: { status: 'synced' | 'drifted' | 'syncing'; drift: number } = {
		status: 'synced',
		drift: 0
	};

	function onMemberSyncState(s: { status: 'synced' | 'drifted' | 'syncing'; drift: number }) {
		memberSyncState = s;
	}

	function onPlaybackChange(signal: {
		playing: boolean;
		position: number;
		provider: { id: string; name: string } | null;
	}) {
		if (!state.isHost) return;
		const prev = lastPlaybackSignal;
		lastPlaybackSignal = signal;
		let action: 'play' | 'pause' | 'seek' = signal.playing ? 'play' : 'pause';
		if (prev && prev.playing === signal.playing) action = 'seek';
		soakEvent(
			'host-signal',
			`action=${action} pos=${signal.position.toFixed(1)} playing=${signal.playing}`
		);
		api(`/watch-party/rooms/${roomId}/playback`, {
			method: 'POST',
			body: JSON.stringify({ action, position: signal.position, provider: signal.provider ?? null })
		});
	}

	async function sendMessage() {
		const body = chatInput.trim();
		if (!body) return;
		chatInput = '';
		await api(`/watch-party/rooms/${roomId}/messages`, {
			method: 'POST',
			body: JSON.stringify({ body })
		});
	}

	async function deleteMessage(id: number) {
		await api(`/watch-party/rooms/${roomId}/messages/${id}/delete`, { method: 'POST' });
	}

	async function kickMember(userId: string) {
		const prevParticipants = state.participants;
		state = { ...state, participants: state.participants.filter((p) => p.userId !== userId) };
		const res = await api(`/watch-party/rooms/${roomId}/kick`, {
			method: 'POST',
			body: JSON.stringify({ userId })
		});
		if (!res) {
			state = { ...state, participants: prevParticipants };
		}
	}

	async function grantSoundControl(userId: string, granted: boolean) {
		await api(`/watch-party/rooms/${roomId}/sound-control`, {
			method: 'POST',
			body: JSON.stringify({ userId, granted })
		});
	}

	async function playSound(effect: string) {
		await api(`/watch-party/rooms/${roomId}/sound`, {
			method: 'POST',
			body: JSON.stringify({ effect })
		});
	}

	function onQueueSearchInput() {
		if (queueSearchTimer) clearTimeout(queueSearchTimer);
		queueSearchTimer = setTimeout(async () => {
			const q = queueSearch.trim();
			if (!q) {
				queueResults = [];
				queueOpen = false;
				return;
			}
			const res = await api<{ items: Array<Record<string, unknown>> }>(
				`/search?q=${encodeURIComponent(q)}&limit=6`
			);
			queueResults = (res?.items ?? [])
				.filter((i) => {
					const mt = i.mediaType === 'movie' || i.mediaType === 'tv' ? i.mediaType : null;
					return mt && typeof i.tmdbId === 'number' && typeof i.title === 'string';
				})
				.map((i) => ({
					tmdbId: i.tmdbId as number,
					title: i.title as string,
					mediaType: i.mediaType as 'movie' | 'tv',
					year: String(i.releaseDate ?? '').slice(0, 4),
					posterPath: (i.posterPath as string | null) ?? null
				}));
			queueOpen = queueResults.length > 0;
		}, 350);
	}

	async function addToQueue(item: QueueResult) {
		queueSubmitting = true;
		await api(`/watch-party/rooms/${roomId}/queue`, {
			method: 'POST',
			body: JSON.stringify({
				mediaType: item.mediaType,
				tmdbId: item.tmdbId,
				title: item.title,
				season: item.mediaType === 'tv' ? 1 : undefined,
				episode: item.mediaType === 'tv' ? 1 : undefined,
				provider: state.playback.provider
			})
		});
		queueSubmitting = false;
		queueSearch = '';
		queueResults = [];
		queueOpen = false;
		soakEvent('queue', `added ${item.mediaType} "${item.title}" (tmdb=${item.tmdbId})`);
	}

	async function removeQueueItem(item: RoomQueueItem) {
		await api(`/watch-party/rooms/${roomId}/queue/${item.id}`, { method: 'DELETE' });
		soakEvent('queue', `removed "${item.title}" (id=${item.id})`);
	}

	async function moveQueueItem(id: number, dir: -1 | 1) {
		const items = state.queue;
		const idx = items.findIndex((i) => i.id === id);
		const target = idx + dir;
		if (idx < 0 || target < 0 || target >= items.length) return;
		const next = [...items];
		[next[idx], next[target]] = [next[target], next[idx]];
		await api(`/watch-party/rooms/${roomId}/queue/reorder`, {
			method: 'POST',
			body: JSON.stringify({ orderedIds: next.map((i) => i.id) })
		});
		soakEvent('queue', `reordered "${items[idx].title}" ${dir === -1 ? 'up' : 'down'}`);
	}

	async function playNext() {
		if (state.queue.length === 0 || queueBusy) return;
		queueBusy = true;
		const res = await api<{ advanced: RoomQueueItem | null }>(
			`/watch-party/rooms/${roomId}/queue/advance`,
			{ method: 'POST' }
		);
		queueBusy = false;
		const advanced = res?.advanced;
		soakEvent(
			'queue',
			advanced
				? `advanced -> "${advanced.title}" (tmdb=${advanced.tmdbId} ${advanced.mediaType})`
				: 'advance: empty queue, no-op'
		);
	}

	async function leave() {
		soakEvent('leave', `room=${roomId}`);
		await api(`/watch-party/leave`, { method: 'POST', body: JSON.stringify({ roomId }) });
		await goto(data.initialState.media?.mediaType === 'tv' ? '/tv' : '/movies');
	}

	async function copyInvite() {
		const link = `${browser ? window.location.origin : ''}/watch/${roomId}`;
		try {
			await navigator.clipboard.writeText(link);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			error = 'Could not copy invite link';
		}
	}

	function timeAgo(ts: number) {
		const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
		if (secs < 5) return 'just now';
		if (secs < 60) return `${secs}s ago`;
		const mins = Math.round(secs / 60);
		if (mins < 60) return `${mins}m ago`;
		return `${Math.round(mins / 60)}h ago`;
	}
</script>

<svelte:head>
	<title>{state.media?.title ?? 'Watch Party'} · SyncWatch</title>
</svelte:head>

{#if closed}
	<div class="closed-wrap">
		<div class="closed-card">
			<Skull size={40} />
			<h1>This party has ended</h1>
			<p>The host closed the room or it went quiet.</p>
			<button onclick={() => goto('/movies')} class="primary-btn">Browse movies</button>
		</div>
	</div>
{/if}

<div class="watch-root">
	{#if kicked}
		<div class="kick-toast" role="status" aria-live="polite">
			<div class="kick-card">
				<span class="kick-icon"><Skull size={20} /></span>
				<div class="kick-text">
					<strong>You've been kicked from the party</strong>
					<span class="kick-msg">{kickMessage}</span>
				</div>
				<button
					class="kick-close"
					onclick={() => void goto('/watch-party')}
					aria-label="Close and return to lobby">&times;</button
				>
				<button class="kick-go" onclick={() => void goto('/watch-party')}>Return to lobby</button>
			</div>
		</div>
	{/if}

	<div class="player-col">
		<div class="room-head">
			<div>
				<h1 class="room-title">{state.media?.title ?? 'Watch Party'}</h1>
				{#if state.media?.mediaType === 'tv'}
					<p class="room-sub">Season {state.media?.season} · Episode {state.media?.episode}</p>
				{/if}
				{#if state.queue.length > 0}
					<p class="upnext-chip">
						<ListVideo size={13} /> Up next: {state.queue[0].title}
					</p>
				{/if}
			</div>
			<div class="room-code-wrap">
				<span class="room-code-label">Room</span>
				<button class="room-code" onclick={copyInvite} title="Copy invite link">
					{roomId}
					<Copy size={14} />
				</button>
				<span class="room-copied">{copied ? 'Copied!' : ''}</span>
			</div>
		</div>

		{#if !soundUnlocked}
			<div class="sound-hint" role="status">Click anywhere to enable sound effects</div>
		{/if}

		{#if state.media && !kicked}
			<Player
				tmdbId={state.media.tmdbId}
				type={state.media.mediaType}
				season={state.media.season ?? 1}
				episode={state.media.episode ?? 1}
				title={state.media.title}
				readOnly={!state.isHost}
				remoteSync={state.isHost ? null : state.playback}
				remoteConfirmed={stateConfirmed}
				{syncPoke}
				{onPlaybackChange}
				onSyncState={onMemberSyncState}
			/>
		{:else}
			<div class="no-media">Nothing is playing yet.</div>
		{/if}

		{#if !state.isHost}
			<div class="sync-row">
				<button
					class="sync-btn"
					onclick={() => syncPoke++}
					title="Jump back to the host's playback position"
				>
					Sync to host
				</button>
				<span
					class="sync-status"
					class:sync-ok={memberSyncState.status === 'synced'}
					class:sync-bad={memberSyncState.status === 'drifted'}
					class:sync-syncing={memberSyncState.status === 'syncing'}
				>
					{#if memberSyncState.status === 'synced'}
						Synced to host
					{:else if memberSyncState.status === 'syncing'}
						Syncing to host...
					{:else}
						Out of sync ({memberSyncState.drift}s)
					{/if}
				</span>
			</div>
		{/if}

		{#if error}
			<p class="err">{error}</p>
		{/if}
	</div>

	<div class="side-col">
		<div class="panel members-panel">
			<div class="panel-head">
				<span class="panel-title"><Users size={16} /> Whisperers in the room</span>
			</div>
			<div class="member-list">
				{#each state.participants as p, i (p.userId)}
					<div class="member-row" class:is-me={p.userId === user.id}>
						<span class="member-avatar">{p.username.slice(0, 1).toUpperCase()}</span>
						<span class="member-name">
							{p.username}
							{#if p.userId === state.host.userId}
								<Trophy size={12} style="color:#f59e0b" />
							{/if}
							{#if p.userId === user.id}
								<span class="me-tag">you</span>
							{/if}
						</span>
						{#if state.isHost && p.userId !== user.id}
							<button
								class="grant-btn"
								class:granted={p.canControlSounds}
								onclick={() => grantSoundControl(p.userId, !p.canControlSounds)}
								title={p.canControlSounds ? 'Revoke sound control' : 'Grant sound control'}
							>
								{p.canControlSounds ? 'Sound: On' : 'Sound: Off'}
							</button>
							<button class="kick-btn" onclick={() => kickMember(p.userId)} title="Remove from room"
								>kick</button
							>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="panel queue-panel">
			<div class="panel-head">
				<span class="panel-title"><ListVideo size={16} /> Next up</span>
				{#if state.queue.length > 0}
					<span class="queue-count">{state.queue.length}</span>
				{/if}
			</div>

			{#if state.isHost}
				<div class="queue-search">
					<input
						class="queue-search-input"
						type="text"
						bind:value={queueSearch}
						oninput={onQueueSearchInput}
						onblur={() => setTimeout(() => (queueOpen = false), 200)}
						placeholder="Search movies & TV to add…"
						aria-label="Search movies and TV shows to add to the queue"
					/>
					{#if queueOpen}
						<div class="queue-results" role="listbox">
							{#each queueResults as r, i (r.tmdbId + '-' + r.mediaType)}
								<button
									type="button"
									class="queue-result"
									role="option"
									aria-selected="false"
									disabled={queueSubmitting}
									onclick={() => addToQueue(r)}
								>
									{#if r.posterPath}
										<img class="queue-thumb" src={r.posterPath} alt="" loading="lazy" />
									{:else}
										<span class="queue-thumb queue-thumb-empty"><Trophy size={12} /></span>
									{/if}
									<span class="queue-result-text">
										<span class="queue-result-title">{r.title}</span>
										<span class="queue-result-meta"
											>{r.mediaType === 'movie' ? 'Movie' : 'TV series'} · {r.year}{r.mediaType ===
											'tv'
												? ' · starts S01 E01'
												: ''}</span
										>
									</span>
									<Plus size={14} />
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<div class="queue-list">
				{#if state.queue.length === 0}
					<p class="queue-empty">
						{state.isHost
							? 'Nothing queued yet. Search above to add movies or TV.'
							: "The host hasn't queued anything yet."}
					</p>
				{/if}
				{#each state.queue as item, i (item.id)}
					<div class="queue-item" class:first={i === 0}>
						<span class="queue-pos">{i + 1}</span>
						<span class="queue-item-text">
							<span class="queue-item-title">{item.title}</span>
							<span class="queue-item-meta">
								{item.mediaType === 'movie'
									? 'Movie'
									: `TV · S${item.season ?? 1} E${item.episode ?? 1}`}
								{#if i === 0}
									<span class="queue-next-tag">up next</span>
								{/if}
							</span>
						</span>
						{#if state.isHost}
							<span class="queue-actions">
								<button
									class="queue-act"
									disabled={i === 0}
									onclick={() => moveQueueItem(item.id, -1)}
									title="Move up"
									aria-label="Move up"><ChevronUp size={14} /></button
								>
								<button
									class="queue-act"
									disabled={i === state.queue.length - 1}
									onclick={() => moveQueueItem(item.id, 1)}
									title="Move down"
									aria-label="Move down"><ChevronDown size={14} /></button
								>
								<button
									class="queue-act queue-act-del"
									onclick={() => removeQueueItem(item)}
									title="Remove"
									aria-label="Remove"><X size={14} /></button
								>
							</span>
						{/if}
					</div>
				{/each}
			</div>

			{#if state.isHost}
				<div class="queue-play-row">
					<button
						class="queue-play-btn"
						disabled={state.queue.length === 0 || queueBusy}
						onclick={playNext}
						title={state.queue.length === 0
							? 'The queue is empty'
							: 'Stop the current movie and play the next one'}
					>
						<Play size={14} />
						Play next{state.queue.length > 0 ? `: ${state.queue[0].title.slice(0, 28)}` : ''}
					</button>
				</div>
			{/if}
		</div>

		<div class="panel fx-panel">
			<div class="panel-head">
				<span class="panel-title"><Sparkles size={16} /> Sound effects</span>
			</div>
			<div class="fx-row">
				{#each SOUND_PRESETS as preset}
					{@const allowed = fxAllowed}
					<button
						class="fx-btn"
						disabled={!allowed}
						onclick={() => playSound(preset.id)}
						title={allowed ? preset.description : "Host hasn't granted you sound control"}
					>
						{preset.label}
					</button>
				{/each}
			</div>
			{#if !fxAllowed}
				<p class="fx-hint">The host hasn't granted you sound control yet.</p>
			{/if}
			<div class="fx-ctrl-row">
				<button
					class="fx-mute"
					onclick={() => (fxMuted = toggleSoundMute())}
					aria-label={fxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
					title={fxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
				>
					{fxMuted ? '🔇' : '🔊'}
				</button>
				<input
					class="fx-slider"
					type="range"
					min="0"
					max="100"
					value={Math.round(fxVolume * 100)}
					oninput={(e) => {
						const v = Number((e.currentTarget as HTMLInputElement).value) / 100;
						fxVolume = v;
						setSoundVolume(v);
					}}
					aria-label="Sound effect volume"
					title="Sound effect volume"
				/>
			</div>
		</div>

		<div class="panel chat-panel">
			<div class="panel-head">
				<span class="panel-title">Room chat</span>
			</div>
			<div class="msg-list">
				{#if messages.length === 0}
					<p class="msg-empty">No messages yet. Say hi!</p>
				{/if}
				{#each messages as m, i (m.id)}
					<div class="msg-row" class:own={m.userId === user.id} class:deleted={m.deleted}>
						<span class="msg-who">
							{m.deleted ? '—' : m.username}
							{#if m.deleted}
								<span class="msg-del-tag">deleted</span>
							{/if}
							<span class="msg-time">{timeAgo(m.createdAt)}</span>
						</span>
						<span class="msg-body">{m.deleted ? '' : m.body}</span>
						{#if m.deleted === false && state.isHost && m.userId !== user.id}
							<button class="del-btn" onclick={() => deleteMessage(m.id)} title="Delete message"
								>×</button
							>
						{/if}
					</div>
				{/each}
				{#if messages.length === 0}
					<div></div>
				{/if}
			</div>
			<form
				class="chat-form"
				onsubmit={(e) => {
					e.preventDefault();
					sendMessage();
				}}
			>
				<input
					class="chat-input"
					bind:value={chatInput}
					placeholder="Say something…"
					maxlength="240"
					aria-label="Chat message"
				/>
				<button class="send-btn" type="submit" aria-label="Send message"><Send size={16} /></button>
			</form>
		</div>

		<div class="leave-row">
			<button class="leave-btn" onclick={leave}>
				<LogOut size={14} /> Leave party
			</button>
		</div>
	</div>
</div>

{#if chatOpen}
	<div
		class="mobile-chat-backdrop"
		role="dialog"
		aria-modal="true"
		aria-label="Room chat"
		tabindex="-1"
		onclick={() => (chatOpen = false)}
	>
		<div class="mobile-chat-sheet" onclick={(e) => e.stopPropagation()}>
			<div class="mobile-chat-head">
				<span class="mobile-chat-title">Room chat</span>
				<button class="mobile-close" onclick={() => (chatOpen = false)} aria-label="Close chat"
					>×</button
				>
			</div>
			<div class="mobile-member-list">
				{#each state.participants as p, i (p.userId)}
					<span class="mobile-member-chip" class:is-me={p.userId === user.id}>
						{p.username.slice(0, 1).toUpperCase()}
						{p.username}
					</span>
				{/each}
			</div>
			<div class="msg-list mobile-msg-list">
				{#if messages.length === 0}
					<p class="msg-empty">No messages yet. Say hi!</p>
				{/if}
				{#each messages as m, i (m.id)}
					<div class="msg-row" class:own={m.userId === user.id} class:deleted={m.deleted}>
						<span class="msg-who">
							{m.deleted ? '—' : m.username}
							{#if m.deleted}
								<span class="msg-del-tag">deleted</span>
							{/if}
							<span class="msg-time">{timeAgo(m.createdAt)}</span>
						</span>
						<span class="msg-body">{m.deleted ? '' : m.body}</span>
					</div>
				{/each}
			</div>
			<form
				class="chat-form"
				onsubmit={(e) => {
					e.preventDefault();
					sendMessage();
				}}
			>
				<input
					class="chat-input"
					bind:value={chatInput}
					placeholder="Say something…"
					maxlength="240"
					aria-label="Chat message"
				/>
				<button class="send-btn" type="submit" aria-label="Send message"><Send size={16} /></button>
			</form>
		</div>
	</div>
{/if}

<button class="chat-fab" onclick={() => (chatOpen = true)} aria-label="Open room chat">
	<MessageCircle size={22} />
</button>

{#if isSoak()}
	<SoakOverlay />
{/if}

<style>
	.watch-root {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		gap: 20px;
		padding: 24px;
		max-width: 1400px;
		margin: 0 auto;
	}
	@media (max-width: 900px) {
		.watch-root {
			grid-template-columns: 1fr;
		}
	}

	.room-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 16px;
		margin-top: 8px;
	}
	.room-title {
		font-size: 22px;
		font-weight: 700;
		color: #f4f4f5;
		margin: 0;
	}
	.room-sub {
		color: #71717a;
		font-size: 13px;
		margin-top: 4px;
	}
	.room-code-wrap {
		display: flex;
		align-items: center;
		flex-direction: column;
		gap: 4px;
	}
	.room-code-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 1px;
		color: #52525b;
	}
	.room-code {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 14px;
		font-weight: 700;
		color: #c4b5fd;
		background: #18181b;
		border: 1px solid #3f3f46;
		padding: 6px 12px;
		border-radius: 8px;
		cursor: pointer;
		letter-spacing: 1px;
	}
	.room-code:hover {
		border-color: #52525b;
	}
	.room-copied {
		font-size: 11px;
		color: #6ee7b7;
		min-height: 14px;
	}
	.sound-hint {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		margin-bottom: 14px;
		background: rgba(124, 92, 252, 0.12);
		border: 1px solid rgba(124, 92, 252, 0.35);
		color: #c4b5fd;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		animation: sound-hint-in 0.3s ease;
	}
	@keyframes sound-hint-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.panel {
		background: #111113;
		border: 1px solid #1f1f23;
		border-radius: 12px;
		overflow: hidden;
	}
	.panel-head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 14px;
		border-bottom: 1px solid #1f1f23;
	}
	.panel-title {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		color: #e4e4e7;
	}

	.side-col {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.member-list {
		max-height: 200px;
		overflow-y: auto;
		padding: 6px;
	}
	.member-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		border-radius: 8px;
	}
	.member-row:hover {
		background: #18181b;
	}
	.member-avatar {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: #27272a;
		color: #c4b5fd;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 700;
		flex-shrink: 0;
	}
	.member-name {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: #d4d4d8;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.grant-btn {
		background: #18181b;
		color: #a1a1aa;
		border: 1px solid #3f3f46;
		border-radius: 6px;
		font-size: 11px;
		padding: 3px 8px;
		cursor: pointer;
	}
	.grant-btn:hover {
		background: #3f3f46;
	}
	.grant-btn.granted {
		color: #6ee7b7;
		border-color: #065f46;
		background: #022c22;
	}
	.kick-btn {
		background: #18181b;
		color: #f87171;
		border: 1px solid #3f3f46;
		border-radius: 6px;
		font-size: 11px;
		padding: 3px 8px;
		cursor: pointer;
	}
	.kick-btn:hover {
		background: #3f3f46;
	}

	.upnext-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		font-size: 12px;
		color: #a5b4fc;
		background: rgba(124, 92, 252, 0.1);
		border: 1px solid rgba(124, 92, 252, 0.25);
		padding: 4px 10px;
		border-radius: 999px;
	}

	.queue-count {
		margin-left: auto;
		font-size: 11px;
		color: #a1a1aa;
		background: #18181b;
		border: 1px solid #3f3f46;
		border-radius: 999px;
		padding: 1px 8px;
	}

	.queue-search {
		position: relative;
		padding: 10px 14px 4px;
	}
	.queue-search-input {
		width: 100%;
		padding: 8px 12px;
		background: #18181b;
		border: 1px solid #3f3f46;
		border-radius: 8px;
		color: #f4f4f5;
		font-size: 13px;
		outline: none;
	}
	.queue-search-input:focus {
		border-color: #818cf8;
	}
	.queue-results {
		position: absolute;
		left: 14px;
		right: 14px;
		top: 48px;
		z-index: 30;
		background: #161618;
		border: 1px solid #27272a;
		border-radius: 10px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
		overflow: hidden;
	}
	.queue-result {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		background: none;
		border: none;
		color: #e4e4e7;
		cursor: pointer;
		text-align: left;
		font-size: 13px;
	}
	.queue-result:hover {
		background: #1f1f23;
	}
	.queue-result:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.queue-thumb {
		width: 34px;
		height: 48px;
		object-fit: cover;
		border-radius: 6px;
		background: #27272a;
		flex-shrink: 0;
	}
	.queue-thumb-empty {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #52525b;
	}
	.queue-result-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		flex: 1;
	}
	.queue-result-title {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.queue-result-meta {
		font-size: 11px;
		color: #71717a;
	}

	.queue-list {
		display: flex;
		flex-direction: column;
		padding: 6px;
		max-height: 240px;
		overflow-y: auto;
	}
	.queue-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		border-radius: 8px;
	}
	.queue-item:hover {
		background: #18181b;
	}
	.queue-pos {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: #18181b;
		border: 1px solid #3f3f46;
		color: #a1a1aa;
		font-size: 11px;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.queue-item.first .queue-pos {
		background: #4c1d95;
		border-color: #7c3aed;
		color: #e9d5ff;
	}
	.queue-item-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		flex: 1;
	}
	.queue-item-title {
		font-size: 13px;
		font-weight: 600;
		color: #e4e4e7;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.queue-item-meta {
		font-size: 11px;
		color: #71717a;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.queue-next-tag {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		color: #c4b5fd;
		background: rgba(124, 92, 252, 0.12);
		border: 1px solid rgba(124, 92, 252, 0.3);
		border-radius: 999px;
		padding: 1px 6px;
	}
	.queue-actions {
		display: inline-flex;
		gap: 2px;
		flex-shrink: 0;
	}
	.queue-act {
		width: 24px;
		height: 24px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #18181b;
		color: #a1a1aa;
		border: 1px solid #3f3f46;
		border-radius: 6px;
		cursor: pointer;
	}
	.queue-act:hover:not(:disabled) {
		background: #27272a;
		color: #f4f4f5;
	}
	.queue-act:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	.queue-act-del:hover:not(:disabled) {
		color: #f87171;
		border-color: #7f1d1d;
	}
	.queue-empty {
		color: #52525b;
		font-size: 12px;
		padding: 10px 12px;
		text-align: center;
	}
	.queue-play-row {
		padding: 8px 14px 12px;
	}
	.queue-play-btn {
		width: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 9px 12px;
		background: #7c3aed;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.queue-play-btn:hover:not(:disabled) {
		background: #6d28d9;
	}
	.queue-play-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.fx-row {
		display: flex;
		gap: 8px;
		padding: 12px 14px;
		flex-wrap: wrap;
	}
	.fx-btn {
		flex: 1;
		min-width: 100px;
		padding: 8px 10px;
		background: #18181b;
		color: #d4d4d8;
		border: 1px solid #3f3f46;
		border-radius: 8px;
		font-size: 12px;
		cursor: pointer;
	}
	.fx-btn:hover {
		background: #27272a;
		border-color: #52525b;
	}
	.fx-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.fx-btn:disabled:hover {
		background: #18181b;
		border-color: #3f3f46;
	}
	.fx-hint {
		padding: 0 14px 10px;
		font-size: 11px;
		color: #71717a;
	}

	.fx-ctrl-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-top: 1px solid #1f1f23;
	}
	.fx-mute {
		background: none;
		border: none;
		font-size: 15px;
		cursor: pointer;
		padding: 2px;
	}
	.fx-slider {
		flex: 1;
		accent-color: #818cf8;
	}

	.chat-panel {
		display: flex;
		flex-direction: column;
		height: 320px;
	}
	.msg-list {
		flex: 1;
		overflow-y: auto;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.msg-row {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 6px 8px;
		border-radius: 8px;
		position: relative;
		flex-direction: column;
	}
	.msg-row:hover {
		background: #18181b;
	}
	.msg-row.deleted .msg-body {
		color: #52525b;
		font-style: italic;
	}
	.msg-who {
		font-size: 12px;
		font-weight: 600;
		color: #818cf8;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.msg-time {
		font-weight: 400;
		color: #52525b;
		font-size: 11px;
	}
	.msg-body {
		font-size: 13px;
		color: #e4e4e7;
	}
	.msg-del-tag {
		font-size: 10px;
		color: #52525b;
		text-transform: uppercase;
		letter-spacing: 0.4px;
	}
	.del-btn {
		position: absolute;
		right: 8px;
		top: 6px;
		background: none;
		border: none;
		color: #52525b;
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
	}
	.del-btn:hover {
		color: #f87171;
	}
	.msg-empty {
		color: #52525b;
		font-size: 12px;
		padding: 12px;
		text-align: center;
	}

	.chat-form {
		display: flex;
		gap: 8px;
		padding: 10px;
		border-top: 1px solid #1f1f23;
	}
	.chat-input {
		flex: 1;
		padding: 8px 12px;
		background: #18181b;
		border: 1px solid #3f3f46;
		border-radius: 8px;
		color: #f4f4f5;
		font-size: 13px;
		outline: none;
		min-height: 40px;
	}
	.chat-input:focus {
		border-color: #818cf8;
	}
	.send-btn {
		width: 40px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: #818cf8;
		color: #fff;
		border: none;
		border-radius: 8px;
		cursor: pointer;
	}
	.send-btn:hover {
		background: #6d7cf0;
	}

	.leave-row {
		padding: 4px 0;
	}
	.leave-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		background: #18181b;
		color: #a1a1aa;
		border: 1px solid #3f3f46;
		border-radius: 8px;
		font-size: 13px;
		cursor: pointer;
	}
	.leave-btn:hover {
		color: #f87171;
		border-color: #f87171;
	}

	.err {
		color: #f87171;
		font-size: 13px;
		margin-top: 10px;
	}

	.closed-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		padding: 24px;
	}
	.closed-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		text-align: center;
		color: #e4e4e7;
		max-width: 360px;
	}
	.closed-card h1 {
		font-size: 20px;
		margin: 8px 0 0;
	}
	.closed-card p {
		color: #71717a;
		font-size: 13px;
		margin: 0;
	}
	.primary-btn {
		margin-top: 12px;
		padding: 10px 20px;
		background: #818cf8;
		color: #fff;
		border: none;
		border-radius: 10px;
		font-weight: 600;
		cursor: pointer;
	}

	.no-media {
		color: #71717a;
		padding: 40px;
		text-align: center;
	}

	.sync-row {
		margin-top: 10px;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.sync-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 7px 14px;
		background: #18181b;
		color: #c4b5fd;
		border: 1px solid #3f3f46;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.sync-btn:hover {
		background: #27272a;
		border-color: #818cf8;
	}
	.sync-status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 10px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
	}
	.sync-status::before {
		content: '';
		width: 7px;
		height: 7px;
		border-radius: 50%;
	}
	.sync-ok {
		background: rgba(34, 197, 94, 0.12);
		color: #4ade80;
	}
	.sync-ok::before {
		background: #22c55e;
	}
	.sync-bad {
		background: rgba(251, 191, 36, 0.12);
		color: #fbbf24;
	}
	.sync-bad::before {
		background: #f59e0b;
	}
	.sync-syncing {
		background: rgba(129, 140, 248, 0.12);
		color: #a5b4fc;
	}
	.sync-syncing::before {
		background: #818cf8;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.kick-toast {
		position: fixed;
		top: 16px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 70;
		width: min(92vw, 480px);
	}
	.kick-card {
		display: flex;
		align-items: center;
		gap: 12px;
		background: #18181b;
		border: 1px solid #3f3f46;
		border-radius: 14px;
		padding: 14px 16px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
		animation: kick-in 0.35s cubic-bezier(0.21, 1.02, 0.73, 1);
	}
	@keyframes kick-in {
		from {
			opacity: 0;
			transform: translateY(-16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.kick-card {
			animation: none;
		}
	}
	.kick-icon {
		color: #f87171;
		flex-shrink: 0;
		display: inline-flex;
	}
	.kick-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}
	.kick-text strong {
		font-size: 14px;
		color: #f4f4f5;
	}
	.kick-msg {
		font-size: 12.5px;
		color: #a1a1aa;
	}
	.kick-close {
		background: none;
		border: none;
		color: #71717a;
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
		padding: 4px;
		flex-shrink: 0;
	}
	.kick-close:hover {
		color: #f87171;
	}
	.kick-go {
		flex-shrink: 0;
		padding: 7px 14px;
		background: #818cf8;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.kick-go:hover {
		background: #6d7cf0;
	}
	@media (max-width: 600px) {
		.kick-card {
			flex-wrap: wrap;
		}
		.kick-go {
			margin-left: auto;
		}
	}

	.chat-fab {
		display: none;
	}

	.mobile-chat-backdrop {
		display: none;
	}

	@media (max-width: 900px) {
		.chat-fab {
			display: inline-flex;
			position: fixed;
			right: 16px;
			bottom: 16px;
			z-index: 60;
			width: 52px;
			height: 52px;
			border-radius: 50%;
			background: #818cf8;
			color: #fff;
			align-items: center;
			justify-content: center;
			border: none;
			box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
			cursor: pointer;
		}

		.chat-fab:hover {
			background: #6d7cf0;
		}

		.mobile-chat-backdrop {
			display: flex;
			position: fixed;
			inset: 0;
			z-index: 50;
			background: rgba(0, 0, 0, 0.55);
			align-items: flex-end;
		}

		.mobile-chat-sheet {
			width: 100%;
			max-height: 80vh;
			background: #111113;
			border-radius: 16px 16px 0 0;
			display: flex;
			flex-direction: column;
			padding: 14px;
			gap: 12px;
		}

		.mobile-chat-head {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		.mobile-chat-title {
			font-size: 15px;
			font-weight: 700;
			color: #e4e4e7;
		}

		.mobile-close {
			background: none;
			border: none;
			color: #a1a1aa;
			font-size: 22px;
			line-height: 1;
			cursor: pointer;
		}

		.mobile-member-list {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
		}
		.mobile-member-chip {
			font-size: 11px;
			padding: 3px 8px;
			border-radius: 999px;
			background: #18181b;
			border: 1px solid #27272a;
			color: #a1a1aa;
		}
		.mobile-member-chip.is-me {
			color: #c4b5fd;
			border-color: #3f3f46;
		}

		.mobile-msg-list {
			flex: 1;
			overflow-y: auto;
			min-height: 120px;
		}
	}
</style>
