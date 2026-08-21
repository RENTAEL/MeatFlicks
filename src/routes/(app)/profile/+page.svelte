<script lang="ts">
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { SEOHead } from '$lib/components/seo';
	import { watchlist } from '$lib/state/stores/watchlistStore.svelte';
	import { watchHistory } from '$lib/state/stores/historyStore.svelte';
	import { Trash2, Film, Tv, Lock, Check, Clock, Flame } from '@lucide/svelte';
	import { getBranding } from '$lib/utils/branding';
	import { impersonationStore } from '$lib/state/stores/impersonationStore.svelte.ts';
	import DemonSlayerEye from '$lib/components/branding/DemonSlayerEye.svelte';
	import { page as pageState } from '$app/state';
	import { isUser2 } from '$lib/experiments/user2';
	import TimeSinceJoined from '$lib/experiments/user2/TimeSinceJoined.svelte';
	import StreakBadge from '$lib/experiments/user2/StreakBadge.svelte';
	import RotatingTagline from '$lib/experiments/user2/RotatingTagline.svelte';
	import MoodSelector from '$lib/experiments/user2/MoodSelector.svelte';

	type FormResult = {
		success?: boolean;
		username?: string;
		errors?: Record<string, string>;
	};

	let { data, form }: { data: PageData; form: FormResult | undefined } = $props();

	let { profile, stats, history, watchlist: watchlistItems } = $derived(data);

	// Demon Slayer personalization for aftermidnight (per-user theme)
	const impersonated = $derived(impersonationStore.current);
	const effectiveProfile = $derived(impersonated ?? profile);
	const isDemonSlayer = $derived(
		getBranding({
			displayName: effectiveProfile.username,
			email: effectiveProfile.email ?? null
		}) === 'demon_slayer'
	);
	const isUser2Profile = $derived(
		isUser2(effectiveProfile as any) || isUser2(pageState.data.user as any)
	);

	const tabs: { id: TabId; label: string }[] = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'history', label: `History (${stats.watchedCount})` },
		{ id: 'watchlist', label: `Watchlist (${stats.watchlistCount})` },
		{ id: 'quotes', label: 'Saved Quotes' }
	];

	type TabId = 'overview' | 'history' | 'watchlist' | 'quotes';

	let activeTab = $state<TabId>('overview');
	let editingName = $state(false);
	let saveError = $state('');
	let removed: string[] = $state([]);
	let clearingHistory = $state(false);

	type SavedQuotesModule = typeof import('$lib/components/profile/SavedQuotesSection.svelte');
	let SavedQuotesComp = $state<SavedQuotesModule['default'] | null>(null);

	function onTabChange(id: TabId) {
		activeTab = id;
		if (id === 'quotes' && !SavedQuotesComp) {
			import('$lib/components/profile/SavedQuotesSection.svelte').then((m) => {
				SavedQuotesComp = m.default;
			});
		}
	}

	function formatDate(ts: number) {
		return new Date(ts).toLocaleDateString('en-ZA', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	async function removeFromWatchlist(mediaId: string) {
		if (removed.includes(mediaId)) return;
		removed = [...removed, mediaId];
		try {
			await watchlist.removeFromWatchlist(mediaId);
			await invalidateAll();
		} catch {
			removed = removed.filter((id) => id !== mediaId);
		}
	}

	async function clearHistory() {
		if (clearingHistory) return;
		clearingHistory = true;
		try {
			await watchHistory.clear();
			await invalidateAll();
		} finally {
			clearingHistory = false;
		}
	}

	function startEdit() {
		saveError = '';
		editingName = true;
	}
</script>

<SEOHead title="Profile — Streamium" description="Manage your Streamium profile" noindex />

<svelte:head>
	<title>Profile | Streamium</title>
	<meta
		name="description"
		content="Manage your Streamium account, preferences, and viewing stats."
	/>
	<meta property="og:title" content="Profile — Streamium" />
	<meta property="og:type" content="website" />
</svelte:head>

<div class="profile-page">
	{#if isDemonSlayer}
		<div class="demon-slayer-banner">
			<div class="demon-slayer-greeting">
				<Flame size="18" class="demon-flame-icon" />
				<div class="demon-greeting-main">
					<span class="demon-greeting-text">
						Total Concentration — Moon Breathing. The night is yours, {effectiveProfile.username}.
					</span>
					<span class="demon-greeting-line"
						>Set your heart ablaze and cut through the darkness.</span
					>
				</div>
				<span class="demon-greeting-sub">— Flame Hashira · Demon Slayer Corps</span>
			</div>
			<div class="demon-slayer-motif" aria-hidden="true">◈</div>
		</div>
	{/if}
	<div class="profile-header glass" class:demon-slayer-header={isDemonSlayer}>
		{#if isDemonSlayer}
			<div class="avatar-demon">
				<DemonSlayerEye size="lg" />
			</div>
		{:else}
			<div class="avatar-circle">{profile.username.charAt(0).toUpperCase()}</div>
		{/if}
		<div class="profile-info">
			{#if editingName}
				<form
					class="name-form"
					method="POST"
					action="?/saveProfile"
					use:enhance={() => {
						saveError = '';
						return async ({ result, update }) => {
							if (result.type === 'success') {
								await update();
								editingName = false;
								await invalidateAll();
							} else if (result.type === 'failure') {
								const data = result.data as FormResult | undefined;
								if (data?.errors?.username) {
									saveError = data.errors.username;
								}
							}
						};
					}}
				>
					<input
						type="text"
						name="username"
						value={profile.username}
						minlength="3"
						maxlength="31"
						pattern="[a-zA-Z0-9_\-]+"
						aria-label="Display name"
						required
					/>
					<input type="hidden" name="csrf_token" value={data.csrfToken} />
					<button type="submit" class="btn btn-primary" aria-label="Save display name">
						<Check size="16" />
					</button>
				</form>
				{#if saveError}
					<p class="save-error">{saveError}</p>
				{/if}
			{:else}
				<h1 class="profile-username">
					{profile.username}
					<StreakBadge />
				</h1>
				<RotatingTagline />
				{#if profile.email}
					<p class="email">
						{profile.email}
						<span class="email-lock"><Lock size="12" /> read-only</span>
					</p>
				{/if}
				<p class="member-since">Member since {profile.memberSince}</p>
			{/if}
			{#if form?.success}
				<p class="save-success">Display name updated to “{form.username}”</p>
			{/if}
		</div>
		<div class="header-actions">
			{#if !editingName}
				<button class="btn btn-secondary" onclick={startEdit}>Edit Display Name</button>
				<a class="btn btn-secondary" href="/profile/edit">Change Password</a>
			{/if}
		</div>
	</div>

	{#if data.error}
		<p class="load-error">{data.error}</p>
	{/if}

	<div class="stats-row">
		<div class="stat-card glass">
			<span class="stat-number">{stats.watchedCount}</span>
			<span class="stat-label">Watched</span>
		</div>
		<div class="stat-card glass">
			<span class="stat-number">{stats.moviesWatched}</span>
			<span class="stat-label"><Film size="14" /> Movies</span>
		</div>
		<div class="stat-card glass">
			<span class="stat-number">{stats.tvWatched}</span>
			<span class="stat-label"><Tv size="14" /> TV Shows</span>
		</div>
		<div class="stat-card glass">
			<span class="stat-number">{stats.watchlistCount}</span>
			<span class="stat-label">Watchlist</span>
		</div>
		{#if stats.totalHours > 0}
			<div class="stat-card glass">
				<span class="stat-number">{stats.totalHours}h</span>
				<span class="stat-label">Time Watched</span>
			</div>
		{/if}
	</div>

	<div class="user2-widgets">
		<TimeSinceJoined />
		<MoodSelector />
	</div>

	<div class="tabs">
		{#each tabs as tab}
			<button
				class="tab-btn"
				class:active={activeTab === tab.id}
				onclick={() => onTabChange(tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if activeTab === 'overview'}
		<section class="section">
			<div class="section-head">
				<h2><Clock size="18" /> Recently Watched</h2>
			</div>
			{#if history.length > 0}
				<div class="media-grid">
					{#each history.slice(0, 12) as item}
						<a
							href="/{item.mediaType === 'tv' ? 'tv' : 'movie'}/{item.tmdbId}"
							class="media-card glow-on-hover"
						>
							{#if item.posterPath}
								<img src={item.posterPath} alt={item.title ?? ''} loading="lazy" />
							{:else}
								<div class="poster-placeholder">{item.title ?? 'Watched'}</div>
							{/if}
							<span class="media-title">{item.title ?? 'Unknown title'}</span>
							<span class="media-date">{formatDate(item.watchedAt)}</span>
						</a>
					{/each}
				</div>
				{#if stats.watchedCount > 12}
					<button class="view-all" onclick={() => (activeTab = 'history')}>
						View all {stats.watchedCount} →
					</button>
				{/if}
			{:else}
				<p class="empty-state">
					Nothing watched yet. <a class="empty-link" href="/browse">Go find something!</a>
				</p>
			{/if}
		</section>

		<section class="section">
			<div class="section-head">
				<h2>Watchlist</h2>
			</div>
			{#if watchlistItems.length > 0}
				<div class="media-grid">
					{#each watchlistItems.slice(0, 8) as item}
						<div class="media-card-wrap">
							<a
								href="/{item.mediaType === 'tv' ? 'tv' : 'movie'}/{item.tmdbId}"
								class="media-card glow-on-hover"
							>
								{#if item.posterPath}
									<img src={item.posterPath} alt={item.title} loading="lazy" />
								{:else}
									<div class="poster-placeholder">{item.title}</div>
								{/if}
								<span class="media-title">{item.title}</span>
								<span class="media-date">
									{item.mediaType === 'tv' ? 'TV Show' : 'Movie'}
								</span>
							</a>
							<button
								class="remove-btn"
								aria-label={`Remove ${item.title} from watchlist`}
								disabled={removed.includes(item.id)}
								onclick={() => removeFromWatchlist(item.id)}
							>
								<Trash2 size="14" />
							</button>
						</div>
					{/each}
				</div>
				{#if stats.watchlistCount > 8}
					<button class="view-all" onclick={() => (activeTab = 'watchlist')}>
						View all {stats.watchlistCount} →
					</button>
				{/if}
			{:else}
				<p class="empty-state">
					Your watchlist is empty. <a class="empty-link" href="/browse">Browse movies &amp; shows</a
					>
				</p>
			{/if}
		</section>
	{/if}

	{#if activeTab === 'history'}
		<section class="section">
			<div class="section-head">
				<h2>Watch History</h2>
				{#if history.length > 0}
					<button class="view-all clear-btn" disabled={clearingHistory} onclick={clearHistory}>
						<Trash2 size="14" />
						{clearingHistory ? 'Clearing…' : 'Clear history'}
					</button>
				{/if}
			</div>
			{#if history.length > 0}
				<div class="media-grid">
					{#each history as item}
						<a
							href="/{item.mediaType === 'tv' ? 'tv' : 'movie'}/{item.tmdbId}"
							class="media-card glow-on-hover"
						>
							{#if item.posterPath}
								<img src={item.posterPath} alt={item.title ?? ''} loading="lazy" />
							{:else}
								<div class="poster-placeholder">{item.title ?? 'Watched'}</div>
							{/if}
							<span class="media-title">{item.title ?? 'Unknown title'}</span>
							<span class="media-date">{formatDate(item.watchedAt)}</span>
						</a>
					{/each}
				</div>
			{:else}
				<p class="empty-state">
					No watch history yet. <a class="empty-link" href="/browse">Go find something!</a>
				</p>
			{/if}
		</section>
	{/if}

	{#if activeTab === 'watchlist'}
		<section class="section">
			<div class="section-head">
				<h2>My Watchlist</h2>
			</div>
			{#if watchlistItems.length > 0}
				<div class="media-grid">
					{#each watchlistItems as item}
						<div class="media-card-wrap">
							<a
								href="/{item.mediaType === 'tv' ? 'tv' : 'movie'}/{item.tmdbId}"
								class="media-card glow-on-hover"
							>
								{#if item.posterPath}
									<img src={item.posterPath} alt={item.title} loading="lazy" />
								{:else}
									<div class="poster-placeholder">{item.title}</div>
								{/if}
								<span class="media-title">{item.title}</span>
								<span class="media-date">
									{item.mediaType === 'tv' ? 'TV Show' : 'Movie'}
								</span>
							</a>
							<button
								class="remove-btn"
								aria-label={`Remove ${item.title} from watchlist`}
								disabled={removed.includes(item.id)}
								onclick={() => removeFromWatchlist(item.id)}
							>
								<Trash2 size="14" />
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="empty-state">
					Your watchlist is empty. <a class="empty-link" href="/browse">Browse movies &amp; shows</a
					>
				</p>
			{/if}
		</section>
	{/if}

	{#if activeTab === 'quotes'}
		{#if SavedQuotesComp}
			<SavedQuotesComp />
		{:else}
			<section class="section">
				<div class="section-head">
					<h2>Saved Quotes</h2>
				</div>
				<p class="empty-state">Loading your saved quotes…</p>
			</section>
		{/if}
	{/if}
</div>

<style>
	.load-error {
		color: var(--color-danger, #f87171);
		background: rgba(248, 113, 113, 0.1);
		border: 1px solid var(--color-danger, #f87171);
		border-radius: var(--radius-md);
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
	}

	.demon-slayer-banner {
		position: relative;
		overflow: hidden;
		margin-bottom: 1.5rem;
		padding: 1.15rem 1.35rem;
		border-radius: var(--radius-lg);
		background:
			radial-gradient(ellipse 80% 100% at 0% 0%, rgba(255, 42, 18, 0.14) 0%, transparent 55%),
			radial-gradient(ellipse 70% 80% at 100% 100%, rgba(255, 107, 0, 0.1) 0%, transparent 50%),
			linear-gradient(135deg, rgba(255, 26, 26, 0.1), rgba(255, 107, 0, 0.08));
		border: 1px solid rgba(255, 42, 18, 0.22);
		box-shadow:
			0 4px 20px rgba(0, 0, 0, 0.35),
			0 0 28px rgba(255, 42, 18, 0.1);
	}

	.demon-slayer-greeting {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		color: var(--text-primary);
	}

	.demon-flame-icon {
		color: #ff3b30;
		filter: drop-shadow(0 0 6px rgba(255, 59, 48, 0.55));
		flex-shrink: 0;
	}

	.demon-greeting-main {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		flex: 1;
		min-width: 220px;
	}

	.demon-greeting-text {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}

	.demon-greeting-line {
		font-size: 0.85rem;
		color: var(--text-secondary);
	}

	.demon-greeting-sub {
		font-size: 0.74rem;
		color: var(--text-tertiary);
		font-style: italic;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.demon-slayer-motif {
		position: absolute;
		top: 50%;
		right: 1.2rem;
		transform: translateY(-50%);
		font-size: 3.2rem;
		opacity: 0.06;
		color: #ff3b30;
		pointer-events: none;
	}

	.demon-slayer-header {
		position: relative;
		overflow: hidden;
		border: 1px solid rgba(255, 42, 18, 0.18) !important;
		box-shadow:
			0 0 0 1px rgba(255, 42, 18, 0.08),
			0 8px 28px rgba(0, 0, 0, 0.35),
			0 0 24px rgba(255, 42, 18, 0.06);
	}

	.demon-slayer-header::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 60% 80% at 95% 10%, rgba(255, 42, 18, 0.07) 0%, transparent 55%),
			linear-gradient(90deg, transparent 0%, rgba(255, 107, 0, 0.04) 100%);
		pointer-events: none;
	}

	.avatar-demon {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, #2a0a0a 0%, #1a0505 100%);
		border: 2px solid rgba(255, 59, 48, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-shadow:
			0 0 12px rgba(255, 59, 48, 0.3),
			0 0 24px rgba(255, 140, 0, 0.15);
		padding: 6px;
	}

	.profile-page {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.profile-header {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 2rem;
		border-radius: var(--radius-lg);
		margin-bottom: 2rem;
		flex-wrap: wrap;
	}

	.profile-username {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.user2-widgets {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	@media (max-width: 640px) {
		.user2-widgets {
			grid-template-columns: 1fr;
		}
	}

	.avatar-circle {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: var(--gradient-brand);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		font-weight: var(--font-weight-bold);
		color: white;
		flex-shrink: 0;
	}

	.profile-info {
		min-width: 0;
	}

	.profile-info h1 {
		margin: 0;
		font-size: 1.8rem;
		color: var(--text-primary);
	}

	.profile-info .email {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-secondary);
		margin: 0.25rem 0 0;
		font-size: 0.95rem;
	}

	.email-lock {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.7rem;
		color: var(--text-tertiary);
		background: var(--bg-input);
		padding: 0.1rem 0.4rem;
		border-radius: var(--radius-full);
	}

	.profile-info .member-since {
		color: var(--text-tertiary);
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
	}

	.name-form {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.name-form input {
		background: var(--bg-input);
		border: 1px solid var(--border-stream);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		padding: 0.5rem 0.75rem;
		font-size: 1.1rem;
		width: 100%;
		max-width: 280px;
	}

	.name-form button {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 0.9rem;
	}

	.save-error {
		color: var(--color-danger, #f87171);
		font-size: 0.85rem;
		margin: 0.4rem 0 0;
	}

	.save-success {
		color: var(--color-success, #4ade80);
		font-size: 0.85rem;
		margin: 0.4rem 0 0;
	}

	.header-actions {
		margin-left: auto;
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.stats-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		border-radius: var(--radius-lg);
		padding: 1.5rem 1rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}

	.stat-number {
		font-size: 2rem;
		font-weight: var(--font-weight-bold);
		color: var(--accent-stream);
	}

	.stat-label {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		border-bottom: 2px solid var(--border-stream);
		margin-bottom: 2rem;
	}

	.tab-btn {
		padding: 0.7rem 1.2rem;
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.95rem;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition: all var(--transition-fast);
		white-space: nowrap;
	}

	.tab-btn:hover {
		color: var(--text-primary);
	}

	.tab-btn.active {
		color: var(--accent-stream);
		border-bottom-color: var(--accent-stream);
	}

	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin: 0 0 1rem;
	}

	.section-head h2 {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 1.3rem;
		margin: 0;
		color: var(--text-primary);
	}

	.media-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 1rem;
	}

	.media-card-wrap {
		position: relative;
	}

	.media-card {
		text-decoration: none;
		color: inherit;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--bg-card);
		transition: transform var(--transition-base);
		display: block;
	}

	.media-card:hover {
		transform: translateY(-4px);
	}

	.media-card img {
		width: 100%;
		aspect-ratio: 2 / 3;
		object-fit: cover;
		display: block;
	}

	.poster-placeholder {
		width: 100%;
		aspect-ratio: 2 / 3;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.9rem;
		text-align: center;
		padding: 0.5rem;
		background: var(--bg-input);
		color: var(--text-tertiary);
		box-sizing: border-box;
	}

	.media-title {
		display: block;
		padding: 0.5rem 0.5rem 0;
		font-size: 0.85rem;
		font-weight: var(--font-weight-semibold);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-primary);
	}

	.media-date {
		display: block;
		padding: 0.15rem 0.5rem 0.5rem;
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.remove-btn {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: none;
		background: rgba(0, 0, 0, 0.65);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		transition: opacity var(--transition-fast);
	}

	.media-card-wrap:hover .remove-btn,
	.remove-btn:focus-visible {
		opacity: 1;
	}

	.remove-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.clear-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin: 0;
		border-color: var(--color-danger, #f87171);
		color: var(--color-danger, #f87171);
	}

	.clear-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.empty-state {
		color: var(--text-secondary);
		font-style: italic;
		padding: 2rem 0;
	}

	.empty-link {
		color: var(--accent-stream);
		text-decoration: none;
		font-style: normal;
	}

	.empty-link:hover {
		text-decoration: underline;
	}

	.view-all {
		display: block;
		margin: 1rem auto 0;
		padding: 0.5rem 1.5rem;
		background: none;
		border: 1px solid var(--border-stream);
		border-radius: var(--radius-full);
		color: var(--accent-stream);
		cursor: pointer;
		font-size: 0.9rem;
		transition: all var(--transition-fast);
	}

	.view-all:hover {
		background: var(--accent-soft);
	}

	.glow-on-hover {
		transition:
			transform var(--transition-base),
			box-shadow var(--transition-base);
	}

	.glow-on-hover:hover {
		box-shadow: 0 0 20px var(--accent-glow);
	}

	@media (max-width: 600px) {
		.profile-header {
			flex-direction: column;
			text-align: center;
		}

		.header-actions {
			margin-left: 0;
			justify-content: center;
		}

		.tabs {
			overflow-x: auto;
		}

		.name-form {
			flex-direction: column;
		}

		.name-form input {
			max-width: none;
		}

		.remove-btn {
			opacity: 1;
		}
	}
</style>
