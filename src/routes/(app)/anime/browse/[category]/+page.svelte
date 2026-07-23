<script lang="ts">
	import AnimeScrollRow from '$lib/components/anime/AnimeScrollRow.svelte';
	import { SEOHead } from '$lib/components/seo';

	let { data } = $props<{ data: { category: string; data: any } }>();

	let category = $derived(data.category);
	let items = $derived(data.data?.animes ?? []);
	let title = $derived(category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
</script>

<SEOHead title="{title} Anime - Streamium" description="Browse {title} anime on Streamium" />

<div class="anime-page page-transition min-h-screen text-foreground">
	<main class="mx-auto w-full py-2 pr-2 pl-0 sm:pr-2 sm:pl-0 lg:pr-2 lg:pl-0">
		<div class="flex min-h-[calc(100vh-2rem)] flex-col gap-8 overflow-hidden rounded-2xl glass shadow-xl p-6">
			<h1 class="text-3xl font-bold text-foreground">{title}</h1>

			{#if items.length > 0}
				<AnimeScrollRow title="" items={items} />
			{:else}
				<p class="text-muted-foreground">No anime found in this category.</p>
			{/if}
		</div>
	</main>
</div>

<style>
	:global(.anime-page) {
		--accent-hue: 320;
	}
</style>
