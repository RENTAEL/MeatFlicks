<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import { AFRIKAANS_FILMS, type AfrikaansFilm } from '$lib/curated/afrikaans-films';
	import AfrikaansMovieCard from './AfrikaansMovieCard.svelte';
	import AfrikaansShowcase from './AfrikaansShowcase.svelte';
	import SkeletonCard from '$lib/components/SkeletonCard.svelte';
	import { fly } from 'svelte/transition';

	let { data }: { data: PageData } = $props();

	let mounted = $state(false);
	let searchQuery = $state('');
	let sortOrder = $state<'title' | 'year'>('year');
	const SKELETON_COUNT = 12;

	onMount(() => { mounted = true; });

	let filtered: AfrikaansFilm[] = $derived.by(() => {
		let list = AFRIKAANS_FILMS;

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(f) =>
					f.title.toLowerCase().includes(q) ||
					(f.titleEn?.toLowerCase() ?? '').includes(q)
			);
		}

		if (sortOrder === 'title') {
			list = [...list].sort((a, b) => a.title.localeCompare(b.title));
		} else if (sortOrder === 'year') {
			list = [...list].sort((a, b) => b.year - a.year);
		}

		return list;
	});
</script>

<svelte:head>
	<title>Afrikaans Films — Cinephile</title>
	<meta name="description" content="Browse our curated collection of Afrikaans films." />
</svelte:head>

<AfrikaansShowcase movies={data.showcase} />

<div class="afrikaans-page">
	<div class="filters">
		<input
			type="search"
			bind:value={searchQuery}
			placeholder="Search Afrikaans films..."
		/>
		<select bind:value={sortOrder}>
			<option value="year">Year</option>
			<option value="title">Title</option>
		</select>
	</div>

	{#if !mounted}
		<div class="grid">
			{#each Array(SKELETON_COUNT) as _, i}
				<div in:fly={{ y: 10, duration: 150, delay: i * 30 }}>
					<SkeletonCard />
				</div>
			{/each}
		</div>
	{:else if filtered.length === 0}
		<p class="empty">Geen flieks gevind nie. — No films found.</p>
	{:else}
		<div class="grid">
			{#each filtered as movie, i (movie.tmdbId)}
				<div in:fly={{ y: 20, duration: 200, delay: Math.min(i * 30, 400) }}>
					<AfrikaansMovieCard {movie} />
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.afrikaans-page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1rem;
	}

	.filters {
		display: flex;
		gap: 1rem;
		padding: 1rem 0;
	}

	.filters input {
		flex: 1;
		padding: 0.5rem;
		border-radius: 6px;
		border: 1px solid #444;
		background: #222;
		color: #fff;
	}

	.filters select {
		padding: 0.5rem;
		border-radius: 6px;
		border: 1px solid #444;
		background: #222;
		color: #fff;
	}

	.empty {
		text-align: center;
		margin-top: 3rem;
		color: #666;
		font-style: italic;
	}
</style>
