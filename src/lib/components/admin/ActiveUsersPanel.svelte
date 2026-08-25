<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Users,
		Radio,
		UserRound,
		Clock3,
		MonitorPlay,
		Link2,
		LogOut,
		Loader2
	} from '@lucide/svelte';
	import ActiveSessionsPanel from './ActiveSessionsPanel.svelte';
	import { getCsrfTokenClient } from '$lib/utils/csrf.client';
	import {
		liveSessions,
		connectLiveSessions,
		isGuestSession,
		sessionLabel,
		type LiveSessionUser
	} from '$lib/admin/liveSessions.svelte';

	type Session = {
		roomId: string;
		host: { userId: string; username: string };
		media: { title: string; mediaType: string; tmdbId: number };
		playing: boolean;
		position: number;
		positionAt: number;
		seq: number;
		members: number;
		createdAt: number;
		lastActivityAt: number;
	};

	let connected = $state(false);
	let counts = $state({ users: 0, sessions: 0 });
	let users = $state<LiveSessionUser[]>([]);
	let sessions = $state<Session[]>([]);
	let lastAt = $state(0);
	let confirmKick = $state<string | null>(null);
	let kicking = $state(false);
	let kickError = $state('');
	let kickNotice = $state<string | null>(null);
	let kickNoticeTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => connectLiveSessions());

	// Mirror the shared store into local state (keeps the template unchanged)
	$effect(() => {
		users = liveSessions.users;
		counts = liveSessions.counts;
		connected = liveSessions.connected;
		lastAt = liveSessions.lastAt;
	});

	async function endSession(userId: string) {
		kicking = true;
		kickError = '';
		try {
			const token = await getCsrfTokenClient();
			if (!token) {
				kickError = 'Could not get CSRF token';
				return;
			}
			const res = await fetch('/api/admin/presence/kick', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
				body: JSON.stringify({ userId })
			});
			const data = (await res.json()) as { ok: boolean; error?: string; guest?: boolean };
			if (!res.ok || !data.ok) {
				kickError = data.error ?? 'Failed to end session';
				return;
			}
			users = users.filter((u) => u.userId !== userId);
			confirmKick = null;
			// Guests are notified via a pull-based heartbeat (≤60s), not an
			// instant SSE push — surface that so the delay isn't read as a
			// broken button. Logged-in kicks are instant, so skip the note.
			if (data.guest) {
				kickNotice = 'Signal sent — guest will be notified within ~60s';
				if (kickNoticeTimer) clearTimeout(kickNoticeTimer);
				kickNoticeTimer = setTimeout(() => (kickNotice = null), 6000);
			}
		} catch {
			kickError = 'Failed to end session';
		} finally {
			kicking = false;
		}
	}

	function fmtDuration(fromMs: number): string {
		const mins = Math.max(0, Math.floor((Date.now() - fromMs) / 60000));
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m`;
		const hrs = Math.floor(mins / 60);
		return `${hrs}h ${mins % 60}m`;
	}

	function fmtLastSeen(ts: number): string {
		const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
		if (secs < 60) return `${secs}s ago`;
		const mins = Math.floor(secs / 60);
		return `${mins}m ago`;
	}

	function pageLabel(u: LiveSessionUser): string {
		if (u.roomId) return `In session ${u.roomId}`;
		if (u.title) return u.title;
		if (u.path && u.path !== '/') return u.path;
		return 'Browsing home';
	}

	function pageHref(u: LiveSessionUser): string | null {
		return u.path && u.path !== '/' ? u.path : null;
	}
</script>

<div class="apu">
	<div class="apu-counts">
		<div class="apu-count">
			<span class="apu-count-num">{counts.users}</span>
			<span class="apu-count-label">
				<UserRound size={13} aria-hidden="true" /> active now
			</span>
		</div>
		<div class="apu-count">
			<span class="apu-count-num">{counts.sessions}</span>
			<span class="apu-count-label">
				<Radio size={13} aria-hidden="true" /> active sessions
			</span>
		</div>
		<span class="apu-live-dot" class:on={connected} aria-hidden="true"></span>
	</div>

	{#if connected}
		<p class="apu-hint">
			Live on this instance — users appear/disappear as their connections open and close.
		</p>
	{:else}
		<p class="apu-hint apu-hint-warn">Live feed disconnected — reconnecting…</p>
	{/if}

	<div class="apu-section">
		<div class="apu-section-title">
			<Users size={13} aria-hidden="true" /> Who's online
		</div>
		{#if users.length === 0}
			<p class="apu-empty">Nobody on the site right now — no users, no guests.</p>
		{:else}
			<ul class="apu-user-list">
				{#each users as u (u.userId)}
					{@const guest = isGuestSession(u.userId)}
					<li class="apu-user" class:apu-guest={guest}>
						<div class="apu-user-main">
							<span class="apu-avatar" class:apu-avatar-guest={guest} aria-hidden="true">
								{guest ? '👻' : u.username.slice(0, 1).toUpperCase()}
							</span>
							<div class="apu-user-info">
								<span class="apu-username">
									{guest ? 'Guest / Anonymous' : u.username}
									<span class="apu-sid" title={u.userId}>{sessionLabel(u.userId)}</span>
									{#if u.roomHost}
										<span class="apu-host-tag">host</span>
									{/if}
									{#if guest}
										<span class="apu-guest-tag">not signed in</span>
									{/if}
								</span>
								<span class="apu-watching">
									{#if u.roomId}
										<MonitorPlay size={12} aria-hidden="true" />
										Watching <strong>{u.roomTitle}</strong> in session
										<code class="apu-code">{u.roomId}</code>
									{:else}
										{pageLabel(u)}
									{/if}
								</span>
							</div>
						</div>
						<div class="apu-user-meta">
							{#if u.roomId}
								<a class="apu-link" href={`/watch/${u.roomId}`} target="_blank" rel="noopener">
									<Link2 size={12} aria-hidden="true" /> Open session
								</a>
							{:else if pageHref(u)}
								<a class="apu-link" href={pageHref(u)} target="_blank" rel="noopener">
									<Link2 size={12} aria-hidden="true" /> Open page
								</a>
							{/if}
							<span class="apu-meta-line">
								<Clock3 size={12} aria-hidden="true" />
								active {fmtDuration(u.joinedAt)} · seen {fmtLastSeen(u.lastSeen)}
							</span>
						</div>
						<div class="apu-user-actions">
							{#if confirmKick === u.userId}
								<div class="apu-kick-confirm">
									<p class="apu-kick-text">
										End session for @{u.username}? They'll be disconnected from the app.
									</p>
									<div class="apu-kick-buttons">
										<button
											class="apu-btn apu-btn-danger"
											type="button"
											disabled={kicking}
											onclick={() => endSession(u.userId)}
										>
											{#if kicking}
												<Loader2 size={13} class="apu-spin" aria-hidden="true" /> Ending…
											{:else}
												Yes, end session
											{/if}
										</button>
										<button
											class="apu-btn"
											type="button"
											disabled={kicking}
											onclick={() => (confirmKick = null)}
										>
											Cancel
										</button>
									</div>
								</div>
							{:else}
								<button
									class="apu-btn apu-btn-danger-ghost"
									type="button"
									onclick={() => {
										kickError = '';
										confirmKick = u.userId;
									}}
								>
									<LogOut size={12} aria-hidden="true" /> End session
								</button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
			{#if kickError}
				<p class="apu-kick-error">{kickError}</p>
			{/if}
			{#if kickNotice}
				<p class="apu-kick-notice">{kickNotice}</p>
			{/if}
		{/if}
	</div>

	<div class="apu-section">
		<div class="apu-section-title">
			<Radio size={13} aria-hidden="true" /> Running sessions
		</div>
		{#if sessions.length === 0}
			<p class="apu-empty">No watch-party sessions are running right now.</p>
		{:else}
			<div class="apu-session-chips">
				{#each sessions as s (s.roomId)}
					<a class="apu-session-chip" href={`/watch/${s.roomId}`} target="_blank" rel="noopener">
						<span class="apu-chip-code">{s.roomId}</span>
						<span class="apu-chip-title">{s.media.title}</span>
						<span class="apu-chip-meta">
							{s.members} member{s.members === 1 ? '' : 's'} · by {s.host.username}
						</span>
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<div class="apu-section">
		<div class="apu-section-title">
			<Radio size={13} aria-hidden="true" /> Session detail &amp; control
		</div>
		<ActiveSessionsPanel inline={true} onclose={() => {}} />
	</div>
</div>

<style>
	.apu {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.apu-counts {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.apu-count {
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		padding: 0.5rem 0.9rem;
		border-radius: var(--radius-md);
		background: var(--bg-elevated);
		border: 1px solid var(--border-stream);
	}

	.apu-count-num {
		font-size: 1.4rem;
		font-weight: var(--font-weight-extrabold, 800);
		background: linear-gradient(135deg, #a78bfa, #f472b6);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.apu-count-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.apu-live-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: #f87171;
		box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.15);
	}

	.apu-live-dot.on {
		background: #4ade80;
		box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.15);
		animation: apu-pulse 2s infinite;
	}

	@keyframes apu-pulse {
		50% {
			opacity: 0.55;
		}
	}

	.apu-hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.apu-hint-warn {
		color: #f87171;
	}

	.apu-section {
		border-top: 1px solid var(--border-stream);
		padding-top: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.apu-section-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
		font-weight: var(--font-weight-semibold, 600);
	}

	.apu-empty {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-tertiary);
	}

	.apu-user-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.apu-user {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.55rem 0.8rem;
		border-radius: var(--radius-md);
		background: var(--bg-root);
		border: 1px solid var(--border-stream);
	}

	.apu-guest {
		border-style: dashed;
	}

	.apu-avatar-guest {
		background: linear-gradient(135deg, #475569, #334155) !important;
	}

	.apu-sid {
		font-family: ui-monospace, monospace;
		font-size: 0.62rem;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.04);
		padding: 0.02rem 0.35rem;
		border-radius: var(--radius-full);
	}

	.apu-guest-tag {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.05rem 0.4rem;
		border-radius: var(--radius-full);
		background: rgba(148, 163, 184, 0.14);
		border: 1px solid rgba(148, 163, 184, 0.35);
		color: #94a3b8;
	}

	.apu-user-main {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
		flex: 1 1 220px;
	}

	.apu-avatar {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--gradient-brand);
		color: #fff;
		font-size: 0.85rem;
		font-weight: var(--font-weight-bold, 700);
	}

	.apu-user-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.apu-username {
		font-size: 0.88rem;
		font-weight: var(--font-weight-semibold, 600);
		color: var(--text-primary);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.apu-host-tag {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.05rem 0.4rem;
		border-radius: var(--radius-full);
		background: rgba(244, 114, 182, 0.14);
		border: 1px solid rgba(244, 114, 182, 0.4);
		color: #f472b6;
	}

	.apu-watching {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.78rem;
		color: var(--text-tertiary);
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.apu-watching strong {
		color: var(--text-secondary);
		font-weight: var(--font-weight-semibold, 600);
	}

	.apu-code {
		font-family: ui-monospace, monospace;
		font-size: 0.72rem;
		background: rgba(124, 92, 252, 0.14);
		border: 1px solid rgba(124, 92, 252, 0.35);
		border-radius: var(--radius-sm);
		padding: 0.05rem 0.3rem;
		color: #a78bfa;
	}

	.apu-user-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.apu-link {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
		color: var(--accent-color, #818cf8);
		text-decoration: none;
	}

	.apu-link:hover {
		text-decoration: underline;
	}

	.apu-meta-line {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.72rem;
		color: var(--text-tertiary);
	}

	.apu-user-actions {
		flex-shrink: 0;
	}

	.apu-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border-stream);
		background: var(--bg-elevated);
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: var(--font-weight-semibold, 600);
		font-family: inherit;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.apu-btn:hover:not(:disabled) {
		border-color: var(--accent-stream);
		color: var(--text-primary);
	}

	.apu-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.apu-btn-danger {
		background: rgba(239, 68, 68, 0.12);
		border-color: rgba(239, 68, 68, 0.45);
		color: #f87171;
	}

	.apu-btn-danger:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.22);
		border-color: #f87171;
		color: #f87171;
	}

	.apu-btn-danger-ghost {
		background: transparent;
		border-color: rgba(239, 68, 68, 0.35);
		color: #f87171;
	}

	.apu-btn-danger-ghost:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.14);
		border-color: #f87171;
		color: #f87171;
	}

	.apu-kick-confirm {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		align-items: flex-end;
	}

	.apu-kick-text {
		margin: 0;
		font-size: 0.78rem;
		color: var(--text-secondary);
		max-width: 300px;
		text-align: right;
	}

	.apu-kick-buttons {
		display: flex;
		gap: 0.4rem;
	}

	.apu-kick-error {
		margin: 0;
		font-size: 0.75rem;
		color: #f87171;
	}

	.apu-kick-notice {
		margin: 0;
		font-size: 0.75rem;
		color: #4ade80;
	}

	.apu-spin {
		animation: apu-spin 0.9s linear infinite;
	}

	@keyframes apu-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.apu-session-chips {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.apu-session-chip {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.8rem;
		border-radius: var(--radius-md);
		background: var(--bg-root);
		border: 1px solid var(--border-stream);
		text-decoration: none;
		transition: border-color var(--transition-fast);
	}

	.apu-session-chip:hover {
		border-color: var(--accent-stream);
	}

	.apu-chip-code {
		font-family: ui-monospace, monospace;
		font-size: 0.78rem;
		letter-spacing: 0.06em;
		background: rgba(124, 92, 252, 0.14);
		border: 1px solid rgba(124, 92, 252, 0.35);
		border-radius: var(--radius-sm);
		padding: 0.1rem 0.35rem;
		color: #a78bfa;
	}

	.apu-chip-title {
		font-size: 0.85rem;
		font-weight: var(--font-weight-semibold, 600);
		color: var(--text-primary);
		flex: 1 1 auto;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.apu-chip-meta {
		font-size: 0.72rem;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}
</style>
