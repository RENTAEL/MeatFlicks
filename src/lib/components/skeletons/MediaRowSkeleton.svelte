<script lang="ts">
	let {
		variant = 'poster',
		items = 7
	}: {
		variant?: 'poster' | 'wide';
		items?: number;
	} = $props();
</script>

<div
	class="grid w-full gap-3 sm:gap-4"
	class:grid-cols-3={variant === 'poster'}
	class:sm:grid-cols-5={variant === 'poster'}
	class:lg:grid-cols-7={variant === 'poster'}
	class:grid-cols-1={variant === 'wide'}
	class:sm:grid-cols-2={variant === 'wide'}
	class:lg:grid-cols-4={variant === 'wide'}
	aria-hidden="true"
>
	{#each Array(items) as _}
		<div>
			<div
				class="shimmer {variant === 'poster' ? 'aspect-[2/3]' : 'aspect-[16/9]'} w-full rounded-lg"
			></div>
			<div class="shimmer mt-2 h-3 w-3/4 rounded"></div>
		</div>
	{/each}
</div>

<style>
	.shimmer {
		position: relative;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.05);
	}

	.shimmer::after {
		content: '';
		position: absolute;
		inset: 0;
		transform: translateX(-100%);
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.08) 50%,
			transparent 100%
		);
		animation: shimmer 1.6s infinite;
	}

	@keyframes shimmer {
		100% {
			transform: translateX(100%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.shimmer::after {
			animation: none;
		}
	}
</style>
