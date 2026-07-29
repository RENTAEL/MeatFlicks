<script lang="ts">
	let {
		id,
		title,
		poster,
		rating,
		year
	}: {
		id: number;
		title: string;
		poster: string | null;
		rating: number;
		year: string;
	} = $props();
</script>

<a href="/movie/{id}" class="card">
	<div class="card-poster">
		{#if poster}
			<img
				src={poster}
				alt={title}
				loading="lazy"
				onerror={(e) => { (e.target as HTMLImageElement).src = '/placeholder-poster.svg'; }}
			/>
		{:else}
			<div class="card-poster-placeholder">
				<svg class="placeholder-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>
			</div>
		{/if}

		<div class="card-play-overlay">
			<div class="play-icon">▶</div>
		</div>

		<div class="card-rating">★ {rating?.toFixed(1)}</div>
	</div>

	<div class="card-info">
		<p class="card-title">{title}</p>
		<p class="card-meta">{year}</p>
	</div>
</a>

<style>
	.card {
		position: relative;
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
		transition: all var(--transition-base);
		cursor: pointer;
		display: block;
		text-decoration: none;
		color: inherit;
	}

	.card:hover {
		transform: translateY(-6px);
		border-color: var(--border-strong);
		box-shadow: var(--shadow-lg), 0 0 30px rgba(124, 92, 252, 0.08);
	}

	.card:active {
		transform: translateY(-2px);
	}

	.card-poster {
		position: relative;
		aspect-ratio: 2 / 3;
		overflow: hidden;
		background: var(--bg-elevated);
	}

	.card-poster img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform var(--transition-slow);
	}

	.card:hover .card-poster img {
		transform: scale(1.05);
	}

	.card-poster::after {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--gradient-card);
		opacity: 0;
		transition: opacity var(--transition-base);
	}

	.card:hover .card-poster::after {
		opacity: 1;
	}

	.card-poster-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: var(--text-tertiary);
	}

	.placeholder-icon {
		width: 3rem;
		height: 3rem;
	}

	.card-play-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity var(--transition-base);
		z-index: 2;
	}

	.card:hover .card-play-overlay {
		opacity: 1;
	}

	.play-icon {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--gradient-brand);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		color: white;
		box-shadow: var(--shadow-glow);
		transition: transform var(--transition-spring);
	}

	.card:hover .play-icon {
		transform: scale(1.1);
	}

	.card-rating {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(8px);
		font-size: 0.8rem;
		font-weight: var(--font-weight-bold);
		color: #fbbf24;
		z-index: 3;
	}

	.card-info {
		padding: 0.75rem;
	}

	.card-title {
		font-size: 0.9rem;
		font-weight: var(--font-weight-semibold);
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-bottom: 0.25rem;
	}

	.card-meta {
		font-size: 0.8rem;
		color: var(--text-tertiary);
	}
</style>
