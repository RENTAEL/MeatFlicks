<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		scrollAmount,
		gap = '0.75rem',
		snap = false,
		children
	}: {
		scrollAmount?: number;
		gap?: string;
		snap?: boolean;
		children: Snippet;
	} = $props();

	let scrollContainer: HTMLDivElement | undefined = $state();
	let atStart = $state(true);
	let atEnd = $state(false);

	function checkScroll() {
		if (!scrollContainer) return;
		const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
		atStart = scrollLeft <= 4;
		atEnd = scrollLeft >= scrollWidth - clientWidth - 4;
	}

	let hasOverflow = $state(false);

	$effect(() => {
		if (scrollContainer) {
			checkScroll();
			hasOverflow = scrollContainer.scrollWidth > scrollContainer.clientWidth + 2;
			const observer = new ResizeObserver(() => {
				checkScroll();
				hasOverflow = scrollContainer!.scrollWidth > scrollContainer!.clientWidth + 2;
			});
			observer.observe(scrollContainer);
			return () => observer.disconnect();
		}
	});

	function scrollLeft() {
		if (!scrollContainer || atStart) return;
		const amount = scrollAmount ?? scrollContainer.clientWidth * 0.8;
		scrollContainer.scrollBy({ left: -amount, behavior: 'smooth' });
	}

	function scrollRight() {
		if (!scrollContainer || atEnd) return;
		const amount = scrollAmount ?? scrollContainer.clientWidth * 0.8;
		scrollContainer.scrollBy({ left: amount, behavior: 'smooth' });
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') { e.preventDefault(); scrollLeft(); }
		if (e.key === 'ArrowRight') { e.preventDefault(); scrollRight(); }
	}
</script>

<div class="scroll-row" tabindex="-1" onkeydown={handleKeydown}>
	<div
		bind:this={scrollContainer}
		class="scroll-content"
		class:snap={snap}
		style="gap: {gap}"
		onscroll={checkScroll}
	>
		{@render children()}
	</div>
	{#if hasOverflow}
	<div class="scroll-controls">
		<button
			class="scroll-btn"
			class:disabled={atStart}
			onclick={scrollLeft}
			disabled={atStart}
			aria-label="Scroll left"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
		</button>
		<button
			class="scroll-btn"
			class:disabled={atEnd}
			onclick={scrollRight}
			disabled={atEnd}
			aria-label="Scroll right"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
		</button>
	</div>
	{/if}
</div>

<style>
	.scroll-row {
		width: 100%;
		outline: none;
	}

	.scroll-content {
		overflow-x: auto;
		scroll-behavior: smooth;
		-webkit-overflow-scrolling: touch;
		display: flex;
		padding-bottom: 0.5rem;
	}

	.scroll-content.snap {
		scroll-snap-type: x mandatory;
	}
	.scroll-content.snap > :global(*) {
		scroll-snap-align: start;
	}

	/* Thin styled scrollbar */
	.scroll-content::-webkit-scrollbar {
		height: 4px;
	}
	.scroll-content::-webkit-scrollbar-track {
		background: transparent;
	}
	.scroll-content::-webkit-scrollbar-thumb {
		background: rgba(255,255,255,0.1);
		border-radius: 2px;
	}
	.scroll-content:hover::-webkit-scrollbar-thumb {
		background: rgba(255,255,255,0.2);
	}

	.scroll-controls {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 0.5rem;
		padding-top: 0.25rem;
		min-height: 0;
	}

	.scroll-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid rgba(255,255,255,0.1);
		background: rgba(0, 0, 0, 0.5);
		color: #aaa;
		font-size: 0.8rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		line-height: 1;
		padding: 0;
		user-select: none;
	}

	.scroll-btn:not(.disabled):hover {
		background: #f59e0b;
		border-color: #f59e0b;
		color: #000;
		transform: scale(1.15);
		box-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
	}

	.scroll-btn:not(.disabled):active {
		transform: scale(0.95);
	}

	.scroll-btn.disabled {
		opacity: 0.25;
		cursor: default;
		border-color: transparent;
	}

	@media (max-width: 1024px) {
		.scroll-controls {
			display: none;
		}
	}
</style>
