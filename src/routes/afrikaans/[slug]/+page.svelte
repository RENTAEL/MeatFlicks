<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let poster = $derived(
		data.details?.poster_path
			? `https://image.tmdb.org/t/p/w500${data.details.poster_path}`
			: '/placeholder-poster.svg'
	);

	let backdrop = $derived(
		data.details?.backdrop_path
			? `https://image.tmdb.org/t/p/w1280${data.details.backdrop_path}`
			: null
	);
</script>

<svelte:head>
	<title>{data.film.title} — Cinephile Afrikaans</title>
</svelte:head>

{#if backdrop}
	<div class="hero">
		<img src={backdrop} alt={data.film.title} />
		<div class="hero-overlay"></div>
	</div>
{/if}

<article class="detail">
	<div class="poster">
		<img src={poster} alt={data.film.title} />
	</div>

	<div class="info">
		<h1>{data.film.title}</h1>
		{#if data.film.titleEn}
			<p class="en-title">{data.film.titleEn}</p>
		{/if}

		<div class="meta">
			<span>{data.film.year}</span>
			{#if data.details?.vote_average}
				<span>★ {data.details.vote_average.toFixed(1)}</span>
			{/if}
			{#if data.details?.runtime}
				<span>{data.details.runtime} min</span>
			{/if}
			{#if data.film.director}
				<span>{data.film.director}</span>
			{/if}
		</div>

		{#if data.details?.genres}
			<div class="genres">
				{#each data.details.genres as genre}
					<span class="genre">{genre.name}</span>
				{/each}
			</div>
		{/if}

		{#if data.details?.overview}
			<p class="overview">{data.details.overview}</p>
		{/if}

		{#if data.details?.tagline}
			<blockquote>{data.details.tagline}</blockquote>
		{/if}

		{#if data.details?.videos?.results?.length}
			<div class="trailer">
				<h3>Trailer</h3>
				<iframe
					src="https://www.youtube-nocookie.com/embed/{data.details.videos.results[0].key}"
					title="Trailer"
					allowfullscreen
				></iframe>
			</div>
		{/if}

		{#if data.subtitleUrl}
			<a class="subtitle-link" href={data.subtitleUrl} target="_blank">
				Download Afrikaans subtitles
			</a>
		{/if}

		{#if data.details?.credits?.cast?.length}
			<div class="cast">
				<h3>Cast</h3>
				<div class="cast-list">
					{#each data.details.credits.cast.slice(0, 10) as member}
						<span class="cast-member">
							<strong>{member.name}</strong>
							<span class="character">{member.character}</span>
						</span>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</article>

<style>
	.hero {
		position: relative;
		height: 40vh;
		min-height: 300px;
		overflow: hidden;
	}

	.hero img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.hero-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, #000 0%, transparent 60%);
	}

	.detail {
		display: flex;
		gap: 2rem;
		max-width: 1200px;
		margin: -100px auto 0;
		padding: 0 2rem 2rem;
		position: relative;
		z-index: 1;
	}

	.poster {
		flex-shrink: 0;
		width: 300px;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
	}

	.poster img {
		width: 100%;
		display: block;
	}

	.info {
		flex: 1;
		min-width: 0;
	}

	.info h1 {
		margin: 0 0 0.2rem;
		font-size: 2rem;
	}

	.en-title {
		margin: 0 0 1rem;
		font-style: italic;
		color: #999;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin-bottom: 1rem;
		color: #aaa;
		font-size: 0.95rem;
	}

	.genres {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.genre {
		padding: 0.2rem 0.6rem;
		border-radius: 4px;
		background: #333;
		font-size: 0.85rem;
	}

	.overview {
		line-height: 1.6;
		margin-bottom: 1rem;
	}

	blockquote {
		font-style: italic;
		color: #aaa;
		border-left: 3px solid #555;
		padding-left: 1rem;
		margin: 0 0 1rem;
	}

	.trailer {
		margin-bottom: 1rem;
	}

	.trailer iframe {
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 8px;
		border: none;
	}

	.subtitle-link {
		display: inline-block;
		padding: 0.5rem 1rem;
		background: #0066cc;
		color: #fff;
		border-radius: 6px;
		text-decoration: none;
		margin-bottom: 1rem;
	}

	.subtitle-link:hover {
		background: #0052a3;
	}

	.cast h3 {
		margin-bottom: 0.5rem;
	}

	.cast-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.cast-member {
		background: #222;
		padding: 0.4rem 0.8rem;
		border-radius: 6px;
		display: flex;
		flex-direction: column;
		font-size: 0.85rem;
	}

	.character {
		color: #888;
		font-size: 0.8rem;
	}
</style>
