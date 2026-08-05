<script lang="ts">
	import AggregatedRating from '$lib/components/AggregatedRating.svelte';
	import { getImageUrl, getSrcSet } from '$lib/utils/image';

	let expanded = $state(false);

	let {
		movie
	}: {
		movie: {
			title: string;
			tagline?: string;
			overview: string;
			release_date: string;
			runtime: number;
			vote_average: number;
			genres: { id: number; name: string }[];
			director?: string;
			cast?: string[];
			budget?: number;
			revenue?: number;
			poster_path: string;
			backdrop_path: string;
			imdb_id?: string;
		};
	} = $props();
</script>

<div class="mt-6 rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-6">
	<div class="flex flex-col gap-6 md:flex-row">
		<div class="w-24 shrink-0 md:hidden">
			<img
				src={getImageUrl(movie.poster_path, 'w342')}
				srcset={getSrcSet(movie.poster_path)}
				sizes="96px"
				alt={movie.title}
				class="w-full rounded-lg"
				loading="lazy"
				decoding="async"
			/>
		</div>

		<div class="min-w-0 flex-1">
			<h1 class="text-2xl font-bold text-white">
				{movie.title}
				<span class="ml-1 text-lg font-normal text-zinc-500">
					({new Date(movie.release_date).getFullYear()})
				</span>
			</h1>

			{#if movie.tagline}
				<p class="mt-1 text-sm italic text-zinc-500">{movie.tagline}</p>
			{/if}

			<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
				<span class="flex items-center gap-1">
					<span class="text-yellow-400">★</span>
					{movie.vote_average.toFixed(1)}
				</span>
				<AggregatedRating rating={movie.vote_average} imdbId={movie.imdb_id || ''} />
				<span>•</span>
				<span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>
				<span>•</span>
				<span>{new Date(movie.release_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
			</div>

			<div class="mt-3 flex flex-wrap gap-1.5">
				{#each movie.genres as genre}
					<span class="rounded-full border border-zinc-700/50 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
						{genre.name}
					</span>
				{/each}
			</div>

			<div class="mt-4">
				<p class="text-sm leading-relaxed text-zinc-300" class:line-clamp-3={!expanded}>
					{movie.overview}
				</p>
				{#if movie.overview?.length > 200}
					<button
						onclick={() => expanded = !expanded}
						class="mt-1 text-xs text-indigo-400 transition-colors hover:text-indigo-300"
					>
						{expanded ? 'Show less' : 'Read more'}
					</button>
				{/if}
			</div>

			<div class="mt-5 grid grid-cols-2 gap-4 border-t border-zinc-800/50 pt-5 sm:grid-cols-4">
				{#if movie.director}
					<div>
						<p class="text-xs text-zinc-500">Director</p>
						<p class="text-sm text-zinc-200">{movie.director}</p>
					</div>
				{/if}
				{#if movie.cast?.length}
					<div class="col-span-2">
						<p class="text-xs text-zinc-500">Cast</p>
						<p class="text-sm text-zinc-200">{movie.cast.slice(0, 5).join(', ')}</p>
					</div>
				{/if}
				{#if movie.budget}
					<div>
						<p class="text-xs text-zinc-500">Budget</p>
						<p class="text-sm text-zinc-200">${(movie.budget / 1000000).toFixed(0)}M</p>
					</div>
				{/if}
				{#if movie.revenue}
					<div>
						<p class="text-xs text-zinc-500">Revenue</p>
						<p class="text-sm text-zinc-200">${(movie.revenue / 1000000).toFixed(0)}M</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
