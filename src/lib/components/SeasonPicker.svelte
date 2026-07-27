<script lang="ts">
	let {
		seasons,
		currentSeason,
		onselect
	}: {
		seasons: { season_number: number; episode_count: number; name: string }[];
		currentSeason: number;
		onselect: (season: number) => void;
	} = $props();
</script>

<div class="mt-8">
	<h3 class="mb-3 text-sm font-semibold text-zinc-400">Seasons</h3>
	<div class="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
		{#each seasons as s}
			<button
				onclick={() => onselect(s.season_number)}
				class="shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all {s.season_number === currentSeason
					? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
					: 'border border-zinc-700/50 bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}"
			>
				{s.name || `Season ${s.season_number}`}
				<span class="ml-1.5 text-xs opacity-60">{s.episode_count} ep</span>
			</button>
		{/each}
	</div>
</div>
