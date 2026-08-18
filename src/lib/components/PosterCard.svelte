<script lang="ts">
	import { goto } from '$app/navigation';
	import HoverPreview from '$lib/components/media/HoverPreview.svelte';

	let { item }: { item: any } = $props();

	let type = $derived(item.media_type === 'tv' ? 'tv' : 'movie');
	let linkHref = $derived(`/${type}/${item.id}`);
	let posterUrl = $derived(
		item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null
	);

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
</script>

<a
	href={linkHref}
	class="poster-card"
	onclick={(e) => {
		e.preventDefault();
		goto(linkHref);
	}}
	onmouseenter={startHover}
	onmouseleave={endHover}
>
	<div class="poster-img-wrapper">
		{#if posterUrl}
			<img src={posterUrl} alt={item.title || item.name} class="poster-img" loading="lazy" />
		{:else}
			<div class="poster-placeholder">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
					><rect x="2" y="2" width="20" height="20" rx="2" /></svg
				>
			</div>
		{/if}
		<HoverPreview
			src={item.trailerUrl}
			alt={item.title || item.name || 'Preview'}
			active={hovering}
		/>
		<div class="poster-rating">★ {item.vote_average?.toFixed(1) || '?'}</div>
	</div>
	<p class="poster-title">{(item.title || item.name || '').slice(0, 30)}</p>
	<p class="poster-year">{(item.release_date || item.first_air_date || '').split('-')[0]}</p>
</a>

<style>
	.poster-card {
		text-decoration: none;
		display: block;
		-webkit-tap-highlight-color: transparent;
	}
	.poster-card:active {
		transform: scale(0.97);
		transition: transform 0.1s;
	}
	.poster-img-wrapper {
		position: relative;
		border-radius: 10px;
		overflow: hidden;
		aspect-ratio: 2/3;
		background: #18181b;
	}
	.poster-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.poster-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #3f3f46;
	}
	.poster-placeholder svg {
		width: 32px;
		height: 32px;
	}
	.poster-rating {
		position: absolute;
		top: 6px;
		left: 6px;
		background: rgba(0, 0, 0, 0.75);
		color: #f59e0b;
		font-size: 11px;
		font-weight: 700;
		padding: 3px 7px;
		border-radius: 6px;
		backdrop-filter: blur(4px);
	}
	.poster-title {
		margin-top: 8px;
		font-size: 13px;
		font-weight: 500;
		color: #e4e4e7;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.poster-year {
		font-size: 12px;
		color: #71717a;
		margin-top: 2px;
	}
</style>
