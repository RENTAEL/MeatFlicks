<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import MediaCard from '$lib/components/MediaCard.svelte';
	import SkeletonCard from '$lib/components/SkeletonCard.svelte';
	import { fly } from 'svelte/transition';

	let { data }: { data: PageData } = $props();

	let movies = $state(data.movies || []);
	let currentPage = $state(data.page || 1);
	let hasMore = $state(data.hasMore ?? false);
	let loadingMore = $state(false);
	let searchQuery = $state('');

	let filteredMovies = $derived(
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

	<div class="relative mb-6">
		<svg class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
		<input
			type="text"
			placeholder="Search by title, director, year…"
			bind:value={searchQuery}
			class="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-2.5 pl-10 pr-10 text-sm text-zinc-200 placeholder-zinc-500 backdrop-blur-sm transition-colors focus:border-indigo-500/50 focus:outline-none"
		/>
		{#if searchQuery}
			<button
				onclick={() => searchQuery = ''}
				class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
			>✕</button>
		{/if}
	</div>

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
		{#if searchQuery}
			<p class="mb-4 text-sm text-zinc-500">{filteredMovies.length} result{filteredMovies.length === 1 ? '' : 's'}</p>
		{/if}

		<div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
			{#each filteredMovies as movie, i (movie.id)}
				<div in:fly={{ y: 20, duration: 200, delay: Math.min(i * 30, 400) }}>
					<MediaCard media={movie} href="/afrikaans/{movie.id}" />
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
