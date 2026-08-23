<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Eye, Play, Pause, ChevronUp, ChevronDown } from '@lucide/svelte';
	import { liveSessions, connectLiveSessions } from '$lib/admin/liveSessions.svelte';

	const OPEN_KEY = 'admin-stats-open';

	let open = $state(true);
	let tick = $state(0);
	let tickTimer: ReturnType<typeof setInterval> | null = null;
	let disconnect: (() => void) | null = null;

	onMount(() => {
		try {
			open = localStorage.getItem(OPEN_KEY) !== '0';
		} catch {}
		disconnect = connectLiveSessions();
		tickTimer = setInterval(() => (tick += 1), 15000);
		return () => {
			disconnect?.();
			if (tickTimer) clearInterval(tickTimer);
		};
	});

	function toggle() {
		open = !open;
		try {
			localStorage.setItem(OPEN_KEY, open ? '1' : '0');
		} catch {}
	}

	function sectionOf(path: string | null): { label: string; emoji: string } {
		const p = (path ?? '/').toLowerCase();
		if (p.startsWith('/afrikaans')) return { label: 'Afrikaans', emoji: '🇿🇦' };
		if (p.startsWith('/watch/')) return { label: 'Watch Party', emoji: '🍿' };
		if (p.startsWith('/watch-party')) return { label: 'WP Lobby', emoji: '🍿' };
		if (p.startsWith('/movie') || p.startsWith('/tv')) return { label: 'Catalog', emoji: '🎬' };
		if (p.startsWith('/search')) return { label: 'Search', emoji: '🔍' };
		if (p.startsWith('/watchlist')) return { label: 'My List', emoji: '📋' };
		if (p.startsWith('/profile') || p.startsWith('/settings'))
			return { label: 'Account', emoji: '👤' };
		if (p.startsWith('/admin')) return { label: 'Admin', emoji: '🛠️' };
		if (p.startsWith('/genre') || p.startsWith('/explore')) return { label: 'Browse', emoji: '🧭' };
		return { label: 'Home', emoji: '🏠' };
	}

	function playbackOf(playing: boolean | null): { label: string; cls: string } {
		void tick;
		if (playing === true) return { label: '▶ Playing', cls: 'pb-playing' };
		if (playing === false) return { label: '⏸ Paused', cls: 'pb-paused' };
		return { label: '👁 Viewing', cls: 'pb-viewing' };
	}

	function duration(fromMs: number): string {
		void tick;
		const secs = Math.max(0, Math.floor((Date.now() - fromMs) / 1000));
		if (secs < 60) return `${secs}s`;
		const mins = Math.floor(secs / 60);
		if (mins < 60) return `${mins}m ${secs % 60}s`;
		const hrs = Math.floor(mins / 60);
		return `${hrs}h ${mins % 60}m`;
	}

	function shortLabel(userId: string): string {
		if (userId.startsWith('guest:')) return `Guest ·${userId.slice(6, 12)}`;
		return userId.length > 10 ? `${userId.slice(0, 8)}…` : userId;
	}
</script>

<div class="stats">
	<button type="button" class="stats-head" onclick={toggle} aria-expanded={open}>
		<span class="stats-title">
			<Eye size={14} aria-hidden="true" /> Live Session Stats
			<span class="stats-count">{liveSessions.users.length}</span>
		</span>
		{#if open}<ChevronUp size={15} aria-hidden="true" />{:else}<ChevronDown
				size={15}
				aria-hidden="true"
			/>{/if}
	</button>

	{#if open}
		{#if liveSessions.users.length === 0}
			<p class="stats-empty">Nobody online right now.</p>
		{:else}
			<div class="stats-rows" role="table" aria-label="Current viewer sessions">
				{#each liveSessions.users as u (u.userId)}
					{@const section = sectionOf(u.path)}
					{@const pb = playbackOf(u.playing ?? null)}
					<div class="stats-row" role="row">
						<span class="r-user" role="cell" title={u.username}>
							{u.username === 'Guest' ? shortLabel(u.userId) : u.username}
						</span>
						<span class="r-section" role="cell"
							>{section.emoji} {section.label}{u.roomTitle ? ' · room' : ''}</span
						>
						<span class="r-title" role="cell" title={u.title ?? ''}>{u.title ?? '—'}</span>
						<span class="r-play {pb.cls}" role="cell">{pb.label}</span>
						<span class="r-dur" role="cell">{duration(u.joinedAt)}</span>
					</div>
					{#if u.roomTitle}
						<div class="stats-sub">
							Watch party: {u.roomTitle}{u.roomHost ? ' · hosting' : ''}
						</div>
					{/if}
				{/each}
			</div>
			<p class="stats-note">Updates live via the presence stream.</p>
		{/if}
	{/if}
</div>

<style>
	.stats {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.02);
	}
	.stats-head {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.85rem;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 700;
	}
	.stats-head:hover {
		background: rgba(255, 255, 255, 0.04);
	}
	.stats-title {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}
	.stats-count {
		padding: 0.05rem 0.5rem;
		border-radius: 999px;
		background: var(--afrikaans-accent-soft, rgba(245, 166, 35, 0.14));
		color: var(--afrikaans-accent, #f5a623);
		font-size: 0.75rem;
	}
	.stats-empty,
	.stats-note {
		margin: 0;
		padding: 0.65rem 0.85rem 0.8rem;
		font-size: 0.78rem;
		color: #a1a1aa;
	}
	.stats-rows {
		display: flex;
		flex-direction: column;
	}
	.stats-row {
		display: grid;
		grid-template-columns: minmax(90px, 1.1fr) minmax(100px, 1fr) minmax(120px, 1.6fr) 84px 64px;
		gap: 0.4rem;
		align-items: center;
		padding: 0.45rem 0.85rem;
		font-size: 0.78rem;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
	.stats-row:nth-child(odd of .stats-row) {
		background: rgba(255, 255, 255, 0.02);
	}
	.r-user {
		font-weight: 700;
		color: #fafafa;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.r-section {
		color: #d4d4d8;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.r-title {
		color: #a1a1aa;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.r-play {
		white-space: nowrap;
	}
	.pb-playing {
		color: #4ade80;
	}
	.pb-paused {
		color: #fbbf24;
	}
	.pb-viewing {
		color: #71717a;
	}
	.r-dur {
		color: #a1a1aa;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.stats-sub {
		padding: 0.2rem 0.85rem 0.5rem;
		font-size: 0.72rem;
		color: #71717a;
	}
	@media (max-width: 720px) {
		.stats-row {
			grid-template-columns: 1fr 1fr;
			row-gap: 0.15rem;
		}
		.r-title {
			grid-column: 1 / -1;
		}
		.r-play {
			justify-self: start;
		}
		.r-dur {
			justify-self: end;
		}
	}
</style>
