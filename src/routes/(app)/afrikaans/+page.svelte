<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import { toLibraryMovie } from '$lib/utils/tmdb';
	import SkeletonCard from '$lib/components/SkeletonCard.svelte';
	import { fly } from 'svelte/transition';

	let { data }: { data: PageData } = $props();

	let movies = $state(data.movies || []);
	let currentPage = $state(data.page || 1);
	let hasMore = $state(data.hasMore ?? false);
	let loadingMore = $state(false);
	let searchQuery = $state('');
	type SortMode = 'default' | 'newest';
	let sortMode = $state<SortMode>('default');

	let searchedMovies = $derived(
		searchQuery
			? movies.filter((m: any) => {
				const q = searchQuery.toLowerCase();
				return (
					(m.title?.toLowerCase() ?? '').includes(q) ||
					(m.titleEn?.toLowerCase() ?? '').includes(q) ||
					(m.overview?.toLowerCase() ?? '').includes(q) ||
					String(m.year ?? '').includes(q) ||
					(m.director?.toLowerCase() ?? '').includes(q)
				);
			})
			: movies
	);

	let filteredMovies = $derived(
		sortMode === 'newest'
			? [...searchedMovies].sort((a: any, b: any) => {
				const dateA = a.release_date ? new Date(a.release_date).getTime() : a.year ? new Date(String(a.year)).getTime() : 0;
				const dateB = b.release_date ? new Date(b.release_date).getTime() : b.year ? new Date(String(b.year)).getTime() : 0;
				return dateB - dateA;
			})
			: searchedMovies
	);

	function toggleSort() {
		sortMode = sortMode === 'default' ? 'newest' : 'default';
	}

	$effect(() => {
		if (data.movies) movies = data.movies;
		currentPage = data.page || 1;
		hasMore = data.hasMore ?? false;
	});

	let initialLoad = $derived(!movies.length);

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		const nextPage = currentPage + 1;
		try {
			const res = await fetch(`/afrikaans/api/discover?page=${nextPage}`);
			if (!res.ok) throw new Error('Failed');
			const json = await res.json();
			movies = [...movies, ...(json.results || [])];
			currentPage = nextPage;
			hasMore = json.hasMore ?? false;
			goto(`/afrikaans?page=${nextPage}`, { replaceState: true, noScroll: true });
		} catch {
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head>
	<title>Afrikaans Films — Streamium</title>
	<meta name="description" content="Browse Afrikaans-language films and South African cinema." />
</svelte:head>

<div class="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
	<div class="mb-2 flex items-center justify-between">
		<h1 class="text-2xl font-bold text-white">Afrikaans Films</h1>
	</div>

	<p class="mb-6 text-sm text-zinc-500">Afrikaans-language cinema and South African film</p>

	<div class="toolbar">
		<div class="search-input-wrap">
			<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
			<input
				type="text"
				class="search-input"
				placeholder="Search by title, director, year…"
				bind:value={searchQuery}
			/>
			{#if searchQuery}
				<button class="search-clear" onclick={() => searchQuery = ''}>✕</button>
			{/if}
		</div>
		<button
			class="sort-btn"
			class:active={sortMode === 'newest'}
			onclick={toggleSort}
		>
			<svg class="sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M3 6h13M3 12h9M3 18h5" />
			</svg>
			<span>{sortMode === 'newest' ? 'Nuutste' : 'Sorteer'}</span>
		</button>
	</div>
	{#if searchQuery}
		<p class="mb-4 text-sm text-zinc-500">{filteredMovies.length} van {movies.length} resultate</p>
	{/if}

	{#if initialLoad}
		<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
			{#each Array(20) as _, i}
				<div in:fly={{ y: 10, duration: 150, delay: i * 30 }}>
					<SkeletonCard />
				</div>
			{/each}
		</div>
	{:else if movies.length === 0}
		<div class="flex flex-col items-center justify-center py-20">
			<svg class="mb-4 size-16 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
			<p class="text-lg font-medium text-zinc-400">Geen Afrikaanse films gevind nie.</p>
		</div>
	{:else if data.error}
		<div class="flex flex-col items-center justify-center py-20">
			<svg class="mb-4 size-16 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
			<p class="text-lg font-medium text-zinc-400">Failed to load films.</p>
			<button
				onclick={() => goto('/afrikaans')}
				class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
			>Retry</button>
		</div>
	{:else if filteredMovies.length === 0}
		<div class="flex flex-col items-center justify-center py-20">
			<svg class="mb-4 size-16 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
			<p class="text-lg font-medium text-zinc-400">Geen resultate vir "{searchQuery}" nie.</p>
			<p class="mt-1 text-sm text-zinc-600">Probeer 'n ander soektog / Try a different search.</p>
		</div>
	{:else}
		<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
			{#each filteredMovies as movie, i (movie.id)}
				<div in:fly={{ y: 20, duration: 200, delay: Math.min(i * 30, 400) }}>
					<MediaCard movie={toLibraryMovie(movie)} href="/afrikaans/{movie.id}" />
				</div>
			{/each}
		</div>

		{#if hasMore && !searchQuery}
			<div class="mt-8 flex justify-center">
				<button
					onclick={loadMore}
					disabled={loadingMore}
					class="rounded-xl border border-zinc-800 bg-zinc-900/60 px-8 py-3 text-sm font-medium text-zinc-300 backdrop-blur-sm transition-colors hover:bg-zinc-800 disabled:opacity-50"
				>
					{loadingMore ? 'Laai... / Loading...' : 'Laai Meer / Load More'}
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.toolbar {
		display: flex; align-items: center; gap: 12px; margin-bottom: 28px; flex-wrap: wrap;
	}
	.search-input-wrap {
		position: relative; flex: 1; max-width: 480px; min-width: 200px;
	}
	.search-icon {
		position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
		width: 16px; height: 16px; color: #71717a; pointer-events: none;
	}
	.search-input {
		width: 100%; padding: 10px 36px 10px 36px;
		border-radius: 12px; border: 1px solid #27272a;
		background: rgba(24,24,27,0.6); color: #e4e4e7;
		font-size: 14px; outline: none; transition: border-color 0.15s;
	}
	.search-input:focus { border-color: rgba(99,102,241,0.5); }
	.search-input::placeholder { color: #52525b; }
	.search-clear {
		position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
		background: none; border: none; color: #71717a; cursor: pointer; font-size: 16px; padding: 4px;
	}
	.search-clear:hover { color: #e4e4e7; }

	.sort-btn {
		display: flex; align-items: center; gap: 6px;
		padding: 10px 16px; background: rgba(30,27,75,0.7);
		border: 1px solid rgba(129,140,248,0.15); border-radius: 12px;
		color: #a5b4fc; font-size: 13px; font-weight: 500;
		cursor: pointer; white-space: nowrap; transition: all 0.15s; flex-shrink: 0;
	}
	.sort-btn:hover { border-color: rgba(129,140,248,0.3); color: #c7d2fe; }
	.sort-btn.active { background: rgba(129,140,248,0.15); border-color: rgba(129,140,248,0.4); color: #e0e7ff; }
	.sort-icon { width: 16px; height: 16px; flex-shrink: 0; }

	@media (max-width: 640px) {
		.toolbar { flex-direction: column; align-items: stretch; }
		.search-input-wrap { max-width: 100%; }
		.sort-btn { justify-content: center; }
	}
</style>
