<script lang="ts">
	let {
		count = 1,
		aspect = '2/3',
	}: {
		count?: number;
		aspect?: string;
	} = $props();
</script>

{#each Array(count) as _}
	<div class="animate-pulse" style="aspect-ratio: {aspect}">
		<div class="h-full w-full rounded-lg bg-muted/30 shimmer"></div>
	</div>
{/each}
