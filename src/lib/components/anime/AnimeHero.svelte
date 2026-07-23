<script lang="ts">
	import { Play, Star } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	let {
		spotlight = []
	}: {
		spotlight: any[];
	} = $props();

	let activeIndex = $state(0);
	let isAutoPlaying = $state(true);

	const slides = $derived(spotlight.slice(0, 5));
	const active = $derived(slides[activeIndex]);

	$effect(() => {
		if (!isAutoPlaying || slides.length <= 1) return;
		const timer = setInterval(() => {
			activeIndex = (activeIndex + 1) % slides.length;
		}, 6000);
		return () => clearInterval(timer);
	});
</script>

{#if active}
	<section class="relative min-h-[55vh] overflow-hidden rounded-2xl md:min-h-[60vh] lg:min-h-[65vh]">
		<div class="absolute inset-0">
			<img
				src={active.poster}
				alt={active.name}
				class="h-full w-full object-cover"
			/>
			<div class="absolute inset-0 bg-linear-to-r from-background/95 via-background/70 to-transparent"></div>
			<div class="absolute inset-0 bg-linear-to-t from-background via-transparent to-transparent"></div>
		</div>

		<div class="absolute inset-x-[10%] bottom-[15%] z-10">
			<h1 class="max-w-2xl text-4xl font-bold text-white md:text-5xl lg:text-6xl">
				{active.name}
			</h1>

			<div class="mt-3 flex flex-wrap items-center gap-3">
				<Badge class="bg-pink-600 text-white">{active.type || 'Anime'}</Badge>
				<span class="text-sm text-white/70">
					{active.episodes?.sub ?? '?'} Episodes
				</span>
				{#if active.rank}
					<Badge variant="outline" class="flex items-center gap-1 border-pink-500/40 text-white">
						<Star class="size-3.5 text-pink-400" />
						#{active.rank}
					</Badge>
				{/if}
			</div>

			{#if active.description}
				<p class="mt-3 max-w-xl text-sm leading-relaxed text-white/80 line-clamp-2">
					{active.description}
				</p>
			{/if}

			<div class="mt-5 flex items-center gap-3">
				<a
					rel="external"
					href={`/anime/${active.id}`}
					class="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-pink-500 hover:-translate-y-0.5"
				>
					<Play class="size-4" fill="currentColor" />
					View Details
				</a>
			</div>
		</div>

		{#if slides.length > 1}
			<div class="absolute right-[10%] bottom-8 z-10 flex gap-2">
				{#each slides as _, i}
					<button
						type="button"
						class="size-2 rounded-full transition-all {i === activeIndex ? 'w-6 bg-pink-500' : 'bg-white/40 hover:bg-white/60'}"
						onclick={() => (activeIndex = i)}
						aria-label="Go to slide {i + 1}"
					></button>
				{/each}
			</div>
		{/if}
	</section>
{/if}
