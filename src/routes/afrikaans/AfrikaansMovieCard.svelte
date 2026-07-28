<script lang="ts">
	import type { AfrikaansFilm } from '$lib/curated/afrikaans-films';

	let { movie }: { movie: AfrikaansFilm } = $props();

	let posterSrc = $derived(
		movie.poster || '/placeholder-poster.svg'
	);
</script>

<a class="card" href="/movie/{movie.tmdbId}">
	<div class="poster">
		<img
			{posterSrc}
			alt={movie.title}
			loading="lazy"
			onerror={(e) => {
				const target = e.currentTarget;
				target.src = '/placeholder-poster.svg';
			}}
		/>
		{#if movie.year}
				<span class="year">{movie.year}</span>
			{/if}
	</div>
	<div class="info">
		<h3>{movie.title}</h3>
		{#if movie.titleEn}
			<p class="en-title">{movie.titleEn}</p>
		{/if}
		{#if movie.director}
			<p class="director">{movie.director}</p>
		{/if}
	</div>
</a>

<style>
	.card {
		display: block;
		text-decoration: none;
		color: inherit;
		border-radius: 8px;
		overflow: hidden;
		background: #111;
		transition: transform 0.2s;
	}

	.card:hover {
		transform: translateY(-4px);
	}

	.poster {
		position: relative;
		aspect-ratio: 2 / 3;
		overflow: hidden;
		background: #222;
	}

	.poster img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.year {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background: rgba(0, 0, 0, 0.75);
		color: #fff;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.8rem;
	}

	.info {
		padding: 0.5rem;
	}

	.info h3 {
		margin: 0;
		font-size: 0.95rem;
	}

	.en-title {
		margin: 0.2rem 0;
		font-size: 0.8rem;
		color: #999;
		font-style: italic;
	}

	.director {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		color: #777;
	}
</style>
