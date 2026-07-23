<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import AnimeCard from './AnimeCard.svelte';

	let {
		title,
		items,
		ranked
	}: {
		title: string;
		items: any[];
		ranked?: boolean;
	} = $props();

	let scrollRef = $state<HTMLDivElement | null>(null);

	function scroll(dir: 'left' | 'right') {
		if (!scrollRef) return;
		const amount = scrollRef.clientWidth * 0.75;
		scrollRef.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
	}
</script>

<div class="group/row px-[10%]">
	<h2 class="mb-4 text-2xl font-bold text-foreground">{title}</h2>

	<div class="relative">
		<button
			type="button"
			class="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background/80 p-2 text-foreground shadow-lg backdrop-blur-sm transition-all hover:bg-background group-hover/row:flex"
			onclick={() => scroll('left')}
			aria-label="Scroll left"
		>
			<ChevronLeft class="size-5" />
		</button>

		<div
			bind:this={scrollRef}
			class="scrollbar-thin flex gap-3 overflow-x-auto pb-2"
			style="scrollbar-width: none; -ms-overflow-style: none;"
		>
			{#each items as item, i (item.id)}
				<AnimeCard anime={item} rank={ranked ? i + 1 : undefined} />
			{/each}
		</div>

		<button
			type="button"
			class="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background/80 p-2 text-foreground shadow-lg backdrop-blur-sm transition-all hover:bg-background group-hover/row:flex"
			onclick={() => scroll('right')}
			aria-label="Scroll right"
		>
			<ChevronRight class="size-5" />
		</button>
	</div>
</div>
