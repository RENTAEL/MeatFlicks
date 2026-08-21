<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { isGlobalExperimentEnabled } from '../user2';

	const user = $derived(page.data.user ?? null);
	const enabled = $derived(isGlobalExperimentEnabled('cursorTrail', user as any));

	let dots: { x: number; y: number; id: number }[] = $state([]);
	let nextId = 0;

	onMount(() => {
		if (typeof window === 'undefined') return;
		const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
		if (isTouch) return;

		const handler = (e: MouseEvent) => {
			if (!enabled) return;
			dots = [...dots.slice(-8), { x: e.clientX, y: e.clientY, id: nextId++ }];
			setTimeout(() => {
				dots = dots.filter((d) => d.id !== nextId - 9);
			}, 600);
		};
		window.addEventListener('mousemove', handler, { passive: true });
		return () => window.removeEventListener('mousemove', handler);
	});
</script>

{#each dots as dot, i (dot.id)}
	<span
		class="cursor-dot"
		style:left="{dot.x}px"
		style:top="{dot.y}px"
		style:opacity={((i + 1) / dots.length) * 0.55}
		aria-hidden="true"
	></span>
{/each}

<style>
	.cursor-dot {
		position: fixed;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: radial-gradient(circle at 30% 30%, #fff, #a855f7 45%, #06b6d4 100%);
		pointer-events: none;
		z-index: 9996;
		transform: translate(-50%, -50%);
		box-shadow: 0 0 10px rgba(168, 85, 247, 0.55);
		animation: fadeOut 0.6s ease forwards;
	}
	@keyframes fadeOut {
		to {
			transform: translate(-50%, -50%) scale(0.2);
			opacity: 0;
		}
	}
</style>
