<script lang="ts">
	import { onMount } from 'svelte';

	let fill: HTMLDivElement | null = $state(null);

	onMount(() => {
		let raf = 0;
		let last = -1;
		const onScroll = () => {
			if (raf) return;
			raf = requestAnimationFrame(() => {
				raf = 0;
				const max = document.documentElement.scrollHeight - window.innerHeight;
				const pct = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
				// Skip redundant writes — no style churn while idle
				if (Math.abs(pct - last) < 0.1) return;
				last = pct;
				// Direct transform write: GPU-composited, zero layout work (smoother than width)
				if (fill) fill.style.transform = `scaleX(${pct / 100})`;
			});
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll, { passive: true });
		onScroll();
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
			if (raf) cancelAnimationFrame(raf);
		};
	});
</script>

<div class="progress-track" aria-hidden="true">
	<div class="progress-fill" bind:this={fill}></div>
</div>

<style>
	.progress-track {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		z-index: 9997;
		background: transparent;
		pointer-events: none;
	}
	.progress-fill {
		height: 100%;
		width: 100%;
		transform-origin: 0 50%;
		transform: scaleX(0);
		background: linear-gradient(90deg, #a855f7, #06b6d4);
		box-shadow: 0 0 8px rgba(168, 85, 247, 0.55);
		will-change: transform; /* compositor-only updates — no jank */
	}
</style>
