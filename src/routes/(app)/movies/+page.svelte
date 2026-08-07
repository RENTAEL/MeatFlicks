<script lang="ts">
	import SectionPage from '$lib/components/sections/SectionPage.svelte';
	import { SEOHead } from '$lib/components/seo';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<SEOHead
	title="Movies — Streamium"
	description="Browse movies from the Streamium library."
	canonical="/movies"
	ogType="video.movie"
	keywords={[
		'stream movies',
		'watch movies online',
		'movie streaming',
		'film library',
		'latest movies'
	]}
/>

<SectionPage
	section="movies"
	rails={data.rails}
	hero={data.hero}
	browse={data.browse}
	browseParams={data.browseParams}
	error={data.error}
/>
