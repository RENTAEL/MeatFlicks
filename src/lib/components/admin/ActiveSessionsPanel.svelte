<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getCsrfTokenClient } from '$lib/utils/csrf.client';
	import { Users, Play, Pause, X, Radio, Clock, XCircle } from '@lucide/svelte';

	let { onclose, inline = false }: { onclose: () => void; inline?: boolean } = $props();

	type ActiveSession = {
		roomId: string;
		host: { userId: string; username: string };
		media: {
			title: string;
			mediaType: 'movie' | 'tv';
			tmdbId: number;
			season: number | null;
			episode: number | null;
		};
		provider: { id: string; name: string } | null;
		playing: boolean;
		position: number;
		positionAt: number;
		seq: number;
		members: number;
		createdAt: number;
		lastActivityAt: number;
	};

	let sessions = $state<ActiveSession[]>([]);
	let loading = $state(true);
	let connected = $state(false);
	let error = $state(false);
	let now = $state(Date.now());
	let confirming = $state<string | null>(null);
	let closing = $state<string[]>([]);

	let es: EventSource | null = null;

	const STALE_MS = 10 * 60 * 1000;

	function livePosition(s: ActiveSession): number {
		return s.playing ? s.position + (now - s.positionAt) / 1000 : s.position;
	}

	function fmtPos(seconds: number): string {
		const s = Math.max(0, Math.floor(seconds));
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${m}:${r.toString().padStart(2, '0')}`;
	}

	function fmtAge(fromMs: number): string {
		const diff = Math.max(0, now - fromMs);
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		const rem = mins % 60;
		return rem > 0 ? `${hours}h ${rem}m ago` : `${hours}h ago`;
	}

	function fmtSessionAge(createdAt: number): string {
		const diff = Math.max(0, now - createdAt);
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return '<1m';
		if (mins < 60) return `${mins}m`;
		return `${Math.floor(mins / 60)}h ${mins % 60}m`;
	}

	async function endSession(roomId: string) {
		if (closing.includes(roomId)) return;
		closing = [...closing, roomId];
		try {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			const token = await getCsrfTokenClient();
			if (token) headers['X-CSRF-Token'] = token;
			await fetch(`/api/admin/watch-party/sessions/${encodeURIComponent(roomId)}/close`, {
				method: 'POST',
				headers,
				credentials: 'include'
			});
		} catch {
			// the live stream will show the room if the close failed
		} finally {
			closing = closing.filter((id) => id !== roomId);
			confirming = null;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	onMount(() => {
		window.addEventListener('keydown', onKeydown);
		const tick = setInterval(() => {
			now = Date.now();
		}, 1000);

		es = new EventSource('/api/admin/watch-party/sessions/stream');
		es.addEventListener('sessions', (e) => {
			if (!e.data) return;
			try {
				const data = JSON.parse(e.data) as { sessions: ActiveSession[]; at: number };
				sessions = data.sessions;
				loading = false;
				error = false;
			} catch {
				// ignore malformed frames
			}
		});
		es.onopen = () => {
			connected = true;
		};
		es.onerror = () => {
			connected = false;
			loading = false;
			error = sessions.length === 0;
		};

		return () => {
			window.removeEventListener('keydown', onKeydown);
			clearInterval(tick);
			if (es) {
				es.close();
				es = null;
			}
		};
	});
</script>

<div class="panel-wrap" class:inline role="dialog" aria-label="Active watch-party sessions">
	<div class="panel-head">
		<div class="panel-title">
			<Radio size={15} aria-hidden="true" />
			<h2>Active Sessions</h2>
			<span class="live-dot" class:on={connected} aria-hidden="true"></span>
		</div>
		{#if !inline}
			<button class="close-btn" type="button" onclick={onclose} aria-label="Close active sessions">
				<X size={16} aria-hidden="true" />
			</button>
		{/if}
	</div>

	{#if loading}
		<p class="panel-empty">Loading sessions…</p>
	{:else if error}
		<p class="panel-empty">Couldn’t reach the session stream.</p>
	{:else if sessions.length === 0}
		<p class="panel-empty">No active sessions right now.</p>
	{:else}
		<ul class="session-list">
			{#each sessions as s (s.roomId)}
				<li class="session-item" class:stale={now - s.lastActivityAt > STALE_MS}>
					<div class="session-row">
						<span class="room-code">{s.roomId}</span>
						<span class="session-title">
							{s.media.title}
							{#if s.media.mediaType === 'tv' && s.media.season != null}
								<span class="session-ep">S{s.media.season}E{s.media.episode ?? 1}</span>
							{/if}
						</span>
						{#if now - s.lastActivityAt > STALE_MS}
							<span class="stale-badge">stale</span>
						{/if}
					</div>
					<div class="session-meta">
						<span class="meta-host" title={`Host: ${s.host.username}`}>
							Host · {s.host.username}
						</span>
						<span class="meta-item" title="Members connected">
							<Users size={12} aria-hidden="true" />
							{s.members}
						</span>
						<span class="meta-item">
							{#if s.playing}
								<Play size={12} aria-hidden="true" /> {fmtPos(livePosition(s))}
							{:else}
								<Pause size={12} aria-hidden="true" /> paused
							{/if}
							{#if s.provider}
								<span class="meta-provider">{s.provider.name}</span>
							{/if}
						</span>
					</div>
					<div class="session-times">
						<span class="meta-item">
							<Clock size={12} aria-hidden="true" />
							active {fmtSessionAge(s.createdAt)}
						</span>
						<span class="meta-item">last activity {fmtAge(s.lastActivityAt)}</span>
					</div>
					<div class="session-actions">
						{#if confirming === s.roomId}
							<span class="confirm-hint">End this session?</span>
							<button
								class="confirm-yes"
								type="button"
								disabled={closing.includes(s.roomId)}
								onclick={() => endSession(s.roomId)}
							>
								{closing.includes(s.roomId) ? 'Ending…' : 'Yes, end it'}
							</button>
							<button
								class="confirm-no"
								type="button"
								disabled={closing.includes(s.roomId)}
								onclick={() => (confirming = null)}
							>
								Cancel
							</button>
						{:else}
							<button class="end-btn" type="button" onclick={() => (confirming = s.roomId)}>
								<XCircle size={13} aria-hidden="true" />
								End session
							</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.panel-wrap {
		position: fixed;
		top: calc(var(--header-height) + 10px);
		right: 1rem;
		z-index: 150;
		width: min(380px, calc(100vw - 2rem));
		max-height: min(70vh, 560px);
		display: flex;
		flex-direction: column;
		border-radius: var(--radius-xl);
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
		overflow: hidden;
	}

	.panel-wrap.inline {
		position: static;
		width: 100%;
		max-height: 420px;
		border-radius: var(--radius-lg);
		box-shadow: none;
		background: var(--bg-root);
		border: 1px solid var(--border-stream);
	}

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-stream);
	}

	.panel-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--accent-color, #818cf8);
	}

	.panel-title h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: var(--font-weight-semibold);
		color: var(--text-primary);
	}

	.live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #71717a;
	}

	.live-dot.on {
		background: #22c55e;
		box-shadow: 0 0 6px rgba(34, 197, 94, 0.7);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.close-btn:hover {
		color: var(--text-primary);
		border-color: var(--border-stream);
	}

	.session-list {
		list-style: none;
		margin: 0;
		padding: 0.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.session-item {
		padding: 0.7rem 0.85rem;
		border-radius: var(--radius-lg);
		background: var(--bg-root);
		border: 1px solid var(--border-stream);
	}

	.session-item.stale {
		border-color: rgba(245, 158, 11, 0.45);
	}

	.session-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.room-code {
		padding: 0.1rem 0.45rem;
		border-radius: var(--radius-sm);
		background: rgba(196, 181, 253, 0.12);
		border: 1px solid rgba(196, 181, 253, 0.3);
		color: #c4b5fd;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.session-title {
		font-size: 0.88rem;
		font-weight: var(--font-weight-semibold);
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		flex: 1;
	}

	.session-ep {
		margin-left: 0.35rem;
		font-size: 0.7rem;
		color: var(--text-secondary);
	}

	.stale-badge {
		padding: 0.05rem 0.4rem;
		border-radius: var(--radius-full);
		background: rgba(245, 158, 11, 0.15);
		border: 1px solid rgba(245, 158, 11, 0.4);
		color: #fbbf24;
		font-size: 0.65rem;
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.session-meta,
	.session-times {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 0.4rem;
	}

	.meta-item,
	.meta-host {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.meta-host {
		font-weight: var(--font-weight-medium);
		color: var(--text-primary);
	}

	.meta-provider {
		margin-left: 0.2rem;
		padding: 0.05rem 0.4rem;
		border-radius: var(--radius-full);
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
		font-size: 0.65rem;
	}

	.session-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.55rem;
	}

	.end-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.7rem;
		border-radius: var(--radius-md);
		border: 1px solid rgba(239, 68, 68, 0.35);
		background: transparent;
		color: #f87171;
		font-size: 0.75rem;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.end-btn:hover {
		background: rgba(239, 68, 68, 0.1);
	}

	.confirm-hint {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.confirm-yes {
		padding: 0.25rem 0.7rem;
		border-radius: var(--radius-md);
		background: #dc2626;
		border: none;
		color: white;
		font-size: 0.75rem;
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
	}

	.confirm-no {
		padding: 0.25rem 0.7rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-stream);
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.confirm-yes:disabled,
	.confirm-no:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.panel-empty {
		padding: 1.5rem 1rem;
		text-align: center;
		color: var(--text-secondary);
		font-size: 0.85rem;
	}
</style>
