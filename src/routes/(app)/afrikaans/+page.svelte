<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import { toLibraryMovie } from '$lib/utils/tmdb';
	import SkeletonCard from '$lib/components/SkeletonCard.svelte';
	import EmptyState from '$lib/components/media/EmptyState.svelte';
	import { fly } from 'svelte/transition';

	let { data }: { data: PageData } = $props();

	let movies = $state(data.movies || []);
	let recentAfrikaans = $state(data.recentAfrikaans || []);
	let recentSA = $state(data.recentSA || []);
	let currentPage = $state(data.page || 1);
	let hasMore = $state(data.hasMore ?? false);
	let loadingMore = $state(false);
	let searchQuery = $state('');
	type SortMode = 'newest' | 'rating' | 'az';
	let sortMode = $state<SortMode>('newest');

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

	const sortValue = (m: any) => {
		const d = m.release_date ? new Date(m.release_date).getTime() : m.year && /^\d{4}$/.test(String(m.year)) ? new Date(String(m.year)).getTime() : 0;
		return Number.isFinite(d) ? d : 0;
	};

	let filteredMovies = $derived(
		(() => {
			const list = [...searchedMovies];
			if (sortMode === 'newest') {
				list.sort((a: any, b: any) => sortValue(b) - sortValue(a));
			} else if (sortMode === 'rating') {
				list.sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0));
			} else {
				list.sort((a: any, b: any) => String(a.title ?? '').localeCompare(String(b.title ?? '')));
			}
			return list;
		})()
	);

	$effect(() => {
		if (data.movies) movies = data.movies;
		recentAfrikaans = data.recentAfrikaans || [];
		recentSA = data.recentSA || [];
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

	{#if recentAfrikaans.length > 0}
		<section class="mb-8" aria-label="Nuut: Afrikaans / Recent Afrikaans">
			<div class="mb-3 flex items-baseline gap-3">
				<h2 class="text-lg font-semibold text-white">Nuut: Afrikaans</h2>
				<p class="text-xs text-zinc-500">Recent Afrikaans-language films (laaste 24 maande)</p>
			</div>
			<div class="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
				{#each recentAfrikaans as movie (movie.id)}
					<a href="/afrikaans/{movie.id}" class="w-28 shrink-0 sm:w-36 md:w-48">
						<MediaCard movie={toLibraryMovie(movie)} href="/afrikaans/{movie.id}" />
					</a>
				{/each}
			</div>
		</section>
	{:else}
		<section class="mb-8" aria-label="Nuut: Afrikaans / Recent Afrikaans">
			<div class="mb-3 flex items-baseline gap-3">
				<h2 class="text-lg font-semibold text-white">Nuut: Afrikaans</h2>
				<p class="text-xs text-zinc-500">Recent Afrikaans-language films (laaste 24 maande)</p>
			</div>
			<EmptyState
				compact
				title="Nog geen onlangse films nie / No recent films yet"
				subtitle="Kyk binnekort weer / Check back soon"
			/>
		</section>
	{/if}

	{#if recentSA.length > 0}
		<section class="mb-8" aria-label="Nuut: Suid-Afrikaans / Recent South African">
			<div class="mb-3 flex items-baseline gap-3">
				<h2 class="text-lg font-semibold text-white">Nuut: Suid-Afrikaans</h2>
				<p class="text-xs text-zinc-500">Recent South African releases — SA films, Afrikaans and English</p>
			</div>
			<div class="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
				{#each recentSA as movie (movie.id)}
					<a href="/afrikaans/{movie.id}" class="w-28 shrink-0 sm:w-36 md:w-48">
						<MediaCard movie={toLibraryMovie(movie)} href="/afrikaans/{movie.id}" />
					</a>
				{/each}
			</div>
		</section>
	{:else}
		<section class="mb-8" aria-label="Nuut: Suid-Afrikaans / Recent South African">
			<div class="mb-3 flex items-baseline gap-3">
				<h2 class="text-lg font-semibold text-white">Nuut: Suid-Afrikaans</h2>
				<p class="text-xs text-zinc-500">Recent South African releases — SA films, Afrikaans and English</p>
			</div>
			<EmptyState
				compact
				title="Nog geen onlangse films nie / No recent films yet"
				subtitle="Kyk binnekort weer / Check back soon"
			/>
		</section>
	{/if}

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
		<div class="sort-wrap">
			<label class="sort-label" for="afrikaans-sort">Sorteer</label>
			<select
				id="afrikaans-sort"
				class="sort-select"
				bind:value={sortMode}
				aria-label="Sorteer films / Sort films"
			>
				<option value="newest">Nuutste / Newest</option>
				<option value="rating">Beoordeling / Rating</option>
				<option value="az">A–Z</option>
			</select>
		</div>
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
		<EmptyState
			icon="film"
			title="Niks gevind nie / Nothing found"
			subtitle="Geen Afrikaanse films beskikbaar op die oomblik nie / No Afrikaans films available right now"
			backdrop={recentSA[0]?.backdrop || recentAfrikaans[0]?.backdrop}
		/>
	{:else if data.error}
		<EmptyState
			icon="error"
			title="Kon nie laai nie / Failed to load films"
			subtitle="Netwerkprobleem met TMDB / Network problem with TMDB"
			actionLabel="Probeer weer / Retry"
			onAction={() => goto('/afrikaans')}
		/>
	{:else if filteredMovies.length === 0}
		<EmptyState
			icon="search"
			title={`Geen resultate vir "${searchQuery}" nie / No results for "${searchQuery}"`}
			subtitle="Probeer 'n ander soektog / Try a different search"
			actionLabel="Maak skoon / Clear"
			onAction={() => searchQuery = ''}
		/>
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

	.sort-wrap {
		display: flex; align-items: center; gap: 8px; flex-shrink: 0;
	}
	.sort-label {
		font-size: 13px; color: #71717a; font-weight: 500; white-space: nowrap;
	}
	.sort-select {
		padding: 9px 12px; background: rgba(30,27,75,0.7);
		border: 1px solid rgba(129,140,248,0.15); border-radius: 12px;
		color: #a5b4fc; font-size: 13px; font-weight: 500;
		cursor: pointer; outline: none; transition: all 0.15s;
	}
	.sort-select:hover { border-color: rgba(129,140,248,0.3); color: #c7d2fe; }
	.sort-select:focus { border-color: rgba(129,140,248,0.4); }
	.sort-select option { background: #1e1b2e; color: #e4e4e7; }

	@media (max-width: 640px) {
		.toolbar { flex-direction: column; align-items: stretch; }
		.search-input-wrap { max-width: 100%; }
		.sort-wrap { justify-content: flex-end; }
	}
</style>
