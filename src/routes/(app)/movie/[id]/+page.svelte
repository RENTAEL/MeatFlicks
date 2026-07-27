<script lang="ts">
	import Player from '$lib/components/Player.svelte';
	import MovieInfo from '$lib/components/MovieInfo.svelte';
	import MediaCard from '$lib/components/MediaCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
	<a
		href="/movies"
		class="mb-4 inline-flex items-center gap-1.5 text-zinc-400 transition-colors hover:text-white"
	>
		<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
		<span class="text-sm">Back to Movies</span>
	</a>

	{#if data.error && !data.movie}
		<div class="flex flex-col items-center justify-center py-20">
			<svg class="mb-4 size-16 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
			<p class="text-lg font-medium text-zinc-400">Failed to load movie</p>
			<p class="mt-1 text-sm text-zinc-600">{data.error}</p>
			<a
				href="/movies"
				class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
			>
				Back to Movies
			</a>
		</div>
	{:else if data.movie}
		<Player tmdbId={data.movie.id} title={data.movie.title} />

		<MovieInfo movie={data.movie} />

		{#if data.similarMovies?.length}
			<div class="mt-10">
				<h2 class="mb-4 text-lg font-semibold text-white">Similar Movies</h2>
				<div class="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
					{#each data.similarMovies as movie (movie.id)}
						<div class="w-36 shrink-0 sm:w-40">
							<MediaCard media={movie} />
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
