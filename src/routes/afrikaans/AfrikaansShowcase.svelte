<script lang="ts">
	import type { AfrikaansFilm } from '$lib/curated/afrikaans-films';
	import type { TMDbMovie } from '$lib/tmdb';

	let {
		movies = [],
	}: {
		movies: { film: AfrikaansFilm; details: TMDbMovie | null }[];
	} = $props();

	let currentIndex = $state(0);
	let current = $derived(movies[currentIndex]);

	function prev() {
		currentIndex = (currentIndex - 1 + movies.length) % movies.length;
	}

	function next() {
		currentIndex = (currentIndex + 1) % movies.length;
	}
</script>

{#if movies.length > 0}
	<div class="showcase">
		<div class="backdrop">
			<img
				src={current.details?.backdrop_path
					? `https://image.tmdb.org/t/p/w1280${current.details.backdrop_path}`
					: '/placeholder-backdrop.svg'}
				alt={current.film.title}
			/>
      <div class="overlay"></div>
		</div>

		<div class="content">
			<h2>{current.film.title}</h2>
			{#if current.film.titleEn}
				<p class="en-title">{current.film.titleEn}</p>
			{/if}
			<p class="overview">{current.details?.overview ?? ''}</p>
			<div class="meta">
				<span>{current.film.year}</span>
				{#if current.details?.vote_average}
					<span>★ {current.details.vote_average.toFixed(1)}</span>
				{/if}
				{#if current.film.director}
					<span>{current.film.director}</span>
				{/if}
			</div>
		</div>

		<button class="nav prev" onclick={prev} aria-label="Previous">‹</button>
		<button class="nav next" onclick={next} aria-label="Next">›</button>

		<div class="dots">
			{#each movies as _, i}
		<button
          class="dot"
          class:active={i === currentIndex}
          onclick={() => (currentIndex = i)}
          aria-label="Go to slide {i + 1}"
        ></button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.showcase {
		position: relative;
		height: 60vh;
		min-height: 400px;
		overflow: hidden;
		border-radius: 12px;
		margin-bottom: 2rem;
	}

	.backdrop {
		position: absolute;
		inset: 0;
	}

	.backdrop img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, transparent 60%);
	}

	.content {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 2rem;
		color: #fff;
		z-index: 1;
	}

	.content h2 {
		margin: 0;
		font-size: 2rem;
	}

	.en-title {
		margin: 0.2rem 0;
		font-style: italic;
		opacity: 0.8;
	}

	.overview {
		max-width: 600px;
		margin: 0.5rem 0;
		opacity: 0.9;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.meta {
		display: flex;
		gap: 1rem;
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		background: rgba(0, 0, 0, 0.5);
		color: #fff;
		border: none;
		font-size: 2rem;
		padding: 0.5rem 1rem;
		cursor: pointer;
		z-index: 2;
		border-radius: 4px;
	}

	.nav:hover {
		background: rgba(0, 0, 0, 0.8);
	}

	.prev {
		left: 1rem;
	}

	.next {
		right: 1rem;
	}

	.dots {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 0.5rem;
		z-index: 2;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 2px solid #fff;
		background: transparent;
		cursor: pointer;
		padding: 0;
	}

	.dot.active {
		background: #fff;
	}
</style>
