<script lang="ts">
	import { onMount } from 'svelte';
	import { getCsrfTokenClient } from '$lib/utils/csrf.client';
	import ActiveUsersPanel from './ActiveUsersPanel.svelte';
	import {
		Shield,
		Wand2,
		RefreshCw,
		Megaphone,
		Activity,
		Flag,
		Trash2,
		Check,
		X,
		Loader2
	} from '@lucide/svelte';

	type Announcement = { text: string; at: number; by: string } | null;
	type AdminStats = {
		activeSessions: number;
		totalUsers: number;
		totalMedia: number;
		totalWatchHistory: number;
		totalSavedQuotes: number;
		openRooms: number;
		lastCatalogRefresh: number | null;
		uptimeSeconds: number;
		recentErrors: { at: number; message: string }[];
	};

	let busy = $state<string | null>(null);
	let lastResult = $state<{ ok: boolean; message: string } | null>(null);
	let confirming = $state<string | null>(null);

	let stats = $state<AdminStats | null>(null);
	let statsLoading = $state(false);

	let announcement = $state<Announcement>(null);
	let announcementText = $state('');
	let broadcastBusy = $state(false);

	let flags = $state<Record<string, boolean>>({});
	let flagsLoaded = $state(false);

	async function apiFetch(path: string, method = 'GET', body?: unknown) {
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (method !== 'GET') {
			const token = await getCsrfTokenClient();
			if (token) headers['X-CSRF-Token'] = token;
		}
		const res = await fetch(path, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
			credentials: 'include'
		});
		return { status: res.status, body: await res.json().catch(() => null) };
	}

	async function runAction(key: string, path: string, okMessage: string) {
		if (busy) return;
		busy = key;
		lastResult = null;
		try {
			const res = await apiFetch(path, 'POST');
			if (res.status === 200 && res.body?.ok) {
				lastResult = { ok: true, message: okMessage };
			} else if (res.status === 403) {
				lastResult = { ok: false, message: 'Nice try — this is admin only.' };
			} else {
				lastResult = { ok: false, message: 'Something went wrong on the server.' };
			}
		} catch {
			lastResult = { ok: false, message: 'Could not reach the server.' };
		} finally {
			busy = null;
			confirming = null;
		}
	}

	async function refreshStats() {
		statsLoading = true;
		try {
			const res = await apiFetch('/api/admin/system/stats');
			if (res.status === 200) stats = res.body?.stats ?? null;
		} catch {
			// ignore — stats card just stays stale
		} finally {
			statsLoading = false;
		}
	}

	async function loadAnnouncement() {
		const res = await apiFetch('/api/admin/announcement');
		if (res.status === 200) announcement = res.body?.announcement ?? null;
	}

	async function sendAnnouncement() {
		if (broadcastBusy) return;
		const text = announcementText.trim();
		if (!text) return;
		broadcastBusy = true;
		try {
			const res = await apiFetch('/api/admin/announcement', 'POST', { text });
			if (res.status === 200 && res.body?.ok) {
				announcement = res.body.announcement;
				announcementText = '';
				lastResult = { ok: true, message: 'Announcement broadcast to the site.' };
			} else {
				lastResult = { ok: false, message: 'Broadcast failed.' };
			}
		} catch {
			lastResult = { ok: false, message: 'Broadcast failed.' };
		} finally {
			broadcastBusy = false;
		}
	}

	async function clearAnnouncement() {
		broadcastBusy = true;
		try {
			const res = await apiFetch('/api/admin/announcement', 'DELETE');
			if (res.status === 200) {
				announcement = null;
				lastResult = { ok: true, message: 'Announcement removed.' };
			}
		} catch {
			lastResult = { ok: false, message: 'Could not clear the announcement.' };
		} finally {
			broadcastBusy = false;
		}
	}

	async function loadFlags() {
		const res = await apiFetch('/api/admin/flags');
		if (res.status === 200) {
			flags = res.body?.flags ?? {};
			flagsLoaded = true;
		}
	}

	async function toggleFlag(name: string, enabled: boolean) {
		flags = { ...flags, [name]: enabled };
		await apiFetch('/api/admin/flags', 'POST', { name, enabled });
		lastResult = { ok: true, message: `Flag "${name}" ${enabled ? 'enabled' : 'disabled'}.` };
	}

	onMount(() => {
		void refreshStats();
		void loadAnnouncement();
		void loadFlags();
	});

	function fmtAge(ts: number | null): string {
		if (!ts) return 'unknown';
		const diff = Math.max(0, Date.now() - ts);
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
	}
