<script lang="ts">
	import { Star, Play } from '@lucide/svelte';

	let {
		anime,
		rank
	}: {
		anime: {
			id: string;
			name: string;
			jname?: string;
			poster: string;
			episodes?: { sub: number; dub: number | null };
			type?: string;
		};
		rank?: number;
	} = $props();
</script>

<a
	rel="external"
	href={`/anime/${anime.id}`}
	class="anime-card group relative w-44 shrink-0"
>
	<div class="relative aspect-[2/3] w-full overflow-hidden rounded-xl">
		{#if rank !== undefined}
			<div class="absolute top-2 left-2 z-10 flex size-8 items-center justify-center rounded-full bg-pink-600 text-sm font-bold text-white shadow-lg">
				{rank}
			</div>
		{/if}

		<img
			src={anime.poster}
			alt={anime.name}
			loading="lazy"
			class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
		/>

		<div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
			<div class="flex size-12 items-center justify-center rounded-full bg-pink-500/80 shadow-lg">
				<Play class="size-6 text-white" fill="white" />
			</div>
		</div>

		<div class="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-3 pt-8">
			<h3 class="text-sm font-semibold text-white truncate">{anime.name}</h3>
			{#if anime.type}
				<span class="text-xs text-white/60">{anime.type}</span>
			{/if}
		</div>
	</div>
</a>

<style>
	.anime-card {
		transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}
	.anime-card:hover {
		transform: translateY(-6px) scale(1.03);
	}
	.anime-card :global(img) {
		border-radius: 0.75rem;
	}
</style>
