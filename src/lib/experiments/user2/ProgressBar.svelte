<script lang="ts">
	import { onMount } from 'svelte';

	let progress = $state(0);

	onMount(() => {
		const onScroll = () => {
			const max = document.documentElement.scrollHeight - window.innerHeight;
			progress = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		onScroll();
		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<div class="progress-track" aria-hidden="true">
	<div class="progress-fill" style:width="{progress}%"></div>
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
		background: linear-gradient(90deg, #a855f7, #06b6d4);
		box-shadow: 0 0 8px rgba(168, 85, 247, 0.55);
		transition: width 0.08s linear;
	}
</style>
