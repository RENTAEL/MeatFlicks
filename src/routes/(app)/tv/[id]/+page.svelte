<script lang="ts">
	import TVPlayer from '$lib/components/TVPlayer.svelte';
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

		<div class="mt-6 rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-6">
			<h1 class="text-2xl font-bold text-white">
				{show.name}
				<span class="ml-1 text-lg font-normal text-zinc-500">
					({new Date(show.first_air_date).getFullYear()})
				</span>
			</h1>

			{#if show.tagline}
				<p class="mt-1 text-sm italic text-zinc-500">{show.tagline}</p>
			{/if}

			<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
				<span class="flex items-center gap-1">
					<span class="text-yellow-400">★</span>
					{show.vote_average?.toFixed(1)}
				</span>
				<span>•</span>
				<span>{show.number_of_seasons} {show.number_of_seasons === 1 ? 'Season' : 'Seasons'}</span>
				<span>•</span>
				<span>{show.status}</span>
			</div>

			<div class="mt-3 flex flex-wrap gap-1.5">
				{#each show.genres as genre}
					<span class="rounded-full border border-zinc-700/50 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">{genre.name}</span>
				{/each}
			</div>

			<div class="mt-4">
				<p class="text-sm leading-relaxed text-zinc-300">{show.overview}</p>
			</div>

			<div class="mt-5 grid grid-cols-2 gap-4 border-t border-zinc-800/50 pt-5 sm:grid-cols-4">
				{#if show.created_by?.length}
					<div class="col-span-2">
						<p class="text-xs text-zinc-500">Created by</p>
						<p class="text-sm text-zinc-200">{show.created_by.map((c: any) => c.name).join(', ')}</p>
					</div>
				{/if}
				<div>
					<p class="text-xs text-zinc-500">First Aired</p>
					<p class="text-sm text-zinc-200">{new Date(show.first_air_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
				</div>
				<div>
					<p class="text-xs text-zinc-500">Last Aired</p>
					<p class="text-sm text-zinc-200">{show.last_air_date ? new Date(show.last_air_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</p>
				</div>
				{#if show.networks?.length}
					<div>
						<p class="text-xs text-zinc-500">Network</p>
						<p class="text-sm text-zinc-200">{show.networks.map((n: any) => n.name).join(', ')}</p>
					</div>
				{/if}
			</div>
		</div>

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
