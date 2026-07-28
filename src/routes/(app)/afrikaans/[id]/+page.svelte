<script lang="ts">
	import { fade } from 'svelte/transition';
	import Player from '$lib/components/Player.svelte';
	import MovieInfo from '$lib/components/MovieInfo.svelte';
	import MediaCard from '$lib/components/MediaCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let showPlayer = $state(false);
	let showYoutube = $state(false);
	let playerSource = $state<'youtube' | 'scraper'>('youtube');
	let scraperError = $state('');

	function handleWatchNow() {
		const m = data.movie;
		if (!m) return;
		fetch('/api/history/add', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				tmdbId: m.id, type: 'movie',
				title: m.title, poster: m.poster_path,
			}),
		}).catch(() => {});

		if (data.youtubeUrl) {
			showYoutube = true;
			playerSource = 'youtube';
		} else {
			showPlayer = true;
			playerSource = 'scraper';
		}
	}

	function closePlayer() {
		showPlayer = false;
		showYoutube = false;
		scraperError = '';
	}

	function switchToYoutube() {
		showPlayer = false;
		showYoutube = true;
		playerSource = 'youtube';
		scraperError = '';
	}

	function switchToScraper() {
		showYoutube = false;
		showPlayer = true;
		playerSource = 'scraper';
		scraperError = '';
	}

	function onScraperError(detail: { message: string }) {
		scraperError = detail.message || 'Kon nie bron laai nie';
	}
</script>

<div class="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
	<a
		href="/afrikaans"
		class="mb-4 inline-flex items-center gap-1.5 text-zinc-400 transition-colors hover:text-white"
	>
		<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
		<span class="text-sm">Back to Afrikaans Films</span>
	</a>

	{#if data.error && !data.movie}
		<div class="flex flex-col items-center justify-center py-20">
			<svg class="mb-4 size-16 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
			<p class="text-lg font-medium text-zinc-400">Failed to load film</p>
			<p class="mt-1 text-sm text-zinc-600">{data.error}</p>
			<a
				href="/afrikaans"
				class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
			>
				Back to Afrikaans Films
			</a>
		</div>
	{:else if data.movie}
		{#if data.movie.titleEn}
			<p class="mb-1 text-sm text-zinc-500">{data.movie.titleEn}</p>
		{/if}

		<div class="relative mb-6 aspect-video w-full overflow-hidden rounded-xl bg-zinc-900">
			{#if data.movie.backdrop_path}
				<img
					src={`https://image.tmdb.org/t/p/w1280${data.movie.backdrop_path}`}
					alt=""
					class="absolute inset-0 h-full w-full object-cover opacity-40"
				/>
			{/if}
			<div class="absolute inset-0 flex items-center justify-center">
				<button
					onclick={handleWatchNow}
					class="flex items-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-indigo-500 hover:scale-105"
				>
					<svg class="size-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
					Kyk Nou
				</button>
			</div>
		</div>

		<MovieInfo movie={data.movie} />

		{#if data.similarMovies?.length}
			<div class="mt-10">
				<h2 class="mb-4 text-lg font-semibold text-white">Similar Films</h2>
				<div class="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
					{#each data.similarMovies as movie (movie.id)}
						<div class="w-36 shrink-0 sm:w-40">
							<MediaCard media={movie} />
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if (showPlayer || showYoutube) && data.movie}
	<div class="overlay" transition:fade={{ duration: 200 }}>
		<div class="overlay-header">
			<div class="source-indicator">
				<span
					class="source-badge"
					class:youtube={playerSource === 'youtube'}
					class:scraper={playerSource === 'scraper'}
				>
					{playerSource === 'youtube' ? 'YouTube' : 'External'}
				</span>
				{#if data.youtubeUrl && playerSource === 'scraper'}
					<button onclick={switchToYoutube} class="switch-btn">Probeer YouTube</button>
				{/if}
				{#if playerSource === 'youtube'}
					<button onclick={switchToScraper} class="switch-btn">Probeer External</button>
				{/if}
			</div>
			<button onclick={closePlayer} class="close-btn" aria-label="Close">&times;</button>
		</div>

		<div class="player-area">
			{#if showYoutube && data.youtubeUrl}
				<iframe
					src={data.youtubeUrl}
					class="player-iframe"
					allow="autoplay; fullscreen; picture-in-picture"
					title={data.movie.title}
				></iframe>
			{/if}

			{#if showPlayer}
				{#if scraperError}
					<div class="error-state">
						<p class="error-msg">{scraperError}</p>
						{#if data.youtubeUrl}
							<button onclick={switchToYoutube} class="fallback-btn youtube-btn">Kyk op YouTube</button>
						{:else}
							<a
								href={`https://www.youtube.com/results?search_query=${encodeURIComponent(data.movie.title + ' volledige film Afrikaans')}`}
								target="_blank"
								rel="noopener"
								class="fallback-btn search-btn"
							>Soek op YouTube</a>
						{/if}
					</div>
				{:else}
					<Player
						tmdbId={data.movie.id}
						title={data.movie.title}
						type="movie"
						onerror={onScraperError}
					/>
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed; inset: 0; z-index: 500;
		background: rgba(0,0,0,0.92);
		display: flex; flex-direction: column;
	}

	.overlay-header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 12px 20px; z-index: 10; flex-shrink: 0;
	}

	.source-indicator { display: flex; align-items: center; gap: 10px; }

	.source-badge {
		font-size: 12px; font-weight: 600;
		padding: 4px 12px; border-radius: 6px;
	}
	.source-badge.youtube { background: #ff0000; color: #fff; }
	.source-badge.scraper { background: rgba(129,140,248,0.2); color: #a5b4fc; }

	.switch-btn {
		background: rgba(255,255,255,0.08); color: #a5b4fc;
		border: 1px solid rgba(129,140,248,0.2);
		padding: 4px 12px; border-radius: 6px;
		font-size: 12px; cursor: pointer; white-space: nowrap;
	}
	.switch-btn:hover { background: rgba(129,140,248,0.2); color: #fff; }

	.close-btn {
		background: rgba(255,255,255,0.1); color: #fff;
		border: none; padding: 6px 16px; border-radius: 8px;
		font-size: 20px; cursor: pointer; line-height: 1;
	}
	.close-btn:hover { background: rgba(255,255,255,0.2); }

	.player-area {
		flex: 1; display: flex; align-items: center; justify-content: center;
		padding: 0 20px 20px;
	}
	.player-iframe {
		width: 100%; max-width: 1100px; aspect-ratio: 16/9;
		border: none; border-radius: 12px;
	}

	.error-state {
		display: flex; flex-direction: column;
		align-items: center; gap: 16px; text-align: center;
	}
	.error-msg { color: #f87171; font-size: 15px; }

	.fallback-btn {
		padding: 12px 24px; border-radius: 10px;
		font-size: 15px; font-weight: 600; cursor: pointer;
		border: none; text-decoration: none;
	}
	.youtube-btn { background: #ff0000; color: #fff; }
	.youtube-btn:hover { background: #cc0000; }
	.search-btn { background: rgba(255,0,0,0.15); color: #ff4444; border: 1px solid rgba(255,0,0,0.3); }
	.search-btn:hover { background: rgba(255,0,0,0.25); }

	@media (max-width: 768px) {
		.player-area { padding: 0 8px 8px; }
	}
</style>
