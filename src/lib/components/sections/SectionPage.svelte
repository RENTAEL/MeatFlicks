<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Hero from '$lib/components/home/Hero.svelte';
	import MediaScrollContainer from '$lib/components/media/MediaScrollContainer.svelte';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import EmptyState from '$lib/components/media/EmptyState.svelte';
	import { toLibraryMovie } from '$lib/utils/tmdb';
	import { Button } from '$lib/components/ui/button';
	import type { LibraryMedia } from '$lib/types/library';

	type BrowseResult = {
		results: Record<string, unknown>[];
		page: number;
		total_pages: number;
		hasMore: boolean;
	};

	type Rail = {
		id: string;
		titleAf: string;
		titleEn: string;
		items: LibraryMedia[];
	};

	type Props = {
		section: 'movies' | 'tv';
		rails: Rail[];
		hero: LibraryMedia[];
		browse: BrowseResult;
		error?: string | null;
	};

	let { section, rails, hero, browse, error = null }: Props = $props();

	const sectionTitle = section === 'movies' ? 'Movies' : 'TV Series';

	let browseItems = $state(browse.results ?? []);
	let browsePage = $state(browse.page ?? 1);
	let browseHasMore = $state(browse.hasMore ?? false);
	let loadingMore = $state(false);

	const sortedHero = $derived.by(() => {
		const withBackdrop = hero.filter((i) => i.backdropPath);
		const rest = hero.filter((i) => !i.backdropPath);
		return [...withBackdrop, ...rest].slice(0, 5);
	});

	$effect(() => {
		browseItems = browse.results ?? [];
		browsePage = browse.page ?? 1;
		browseHasMore = browse.hasMore ?? false;
	});

	async function loadMore() {
		if (loadingMore || !browseHasMore) return;
		loadingMore = true;
		try {
			const p = new URLSearchParams($page.url.search);
			p.set('page', String(browsePage + 1));
			const res = await fetch(`${section === 'movies' ? '/movies' : '/tv'}/api/discover?${p}`);
			if (!res.ok) throw new Error('Failed');
			const json = await res.json();
			browseItems = [...browseItems, ...(json.results || [])];
			browsePage = json.page;
			browseHasMore = json.hasMore;
		} catch {
			// keep current items; user can retry
		} finally {
			loadingMore = false;
		}
	}

	function retry() {
		goto(section === 'movies' ? '/movies' : '/tv', { replaceState: true, invalidateAll: true });
	}
</script>

<svelte:head>
	<title>{sectionTitle} — Streamium</title>
</svelte:head>

<div class="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
	<div class="mb-4">
		<h1 class="text-2xl font-bold text-white">{sectionTitle}</h1>
		<p class="mt-1 text-sm text-zinc-400">{sectionTitle} from the Streamium library</p>
	</div>

	{#if sortedHero.length > 0}
		<Hero movie={null} movies={sortedHero} autoPlayIntervalMs={8000} pauseOnHover />
	{/if}

	{#if error && rails.length === 0}
		<EmptyState
			icon="error"
			title="Kan nie laai nie / Failed to load"
			subtitle={error}
			actionLabel="Retry"
			onAction={retry}
		/>
	{:else}
		<div class="mt-10 flex flex-col gap-8">
			{#each rails as rail (rail.id)}
				{#if rail.items.length >= 4}
					<MediaScrollContainer title={rail.titleEn} media={rail.items} />
				{/if}
			{/each}
		</div>

		<section class="mt-12">
			<h2 class="mb-4 text-xl font-bold text-white">All {sectionTitle}</h2>

			{#if error && browseItems.length === 0}
				<EmptyState
					icon="error"
					title="Kan nie laai nie / Failed to load"
					subtitle={error}
					actionLabel="Retry"
					onAction={retry}
				/>
			{:else if browseItems.length === 0}
				<EmptyState icon="search" title="Niks gevind nie / Nothing found" subtitle="Try different filters." />
			{:else}
				<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
					{#each browseItems as item (item.id)}
						<MediaCard movie={toLibraryMovie(item)} />
					{/each}
				</div>

				{#if browseHasMore}
					<div class="mt-8 flex justify-center">
						<Button type="button" onclick={loadMore} disabled={loadingMore} variant="outline">
							{loadingMore ? 'Loading...' : 'Load More'}
						</Button>
					</div>
				{/if}
			{/if}
		</section>
	{/if}
</div>