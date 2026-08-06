<script lang="ts">
	import SectionPage from '$lib/components/sections/SectionPage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<SectionPage section="movies" rails={data.rails} hero={data.hero} browse={data.browse} error={data.error} />
