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
		<div class="animate-pulse">
			<div
				class="{variant === 'poster' ? 'aspect-[2/3]' : 'aspect-[16/9]'} w-full rounded-lg bg-muted/50"
			></div>
			<div class="mt-2 h-3 w-3/4 rounded bg-muted/40"></div>
		</div>
	{/each}
</div>
