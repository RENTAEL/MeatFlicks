<script lang="ts">
	import PosterCard from './PosterCard.svelte';

	let {
		title,
		items,
		href = ''
	}: {
		title: string;
		items: any[];
		href?: string;
	} = $props();

	let scrollContainer: HTMLDivElement | undefined = $state(undefined);
	let showLeftArrow = $state(false);
	let showRightArrow = $state(true);

	function checkArrows() {
		if (!scrollContainer) return;
		const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
		showLeftArrow = scrollLeft > 10;
		showRightArrow = scrollLeft < scrollWidth - clientWidth - 10;
	}
</script>

<div class="content-row">
	<div class="row-header">
		<h2 class="row-title">{title}</h2>
		{#if href}
			<a href={href} class="row-see-all">See all →</a>
		{/if}
	</div>

	<div class="row-scroll-wrapper">
		{#if showLeftArrow}
			<button onclick={() => scrollContainer?.scrollBy({ left: -280, behavior: 'smooth' })} class="scroll-arrow scroll-arrow-left" aria-label="Scroll left">
				<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
			</button>
		{/if}

		<div bind:this={scrollContainer} class="row-scroll" onscroll={checkArrows}>
			{#each items as item}
				<div class="row-card-wrapper">
					<PosterCard {item} />
				</div>
			{/each}
		</div>

		{#if showRightArrow}
			<button onclick={() => scrollContainer?.scrollBy({ left: 280, behavior: 'smooth' })} class="scroll-arrow scroll-arrow-right" aria-label="Scroll right">
				<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
			</button>
		{/if}
	</div>
</div>

<style>
	.content-row { margin-bottom: 8px; }
	.row-header { display: flex; align-items: baseline; justify-content: space-between; padding: 0 16px; margin-bottom: 12px; }
	.row-title { font-size: 18px; font-weight: 700; }
	.row-see-all { font-size: 13px; color: #818cf8; text-decoration: none; font-weight: 600; }
	.row-scroll-wrapper { position: relative; }
	.row-scroll { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0 16px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
	.row-scroll::-webkit-scrollbar { display: none; }
	.row-card-wrapper { scroll-snap-align: start; flex-shrink: 0; width: 140px; }
	@media (min-width: 768px) { .row-card-wrapper { width: 180px; } }
	.scroll-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 5; width: 36px; height: 36px; border-radius: 50%; background: rgba(24,24,27,0.9); border: 1px solid rgba(255,255,255,0.08); color: #fff; cursor: pointer; display: none; align-items: center; justify-content: center; backdrop-filter: blur(8px); }
	.scroll-arrow svg { width: 20px; height: 20px; }
	.scroll-arrow-left { left: 4px; }
	.scroll-arrow-right { right: 4px; }
	@media (min-width: 768px) { .scroll-arrow { display: flex; } }
</style>
