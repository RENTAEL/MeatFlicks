<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { Play, Star, Plus, Minus, X } from '@lucide/svelte';
	import { watchlist } from '$lib/state/stores/watchlistStore.svelte';
	import { mediaSheetStore, closeMediaSheet } from '$lib/state/stores/mediaSheetStore.svelte';
	import { getBackdropSrcSet, getImageUrl } from '$lib/utils/image';

	let dragOffset = $state(0);
	let dragStartY = 0;
	let dragging = $state(false);
	let reducedMotion = $state(false);

	if (browser) {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	const open = $derived(mediaSheetStore.open);
	const movie = $derived(mediaSheetStore.movie);

	const backdropUrl = $derived(
		movie ? getImageUrl(movie.backdropPath || movie.posterPath, 'w780') : ''
	);
	const backdropSrcSet = $derived(
		movie ? getBackdropSrcSet(movie.backdropPath || movie.posterPath) : ''
	);

	const ratingLabel = $derived(
		movie?.rating && typeof movie.rating === 'number' ? movie.rating.toFixed(1) : null
	);
	const releaseYear = $derived(
		movie?.releaseDate ? new Date(movie.releaseDate).getFullYear() : null
	);
	const genreNames = $derived(
		Array.isArray(movie?.genres)
			? (movie.genres as Array<string | { name: string }>)
					.map((g) => (typeof g === 'string' ? g : g.name || ''))
					.filter(Boolean)
			: []
	);

	const detailsHref = $derived.by(() => {
		if (!movie) return '/';
		if (movie.canonicalPath) return `/${movie.canonicalPath.replace(/^\//, '')}`;
		const type = movie.mediaType || movie.media_type || 'movie';
		const identifier = movie.tmdbId || movie.id;
		return `/${type}/${identifier}`;
	});

	const isInWatchlist = $derived(movie ? watchlist.isInWatchlist(movie.id) : false);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeMediaSheet();
	}

	$effect(() => {
		if (!open) return;
		document.body.style.overflow = 'hidden';
		window.addEventListener('keydown', handleKeydown);
		return () => {
			document.body.style.overflow = '';
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	function onPointerDown(e: PointerEvent) {
		dragging = true;
		dragStartY = e.clientY;
		dragOffset = 0;
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const delta = e.clientY - dragStartY;
		dragOffset = delta > 0 ? delta : 0;
	}

	function onPointerUp() {
		dragging = false;
		if (dragOffset > 120) {
			closeMediaSheet();
		}
		dragOffset = 0;
	}

	function handleWatchlistToggle(e: MouseEvent) {
		e.stopPropagation();
		if (!movie) return;
		if (isInWatchlist) watchlist.removeFromWatchlist(movie.id);
		else watchlist.addToWatchlist(movie);
	}

	function handlePlay() {
		if (detailsHref !== '/') goto(detailsHref);
	}
</script>

{#if open && movie}
	<div
		class="sheet-backdrop"
		role="presentation"
		onclick={closeMediaSheet}
		transition:fade={{ duration: 150 }}
	></div>

	<div
		class="sheet"
		role="dialog"
		aria-modal="true"
		aria-label={`${movie.title} details`}
		transition:fly={reducedMotion ? { y: 0, duration: 0 } : { y: 480, duration: 320 }}
	>
		<div class="sheet-drag" style="transform: translateY({dragOffset}px)">
			<div
				class="sheet-handle"
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerUp}
				role="button"
				tabindex="-1"
				aria-label="Drag to dismiss"
			></div>

			{#if backdropUrl}
				<div class="sheet-hero">
					<img
						src={backdropUrl}
						srcset={backdropSrcSet}
						sizes="100vw"
						width="780"
						height="439"
						alt=""
						loading="lazy"
						aria-hidden="true"
					/>
					<div class="sheet-hero-scrim"></div>
				</div>
			{/if}

			<button
				type="button"
				class="sheet-close"
				onclick={closeMediaSheet}
				aria-label="Close details"
			>
				<X class="size-5" />
			</button>

			<div class="sheet-body">
				<div class="flex flex-wrap items-center gap-2 text-xs">
					{#if ratingLabel}
						<span class="flex items-center gap-1 font-semibold text-white/90">
							<Star class="size-3.5 text-yellow-400" aria-hidden="true" />
							{ratingLabel}
						</span>
					{/if}
					{#if releaseYear}
						<span class="text-white/70">{releaseYear}</span>
					{/if}
					{#if genreNames.length > 0}
						<span class="text-white/70">{genreNames.slice(0, 3).join(' · ')}</span>
					{/if}
				</div>

				<h2 class="mt-1 text-2xl font-bold text-white">{movie.title}</h2>

				{#if movie.overview}
					<p class="mt-3 text-sm leading-relaxed text-white/80">{movie.overview}</p>
				{/if}

				<div class="mt-5 flex items-center gap-3">
					<button type="button" class="sheet-btn sheet-btn-primary" onclick={handlePlay}>
						<Play class="size-4" aria-hidden="true" />
						Play
					</button>
					<button
						type="button"
						class="sheet-btn sheet-btn-secondary"
						onclick={handleWatchlistToggle}
						aria-label={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
					>
						{#if isInWatchlist}
							<Minus class="size-4" aria-hidden="true" />
						{:else}
							<Plus class="size-4" aria-hidden="true" />
						{/if}
						{isInWatchlist ? 'In My List' : 'My List'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.sheet-backdrop {
		position: fixed;
		inset: 0;
		z-index: 190;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
	}

	.sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 200;
		max-height: 85dvh;
		border-radius: 20px 20px 0 0;
		background: var(--bg-card);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		padding-bottom: env(safe-area-inset-bottom);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.5);
	}

	.sheet-drag {
		transition: transform 0.1s linear;
	}

	.sheet-handle {
		width: 44px;
		height: 4px;
		margin: 10px auto 2px;
		border-radius: 2px;
		background: rgba(255, 255, 255, 0.25);
		cursor: grab;
		touch-action: none;
	}

	.sheet-hero {
		position: relative;
		height: 40dvh;
		min-height: 200px;
		overflow: hidden;
	}

	.sheet-hero img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 30%;
	}

	.sheet-hero-scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 40%, var(--bg-card) 100%);
	}

	.sheet-close {
		position: absolute;
		top: 14px;
		right: 14px;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: rgba(0, 0, 0, 0.5);
		color: white;
		cursor: pointer;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	.sheet-body {
		padding: 1rem 1.25rem 2rem;
		margin-top: -1.5rem;
		position: relative;
	}

	.sheet-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 48px;
		padding: 0 1.5rem;
		border-radius: 12px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
		-webkit-tap-highlight-color: transparent;
	}

	.sheet-btn-primary {
		flex: 1;
		background: var(--gradient-brand);
		color: white;
		box-shadow: 0 4px 20px var(--accent-glow);
	}

	.sheet-btn-primary:active {
		transform: scale(0.97);
	}

	.sheet-btn-secondary {
		background: rgba(255, 255, 255, 0.08);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	.sheet-btn-secondary:active {
		transform: scale(0.97);
	}

	@media (min-width: 768px) {
		.sheet {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sheet-drag {
			transition: none;
		}
	}
</style>
