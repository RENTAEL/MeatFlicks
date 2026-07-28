<script lang="ts">
	import { AFRIKAANS_FILMS, type AfrikaansFilm } from '$lib/curated/afrikaans-films';
	import AfrikaansMovieCard from './AfrikaansMovieCard.svelte';
	import AfrikaansShowcase from './AfrikaansShowcase.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let { showcase } = data;

	let searchQuery = $state('');
	let sortOrder = $state<'title' | 'year' | 'popularity'>('title');

	let filtered: AfrikaansFilm[] = $derived.by(() => {
		let list = AFRIKAANS_FILMS;

		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(f) =>
					f.title.toLowerCase().includes(q) ||
					(f.titleEn?.toLowerCase() ?? '').includes(q) ||
					(f.director?.toLowerCase() ?? '').includes(q)
			);
		}

		if (sortOrder === 'title') {
			list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'af'));
		} else if (sortOrder === 'year') {
			list = [...list].sort((a, b) => b.year - a.year);
		}

		return list;
	});
</script>

<AfrikaansShowcase {showcase} />

<div class="controls">
	<input
		type="search"
		bind:value={searchQuery}
		placeholder="Search Afrikaans films..."
	/>

	<select bind:value={sortOrder}>
		<option value="title">Title</option>
		<option value="year">Year</option>
	</select>
</div>

<div class="grid">
	{#each filtered as movie (movie.tmdbId)}
		<AfrikaansMovieCard {movie} />
	{/each}
</div>

{#if filtered.length === 0}
	<p class="empty">Geen resultate nie</p>
{/if}

<style>
	.controls {
		display: flex;
		gap: 1rem;
		padding: 1rem 0;
		max-width: 1200px;
		margin: 0 auto;
	}

	.controls input {
		flex: 1;
		padding: 0.5rem;
		border-radius: 6px;
		border: 1px solid #444;
		background: #222;
		color: #fff;
	}

	.controls select {
		padding: 0.5rem;
		border-radius: 6px;
		border: 1px solid #444;
		background: #222;
		color: #fff;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.empty {
		text-align: center;
		padding: 3rem;
		color: #888;
	}
</style>
