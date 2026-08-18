<script lang="ts">
	import { getImageUrl } from '$lib/utils/image';
	import HoverPreview from '$lib/components/media/HoverPreview.svelte';

	let {
		movie,
		rank
	}: {
		movie: {
			id: number;
			title?: string;
			name?: string;
			poster_path?: string | null;
			release_date?: string;
			first_air_date?: string;
			vote_average?: number;
			trailerUrl?: string | null;
		};
		rank: number;
	} = $props();

	let hovering = $state(false);
	let hoverTimer: ReturnType<typeof setTimeout> | null = null;

	function startHover() {
		hoverTimer = setTimeout(() => {
			hovering = true;
		}, 250);
	}

	function endHover() {
		if (hoverTimer) {
			clearTimeout(hoverTimer);
			hoverTimer = null;
		}
		hovering = false;
	}

	const posterUrl = $derived(getImageUrl(movie?.poster_path, 'w342'));
	const title = $derived(movie?.title || movie?.name || 'Untitled');
	const year = $derived(
		movie?.release_date
			? new Date(movie.release_date).getFullYear()
			: movie?.first_air_date
				? new Date(movie.first_air_date).getFullYear()
				: ''
	);
	const rating = $derived(movie?.vote_average?.toFixed(1) ?? '');

	function handleImgError(e: Event) {
		const img = e.target as HTMLImageElement;
		img.onerror = null;
		img.src =
			"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 342 513'%3E%3Crect fill='%23333' width='342' height='513'/%3E%3Ctext x='171' y='256' text-anchor='middle' fill='%23666' font-size='20'%3ENo Image%3C/text%3E%3C/svg%3E";
	}

	const cardWidth = $derived(rank === 1 ? '180px' : rank <= 3 ? '160px' : '150px');
	const rankFont = $derived(rank === 1 ? '4.5rem' : '4rem');
</script>

<a
	href="/movie/{movie.id}"
	class="trending-card"
	style="touch-action: manipulation; -webkit-tap-highlight-color: transparent; --card-width: {cardWidth}; --rank-size: {rankFont};"
	class:rank-one={rank === 1}
	onmouseenter={startHover}
	onmouseleave={endHover}
>
	<div class="poster-wrapper">
		<img src={posterUrl} alt={title} loading="lazy" decoding="async" onerror={handleImgError} />

		<HoverPreview src={movie.trailerUrl} alt={`${title} Trailer`} active={hovering} />

		<span class="rank-number">{rank}</span>

		<span class="trending-pill">TRENDING</span>

		{#if rating}
			<span class="rating-badge">
				⭐ {rating}
			</span>
		{/if}
	</div>

	<div class="info">
		<h3 class="title">{title}</h3>
		{#if year}
			<span class="year">{year}</span>
		{/if}
	</div>
</a>

<style>
	.trending-card {
		display: flex;
		flex-direction: column;
		text-decoration: none;
		color: inherit;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
		border-radius: 12px;
		overflow: hidden;
		width: var(--card-width, 150px);
		flex-shrink: 0;
	}

	.trending-card:hover {
		transform: translateY(-4px);
	}

	.rank-one {
		filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.35));
	}

	.rank-one .poster-wrapper {
		box-shadow:
			0 0 0 2px rgba(245, 158, 11, 0.5),
			0 0 20px rgba(245, 158, 11, 0.25);
	}

	.poster-wrapper {
		position: relative;
		aspect-ratio: 2/3;
		overflow: hidden;
		border-radius: 12px;
	}

	.poster-wrapper img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.rank-number {
		position: absolute;
		top: 4px;
		left: 4px;
		font-size: var(--rank-size, 4rem);
		font-weight: 900;
		line-height: 1;
		letter-spacing: -2px;
		z-index: 2;
		background: linear-gradient(135deg, #f59e0b, #ef4444);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.6));
	}

	.trending-pill {
		position: absolute;
		top: 4px;
		right: 4px;
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.5px;
		padding: 2px 6px;
		border-radius: 4px;
		background: linear-gradient(135deg, #f59e0b, #ef4444);
		color: #fff;
		z-index: 2;
		line-height: 1.2;
	}

	.rating-badge {
		position: absolute;
		bottom: 6px;
		right: 6px;
		font-size: 0.65rem;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.7);
		color: #fff;
		z-index: 2;
		line-height: 1.3;
		backdrop-filter: blur(4px);
	}

	.info {
		padding: 8px 4px 0;
	}

	.title {
		font-size: 0.85rem;
		font-weight: 600;
		margin: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.year {
		font-size: 0.75rem;
		color: #888;
	}

	@media (max-width: 767px) {
		.trending-card {
			--card-width: 140px;
			--rank-size: 2.5rem;
		}

		.rank-one {
			--card-width: 155px;
			--rank-size: 3rem;
		}

		.trending-pill {
			font-size: 0.5rem;
			padding: 1px 4px;
		}

		.rating-badge {
			font-size: 0.55rem;
			padding: 1px 4px;
		}
	}
</style>
