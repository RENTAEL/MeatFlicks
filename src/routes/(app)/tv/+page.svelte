<script lang="ts">
	import ContentRow from '$lib/components/ContentRow.svelte';
	import HeroCarousel from '$lib/components/HeroCarousel.svelte';
	import SkeletonRow from '$lib/components/SkeletonRow.svelte';

	let trendingShows = $state<any[]>([]);
	let popularShows = $state<any[]>([]);
	let topRatedShows = $state<any[]>([]);
	let onTheAir = $state<any[]>([]);
	let isLoading = $state(true);

	async function load() {
		isLoading = true;
		try {
			const [trending, popular, topRated, onAir] = await Promise.all([
				fetch('/api/tmdb/tv/trending').then(r => r.json()),
				fetch('/api/tmdb/tv/popular').then(r => r.json()),
				fetch('/api/tmdb/tv/top-rated').then(r => r.json()),
				fetch('/api/tmdb/tv/on-the-air').then(r => r.json()),
			]);
			trendingShows = trending.results || [];
			popularShows = popular.results || [];
			topRatedShows = topRated.results || [];
			onTheAir = onAir.results || [];
		} catch (e) {
			console.error('Failed to load TV data:', e);
		} finally {
			isLoading = false;
		}
	}

	$effect(() => { load(); });
</script>

<div class="tv-page">
	{#if isLoading}
		<div class="hero-skeleton"></div>
		<SkeletonRow />
		<SkeletonRow />
		<SkeletonRow />
	{:else}
		{#if trendingShows.length > 0}
			<HeroCarousel items={trendingShows.slice(0, 8)} />
		{/if}
		<div class="content-rows">
			<ContentRow title="Trending TV Shows" items={trendingShows} />
			<ContentRow title="Popular TV Shows" items={popularShows} />
			<ContentRow title="Top Rated" items={topRatedShows} />
			<ContentRow title="On The Air" items={onTheAir} />
		</div>
	{/if}
</div>

<style>
	.tv-page { padding-bottom: 24px; }
	.hero-skeleton {
		width: calc(100% - 32px); margin: 8px 16px; aspect-ratio: 16/10;
		background: linear-gradient(90deg, #18181b 25%, #27272a 50%, #18181b 75%);
		background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 12px;
	}
	@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
	.content-rows { display: flex; flex-direction: column; gap: 32px; padding: 24px 0; }
	@media (min-width: 768px) { .hero-skeleton { aspect-ratio: 16/7; } }
</style>
