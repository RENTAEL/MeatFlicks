<script lang="ts">
	import { page } from '$app/state';
	import AnimeHero from '$lib/components/anime/AnimeHero.svelte';
	import AnimeTrendingRow from '$lib/components/anime/AnimeTrendingRow.svelte';
	import AnimeLatestRow from '$lib/components/anime/AnimeLatestRow.svelte';
	import AnimeTop10Row from '$lib/components/anime/AnimeTop10Row.svelte';
	import HomePageSkeleton from '$lib/components/skeletons/HomePageSkeleton.svelte';
	import { SEOHead } from '$lib/components/seo';

	let { data } = $props<{ data: { home: any } }>();
	let home = $derived(data.home);
</script>

<SEOHead
	title="Anime - Streamium"
	description="Stream the latest and greatest anime for free on Streamium. Watch subbed and dubbed anime, explore trending series, and discover new favorites."
	canonical="/anime"
	ogType="website"
	keywords={['anime', 'anime streaming', 'free anime', 'subbed anime', 'dubbed anime', 'watch anime online']}
/>

<div class="anime-page page-transition min-h-screen text-foreground">
	<div class="mx-auto w-full py-2 pr-2 pl-0 sm:pr-2 sm:pl-0 lg:pr-2 lg:pl-0">
		<main class="flex min-h-[calc(100vh-2rem)] flex-col gap-8 overflow-hidden rounded-2xl glass shadow-xl">
			{#if home}
				<AnimeHero spotlight={home.spotLightAnimes} />

				<div class="space-y-8 pb-12">
					{#if home.trendingAnimes?.length}
						<AnimeTrendingRow title="Trending Now" items={home.trendingAnimes} />
					{/if}

					{#if home.latestEpisodes?.length}
						<AnimeLatestRow title="Latest Episodes" items={home.latestEpisodes} />
					{/if}

					{#if home.top10Animes}
						{#each Object.entries(home.top10Animes) as [category, animes]}
							<AnimeTop10Row title="Top 10 - {category}" items={animes} />
						{/each}
					{/if}
				</div>
			{:else}
				<HomePageSkeleton />
			{/if}
		</main>
	</div>
</div>

<style>
	:global(.anime-page) {
		--accent-hue: 320;
	}
</style>
