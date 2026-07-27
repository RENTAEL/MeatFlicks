<script lang="ts">
	let {
		episodes,
		currentEpisode,
		onselect
	}: {
		episodes: {
			episode_number: number;
			name: string;
			overview: string;
			still_path: string;
			runtime: number;
			air_date: string;
		}[];
		currentEpisode: number;
		onselect: (episode: number) => void;
	} = $props();
</script>

<div class="mt-4 overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-900/60">
	<h3 class="border-b border-zinc-800/50 px-5 py-3 text-sm font-semibold text-zinc-400">Episodes</h3>
	<div class="max-h-[500px] divide-y divide-zinc-800/50 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
		{#each episodes as ep}
			<button
				onclick={() => onselect(ep.episode_number)}
				class="flex w-full gap-4 p-4 text-left transition-colors hover:bg-zinc-800/30 {ep.episode_number === currentEpisode ? 'border-l-2 border-l-indigo-500 bg-indigo-600/10' : ''}"
			>
				<div class="aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-zinc-800 sm:w-40">
					{#if ep.still_path}
						<img
							src="https://image.tmdb.org/t/p/w300{ep.still_path}"
							alt={ep.name}
							loading="lazy"
							class="h-full w-full object-cover"
						/>
					{:else}
						<div class="flex h-full w-full items-center justify-center text-zinc-600">
							<span class="text-2xl">{ep.episode_number}</span>
						</div>
					{/if}
				</div>

				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="font-mono text-xs text-zinc-500">EP {ep.episode_number}</span>
						{#if ep.episode_number === currentEpisode}
							<span class="rounded bg-indigo-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400">PLAYING</span>
						{/if}
					</div>
					<p class="mt-0.5 truncate text-sm font-medium text-zinc-200">{ep.name || `Episode ${ep.episode_number}`}</p>
					{#if ep.overview}
						<p class="mt-1 line-clamp-2 text-xs text-zinc-500">{ep.overview}</p>
					{/if}
					<div class="mt-1.5 flex items-center gap-3 text-xs text-zinc-600">
						{#if ep.runtime}<span>{ep.runtime}m</span>{/if}
						{#if ep.air_date}
							<span>{new Date(ep.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
						{/if}
					</div>
				</div>
			</button>
		{/each}
	</div>
</div>
