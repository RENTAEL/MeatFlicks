<script lang="ts">
	import { Plus, Minus, Star, Play, Info, Clock } from '@lucide/svelte';
	import { watchlist } from '$lib/state/stores/watchlistStore.svelte';
	import type { Movie as WatchlistMovie } from '$lib/state/stores/watchlistStore.svelte';
	import { error as errorStore } from '$lib/state/stores/errorStore';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import type { LibraryMovie } from '$lib/types/library';
	import { getImageUrl } from '$lib/utils/image';
	import ProviderBadges from '$lib/components/ProviderBadges.svelte';

	let { movie, priority = false }: { movie: LibraryMovie | WatchlistMovie | null; priority?: boolean } = $props();

	const isInWatchlist = $derived(movie ? watchlist.isInWatchlist(movie.id) : false);
	const posterUrl = $derived(getImageUrl(movie?.posterPath, 'w342'));
	const backdropUrl = $derived(getImageUrl(movie?.backdropPath || movie?.posterPath, 'w780'));

	let imageLoaded = $state(false);
	let showPreview = $state(false);
	let hoverTimer: ReturnType<typeof setTimeout> | null = null;
	let isHovering = $state(false);
	let shouldFetchProviders = $state(false);

	let trailerKey = $derived.by(() => {
		if (!movie?.trailerUrl) return null;
		const url = movie.trailerUrl;
		const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
		if (ytMatch) return ytMatch[1];
		if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
		return null;
	});

	let ratingLabel = $derived(movie?.rating && typeof movie.rating === 'number' ? movie.rating.toFixed(1) : null);
	let releaseYear = $derived(movie?.releaseDate ? new Date(movie.releaseDate).getFullYear() : null);
	let genreNames = $derived(
		Array.isArray(movie?.genres)
			? (movie.genres as Array<string | { name: string }>)
					.map(g => (typeof g === 'string' ? g : g.name || ''))
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

	function startHover() {
		isHovering = true;
		shouldFetchProviders = true;
		hoverTimer = setTimeout(() => {
			if (isHovering) showPreview = true;
		}, 600);
	}

	function endHover() {
		isHovering = false;
		if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
		showPreview = false;
	}

	function handleWatchlistToggle(event: MouseEvent) {
		event.stopPropagation();
		if (!movie) { errorStore.set('No movie selected.'); return; }
		try {
			if (isInWatchlist) watchlist.removeFromWatchlist(movie.id);
			else watchlist.addToWatchlist(movie);
		} catch (err) {
			console.error('Failed to update watchlist:', err);
			errorStore.set('Failed to update watchlist. Please try again.');
		}
	}

	function handlePlay(event: MouseEvent) {
		event.stopPropagation();
		event.preventDefault();
		if (detailsHref) window.location.href = detailsHref;
	}
</script>

<div
	class="media-card group relative {showPreview ? 'z-50' : 'z-10'}"
	onmouseenter={startHover}
	onmouseleave={endHover}
	role="button"
	tabindex="0"
	aria-label={movie ? `View details for ${movie.title}` : 'Loading movie'}
>
	<div
		class="card-inner relative overflow-hidden rounded-xl transition-all duration-500 ease-out {showPreview
			? 'w-[340px] scale-110 md:w-[400px]'
			: 'h-72 w-48'} {showPreview
			? 'shadow-[0_0_30px_oklch(0.6_0.2_300/0.4),0_0_60px_oklch(0.5_0.18_280/0.2),0_20px_60px_oklch(0_0_0/0.5)]'
			: 'shadow-lg shadow-purple-900/10'} bg-background/40 backdrop-blur-sm"
	>
		{#if movie}
			<div class="relative h-full w-full">
				{#if showPreview && trailerKey}
					<div class="video-fade-in absolute inset-0 z-20">
						<iframe
							src="https://www.youtube.com/embed/{trailerKey}?autoplay=1&mute=1&loop=1&playlist={trailerKey}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1"
							title="{movie.title} Trailer"
							class="h-full w-full"
							style="pointer-events: none;"
							loading="lazy"
							allow="autoplay; encrypted-media"
							sandbox="allow-same-origin allow-scripts allow-presentation"
						></iframe>
						<div class="absolute inset-0 bg-linear-to-t from-background/90 via-background/10 to-transparent"></div>
					</div>
				{/if}

				<div class="relative h-full w-full overflow-hidden {showPreview && trailerKey ? 'opacity-0 transition-opacity duration-300' : ''}">
					{#if movie.posterPath}
						<img
							src={getImageUrl(movie.posterPath, 'w92')}
							alt=""
							class="blur-up absolute inset-0 h-full w-full object-cover"
							class:loaded={imageLoaded}
							aria-hidden="true"
							loading={priority ? 'eager' : 'lazy'}
						/>
						<img
							src={posterUrl}
							alt={`${movie.title} Poster`}
							class="absolute inset-0 h-full w-full object-cover transition-opacity duration-400"
							class:opacity-0={!imageLoaded}
							loading={priority ? 'eager' : 'lazy'}
							fetchpriority={priority ? 'high' : undefined}
							onload={() => (imageLoaded = true)}
						/>
					{:else}
						<div class="flex h-full w-full flex-1 items-center justify-center bg-muted/50">
							<span class="text-lg text-muted-foreground">No Image</span>
						</div>
					{/if}
				</div>

				<!-- Rating badge (top-left) -->
				<div class="absolute top-3 left-3 z-30 opacity-0 transition-all duration-400 ease-out group-hover:opacity-100 {showPreview ? '!opacity-100' : ''}">
					<Badge variant="secondary" class="flex items-center gap-1 bg-black/70 text-white backdrop-blur-sm">
						<Star class="size-3.5 text-yellow-500" fill="currentColor" stroke="currentColor" />
						{ratingLabel ?? 'N/A'}
					</Badge>
				</div>

				<!-- Watchlist button (top-right) -->
				<div class="absolute top-3 right-3 z-30 opacity-0 transition-all duration-400 ease-out group-hover:opacity-100 {showPreview ? '!opacity-100' : ''}">
					<Button
						type="button"
						size="icon"
						variant={isInWatchlist ? 'destructive' : 'secondary'}
						onclick={handleWatchlistToggle}
						class="glass size-8 rounded-full shadow-md"
					>
						{#if isInWatchlist}
							<Minus class="size-4" />
						{:else}
							<Plus class="size-4" />
						{/if}
					</Button>
				</div>

				<!-- Expanded info overlay (shown on preview) -->
				{#if showPreview}
					<div class="absolute inset-x-0 bottom-0 z-30 animate-slide-up-fade p-4">
						<a
							rel="external"
							href={detailsHref}
							class="block"
						>
							<h3 class="text-lg font-bold text-white drop-shadow-lg truncate">
								{movie.title}
							</h3>
						</a>

						<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/80">
							{#if ratingLabel}
								<span class="flex items-center gap-1">
									<Star class="size-3 text-yellow-400" />
									{ratingLabel}
								</span>
							{/if}
							{#if releaseYear}
								<span>{releaseYear}</span>
							{/if}
							{#if genreNames.length > 0}
								<span class="truncate max-w-[180px]">{genreNames.slice(0, 3).join(' · ')}</span>
							{/if}
						</div>

						{#if movie.overview}
							<p class="mt-2 text-xs leading-relaxed text-white/70 line-clamp-2">
								{movie.overview}
							</p>
						{/if}

						<div class="mt-3 flex items-center gap-2">
							<a
								rel="external"
								href={detailsHref}
								class="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/30"
							>
								<Play class="size-3.5" />
								Play
							</a>
							<a
								rel="external"
								href={detailsHref}
								class="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20"
							>
								<Info class="size-3.5" />
								More Info
							</a>
						</div>

						{#if shouldFetchProviders && movie.tmdbId}
							<div class="mt-2">
								<ProviderBadges movieId={movie.tmdbId} size="small" />
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<Skeleton class="h-full w-full rounded-xl" />
		{/if}
	</div>
</div>

<style>
	.media-card {
		transition: z-index 0s;
	}
	.card-inner {
		transform-origin: center bottom;
	}
	:global(.line-clamp-2) {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-clamp: 2;
	}
</style>
