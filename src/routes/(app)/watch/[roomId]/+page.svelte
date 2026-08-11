<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import Player from '$lib/components/Player.svelte';
	import { playSoundEffect, SOUND_PRESETS, getSoundVolume, getSoundMuted, setSoundVolume, toggleSoundMute } from '$lib/watch-party/sounds';
	import { Users, Trophy, Copy, Send, Sparkles, LogOut, Skull, MessageCircle } from '@lucide/svelte';
	import type { RoomState } from '$lib/server/watch-party/types';

	interface WatchData {
		roomId: string;
		user: { id: string; username: string };
		initialState: RoomState;
	}

	export let data: WatchData;

	const roomId = data.roomId;
	const user = data.user;

	let state: RoomState = data.initialState;
	let closed = false;
	let messages: RoomState['messages'] = data.initialState.messages;
	let lastMessageId = data.initialState.lastMessageId;
	let lastSoundSeq = data.initialState.sound?.seq ?? 0;
	let chatInput = '';
	let polling = false;
	let copied = false;
	let error = '';
	let fxVolume = getSoundVolume();
	let fxMuted = getSoundMuted();
	let chatOpen = false;

	let pollTimer: ReturnType<typeof setInterval> | null = null;

	function mergeMessages(next: RoomState['messages']) {
		if (next.length === 0) return;
		const byId = new Map(messages.map((m) => [m.id, m]));
		for (const m of next) {
			byId.set(m.id, m);
		}
		messages = [...byId.values()].sort((a, b) => a.id - b.id);
	}

	async function api<T = unknown>(path: string, init?: RequestInit): Promise<T | null> {
		try {
			const res = await fetch(`/api${path}`, {
				headers: { 'content-type': 'application/json' },
				...init
			});
			if (res.status === 401 || res.status === 403) {
				await goto(`/login?next=${encodeURIComponent(`/watch/${roomId}`)}`);
				return null;
			}
			if (!res.ok) throw new Error((await res.json().catch(() => ({ message: 'Request failed' }))).message ?? 'Request failed');
			return (await res.json()) as T;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
			return null;
		}
	}

	onMount(async () => {
		await api(`/watch-party/join`, { method: 'POST', body: JSON.stringify({ roomId }) });
		poll();
		pollTimer = setInterval(poll, 2000);
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
	});

	async function poll() {
		if (polling) return;
		polling = true;
		try {
			const s = await api<RoomState>(`/watch-party/rooms/${roomId}?since=${lastMessageId}`);
			if (!s) return;
			if (s.closed) {
				closed = true;
				lastSoundSeq = s.sound?.seq ?? lastSoundSeq;
				return;
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
		} finally {
			polling = false;
		}
	}

	function getRemoteSync() {
		return state.isHost
			? null
			: {
					seq: state.playback.seq,
					playing: state.playback.playing,
					position: state.playback.position,
					positionAt: state.playback.positionAt
				};
	}

	let lastPlaybackSignal: { playing: boolean; position: number } | null = null;
	let syncPoke = 0;

	function onPlaybackChange(signal: { playing: boolean; position: number }) {
		if (!state.isHost) return;
		const prev = lastPlaybackSignal;
		lastPlaybackSignal = signal;
		let action: 'play' | 'pause' | 'seek' = signal.playing ? 'play' : 'pause';
		if (prev && prev.playing === signal.playing) action = 'seek';
		api(`/watch-party/rooms/${roomId}/playback`, {
			method: 'POST',
			body: JSON.stringify({ action, position: signal.position })
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
		await api(`/watch-party/rooms/${roomId}/kick`, {
			method: 'POST',
			body: JSON.stringify({ userId })
		});
	}

	async function playSound(effect: string) {
		await api(`/watch-party/rooms/${roomId}/sound`, {
			method: 'POST',
			body: JSON.stringify({ effect })
		});
	}

	async function leave() {
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
	<div class="player-col">
		<div class="room-head">
			<div>
				<h1 class="room-title">{state.media?.title ?? 'Watch Party'}</h1>
				{#if state.media?.mediaType === 'tv'}
					<p class="room-sub">Season {state.media?.season} · Episode {state.media?.episode}</p>
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

		{#if state.media}
			<Player
				tmdbId={state.media.tmdbId}
				type={state.media.mediaType}
				season={state.media.season ?? 1}
				episode={state.media.episode ?? 1}
				title={state.media.title}
				readOnly={!state.isHost}
				remoteSync={getRemoteSync()}
				syncPoke={syncPoke}
				onPlaybackChange={onPlaybackChange}
			/>
		{:else}
			<div class="no-media">Nothing is playing yet.</div>
		{/if}

		{#if !state.isHost}
			<div class="sync-row">
				<button class="sync-btn" onclick={() => syncPoke++} title="Jump back to the host's playback position">
					Sync to host
				</button>
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
							<button class="kick-btn" onclick={() => kickMember(p.userId)} title="Remove from room">kick</button>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="panel fx-panel">
			<div class="panel-head">
				<span class="panel-title"><Sparkles size={16} /> Sound effects</span>
			</div>
			{#if state.isHost}
				<div class="fx-row">
					{#each SOUND_PRESETS as preset}
						<button class="fx-btn" onclick={() => playSound(preset.id)} title={preset.description}>
							{preset.label}
						</button>
					{/each}
				</div>
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
							<button class="del-btn" onclick={() => deleteMessage(m.id)} title="Delete message">×</button>
						{/if}
					</div>
				{/each}
				{#if messages.length === 0}
					<div></div>
				{/if}
			</div>
			<form class="chat-form" onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
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
	<div class="mobile-chat-backdrop" role="dialog" aria-modal="true" aria-label="Room chat" tabindex="-1" onclick={() => (chatOpen = false)}>
		<div class="mobile-chat-sheet" onclick={(e) => e.stopPropagation()}>
			<div class="mobile-chat-head">
				<span class="mobile-chat-title">Room chat</span>
				<button class="mobile-close" onclick={() => (chatOpen = false)} aria-label="Close chat">×</button>
			</div>
			<div class="mobile-member-list">
				{#each state.participants as p, i (p.userId)}
					<span class="mobile-member-chip" class:is-me={p.userId === user.id}>
						{p.username.slice(0, 1).toUpperCase()} {p.username}
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
			<form class="chat-form" onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
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

<style>
	.watch-root { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; padding: 24px; max-width: 1400px; margin: 0 auto; }
	@media (max-width: 900px) { .watch-root { grid-template-columns: 1fr; } }

	.room-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; margin-top: 8px; }
	.room-title { font-size: 22px; font-weight: 700; color: #f4f4f5; margin: 0; }
	.room-sub { color: #71717a; font-size: 13px; margin-top: 4px; }
	.room-code-wrap { display: flex; align-items: center; flex-direction: column; gap: 4px; }
	.room-code-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #52525b; }
	.room-code { display: flex; align-items: center; gap: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; font-weight: 700; color: #c4b5fd; background: #18181b; border: 1px solid #3f3f46; padding: 6px 12px; border-radius: 8px; cursor: pointer; letter-spacing: 1px; }
	.room-code:hover { border-color: #52525b; }
	.room-copied { font-size: 11px; color: #6ee7b7; min-height: 14px; }

	.panel { background: #111113; border: 1px solid #1f1f23; border-radius: 12px; overflow: hidden; }
	.panel-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid #1f1f23; }
	.panel-title { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #e4e4e7; }

	.side-col { display: flex; flex-direction: column; gap: 16px; }

	.member-list { max-height: 200px; overflow-y: auto; padding: 6px; }
	.member-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; }
	.member-row:hover { background: #18181b; }
	.member-avatar { width: 26px; height: 26px; border-radius: 50%; background: #27272a; color: #c4b5fd; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
	.member-name { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #d4d4d8; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.kick-btn { background: #18181b; color: #f87171; border: 1px solid #3f3f46; border-radius: 6px; font-size: 11px; padding: 3px 8px; cursor: pointer; }
	.kick-btn:hover { background: #3f3f46; }

	.fx-row { display: flex; gap: 8px; padding: 12px 14px; flex-wrap: wrap; }
	.fx-btn { flex: 1; min-width: 100px; padding: 8px 10px; background: #18181b; color: #d4d4d8; border: 1px solid #3f3f46; border-radius: 8px; font-size: 12px; cursor: pointer; }
	.fx-btn:hover { background: #27272a; border-color: #52525b; }

	.fx-ctrl-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-top: 1px solid #1f1f23; }
	.fx-mute { background: none; border: none; font-size: 15px; cursor: pointer; padding: 2px; }
	.fx-slider { flex: 1; accent-color: #818cf8; }

	.chat-panel { display: flex; flex-direction: column; height: 320px; }
	.msg-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
	.msg-row { display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; border-radius: 8px; position: relative; flex-direction: column; }
	.msg-row:hover { background: #18181b; }
	.msg-row.deleted .msg-body { color: #52525b; font-style: italic; }
	.msg-who { font-size: 12px; font-weight: 600; color: #818cf8; display: inline-flex; align-items: center; gap: 6px; }
	.msg-time { font-weight: 400; color: #52525b; font-size: 11px; }
	.msg-body { font-size: 13px; color: #e4e4e7; }
	.msg-del-tag { font-size: 10px; color: #52525b; text-transform: uppercase; letter-spacing: 0.4px; }
	.del-btn { position: absolute; right: 8px; top: 6px; background: none; border: none; color: #52525b; cursor: pointer; font-size: 14px; line-height: 1; }
	.del-btn:hover { color: #f87171; }
	.msg-empty { color: #52525b; font-size: 12px; padding: 12px; text-align: center; }

	.chat-form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #1f1f23; }
	.chat-input { flex: 1; padding: 8px 12px; background: #18181b; border: 1px solid #3f3f46; border-radius: 8px; color: #f4f4f5; font-size: 13px; outline: none; min-height: 40px; }
	.chat-input:focus { border-color: #818cf8; }
	.send-btn { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; background: #818cf8; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
	.send-btn:hover { background: #6d7cf0; }

	.leave-row { padding: 4px 0; }
	.leave-btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; background: #18181b; color: #a1a1aa; border: 1px solid #3f3f46; border-radius: 8px; font-size: 13px; cursor: pointer; }
	.leave-btn:hover { color: #f87171; border-color: #f87171; }

	.err { color: #f87171; font-size: 13px; margin-top: 10px; }

	.closed-wrap { display: flex; align-items: center; justify-content: center; min-height: 60vh; padding: 24px; }
	.closed-card { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; color: #e4e4e7; max-width: 360px; }
	.closed-card h1 { font-size: 20px; margin: 8px 0 0; }
	.closed-card p { color: #71717a; font-size: 13px; margin: 0; }
	.primary-btn { margin-top: 12px; padding: 10px 20px; background: #818cf8; color: #fff; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; }

	.no-media { color: #71717a; padding: 40px; text-align: center; }

	.sync-row { margin-top: 10px; display: flex; }
	.sync-btn { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; background: #18181b; color: #c4b5fd; border: 1px solid #3f3f46; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
	.sync-btn:hover { background: #27272a; border-color: #818cf8; }

	.chat-fab { display: none; }

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

		.chat-fab:hover { background: #6d7cf0; }

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

		.mobile-chat-title { font-size: 15px; font-weight: 700; color: #e4e4e7; }

		.mobile-close {
			background: none;
			border: none;
			color: #a1a1aa;
			font-size: 22px;
			line-height: 1;
			cursor: pointer;
		}

		.mobile-member-list { display: flex; flex-wrap: wrap; gap: 6px; }
		.mobile-member-chip {
			font-size: 11px;
			padding: 3px 8px;
			border-radius: 999px;
			background: #18181b;
			border: 1px solid #27272a;
			color: #a1a1aa;
		}
		.mobile-member-chip.is-me { color: #c4b5fd; border-color: #3f3f46; }

		.mobile-msg-list { flex: 1; overflow-y: auto; min-height: 120px; }
	}
</style>