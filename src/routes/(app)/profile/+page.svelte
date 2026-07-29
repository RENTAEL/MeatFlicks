<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { SEOHead } from '$lib/components/seo';

	let { data }: { data: PageData } = $props();

	let { profile, stats, recentHistory, watchlistPreview } = $derived(data);

	const tabs = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'history', label: `History (${stats.historyCount})` },
		{ id: 'watchlist', label: `Watchlist (${stats.watchlistCount})` },
	];

	let activeTab = $state('overview');

	function formatDate(ts: number) {
		return new Date(ts).toLocaleDateString('en-ZA', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}
</script>

<SEOHead title="Profile — Streamium" description="Manage your Streamium profile" noindex />

<div class="profile-page">
	<div class="profile-header glass">
		<div class="avatar-circle">
			{profile.username.charAt(0).toUpperCase()}
		</div>
		<div class="profile-info">
			<h1>{profile.username}</h1>
			{#if profile.email}
				<p class="email">{profile.email}</p>
			{/if}
			<p class="member-since">Member since {profile.memberSince}</p>
		</div>
		<button class="btn btn-secondary edit-btn" onclick={() => goto('/profile/edit')}>
			Edit Profile
		</button>
	</div>

	<div class="stats-row">
		<div class="stat-card glass">
			<span class="stat-number">{stats.watchlistCount}</span>
			<span class="stat-label">Watchlist</span>
		</div>
		<div class="stat-card glass">
			<span class="stat-number">{stats.historyCount}</span>
			<span class="stat-label">Watched</span>
		</div>
	</div>

	<div class="tabs">
		{#each tabs as tab}
			<button
				class="tab-btn"
				class:active={activeTab === tab.id}
				onclick={() => (activeTab = tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	{#if activeTab === 'overview'}
		<section class="section">
			<h2>Recently Watched</h2>
			{#if recentHistory.length > 0}
				<div class="media-grid">
					{#each recentHistory as item}
						<a
							href="/{item.mediaType === 'tv' ? 'tv' : 'movie'}/{item.mediaId}"
							class="media-card glow-on-hover"
						>
							{#if item.posterPath}
								<img
									src={item.posterPath}
									alt={item.title}
									loading="lazy"
								/>
							{:else}
								<div class="poster-placeholder">No Poster</div>
							{/if}
							<span class="media-title">{item.title}</span>
							<span class="media-date">{formatDate(item.watchedAt)}</span>
						</a>
					{/each}
				</div>
			{:else}
				<p class="empty-state">Nothing watched yet. Go find something!</p>
			{/if}
		</section>

		<section class="section">
			<h2>Watchlist</h2>
			{#if watchlistPreview.length > 0}
				<div class="media-grid">
					{#each watchlistPreview as item}
						<a
							href="/{item.mediaType === 'tv' ? 'tv' : 'movie'}/{item.mediaId}"
							class="media-card glow-on-hover"
						>
							{#if item.posterPath}
								<img
									src={item.posterPath}
									alt={item.title}
									loading="lazy"
								/>
							{:else}
								<div class="poster-placeholder">No Poster</div>
							{/if}
							<span class="media-title">{item.title}</span>
						</a>
					{/each}
				</div>
				{#if stats.watchlistCount > 10}
					<button class="view-all" onclick={() => (activeTab = 'watchlist')}>
						View all {stats.watchlistCount} →
					</button>
				{/if}
			{:else}
				<p class="empty-state">Your watchlist is empty. Add some movies or shows!</p>
			{/if}
		</section>
	{/if}

	{#if activeTab === 'history'}
		<section class="section">
			<h2>Watch History</h2>
			{#if stats.historyCount > 0}
				<p>Full history — {stats.historyCount} items</p>
			{:else}
				<p class="empty-state">No watch history yet.</p>
			{/if}
		</section>
	{/if}

	{#if activeTab === 'watchlist'}
		<section class="section">
			<h2>My Watchlist</h2>
			{#if stats.watchlistCount > 0}
				<p>Full watchlist — {stats.watchlistCount} items</p>
			{:else}
				<p class="empty-state">Your watchlist is empty.</p>
			{/if}
		</section>
	{/if}
</div>

<style>
	.profile-page {
		max-width: 900px;
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

	.profile-info h1 {
		margin: 0;
		font-size: 1.8rem;
		color: var(--text-primary);
	}

	.profile-info .email {
		color: var(--text-secondary);
		margin: 0.25rem 0 0;
		font-size: 0.95rem;
	}

	.profile-info .member-since {
		color: var(--text-tertiary);
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
	}

	.edit-btn {
		margin-left: auto;
	}

	.stats-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		border-radius: var(--radius-lg);
		padding: 1.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.stat-number {
		font-size: 2rem;
		font-weight: var(--font-weight-bold);
		color: var(--accent-stream);
	}

	.stat-label {
		font-size: 0.9rem;
		color: var(--text-secondary);
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		border-bottom: 2px solid var(--border-stream);
		margin-bottom: 2rem;
		padding-bottom: 0;
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
	}

	.tab-btn:hover {
		color: var(--text-primary);
	}

	.tab-btn.active {
		color: var(--accent-stream);
		border-bottom-color: var(--accent-stream);
	}

	.section h2 {
		font-size: 1.3rem;
		margin: 0 0 1rem;
		color: var(--text-primary);
	}

	.media-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 1rem;
	}

	.media-card {
		text-decoration: none;
		color: inherit;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--bg-card);
		transition: transform var(--transition-base);
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
		background: var(--bg-input);
		color: var(--text-tertiary);
	}

	.media-title {
		display: block;
		padding: 0.5rem;
		font-size: 0.85rem;
		font-weight: var(--font-weight-semibold);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-primary);
	}

	.media-date {
		display: block;
		padding: 0 0.5rem 0.5rem;
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}

	.empty-state {
		color: var(--text-secondary);
		font-style: italic;
		padding: 2rem 0;
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
		transition: transform var(--transition-base), box-shadow var(--transition-base);
	}

	.glow-on-hover:hover {
		box-shadow: 0 0 20px var(--accent-glow);
	}

	@media (max-width: 600px) {
		.profile-header {
			flex-direction: column;
			text-align: center;
		}

		.edit-btn {
			margin-left: 0;
			margin-top: 0.5rem;
		}

		.tabs {
			overflow-x: auto;
		}
	}
</style>
