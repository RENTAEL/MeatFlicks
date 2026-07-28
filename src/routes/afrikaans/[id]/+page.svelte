<script lang="ts">
	import type { PageData } from './$types';
	import { fly, fade } from 'svelte/transition';

	let { data }: { data: PageData } = $props();
	let { movie, trailer, subtitles } = data;

	let showPlayer = $state(false);
	let showTrailer = $state(false);

	function handleWatchNow() {
		fetch('/api/history/add', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				tmdbId: movie.id, type: 'movie',
				title: movie.title, poster: movie.poster_path,
			}),
		}).catch(() => {});
		showPlayer = true;
	}
</script>

<svelte:head>
	<title>{movie.title} — Afrikaans Films — Streamium</title>
	<meta name="description" content={movie.overview?.slice(0, 160)} />
</svelte:head>

<div class="detail-page">
	{#if movie.backdrop_path}
		<div class="backdrop">
			<img src="https://image.tmdb.org/t/p/original{movie.backdrop_path}" alt="" />
			<div class="backdrop-gradient"></div>
		</div>
	{/if}

	<div class="detail-content">
		<a href="/afrikaans" class="back-link">← Terug na Afrikaans Films</a>

		<div class="detail-layout">
			<div class="poster-col">
				<img
					src={movie.poster_path
						? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
						: '/placeholder.svg'}
					alt={movie.title}
					class="poster"
				/>
			</div>

			<div class="info-col">
				<h1 class="movie-title">{movie.title}</h1>
				{#if movie.titleEn}
					<p class="movie-title-en">{movie.titleEn}</p>
				{/if}

				{#if movie.tagline}
					<p class="tagline">{movie.tagline}</p>
				{/if}

				<div class="meta-row">
					{#if movie.year}
						<span class="meta-badge">{movie.year}</span>
					{/if}
					{#if movie.runtime}
						<span class="meta-badge">{movie.runtime} min</span>
					{/if}
					{#if movie.vote_average > 0}
						<span class="meta-badge rating">★ {movie.vote_average.toFixed(1)}</span>
					{/if}
					{#if movie.director}
						<span class="meta-badge">{movie.director}</span>
					{/if}
				</div>

				{#if movie.genres?.length > 0}
					<div class="genres">
						{#each movie.genres as genre}
							<span class="genre-tag">{genre.name}</span>
						{/each}
					</div>
				{/if}

				{#if movie.overview}
					<p class="overview">{movie.overview}</p>
				{/if}

				{#if movie.cast?.length > 0}
					<div class="cast-section">
						<h3>Rolverdeling</h3>
						<div class="cast-list">
							{#each movie.cast as actor}
								<span class="cast-item">
									<strong>{actor.name}</strong>
									<span class="cast-role">{actor.character}</span>
								</span>
							{/each}
						</div>
					</div>
				{/if}

				<div class="actions">
					<button class="watch-btn" onclick={handleWatchNow}>
						▶ Kyk Nou
					</button>
					{#if trailer}
						<button class="trailer-btn" onclick={() => { showTrailer = true; }}>
							▶ Voorskou
						</button>
					{/if}
				</div>

				{#if subtitles}
					<p class="subtitles-available">
						💬 Afrikaanse onderskrifte beskikbaar
					</p>
				{/if}
			</div>
		</div>

		{#if movie.similar?.length > 0}
			<section class="similar-section">
				<h2>Soortgelyke Films</h2>
				<div class="similar-scroll">
					{#each movie.similar as similar}
						<a href="/afrikaans/{similar.id}" class="similar-card">
							<img
								src={similar.poster_path
									? `https://image.tmdb.org/t/p/w300${similar.poster_path}`
									: '/placeholder.svg'}
								alt={similar.title}
								loading="lazy"
							/>
							<span>{similar.title}</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

{#if showPlayer}
	<div class="overlay" transition:fade={{ duration: 200 }}>
		<button class="overlay-close" onclick={() => { showPlayer = false; }}>✕ Sluit</button>
		<div class="player-container">
			<iframe
				src="/api/stream/{movie.id}?type=movie"
				class="player-iframe"
				allow="autoplay; fullscreen"
				allowfullscreen
			></iframe>
		</div>
	</div>
{/if}

{#if showTrailer && trailer}
	<div class="overlay" transition:fade={{ duration: 200 }}>
		<button class="overlay-close" onclick={() => { showTrailer = false; }}>✕ Sluit</button>
		<div class="youtube-wrap">
			<iframe
				src="https://www.youtube.com/embed/{trailer.key}?autoplay=1"
				allow="autoplay; fullscreen"
				allowfullscreen
				class="youtube-iframe"
			></iframe>
		</div>
	</div>
{/if}

<style>
	.detail-page { position: relative; min-height: 100vh; }

	.backdrop {
		position: absolute; top: 0; left: 0; right: 0;
		height: 500px; overflow: hidden; z-index: 0;
	}
	.backdrop img {
		width: 100%; height: 100%; object-fit: cover;
		filter: blur(20px); transform: scale(1.1);
	}
	.backdrop-gradient {
		position: absolute; inset: 0;
		background: linear-gradient(to bottom, rgba(15,15,35,0.4), #0f0f23 95%);
	}

	.detail-content {
		position: relative; z-index: 1;
		max-width: 1200px; margin: 0 auto; padding: 40px 24px;
	}

	.back-link {
		display: inline-block; color: #818cf8;
		text-decoration: none; font-size: 14px; margin-bottom: 32px;
	}

	.detail-layout { display: flex; gap: 40px; }

	.poster-col { flex-shrink: 0; width: 300px; }
	.poster { width: 100%; border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }

	.info-col { flex: 1; min-width: 0; }

	.movie-title {
		font-size: 36px; font-weight: 800;
		color: #e0e7ff; margin: 0 0 4px;
	}
	.movie-title-en {
		font-size: 16px; color: #6b7280; margin: 0 0 12px;
	}
	.tagline {
		font-size: 15px; color: #a5b4fc;
		font-style: italic; margin: 0 0 16px;
	}

	.meta-row {
		display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
	}
	.meta-badge {
		background: rgba(129,140,248,0.1); color: #c7d2fe;
		padding: 4px 12px; border-radius: 6px; font-size: 13px;
	}
	.meta-badge.rating { color: #fbbf24; }

	.genres { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
	.genre-tag {
		background: rgba(129,140,248,0.08); color: #a5b4fc;
		border: 1px solid rgba(129,140,248,0.15);
		padding: 4px 12px; border-radius: 20px; font-size: 12px;
	}

	.overview {
		font-size: 15px; color: #c7d2fe;
		line-height: 1.7; margin: 0 0 24px;
	}

	.cast-section h3 { font-size: 16px; color: #e0e7ff; margin: 0 0 12px; }
	.cast-list { display: flex; flex-wrap: wrap; gap: 8px 20px; }
	.cast-item { font-size: 13px; color: #c7d2fe; }
	.cast-item strong { color: #e0e7ff; }
	.cast-role { color: #6b7280; margin-left: 6px; }

	.actions {
		display: flex; align-items: center; gap: 12px;
		margin-top: 28px; flex-wrap: wrap;
	}
	.watch-btn {
		background: #818cf8; color: #fff; border: none;
		padding: 14px 28px; border-radius: 12px;
		font-size: 16px; font-weight: 600; cursor: pointer;
	}
	.watch-btn:hover { background: #6366f1; }
	.trailer-btn {
		background: rgba(129,140,248,0.1); color: #c7d2fe;
		border: 1px solid rgba(129,140,248,0.2);
		padding: 14px 28px; border-radius: 12px; font-size: 16px; cursor: pointer;
	}
	.trailer-btn:hover { background: rgba(129,140,248,0.2); }
	.subtitles-available { margin-top: 16px; font-size: 13px; color: #34d399; }

	.overlay {
		position: fixed; inset: 0; z-index: 500;
		background: rgba(0,0,0,0.92);
		display: flex; align-items: center; justify-content: center; flex-direction: column;
	}
	.overlay-close {
		position: absolute; top: 20px; right: 20px; z-index: 10;
		background: rgba(255,255,255,0.1); color: #fff;
		border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer;
	}
	.player-container { width: 90vw; max-width: 1100px; aspect-ratio: 16/9; }
	.player-iframe { width: 100%; height: 100%; border: none; border-radius: 12px; }
	.youtube-wrap { width: 90vw; max-width: 960px; aspect-ratio: 16/9; }
	.youtube-iframe { width: 100%; height: 100%; border: none; border-radius: 12px; }

	.similar-section { margin-top: 60px; }
	.similar-section h2 { font-size: 22px; color: #e0e7ff; margin: 0 0 20px; }
	.similar-scroll { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; }
	.similar-card { flex-shrink: 0; width: 140px; text-decoration: none; text-align: center; }
	.similar-card img { width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 8px; }
	.similar-card span { display: block; font-size: 12px; color: #c7d2fe; margin-top: 6px; }

	@media (max-width: 768px) {
		.detail-layout { flex-direction: column; gap: 24px; }
		.poster-col { width: 200px; margin: 0 auto; }
		.movie-title { font-size: 26px; }
		.actions { flex-direction: column; align-items: stretch; }
		.backdrop { height: 300px; }
	}
</style>
