<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import AnimeHero from '$lib/components/anime/AnimeHero.svelte';
	import AnimeTrendingRow from '$lib/components/anime/AnimeTrendingRow.svelte';
	import AnimeLatestRow from '$lib/components/anime/AnimeLatestRow.svelte';
	import AnimeTop10Row from '$lib/components/anime/AnimeTop10Row.svelte';
	import AnimeCard from '$lib/components/anime/AnimeCard.svelte';
	import HomePageSkeleton from '$lib/components/skeletons/HomePageSkeleton.svelte';
	import MobileShell from '$lib/components/MobileShell.svelte';
	import { SEOHead } from '$lib/components/seo';
	import { onMount } from 'svelte';

	let { data } = $props<{ data: { home: any } }>();
	let home = $derived(data.home);

	let searchQuery = $state('');
	let searchResults = $state<any[]>([]);
	let isSearching = $state(false);
	let searchError = $state('');
	let debounceTimer: ReturnType<typeof setTimeout> | undefined = $state();
	let hasSearched = $state(false);

	const isShowingSearch = $derived(searchQuery.trim().length >= 2);

	async function doSearch(q: string) {
		const trimmed = q.trim();
		if (trimmed.length < 2) {
			searchResults = [];
			searchError = '';
			hasSearched = false;
			return;
		}

		isSearching = true;
		searchError = '';
		hasSearched = true;

		try {
			const res = await fetch(`/api/anime-search?q=${encodeURIComponent(trimmed)}`);
			const json = await res.json();

			if (!res.ok) {
				searchError = json.error || 'Search failed';
				searchResults = [];
			} else {
				searchResults = json.results || [];
			}
		} catch {
			searchError = 'Search unavailable. Try again.';
			searchResults = [];
		} finally {
			isSearching = false;
		}
	}

	function handleInput() {
		clearTimeout(debounceTimer);
		const q = searchQuery.trim();

		if (q.length < 2) {
			searchResults = [];
			searchError = '';
			hasSearched = false;
			return;
		}

		debounceTimer = setTimeout(() => {
			doSearch(q);
			if (browser) {
				const url = new URL(window.location.href);
				url.searchParams.set('q', q);
				goto(url, { replaceState: true, noScroll: true, keepFocus: true });
			}
		}, 400);
	}

	function clearSearch() {
		searchQuery = '';
		searchResults = [];
		searchError = '';
		hasSearched = false;
		if (browser) {
			const url = new URL(window.location.href);
			url.searchParams.delete('q');
			goto(url, { replaceState: true, noScroll: true, keepFocus: true });
		}
	}

	onMount(() => {
		const urlQ = page.url.searchParams.get('q') || '';
		if (urlQ) {
			searchQuery = urlQ;
			doSearch(urlQ);
		}

		function handleKeydown(e: KeyboardEvent) {
			if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
				e.preventDefault();
				const input = document.querySelector('input[type="search"]') as HTMLInputElement;
				input?.focus();
			}
			if (e.key === 'Escape' && searchQuery) {
				clearSearch();
				(document.querySelector('input[type="search"]') as HTMLInputElement)?.blur();
			}
		}
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

<MobileShell />

<SEOHead
	title="Anime - Streamium"
	description="Stream the latest and greatest anime for free on Streamium."
	canonical="/anime"
	ogType="website"
/>

<div class="page-transition min-h-screen pt-20">
	<div class="mx-auto max-w-7xl px-4 pb-24">
		<div class="relative mb-6">
			<input
				type="search"
				bind:value={searchQuery}
				oninput={handleInput}
				placeholder="Search anime... (press / to focus)"
				autocomplete="off"
				class="w-full rounded-xl bg-zinc-800/80 px-10 py-3 text-base text-white placeholder-zinc-500 outline-none transition focus:ring-2 focus:ring-indigo-500"
				style="font-size: 16px;"
			/>
			<svg class="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
			{#if searchQuery}
				<button
					onclick={clearSearch}
					class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-zinc-700 p-1 text-zinc-400 transition hover:text-white"
				>
					<svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			{/if}
		</div>

		{#if isSearching}
			<div class="flex items-center justify-center py-12">
				<div class="size-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
				<span class="ml-3 text-zinc-400">Searching...</span>
			</div>
		{/if}

		{#if searchError && !isSearching}
			<div class="rounded-xl border border-red-800 bg-red-900/30 p-6 text-center">
				<p class="text-red-400">{searchError}</p>
				<button
					onclick={() => doSearch(searchQuery)}
					class="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm text-white transition hover:bg-red-600"
				>
					Retry
				</button>
			</div>
		{/if}

		{#if isShowingSearch && !isSearching && !searchError && searchResults.length > 0}
			<p class="mb-4 text-sm text-zinc-400">
				{searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
			</p>
		{/if}

		{#if isShowingSearch && searchResults.length === 0 && !isSearching && !searchError && hasSearched}
			<div class="flex flex-col items-center py-16 text-center">
				<svg class="size-12 text-zinc-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6"/></svg>
				<p class="mt-4 text-lg text-zinc-400">No anime found for "{searchQuery}"</p>
				<p class="mt-1 text-sm text-zinc-500">Try a different title or check your spelling</p>
			</div>
		{/if}

		{#if isShowingSearch && searchResults.length > 0 && !isSearching}
			<div class="movie-grid">
				{#each searchResults as item, i (String(item.id) + '-' + i)}
					<AnimeCard
						anime={{
							id: item.id,
							name: item.title,
							poster: item.poster || item.image,
							type: 'TV',
							episodes: { sub: item.episodes || 0, dub: null }
						}}
					/>
				{/each}
			</div>
		{/if}

		{#if !isShowingSearch}
			<main class="flex flex-col gap-8">
				{#if home}
					<AnimeHero spotlight={home.spotLightAnimes} />

					<div class="space-y-8 pb-12">
						{#if home.trendingAnimes?.length}
							<AnimeTrendingRow title="Trending Now" items={home.trendingAnimes} />
						{/if}

						{#if home.latestEpisodes?.length}
							<AnimeLatestRow title="Latest Episodes" items={home.latestEpisodes} />
						{/if}

						{#if home.top10Animes}
							{#each Object.entries(home.top10Animes) as [category, animes]}
								<AnimeTop10Row title="Top 10 - {category}" items={animes} />
							{/each}
						{/if}
					</div>
				{:else}
					<HomePageSkeleton />
				{/if}
			</main>
		{/if}
	</div>
</div>
