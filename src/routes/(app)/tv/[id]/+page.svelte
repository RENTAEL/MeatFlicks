<script lang="ts">
	import TVPlayer from '$lib/components/TVPlayer.svelte';
	import TvInfo from '$lib/components/TvInfo.svelte';
	import SeasonPicker from '$lib/components/SeasonPicker.svelte';
	import EpisodeList from '$lib/components/EpisodeList.svelte';
	import MediaCard from '$lib/components/MediaCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let show = $derived(data.show);
	let seasons = $derived(data.seasons || []);
	let episodes = $derived(data.episodes || []);
	let currentSeason = $derived(data.currentSeason);
	let currentEpisode = $derived(data.currentEpisode);
	let similarShows = $derived(data.similarShows || []);
	let error = $derived(data.error);

	function handleSeasonSelect(seasonNum: number) {
		window.location.href = `/tv/${show.id}?s=${seasonNum}&e=1`;
	}

	function handleEpisodeSelect(episodeNum: number) {
		window.location.href = `/tv/${show.id}?s=${currentSeason}&e=${episodeNum}`;
	}
</script>

<div class="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
	{#if error && !show}
		<div class="flex flex-col items-center justify-center py-20">
			<svg class="mb-4 size-16 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
			<p class="text-lg font-medium text-zinc-400">Failed to load TV show</p>
			<p class="mt-1 text-sm text-zinc-600">{error}</p>
			<a
				href="/tv"
				class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
			>
				Back to TV Shows
			</a>
		</div>
	{:else if show}
		<a
			href="/tv"
			class="mb-4 inline-flex items-center gap-1.5 text-zinc-400 transition-colors hover:text-white"
		>
			<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
			<span class="text-sm">Back to TV Shows</span>
		</a>

		<TVPlayer
			tmdbId={show.id}
			season={currentSeason}
			episode={currentEpisode}
			title={show.name}
		/>

		<TvInfo {show} />

		{#if seasons.length > 1}
			<SeasonPicker {seasons} currentSeason={currentSeason} onselect={handleSeasonSelect} />
		{/if}

		{#if episodes.length > 0}
			<EpisodeList {episodes} currentEpisode={currentEpisode} onselect={handleEpisodeSelect} />
		{:else}
			<div class="mt-4 rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-6 text-center text-sm text-zinc-500">
				No episode data available for this season.
			</div>
		{/if}

		{#if similarShows.length > 0}
			<div class="mt-10">
				<h2 class="mb-4 text-lg font-semibold text-white">Similar Shows</h2>
				<div class="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
					{#each similarShows as show (show.id)}
						<div class="w-36 shrink-0 sm:w-40">
							<MediaCard media={show} href="/tv/{show.id}" />
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
