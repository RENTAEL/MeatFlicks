<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import MediaCard from '$lib/components/MediaCard.svelte';
	import SkeletonCard from '$lib/components/SkeletonCard.svelte';
	import { fly } from 'svelte/transition';

	let { data }: { data: PageData } = $props();

	let movies = $state(data.movies || []);
	let currentPage = $state(data.page || 1);
	let hasMore = $state(data.hasMore ?? false);
	let loadingMore = $state(false);

	$effect(() => {
		if (data.movies) movies = data.movies;
		currentPage = data.page || 1;
		hasMore = data.hasMore ?? false;
	});

	let initialLoad = $derived(!movies.length);

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		const nextPage = currentPage + 1;
		try {
			const res = await fetch(`/afrikaans/api/discover?page=${nextPage}`);
			if (!res.ok) throw new Error('Failed');
			const json = await res.json();
			movies = [...movies, ...(json.results || [])];
			currentPage = nextPage;
			hasMore = json.hasMore ?? false;
			goto(`/afrikaans?page=${nextPage}`, { replaceState: true, noScroll: true });
		} catch {
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head>
	<title>Afrikaans Films — Streamium</title>
	<meta name="description" content="Browse Afrikaans-language films and South African cinema." />
</svelte:head>

<div class="afrikaans-page">
	<div class="page-hero">
		<h1 class="page-title">Afrikaans Films</h1>
		<p class="page-subtitle">Afrikaans-language cinema and South African film</p>
	</div>

	{#if initialLoad}
		<div class="movie-grid">
			{#each Array(20) as _, i}
				<div in:fly={{ y: 10, duration: 150, delay: i * 30 }}>
					<SkeletonCard />
				</div>
			{/each}
		</div>
	{:else if movies.length === 0}
		<div class="empty-state">
			<p>Geen Afrikaanse films gevind nie.</p>
		</div>
	{:else if data.error}
		<div class="error-state">
			<p>Failed to load films.</p>
			<button class="retry-btn" onclick={() => goto('/afrikaans')}>Retry</button>
		</div>
	{:else}
		<div class="movie-grid">
			{#each movies as movie, i (movie.id)}
				<div in:fly={{ y: 20, duration: 200, delay: Math.min(i * 30, 400) }}>
					<MediaCard media={movie} href="/afrikaans/{movie.tmdbId || movie.id}" />
				</div>
			{/each}
		</div>

		{#if hasMore}
			<div class="load-more-wrap">
				{#if loadingMore}
					<div class="spinner"></div>
				{:else}
					<button class="load-more-btn" onclick={loadMore}>
						Laai Meer / Load More
					</button>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.afrikaans-page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 40px 24px;
	}

	.page-hero { margin-bottom: 36px; }
	.page-title {
		font-size: 32px; font-weight: 800;
		color: #e0e7ff; margin: 0 0 8px;
	}
	.page-subtitle {
		font-size: 15px; color: #a5b4fc; margin: 0;
	}

	.movie-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 20px;
	}



	.empty-state, .error-state {
		text-align: center; padding: 80px 20px;
		color: #a5b4fc; font-size: 16px;
	}

	.retry-btn {
		margin-top: 12px;
		background: #818cf8; color: #fff;
		border: none; padding: 10px 24px;
		border-radius: 8px; cursor: pointer;
	}

	.load-more-wrap { text-align: center; padding: 40px 0; }

	.load-more-btn {
		background: rgba(129, 140, 248, 0.1);
		color: #c7d2fe; border: 1px solid rgba(129, 140, 248, 0.2);
		padding: 12px 32px; border-radius: 10px;
		font-size: 14px; cursor: pointer;
	}
	.load-more-btn:hover { background: rgba(129, 140, 248, 0.2); color: #e0e7ff; }

	.spinner {
		width: 32px; height: 32px;
		border: 3px solid rgba(129, 140, 248, 0.2);
		border-top-color: #818cf8; border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	@media (max-width: 640px) {
		.afrikaans-page { padding: 24px 16px; }
		.page-title { font-size: 24px; }
		.movie-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
	}
</style>
