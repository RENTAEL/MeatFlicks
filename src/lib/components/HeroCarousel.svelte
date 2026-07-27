<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';

	let { items }: { items: any[] } = $props();

	let currentIndex = $state(0);
	let autoplayTimer: ReturnType<typeof setInterval> | undefined;
	let touchStartX = 0;
	let touchEndX = 0;
	let isDragging = false;

	let currentItem = $derived(items[currentIndex]);

	function next() { currentIndex = (currentIndex + 1) % items.length; }
	function prev() { currentIndex = (currentIndex - 1 + items.length) % items.length; }

	function goToItem(item: any) {
		const type = item.media_type === 'tv' ? 'tv' : 'movie';
		goto(`/${type}/${item.id}`);
	}

	function handleTouchStart(e: TouchEvent) { touchStartX = e.touches[0].clientX; isDragging = true; stopAutoplay(); }
	function handleTouchMove(e: TouchEvent) { if (!isDragging) return; touchEndX = e.touches[0].clientX; }
	function handleTouchEnd() {
		if (!isDragging) return;
		isDragging = false;
		const diff = touchStartX - touchEndX;
		if (Math.abs(diff) > 50) { if (diff > 0) next(); else prev(); }
		startAutoplay();
	}

	function startAutoplay() { autoplayTimer = setInterval(next, 5000); }
	function stopAutoplay() { clearInterval(autoplayTimer); }

	onMount(() => startAutoplay());
	onDestroy(() => stopAutoplay());
</script>

<div class="hero" ontouchstart={handleTouchStart} ontouchmove={handleTouchMove} ontouchend={handleTouchEnd}>
	<div class="hero-track" style="transform: translateX(-{currentIndex * 100}%)">
		{#each items as item, i}
			<div class="hero-slide">
				<div class="hero-backdrop">
					{#if item.backdrop_path}
						<img src="https://image.tmdb.org/t/p/w1280{item.backdrop_path}" alt="" class="hero-backdrop-img" loading={i === 0 ? 'eager' : 'lazy'} />
					{/if}
					<div class="hero-gradient"></div>
				</div>
				<div class="hero-content">
					<h2 class="hero-title">{item.title || item.name}</h2>
					<div class="hero-meta">
						<span class="hero-rating">★ {item.vote_average?.toFixed(1)}</span>
						<span class="hero-year">{(item.release_date || item.first_air_date || '').split('-')[0]}</span>
					</div>
					<p class="hero-overview">{(item.overview || '').slice(0, 120)}...</p>
					<div class="hero-actions">
						<button onclick={() => goToItem(item)} class="hero-play-btn">
							<svg viewBox="0 0 24 24" fill="currentColor" class="hero-play-icon"><path d="M8 5v14l11-7z"/></svg>
							Watch Now
						</button>
					</div>
				</div>
			</div>
		{/each}
	</div>
	<div class="hero-dots">
		{#each items as _, i}
			<button class="hero-dot" class:hero-dot-active={i === currentIndex} onclick={() => currentIndex = i} aria-label="Slide {i + 1}"></button>
		{/each}
	</div>
</div>

<style>
	.hero { position: relative; width: 100%; overflow: hidden; aspect-ratio: 16 / 10; touch-action: pan-y pinch-zoom; }
	@media (min-width: 768px) { .hero { aspect-ratio: 16 / 7; } }
	.hero-track { display: flex; height: 100%; transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
	.hero-slide { flex: 0 0 100%; position: relative; overflow: hidden; }
	.hero-backdrop { position: absolute; inset: 0; }
	.hero-backdrop-img { width: 100%; height: 100%; object-fit: cover; }
	.hero-gradient { position: absolute; inset: 0; background: linear-gradient(to top, #09090b 0%, rgba(9,9,11,0.8) 30%, rgba(9,9,11,0.2) 70%, rgba(9,9,11,0.3) 100%); }
	.hero-content { position: absolute; bottom: 0; left: 0; right: 0; padding: 24px 20px; display: flex; flex-direction: column; gap: 8px; }
	@media (min-width: 768px) { .hero-content { padding: 40px; max-width: 560px; } }
	.hero-title { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.15; }
	@media (min-width: 768px) { .hero-title { font-size: 36px; } }
	.hero-meta { display: flex; align-items: center; gap: 12px; }
	.hero-rating { color: #f59e0b; font-weight: 700; font-size: 14px; }
	.hero-year { color: #a1a1aa; font-size: 14px; }
	.hero-overview { font-size: 13px; color: #a1a1aa; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	@media (min-width: 768px) { .hero-overview { font-size: 14px; -webkit-line-clamp: 3; } }
	.hero-actions { display: flex; gap: 10px; margin-top: 8px; }
	.hero-play-btn { display: flex; align-items: center; gap: 8px; padding: 12px 24px; background: #818cf8; color: #fff; border: none; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.15s; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
	.hero-play-btn:active { background: #6366f1; transform: scale(0.97); }
	.hero-play-icon { width: 18px; height: 18px; }
	.hero-dots { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; padding: 8px; }
	.hero-dot { width: 6px; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.3); border: none; cursor: pointer; transition: all 0.3s; padding: 0; }
	.hero-dot-active { width: 20px; background: #818cf8; }
</style>