</script>

<div class="admin-panel glass">
	<div class="admin-head">
		<div class="admin-title">
			<Shield size={18} aria-hidden="true" />
			<h2>Admin Panel</h2>
		</div>
		<a class="admin-link" href="/settings/admin">Open full page →</a>
	</div>

	{#if lastResult}
		<div class="result-banner" class:result-ok={lastResult.ok} class:result-bad={!lastResult.ok}>
			{lastResult.ok ? '✅ ' : '⚠️ '}{lastResult.message}
		</div>
	{/if}

	<!-- Destructive session actions -->
	<div class="admin-group">
		<div class="admin-group-title">Watch-party sessions</div>

		<div class="admin-option">
			<div class="option-text">
				<strong>End all active sessions</strong>
				<p>Force-close every running watch party and disconnect all members. No survivors.</p>
			</div>
			{#if confirming === 'end-all'}
				<div class="confirm-row">
					<span class="confirm-hint">Kill them all?</span>
					<button
						class="btn-danger"
						type="button"
						disabled={busy === 'end-all'}
						onclick={() =>
							runAction(
								'end-all',
								'/api/admin/watch-party/sessions/end-all',
								'All sessions ended.'
							)}
					>
						{#if busy === 'end-all'}
							<Loader2 size={14} class="spin" />
							Ending…
						{:else}
							Yes, end everything
						{/if}
					</button>
					<button class="btn-ghost" type="button" onclick={() => (confirming = null)}>
						Cancel
					</button>
				</div>
			{:else}
				<button class="btn-danger" type="button" onclick={() => (confirming = 'end-all')}>
					<Trash2 size={14} aria-hidden="true" /> End all
				</button>
			{/if}
		</div>

		<div class="admin-option">
			<div class="option-text">
				<strong>Clear orphaned sessions</strong>
				<p>Scan for stale, abandoned sessions that never ended and sweep them away.</p>
			</div>
			{#if confirming === 'clear-orphans'}
				<div class="confirm-row">
					<span class="confirm-hint">Run the cleanup?</span>
					<button
						class="btn-danger"
						type="button"
						disabled={busy === 'clear-orphans'}
						onclick={() =>
							runAction(
								'clear-orphans',
								'/api/admin/watch-party/sessions/clear-orphans',
								'Orphaned sessions cleaned.'
							)}
					>
						{#if busy === 'clear-orphans'}
							<Loader2 size={14} class="spin" />
							Cleaning…
						{:else}
							Yes, clean up
						{/if}
					</button>
					<button class="btn-ghost" type="button" onclick={() => (confirming = null)}>
						Cancel
					</button>
				</div>
			{:else}
				<button class="btn-danger" type="button" onclick={() => (confirming = 'clear-orphans')}>
					<Wand2 size={14} aria-hidden="true" /> Clean up
				</button>
			{/if}
		</div>
	</div>

	<!-- Catalog -->
	<div class="admin-group">
		<div class="admin-group-title">Catalog</div>
		<div class="admin-option">
			<div class="option-text">
				<strong>Refresh catalog data</strong>
				<p>
					Manually re-fetch the movie &amp; TV catalog freshness pipeline and purge stale caches.
				</p>
			</div>
			<button
				class="btn-action"
				type="button"
				disabled={busy === 'refresh-catalog'}
				onclick={() =>
					runAction('refresh-catalog', '/api/admin/catalog/refresh', 'Catalog refresh kicked off.')}
			>
				{#if busy === 'refresh-catalog'}
					<Loader2 size={14} class="spin" />
					Refreshing…
				{:else}
					<RefreshCw size={14} aria-hidden="true" />
					Refresh now
				{/if}
			</button>
		</div>
	</div>

	<!-- Active users & sessions (live) -->
	<div class="admin-group">
		<ActiveUsersPanel />
	</div>

	<!-- Broadcast -->
	<div class="admin-group">
		<div class="admin-group-title">Broadcast</div>
		<div class="admin-option">
			<div class="option-text">
				<strong>Broadcast a message</strong>
				<p>Send a site-wide notice banner to every visitor, e.g. “Maintenance tonight at 2am”.</p>
			</div>
			<form
				class="broadcast-form"
				onsubmit={(e) => {
					e.preventDefault();
					void sendAnnouncement();
				}}
			>
				<input
					type="text"
					class="broadcast-input"
					placeholder="e.g. Maintenance tonight at 2am"
					maxlength="280"
					bind:value={announcementText}
					aria-label="Announcement text"
				/>
				<button
					class="btn-action"
					type="submit"
					disabled={broadcastBusy || !announcementText.trim()}
				>
					{#if broadcastBusy}
						<Loader2 size={14} class="spin" />
					{:else}
						<Megaphone size={14} aria-hidden="true" />
					{/if}
					Send
				</button>
			</form>
			{#if announcement}
				<div class="current-announcement">
					<span>Live now:</span>
					<q>{announcement.text}</q>
					<span class="ann-meta">
						by {announcement.by} · {fmtAge(announcement.at)}
					</span>
					<button
						class="btn-ghost"
						type="button"
						disabled={broadcastBusy}
						onclick={() => void clearAnnouncement()}
					>
						Remove
					</button>
				</div>
			{:else}
				<p class="no-announcement">No announcement currently live.</p>
			{/if}
		</div>
	</div>

	<!-- Stats -->
	<div class="admin-group">
		<div class="admin-group-title">
			<Activity size={14} aria-hidden="true" /> System stats
		</div>
		<div class="stats-actions">
			<button
				class="btn-ghost"
				type="button"
				disabled={statsLoading}
				onclick={() => void refreshStats()}
			>
				{#if statsLoading}
					<Loader2 size={14} class="spin" />
				{:else}
					<RefreshCw size={14} aria-hidden="true" />
				{/if}
				Refresh
			</button>
		</div>
		{#if stats}
			<div class="stats-grid">
				<div class="stat-item">
					<span class="stat-num">{stats.activeSessions}</span>active sessions
				</div>
				<div class="stat-item"><span class="stat-num">{stats.openRooms}</span>open rooms</div>
				<div class="stat-item"><span class="stat-num">{stats.totalUsers}</span>total users</div>
				<div class="stat-item"><span class="stat-num">{stats.totalMedia}</span>catalog items</div>
				<div class="stat-item">
					<span class="stat-num">{stats.totalWatchHistory}</span>watch entries
				</div>
				<div class="stat-item">
					<span class="stat-num">{stats.totalSavedQuotes}</span>saved quotes
				</div>
				<div class="stat-item">
					<span class="stat-num">{Math.floor(stats.uptimeSeconds / 60)}m</span>instance uptime
				</div>
				<div class="stat-item">
					<span class="stat-num">{fmtAge(stats.lastCatalogRefresh)}</span>last catalog refresh
				</div>
			</div>
			{#if stats.recentErrors.length > 0}
				<div class="recent-errors">
					<span class="recent-title">Recent errors on this instance:</span>
					<ul>
						{#each stats.recentErrors.slice(0, 5) as e, i (i)}
							<li>{fmtAge(e.at)} — {e.message}</li>
						{/each}
					</ul>
				</div>
			{/if}
		{:else}
			<p class="no-announcement">Stats unavailable.</p>
		{/if}
	</div>

	<!-- Feature flags -->
	<div class="admin-group">
		<div class="admin-group-title">
			<Flag size={14} aria-hidden="true" /> Feature flags
		</div>
		{#if flagsLoaded}
			<div class="flag-list">
				{#each Object.entries(flags) as [name, enabled] (name)}
					<div class="flag-row">
						<div class="flag-text">
							<strong>{name}</strong>
							<span class="flag-state" class:on={enabled}>{enabled ? 'enabled' : 'disabled'}</span>
						</div>
						<button
							class="btn-action"
							class:btn-danger={enabled}
							type="button"
							onclick={() => void toggleFlag(name, !enabled)}
						>
							{#if enabled}
								<X size={13} aria-hidden="true" />
								Disable
							{:else}
								<Check size={13} aria-hidden="true" />
								Enable
							{/if}
						</button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="no-announcement">Loading flags…</p>
		{/if}
	</div>
</div>

<style>
	.admin-panel {
		border-radius: var(--radius-xl);
		border: 1px solid rgba(124, 92, 252, 0.25);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.admin-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.admin-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--accent-color, #818cf8);
	}

	.admin-title h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: var(--font-weight-extrabold, 800);
		color: var(--text-primary);
	}

	.admin-link {
		font-size: 0.8rem;
		color: var(--accent-color, #818cf8);
		text-decoration: none;
	}

	.admin-link:hover {
		text-decoration: underline;
	}

	.result-banner {
		padding: 0.6rem 0.9rem;
		border-radius: var(--radius-md);
		font-size: 0.85rem;
		font-weight: var(--font-weight-medium, 500);
	}

	.result-ok {
		background: rgba(34, 197, 94, 0.1);
		border: 1px solid rgba(34, 197, 94, 0.35);
		color: #4ade80;
	}

	.result-bad {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.35);
		color: #f87171;
	}

	.admin-group {
		border-top: 1px solid var(--border-stream);
		padding-top: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.admin-group-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
		font-weight: var(--font-weight-semibold, 600);
	}

	.admin-option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.option-text {
		flex: 1 1 240px;
	}

	.option-text strong {
		font-size: 0.95rem;
		color: var(--text-primary);
	}

	.option-text p {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		color: var(--text-tertiary);
		line-height: 1.5;
	}

	.btn-action,
	.btn-danger,
	.btn-ghost {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.9rem;
		border-radius: var(--radius-md);
		font-size: 0.8rem;
		font-weight: var(--font-weight-semibold, 600);
		cursor: pointer;
		transition: all var(--transition-fast);
		font-family: inherit;
	}

	.btn-action {
		background: var(--gradient-brand);
		border: none;
		color: #fff;
	}

	.btn-action:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.btn-danger {
		background: transparent;
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #f87171;
	}

	.btn-danger:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.1);
	}

	.btn-danger:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.btn-ghost {
		background: var(--bg-elevated);
		border: 1px solid var(--border-stream);
		color: var(--text-secondary);
	}

	.btn-ghost:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.confirm-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.confirm-hint {
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	:global(.spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.broadcast-form {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		width: 100%;
	}

	.broadcast-input {
		flex: 1 1 220px;
		min-height: 38px;
		padding: 0.5rem 0.8rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-stream);
		background: var(--bg-root);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.85rem;
	}

	.current-announcement {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		padding: 0.6rem 0.9rem;
		border-radius: var(--radius-md);
		background: rgba(124, 92, 252, 0.08);
		border: 1px solid rgba(124, 92, 252, 0.3);
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.ann-meta {
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.no-announcement {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-tertiary);
	}

	.stats-actions {
		display: flex;
		justify-content: flex-end;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.6rem;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.6rem 0.8rem;
		border-radius: var(--radius-md);
		background: var(--bg-root);
		border: 1px solid var(--border-stream);
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.stat-num {
		font-size: 1.05rem;
		font-weight: var(--font-weight-bold, 700);
		color: var(--text-primary);
	}

	.recent-errors {
		margin-top: 0.6rem;
		font-size: 0.78rem;
		color: var(--text-tertiary);
	}

	.recent-title {
		display: block;
		margin-bottom: 0.3rem;
		color: var(--text-secondary);
	}

	.recent-errors ul {
		margin: 0;
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.flag-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.flag-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.55rem 0.8rem;
		border-radius: var(--radius-md);
		background: var(--bg-root);
		border: 1px solid var(--border-stream);
	}

	.flag-text {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.flag-state {
		padding: 0.05rem 0.45rem;
		border-radius: var(--radius-full);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: rgba(239, 68, 68, 0.12);
		border: 1px solid rgba(239, 68, 68, 0.35);
		color: #f87171;
	}

	.flag-state.on {
		background: rgba(34, 197, 94, 0.12);
		border: 1px solid rgba(34, 197, 94, 0.35);
		color: #4ade80;
	}
</style>
