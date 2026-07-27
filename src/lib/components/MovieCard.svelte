<script lang="ts">
	let {
		id,
		title,
		poster,
		rating,
		year
	}: {
		id: number;
		title: string;
		poster: string | null;
		rating: number;
		year: string;
	} = $props();
</script>

<a href="/movie/{id}" class="group block">
	<div class="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-800/50">
		{#if poster}
			<img
				src={poster}
				alt={title}
				loading="lazy"
				class="h-full w-full object-cover transition duration-300 group-hover:scale-110"
				onerror={(e) => { (e.target as HTMLImageElement).src = '/placeholder-poster.svg'; }}
			/>
		{:else}
			<div class="flex h-full w-full items-center justify-center text-zinc-600">
				<svg class="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
			</div>
		{/if}

    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"></div>

		<div class="absolute bottom-0 left-0 right-0 translate-y-2 p-3 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
			<p class="truncate text-sm font-semibold text-white">{title}</p>
			<p class="mt-0.5 text-xs text-zinc-400">{year}</p>
		</div>

		<div class="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 backdrop-blur-sm">
			<span class="text-xs text-yellow-400">★</span>
			<span class="text-xs font-medium text-white">{rating?.toFixed(1)}</span>
		</div>
	</div>

	<p class="mt-2 truncate text-sm font-medium text-zinc-200 transition-colors group-hover:text-white">{title}</p>
	<p class="text-xs text-zinc-500">{year}</p>
</a>
