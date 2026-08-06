<script lang="ts">
	import SectionPage from '$lib/components/sections/SectionPage.svelte';
	import { SEOHead } from '$lib/components/seo';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<SEOHead
	title="TV Series — Streamium"
	description="Reekse uit die biblioteek — Browse TV series from the Streamium library."
	canonical="/tv"
	ogType="video.tv_show"
	keywords={[
		'stream tv series',
		'watch series online',
		'reekse aanlyn',
		'tv show streaming',
		'series library',
		'top series'
	]}
/>

<SectionPage
	section="tv"
	rails={data.rails}
	hero={data.hero}
	browse={data.browse}
	browseParams={data.browseParams}
	error={data.error}
/>
