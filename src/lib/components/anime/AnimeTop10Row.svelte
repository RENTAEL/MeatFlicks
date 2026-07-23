<script lang="ts">
	import AnimeScrollRow from './AnimeScrollRow.svelte';

	let { title, items }: { title: string; items: any[] } = $props();
</script>

<AnimeScrollRow {title} {items} ranked />
