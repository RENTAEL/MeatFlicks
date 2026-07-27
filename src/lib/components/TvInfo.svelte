<script lang="ts">
	let expanded = $state(false);

	let {
		show
	}: {
		show: {
			name: string;
			tagline?: string;
			overview: string;
			first_air_date: string;
			last_air_date?: string;
			vote_average: number;
			number_of_seasons: number;
			status: string;
			genres: { id: number; name: string }[];
			created_by?: { id: number; name: string }[];
			networks?: { id: number; name: string }[];
			poster_path: string;
			backdrop_path: string;
		};
	} = $props();
</script>

<div class="mt-6 rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-6">
	<div class="flex flex-col gap-6 md:flex-row">
		<div class="w-24 shrink-0 md:hidden">
			<img
				src="https://image.tmdb.org/t/p/w342{show.poster_path}"
				alt={show.name}
				class="w-full rounded-lg"
			/>
		</div>

		<div class="min-w-0 flex-1">
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
					{show.vote_average.toFixed(1)}
				</span>
				<span>•</span>
				<span>{show.number_of_seasons} {show.number_of_seasons === 1 ? 'Season' : 'Seasons'}</span>
				<span>•</span>
				<span>{show.status}</span>
			</div>

			<div class="mt-3 flex flex-wrap gap-1.5">
				{#each show.genres as genre}
					<span class="rounded-full border border-zinc-700/50 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
						{genre.name}
					</span>
				{/each}
			</div>

			<div class="mt-4">
				<p class="text-sm leading-relaxed text-zinc-300" class:line-clamp-3={!expanded}>
					{show.overview}
				</p>
				{#if show.overview?.length > 200}
					<button
						onclick={() => expanded = !expanded}
						class="mt-1 text-xs text-indigo-400 transition-colors hover:text-indigo-300"
					>
						{expanded ? 'Show less' : 'Read more'}
					</button>
				{/if}
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
	</div>
</div>
