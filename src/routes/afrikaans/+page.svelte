<script lang="ts">
	import type { PageData } from './$types';
	import { AFRIKAANS_FILMS, type AfrikaansFilm } from '$lib/curated/afrikaans-films';
	import AfrikaansMovieCard from './AfrikaansMovieCard.svelte';
	import AfrikaansShowcase from './AfrikaansShowcase.svelte';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let sortOrder = $state<'title' | 'year'>('year');

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

<AfrikaansShowcase movies={data.showcase} />

<svelte:head>
	<title>Afrikaans Films — Cinephile</title>
	<meta name="description" content="Browse our curated collection of Afrikaans films." />
</svelte:head>

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

	<div class="grid">
		{#each filtered as movie (movie.tmdbId)}
			<AfrikaansMovieCard {movie} />
		{/each}
	</div>
</div>

{#if filtered.length === 0}
	<p class="empty">Geen flieks gevind nie. — No films found.</p>
{/if}

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
