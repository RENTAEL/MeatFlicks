<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let { count = 12, enabled = true }: { count?: number; enabled?: boolean } = $props();

	let reduceMotion = $state(false);
	let visible = $state(false);

	onMount(() => {
		if (!browser) return;
		reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		visible = enabled && !reduceMotion;
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const onChange = () => {
			reduceMotion = mq.matches;
			visible = enabled && !reduceMotion;
		};
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	$effect(() => {
		visible = enabled && !reduceMotion;
	});
</script>

{#if visible}
	<div class="sune-petals" aria-hidden="true">
		{#each Array.from({ length: count }) as _, i}
			<span
				class="sune-petal"
				style="
					left: {5 + (i * 7.3) % 90}%;
					animation-delay: {(i * 0.85) % 8}s;
					animation-duration: {14 + (i % 5) * 2.5}s;
					font-size: {10 + (i % 3) * 4}px;
					opacity: {0.12 + (i % 4) * 0.04};
				"
			>
				❦
			</span>
		{/each}
	</div>
{/if}

<style>
	.sune-petals {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 0;
	}

	.sune-petal {
		position: absolute;
		top: -12%;
		color: #e7c663;
		text-shadow: 0 0 6px rgba(212, 175, 55, 0.45);
		animation-name: sunePetalFall;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
		will-change: transform, opacity;
		user-select: none;
	}

	@keyframes sunePetalFall {
		0% {
			transform: translateY(-10%) translateX(0) rotate(0deg) scale(0.9);
			opacity: 0;
		}
		10% {
			opacity: 1;
		}
		90% {
			opacity: 0.18;
		}
		100% {
			transform: translateY(108%) translateX(18px) rotate(180deg) scale(1.05);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sune-petals {
			display: none !important;
		}
	}
</style>
