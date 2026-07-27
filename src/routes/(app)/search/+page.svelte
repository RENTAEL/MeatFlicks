<script lang="ts">
	import { browser } from '$app/environment';
	import { PUBLIC_TMDB_API_KEY } from '$env/static/public';
	import { fly, fade } from 'svelte/transition';
	import MediaCard from '$lib/components/MediaCard.svelte';

	let query = $state('');
	let results = $state<any[]>([]);
	let isLoading = $state(false);
	let hasSearched = $state(false);
	let error = $state('');
	let searchTimeout: ReturnType<typeof setTimeout>;
	let recentSearches = $state<string[]>([]);

	const genres = [
		{ name: 'Action', id: 28 },
		{ name: 'Comedy', id: 35 },
		{ name: 'Horror', id: 27 },
		{ name: 'Sci-Fi', id: 878 },
		{ name: 'Drama', id: 18 },
		{ name: 'Animation', id: 16 },
		{ name: 'Thriller', id: 53 },
		{ name: 'Romance', id: 10749 },
	];

	if (browser) {
		const stored = localStorage.getItem('streamium_recent_searches');
		if (stored) {
			try { recentSearches = JSON.parse(stored); } catch {}
		}
		const urlQuery = new URL(window.location.href).searchParams.get('q');
		if (urlQuery) {
			query = urlQuery;
			performSearch(urlQuery);
		}
	}

	function saveRecentSearch(term: string) {
		recentSearches = [term, ...recentSearches.filter(s => s !== term)].slice(0, 8);
		localStorage.setItem('streamium_recent_searches', JSON.stringify(recentSearches));
	}

	function clearRecentSearches() {
		recentSearches = [];
		localStorage.removeItem('streamium_recent_searches');
	}

	$effect(() => {
		const q = query;
		clearTimeout(searchTimeout);
		if (q.trim().length >= 2) {
			searchTimeout = setTimeout(() => performSearch(q.trim()), 400);
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && query.trim().length >= 2) {
			clearTimeout(searchTimeout);
			performSearch(query.trim());
		}
	}

	async function performSearch(term: string) {
		if (!term || term.length < 2) return;
		isLoading = true;
		hasSearched = true;
		error = '';
		results = [];

		const url = new URL(window.location.href);
		url.searchParams.set('q', term);
		window.history.replaceState({}, '', url.toString());

		try {
			const res = await fetch(
				`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(term)}&include_adult=false&api_key=${PUBLIC_TMDB_API_KEY}`
			);
			if (!res.ok) throw new Error(`Search failed (${res.status})`);
			const data = await res.json();

			results = (data.results || [])
				.filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
				.map((item: any) => ({
					id: item.id,
					title: item.title || item.name,
					poster: item.poster_path
						? `https://image.tmdb.org/t/p/w342${item.poster_path}`
						: null,
					rating: item.vote_average || 0,
					year: (item.release_date || item.first_air_date)?.split('-')[0] || '—',
					mediaType: item.media_type,
					href: `/${item.media_type}/${item.id}`,
				}));

			saveRecentSearch(term);
		} catch (e: any) {
			error = e.message || 'Something went wrong. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	function handleGenreClick(_genreId: number, genreName: string) {
		query = genreName;
		performSearch(genreName);
	}

	function handleRecentClick(term: string) {
		query = term;
		performSearch(term);
	}

	function clearSearch() {
		query = '';
		results = [];
		hasSearched = false;
		error = '';
		const url = new URL(window.location.href);
		url.searchParams.delete('q');
		window.history.replaceState({}, '', url.toString());
	}
</script>

<svelte:head>
	<title>Search — Streamium</title>
</svelte:head>

<div class="mx-auto min-h-screen max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
	<div class="mx-auto max-w-2xl pt-8 pb-6">
		<div class="relative">
			<div class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
			</div>
			<input
				type="text"
				bind:value={query}
				onkeydown={handleKeydown}
				placeholder="Search movies and TV shows..."
				autofocus
				class="w-full rounded-2xl border border-zinc-700/50 bg-zinc-900/80 py-4 pl-12 pr-12 text-lg text-white placeholder-zinc-500 transition-all focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
			/>
			{#if query}
				<button
					onclick={clearSearch}
					class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
					aria-label="Clear search"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
				</button>
			{/if}
		</div>
	</div>

	{#if !hasSearched && !isLoading}
		<div class="mx-auto max-w-2xl" in:fly={{ y: 20, duration: 300 }}>
			{#if recentSearches.length > 0}
				<div class="mb-8">
					<div class="mb-3 flex items-center justify-between">
						<h3 class="text-sm font-semibold text-zinc-400">Recent Searches</h3>
						<button
							onclick={clearRecentSearches}
							class="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
						>
							Clear all
						</button>
					</div>
					<div class="flex flex-wrap gap-2">
						{#each recentSearches as term}
							<button
								onclick={() => handleRecentClick(term)}
								class="flex items-center gap-1.5 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
								{term}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<div>
				<h3 class="mb-3 text-sm font-semibold text-zinc-400">Browse by Genre</h3>
				<div class="flex flex-wrap gap-2">
					{#each genres as genre}
						<button
							onclick={() => handleGenreClick(genre.id, genre.name)}
							class="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
						>
							{genre.name}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if isLoading}
		<div class="mt-4">
			<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
				{#each Array(12) as _}
					<div>
						<div class="aspect-[2/3] animate-pulse rounded-xl bg-zinc-800/50"></div>
						<div class="mt-2 h-4 w-3/4 animate-pulse rounded bg-zinc-800/50"></div>
						<div class="mt-1 h-3 w-1/2 animate-pulse rounded bg-zinc-800/30"></div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if error}
		<div class="mx-auto mt-16 max-w-md text-center" in:fade>
			<div class="mb-4 text-5xl">😞</div>
			<h3 class="mb-2 text-lg font-semibold text-zinc-200">Search failed</h3>
			<p class="mb-6 text-sm text-zinc-400">{error}</p>
			<button
				onclick={() => performSearch(query)}
				class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
			>
				Try again
			</button>
		</div>
	{/if}

	{#if hasSearched && !isLoading && !error && results.length === 0}
		<div class="mx-auto mt-16 max-w-md text-center" in:fade>
			<div class="mb-4 text-5xl">🔍</div>
			<h3 class="mb-2 text-lg font-semibold text-zinc-200">No results for "{query}"</h3>
			<p class="mb-6 text-sm text-zinc-400">
				We couldn't find any movies or TV shows matching your search. Try a different title, check for typos, or browse by genre instead.
			</p>
			<div class="flex flex-wrap justify-center gap-2">
				{#each genres.slice(0, 4) as genre}
					<button
						onclick={() => handleGenreClick(genre.id, genre.name)}
						class="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
					>
						{genre.name}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if results.length > 0}
		<div class="mt-4" in:fade>
			<p class="mb-4 text-sm text-zinc-500">
				{results.length} result{results.length !== 1 ? 's' : ''} for <span class="text-zinc-300">"{query}"</span>
			</p>
			<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
				{#each results as item (item.id + item.mediaType)}
					<div in:fly={{ y: 16, duration: 300, delay: 50 }}>
						<MediaCard media={item} href={item.href} />
						<div class="mt-1">
						<span
							class="rounded text-[10px] font-medium px-1.5 py-0.5 {item.mediaType === 'movie' ? 'text-indigo-400 bg-indigo-400/10' : 'text-emerald-400 bg-emerald-400/10'}"
						>
								{item.mediaType === 'movie' ? 'Movie' : 'TV'}
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="mx-auto mt-16 max-w-2xl pb-8 text-center">
		<p class="text-xs text-zinc-700">Search powered by TMDB.</p>
	</div>
</div>
