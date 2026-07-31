<script lang="ts">
	import { goto } from '$app/navigation';
	import MediaCard from '$lib/components/MediaCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');

	const categories = [
		{ id: 'popular', label: 'All' },
		{ id: 'trending', label: 'Trending' },
		{ id: 'popular', label: 'Popular' },
		{ id: 'top_rated', label: 'Top Rated' },
		{ id: 'upcoming', label: 'Upcoming' }
	];

	let currentCategory = $state(data.category || 'popular');
	let currentPage = $state(data.page || 1);
	let allMovies = $state(data.movies || []);
	let isLoadingMore = $state(false);
	let hasMore = $state((data.page || 1) < (data.totalPages || 0));

	let filteredMovies = $derived.by(() => {
		if (!searchQuery) return allMovies;
		const q = searchQuery.toLowerCase();
		return allMovies.filter((m: { title: string }) => m.title.toLowerCase().includes(q));
	});

	$effect(() => {
		currentCategory = data.category || 'popular';
		currentPage = data.page || 1;
		allMovies = data.movies || [];
		hasMore = (data.page || 1) < (data.totalPages || 0);
	});

	function switchCategory(catId: string) {
		searchQuery = '';
		goto(`/movies?category=${catId}`, { replaceState: true });
	}

	function getEndpoint(cat: string, pg: number): string {
		if (cat === 'trending') return `https://api.themoviedb.org/3/trending/movie/week?api_key=5aa00ca6320d13f8d492d7806e012f9b&page=${pg}`;
		if (cat === 'all') return `https://api.themoviedb.org/3/movie/now_playing?api_key=5aa00ca6320d13f8d492d7806e012f9b&page=${pg}`;
		return `https://api.themoviedb.org/3/movie/${cat}?api_key=5aa00ca6320d13f8d492d7806e012f9b&page=${pg}`;
	}

	async function loadMore() {
		if (isLoadingMore || !hasMore) return;
		isLoadingMore = true;
		const nextPage = currentPage + 1;
		try {
			const res = await fetch(getEndpoint(currentCategory, nextPage));
			if (!res.ok) throw new Error('Failed');
			const json = await res.json();
			const { formatMovie } = await import('$lib/utils/tmdb');
			const { isEligibleMedia } = await import('$lib/utils/mediaFilter');
			const newMovies = (json.results || [])
				.filter((m: any) => currentCategory === 'upcoming' || isEligibleMedia(m))
				.map(formatMovie);
			allMovies = [...allMovies, ...newMovies];
			currentPage = nextPage;
			hasMore = nextPage < (json.total_pages || 0);
		} catch {
		} finally {
			isLoadingMore = false;
		}
	}
</script>

<svelte:head>
	<title>Movies — Streamium</title>
</svelte:head>

<div class="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
	<div class="mb-2 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-white">Movies</h1>
	</div>

	<div class="relative mb-6">
		<svg class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
		<input
			type="text"
			placeholder="Search movies..."
			bind:value={searchQuery}
			class="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-500 backdrop-blur-sm transition-colors focus:border-indigo-500/50 focus:outline-none"
		/>
	</div>

	<div class="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
		{#each categories as cat}
			<button
				onclick={() => switchCategory(cat.id)}
				class="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors {currentCategory === cat.id || (currentCategory === 'popular' && cat.label === 'All')
					? 'bg-indigo-600 text-white'
					: 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-300'}"
			>
				{cat.label}
			</button>
		{/each}
	</div>

	{#if data.error && allMovies.length === 0}
		<div class="flex flex-col items-center justify-center py-20">
			<svg class="mb-4 size-16 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
			<p class="text-lg font-medium text-zinc-400">Failed to load movies</p>
			<p class="mt-1 text-sm text-zinc-600">Please try again.</p>
			<button
				onclick={() => goto(`/movies?category=${currentCategory}`, { replaceState: true })}
				class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
			>
				Retry
			</button>
		</div>
	{:else if filteredMovies.length === 0}
		<div class="flex flex-col items-center justify-center py-20">
			<svg class="mb-4 size-16 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
			<p class="text-lg font-medium text-zinc-400">No movies found</p>
			<p class="mt-1 text-sm text-zinc-600">Try a different category.</p>
		</div>
	{:else}
		<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
			{#each filteredMovies as movie (movie.id)}
				<MediaCard media={movie} />
			{/each}
		</div>

		{#if hasMore}
			<div class="mt-8 flex justify-center">
				<button
					onclick={loadMore}
					disabled={isLoadingMore}
					class="rounded-xl border border-zinc-800 bg-zinc-900/60 px-8 py-3 text-sm font-medium text-zinc-300 backdrop-blur-sm transition-colors hover:bg-zinc-800 disabled:opacity-50"
				>
					{isLoadingMore ? 'Loading...' : 'Load More'}
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
	.scrollbar-none::-webkit-scrollbar { display: none; }
</style>
