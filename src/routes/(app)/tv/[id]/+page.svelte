<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Player from '$lib/components/Player.svelte';
	import { resolveNextEpisode } from '$lib/episodeNav';
	import ContentRow from '$lib/components/ContentRow.svelte';
	import { watchlist as wl } from '$lib/state/stores/watchlistStore.svelte';
	import { authStore } from '$lib/state/stores/authStore.svelte';
	import { fade, fly } from 'svelte/transition';
	import AggregatedRating from '$lib/components/AggregatedRating.svelte';
	import { getImageUrl } from '$lib/utils/image';

	let { data } = $props();
	let show: any = $state(null);
	let credits: any[] = $state([]);
	let similar: any[] = $state([]);
	let episodes: any[] = $state([]);
	let watchProgress: any = $state({});
	let isLoading = $state(true);
	let activeSeason = $state(1);
	let showFullOverview = $state(false);
	let selectedEpisode = $state<{ season: number; episode: number } | null>(null);
	let seasons: any[] = $state([]);
	let next = $derived(
		selectedEpisode
			? resolveNextEpisode(seasons, episodes, selectedEpisode.season, selectedEpisode.episode)
			: null
	);
	function findCurrentEpisode(): any {
		const s = selectedEpisode;
		if (!s) return null;
		return episodes.find((e: any) => e.season_number === s.season && e.episode_number === s.episode) ?? null;
	}
	let currentEp = $derived(findCurrentEpisode());
	let seasonTabsEl: HTMLDivElement | null = $state(null);
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

	function updateTabScroll() {
		if (!seasonTabsEl) return;
		canScrollLeft = seasonTabsEl.scrollLeft > 4;
		canScrollRight =
			seasonTabsEl.scrollLeft < seasonTabsEl.scrollWidth - seasonTabsEl.clientWidth - 4;
	}

	function tabsWheel(node: HTMLElement) {
		const handler = (e: WheelEvent) => {
			if (e.deltaY === 0) return;
			if (node.scrollWidth > node.clientWidth) {
				node.scrollLeft += e.deltaY;
				e.preventDefault();
			}
		};
		node.addEventListener('wheel', handler, { passive: false });
		return { destroy: () => node.removeEventListener('wheel', handler) };
	}

	function scrollTabs(delta: number) {
		seasonTabsEl?.scrollBy({ left: delta, behavior: 'smooth' });
	}

	let tmdbId = $derived(Number(page.params.id));
	let isSaved = $derived(wl.isInWatchlist(tmdbId.toString()));

	async function loadShow() {
		isLoading = true;
		try {
			const [detailRes, creditsRes, similarRes] = await Promise.all([
				fetch(`/api/tmdb/tv/${tmdbId}`),
				fetch(`/api/tmdb/tv/${tmdbId}/credits`),
				fetch(`/api/tmdb/tv/${tmdbId}/similar`),
			]);
			show = await detailRes.json();
			credits = (await creditsRes.json()).cast?.slice(0, 15) || [];
			similar = (await similarRes.json()).results?.slice(0, 12) || [];

			seasons = (show.seasons || []).filter((s: any) => s.season_number > 0);
			if (seasons.length === 0) seasons = show.seasons || [];

			const urlSeason = Number(page.params.season);
			const urlEpisode = Number(page.params.episode);

			if (urlSeason && urlEpisode) {
				activeSeason = urlSeason;
			} else {
				activeSeason = 1;
			}

			await loadEpisodes(activeSeason);
			await loadProgress();

			if (urlSeason && urlEpisode) {
				setTimeout(() => {
					const ep = episodes.find(
						(e: any) => e.season_number === urlSeason && e.episode_number === urlEpisode
					);
					if (ep) playEpisode(ep);
				}, 600);
			}
		} catch (e) {
			console.error('Failed to load show:', e);
		} finally {
			isLoading = false;
		}
	}

	async function loadEpisodes(season: number) {
		activeSeason = season;
		episodes = [];
		try {
			const res = await fetch(`/api/tmdb/tv/${tmdbId}/season/${season}`);
			const data = await res.json();
			episodes = data.episodes || [];
		} catch (e) {
			console.error('Failed to load episodes:', e);
		}
	}

	async function loadProgress() {
		if (!authStore.state.user) return;
		try {
			const res = await fetch(`/api/history?tmdb_id=${tmdbId}&media_type=tv`);
			const data = await res.json();
			if (data.history) {
				watchProgress = data.history;
				if (data.history.season && !selectedEpisode && !page.params.season) {
					activeSeason = data.history.season;
					await loadEpisodes(data.history.season);
				}
			}
		} catch {}
	}

	async function playEpisode(ep: any) {
		selectedEpisode = { season: ep.season_number, episode: ep.episode_number };

		if (authStore.state.user) {
			try {
				await fetch('/api/history', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						tmdb_id: tmdbId,
						media_type: 'tv',
						season: ep.season_number,
						episode: ep.episode_number,
						progress: 0,
					}),
				});
			} catch {}
		}

		goto(`/tv/${tmdbId}/${ep.season_number}/${ep.episode_number}`, {
			replaceState: true,
			noScroll: true,
		});

		setTimeout(() => {
			document.getElementById('player-section')?.scrollIntoView({ behavior: 'smooth' });
		}, 100);
	}

	function toggleWatchlist() {
		if (!show) return;
		if (isSaved) {
			wl.removeFromWatchlist(tmdbId.toString());
		} else {
			wl.addToWatchlist({
				id: tmdbId.toString(),
				tmdb_id: tmdbId,
				media_type: 'tv',
				title: show.name,
				poster_path: show.poster_path,
				year: (show.first_air_date || '').split('-')[0],
			});
		}
	}

	$effect(() => { if (tmdbId) loadShow(); });
	$effect(() => {
		const el = seasonTabsEl;
		if (!el) return;
		updateTabScroll();
		const ro = new ResizeObserver(updateTabScroll);
		ro.observe(el);
		return () => ro.disconnect();
	});
</script>

<svelte:head>
	<title>{data.movie ? `${data.movie.title} — Watch Online | Streamium` : show ? `${show.name} — Watch Online | Streamium` : 'TV Series | Streamium'}</title>
	{#if data.movie?.overview}
		<meta name="description" content={data.movie.overview.slice(0, 155)} />
	{/if}
	{#if data.movie}
		<meta property="og:type" content="video.tv_show" />
		<meta property="og:title" content={data.movie.title} />
		{#if data.movie.posterPath}
			<meta property="og:image" content={`https://streamium-cosmic.vercel.app${getImageUrl(data.movie.posterPath, 'w780')}`} />
		{/if}
	{/if}
</svelte:head>

{#if isLoading}
	<div class="detail-skeleton">
		<div class="detail-backdrop-skel"></div>
		<div class="detail-content-skel">
			<div class="skel-poster"></div>
			<div class="skel-info">
				<div class="skel-line w-60"></div>
				<div class="skel-line w-40 mt-8"></div>
				<div class="skel-line w-full mt-16 h-60"></div>
			</div>
		</div>
	</div>
{:else if show}
	<div class="tv-detail">
		<div class="detail-backdrop">
			{#if show.backdrop_path}
				<img src="https://image.tmdb.org/t/p/w1280{show.backdrop_path}" alt="" class="detail-backdrop-img" />
			{/if}
			<div class="detail-backdrop-grad"></div>
		</div>

		<div class="detail-header">
			<div class="detail-poster">
				{#if show.poster_path}
					<img src="https://image.tmdb.org/t/p/w342{show.poster_path}" alt={show.name} class="detail-poster-img" />
				{:else}
					<div class="detail-poster-placeholder"></div>
				{/if}
				<button class="save-btn" class:saved={isSaved} onclick={toggleWatchlist} aria-label="Toggle watchlist">
					<svg viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
						<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
					</svg>
				</button>
			</div>

			<div class="detail-info">
				<h1 class="detail-title">{show.name}</h1>
				<div class="detail-meta">
					<span class="meta-rating">★ {show.vote_average?.toFixed(1)}</span>
					<AggregatedRating rating={show.vote_average} imdbId="" />
					<span class="meta-year">{(show.first_air_date || '').split('-')[0]}</span>
					<span class="meta-seasons">{show.number_of_seasons} season{show.number_of_seasons > 1 ? 's' : ''}</span>
					{#if show.status}
						<span class="meta-status">{show.status}</span>
					{/if}
				</div>
				<div class="detail-genres">
					{#each show.genres || [] as genre}
						<span class="genre-tag">{genre.name}</span>
					{/each}
				</div>
			</div>
		</div>

		<div class="detail-section">
			<p class="detail-overview" class:overview-expanded={showFullOverview}>
				{show.overview || 'No overview available.'}
			</p>
			{#if (show.overview || '').length > 200}
				<button class="overview-toggle" onclick={() => showFullOverview = !showFullOverview}>
					{showFullOverview ? 'Show less' : 'Read more'}
				</button>
			{/if}
		</div>

		{#if watchProgress.season && !selectedEpisode}
			<div class="progress-banner" transition:fly={{ y: -10 }}>
				<div class="progress-banner-left">
					<span class="progress-dot"></span>
					<div>
						<p class="progress-banner-title">Continue Watching</p>
						<p class="progress-banner-sub">
							Season {watchProgress.season}, Episode {watchProgress.episode}
							{#if watchProgress.progress > 0}
								— {Math.round(watchProgress.progress * 100)}% watched
							{/if}
						</p>
					</div>
				</div>
				<button class="progress-play-btn" onclick={async () => {
					activeSeason = watchProgress.season;
					await loadEpisodes(watchProgress.season);
					setTimeout(() => {
						const ep = episodes.find(
							(e: any) => e.season_number === watchProgress.season && e.episode_number === watchProgress.episode
						);
						if (ep) playEpisode(ep);
					}, 500);
				}}>
					<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
					Resume
				</button>
			</div>
		{/if}

		{#if seasons.length > 1}
			<div class="detail-section">
				<h3 class="section-title">Seasons</h3>
				<div class="season-tabs-wrap">
					{#if canScrollLeft}
						<div class="tabs-fade tabs-fade-left"></div>
					{/if}
					{#if canScrollRight}
						<div class="tabs-fade tabs-fade-right"></div>
					{/if}
					<button class="tabs-arrow tabs-arrow-left" class:show={canScrollLeft} aria-label="Previous seasons" onclick={() => scrollTabs(-280)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
					</button>
					<button class="tabs-arrow tabs-arrow-right" class:show={canScrollRight} aria-label="More seasons" onclick={() => scrollTabs(280)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
					<div
						class="season-tabs"
						bind:this={seasonTabsEl}
						onscroll={updateTabScroll}
						use:tabsWheel
					>
						{#each seasons as season}
							<button
								class="season-tab"
								class:season-tab-active={activeSeason === season.season_number}
								onclick={() => loadEpisodes(season.season_number)}
							>
								{season.name}
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		{#if seasons.length > 0}
			<div class="detail-section">
				<h3 class="section-title">
					Episodes
					<span class="episode-count">{episodes.length} episode{episodes.length !== 1 ? 's' : ''}</span>
				</h3>

			<div class="episode-list" class:episode-list-scroll={episodes.length > 15}>
				{#each episodes as ep (ep.id)}
					{@const isUnaired = !!ep.air_date && new Date(ep.air_date).getTime() > Date.now()}
					{@const isNowPlaying = selectedEpisode?.season === ep.season_number && selectedEpisode?.episode === ep.episode_number}
					<div class="episode-card" class:episode-active={isNowPlaying} class:episode-unaired={isUnaired}>
						<div class="episode-still">
							{#if ep.still_path}
								<img src="https://image.tmdb.org/t/p/w300{ep.still_path}" alt={ep.name} class="episode-still-img" loading="lazy" />
							{:else if show.backdrop_path}
								<img src="https://image.tmdb.org/t/p/w500{show.backdrop_path}" alt={ep.name} class="episode-still-img" loading="lazy" />
							{:else}
								<div class="episode-still-placeholder">
									<span class="ep-num">{ep.episode_number}</span>
								</div>
							{/if}

							<button
								class="episode-play-overlay"
								disabled={isUnaired}
								onclick={() => playEpisode(ep)}
								aria-label="Play episode {ep.episode_number}"
							>
								<svg viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
							</button>

							{#if watchProgress.season === ep.season_number && watchProgress.episode === ep.episode_number && watchProgress.progress > 0}
								<div class="progress-bar-container">
									<div class="progress-bar-fill" style="width: {Math.round(watchProgress.progress * 100)}%"></div>
								</div>
							{/if}
						</div>

						<div class="episode-info">
							<span class="episode-title-text">{ep.name}</span>
							<div class="episode-header">
								<span class="episode-number">E{ep.episode_number}</span>
								{#if ep.runtime}
									<span class="episode-runtime">{ep.runtime}m</span>
								{/if}
								{#if ep.vote_average && ep.vote_average > 0}
									<span class="episode-rating">★ {Number(ep.vote_average).toFixed(1)}</span>
								{/if}
								{#if isNowPlaying}
									<span class="now-playing-badge">Now Playing</span>
								{/if}
							</div>
							{#if ep.overview}
								<p class="episode-overview">
									{ep.overview.slice(0, 150)}{ep.overview.length > 150 ? '...' : ''}
								</p>
							{/if}
							{#if ep.air_date}
								<span class="episode-air-date">
									{isUnaired ? 'Airs' : 'Aired'} {new Date(ep.air_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
								</span>
							{/if}
						</div>
					</div>
				{/each}

					{#if episodes.length === 0}
						<p class="no-episodes">No episode data available for this season.</p>
					{/if}
				</div>
			</div>
		{/if}

		{#if credits.length > 0}
			<div class="detail-section">
				<h3 class="section-title">Cast</h3>
				<div class="cast-scroll">
					{#each credits as person}
						<div class="cast-card">
							<div class="cast-avatar">
								{#if person.profile_path}
									<img src="https://image.tmdb.org/t/p/w185{person.profile_path}" alt={person.name} class="cast-avatar-img" />
								{:else}
									<div class="cast-avatar-placeholder">{person.name[0]}</div>
								{/if}
							</div>
							<p class="cast-name">{person.name}</p>
							<p class="cast-role">{person.character || person.roles?.[0]?.character || ''}</p>
						</div>
					{/each}
				</div>
			</div>
		{/if}

	{#if selectedEpisode}
		<div class="detail-section" id="player-section">
			<div class="player-header">
				<h3 class="section-title">
						Now Playing: {show.name} — S{selectedEpisode.season}:E{selectedEpisode.episode}
					</h3>
					<button class="close-player-btn" onclick={() => { selectedEpisode = null; goto(`/tv/${tmdbId}`, { replaceState: true, noScroll: true }); }}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						Close
					</button>
				</div>
				<Player
					tmdbId={tmdbId}
					type="tv"
					season={selectedEpisode.season}
					episode={selectedEpisode.episode}
					imdbId={data.show?.imdb_id || null}
					title={`${show.name} — S${selectedEpisode.season}:E${selectedEpisode.episode}`}
					runtime={currentEp?.runtime ?? null}
					backdrop={show.backdrop_path ?? null}
					next={next}
					onnext={() => { if (next) playEpisode(next); }}
				/>
			</div>
		{/if}

		{#if similar.length > 0}
			<div class="detail-section">
				<ContentRow title="Similar Shows" items={similar} />
			</div>
		{/if}
	</div>
{/if}

<style>
	.tv-detail { padding-bottom: 40px; }

	.detail-backdrop { position: relative; width: 100%; aspect-ratio: 16/9; overflow: hidden; }
	.detail-backdrop-img { width: 100%; height: 100%; object-fit: cover; }
	.detail-backdrop-grad { position: absolute; inset: 0; background: linear-gradient(to top, #09090b 0%, transparent 60%); }

	.detail-header { display: flex; gap: 16px; padding: 0 16px; margin-top: -80px; position: relative; z-index: 2; }
	.detail-poster { width: 110px; flex-shrink: 0; position: relative; }
	@media (min-width: 768px) { .detail-poster { width: 160px; } }
	.detail-poster-img { width: 100%; border-radius: 10px; aspect-ratio: 2/3; object-fit: cover; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
	.detail-poster-placeholder { width: 100%; aspect-ratio: 2/3; border-radius: 10px; background: #18181b; }
	.save-btn { position: absolute; top: 6px; right: 6px; width: 32px; height: 32px; border-radius: 8px; background: rgba(0,0,0,0.6); border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
	.save-btn.saved { color: #818cf8; }
	.save-btn svg { width: 18px; height: 18px; }
	.detail-info { flex: 1; padding-top: 20px; min-width: 0; }
	.detail-title { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2; }
	.detail-meta { display: flex; align-items: center; gap: 10px; margin-top: 6px; flex-wrap: wrap; }
	.meta-rating { color: #f59e0b; font-weight: 700; font-size: 14px; }
	.meta-year { color: #a1a1aa; font-size: 14px; }
	.meta-seasons { color: #71717a; font-size: 13px; }
	.meta-status { color: #818cf8; font-size: 12px; font-weight: 600; background: rgba(129,140,248,0.12); padding: 2px 8px; border-radius: 10px; }
	.detail-genres { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
	.genre-tag { padding: 4px 10px; background: rgba(129,140,248,0.15); color: #a5b4fc; border-radius: 20px; font-size: 12px; font-weight: 600; }

	.detail-section { padding: 20px 16px 0; }
	.section-title { font-size: 17px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
	.episode-count { font-size: 13px; color: #71717a; font-weight: 400; }
	.detail-overview { font-size: 14px; color: #a1a1aa; line-height: 1.6; }
	.detail-overview:not(.overview-expanded) { display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
	.overview-toggle { background: none; border: none; color: #818cf8; font-size: 13px; font-weight: 600; padding: 4px 0; cursor: pointer; margin-top: 4px; }

	.progress-banner { display: flex; align-items: center; justify-content: space-between; margin: 16px; padding: 14px 16px; background: rgba(129,140,248,0.1); border: 1px solid rgba(129,140,248,0.2); border-radius: 14px; gap: 12px; }
	.progress-banner-left { display: flex; align-items: center; gap: 10px; }
	.progress-dot { width: 10px; height: 10px; background: #818cf8; border-radius: 50%; animation: pulse 2s infinite; }
	@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
	.progress-banner-title { font-size: 14px; font-weight: 600; }
	.progress-banner-sub { font-size: 12px; color: #a1a1aa; margin-top: 2px; }
	.progress-play-btn { display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: #818cf8; color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
	.progress-play-btn svg { width: 14px; height: 14px; }
	.progress-play-btn:active { background: #6366f1; transform: scale(0.97); }

	.season-tabs-wrap { position: relative; }
	.tabs-fade { position: absolute; top: 0; bottom: 4px; width: 36px; pointer-events: none; z-index: 1; }
	.tabs-fade-left { left: 0; background: linear-gradient(to right, rgba(9,9,11,0.95), transparent); }
	.tabs-fade-right { right: 0; background: linear-gradient(to left, rgba(9,9,11,0.95), transparent); }
	.tabs-arrow { position: absolute; top: 2px; bottom: 6px; width: 28px; display: none; align-items: center; justify-content: center; background: rgba(24,24,27,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; cursor: pointer; z-index: 2; }
	.tabs-arrow.show { display: flex; }
	.tabs-arrow svg { width: 16px; height: 16px; }
	.tabs-arrow:active { background: #3f3f46; }
	.tabs-arrow-left { left: 0; }
	.tabs-arrow-right { right: 0; }
	@media (max-width: 767px) { .tabs-arrow { display: none !important; } }
	.season-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; -webkit-overflow-scrolling: touch; scroll-snap-type: x proximity; scroll-padding: 8px; overscroll-behavior-x: contain; }
	.season-tabs::-webkit-scrollbar { display: none; }
	.season-tab { padding: 10px 16px; background: #18181b; border: 1px solid #27272a; border-radius: 10px; color: #a1a1aa; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 0.15s; flex-shrink: 0; scroll-snap-align: start; font-family: inherit; }
	.season-tab:active { background: #27272a; }
	.season-tab-active { background: #818cf8; border-color: #818cf8; color: #fff; }

	.episode-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; padding-right: 4px; }
	.episode-list.episode-list-scroll { max-height: min(560px, 60vh); overflow-y: auto; scrollbar-width: thin; }
	.episode-card { display: flex; flex-direction: column; flex-shrink: 0; background: #0d0d0f; border: 1px solid rgba(255,255,255,0.04); border-radius: 12px; overflow: hidden; transition: border-color 0.15s; }
	.episode-card:hover { border-color: rgba(255,255,255,0.1); }
	.episode-card.episode-active { border-color: rgba(129,140,248,0.55); }
	.episode-card.episode-unaired { opacity: 0.55; }
	.episode-still { position: relative; width: 100%; aspect-ratio: 16/9; flex-shrink: 0; background: #18181b; overflow: hidden; }
	.episode-still-img { width: 100%; height: 100%; object-fit: cover; display: block; }
	.episode-still-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #18181b; }
	.ep-num { font-size: 32px; font-weight: 800; color: #27272a; }
	.episode-play-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); opacity: 0; transition: opacity 0.2s; border: none; cursor: pointer; }
	.episode-card:hover .episode-play-overlay, .episode-still:active .episode-play-overlay { opacity: 1; }
	.episode-play-overlay svg { width: 36px; height: 36px; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5)); }
	.progress-bar-container { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.15); }
	.progress-bar-fill { height: 100%; background: #818cf8; transition: width 0.3s; }
	.episode-info { flex: 1; min-width: 0; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
	.episode-title-text { font-size: 14px; font-weight: 600; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
	.episode-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
	.episode-number { font-size: 12px; font-weight: 700; color: #818cf8; }
	.episode-runtime { font-size: 12px; color: #71717a; }
	.episode-rating { font-size: 12px; color: #f59e0b; font-weight: 600; }
	.now-playing-badge { font-size: 10px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: #fff; background: #818cf8; padding: 2px 8px; border-radius: 8px; }
	.episode-play-overlay:disabled { display: none; }
	.episode-overview { font-size: 12px; color: #a1a1aa; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
	.episode-air-date { font-size: 11px; color: #52525b; display: block; }
	.no-episodes { text-align: center; color: #52525b; padding: 32px 0; }

	.cast-scroll { display: flex; gap: 12px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
	.cast-scroll::-webkit-scrollbar { display: none; }
	.cast-card { flex-shrink: 0; width: 72px; text-align: center; }
	.cast-avatar { width: 64px; height: 64px; border-radius: 50%; overflow: hidden; margin: 0 auto; background: #18181b; }
	.cast-avatar-img { width: 100%; height: 100%; object-fit: cover; }
	.cast-avatar-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #52525b; }
	.cast-name { font-size: 12px; font-weight: 600; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.cast-role { font-size: 11px; color: #71717a; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

	.player-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
	#player-section { scroll-margin-top: calc(var(--header-height) + env(safe-area-inset-top, 0px) + 12px); }
	.close-player-btn { display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: #18181b; border: 1px solid #27272a; border-radius: 8px; color: #a1a1aa; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }
	.close-player-btn svg { width: 14px; height: 14px; }
	.close-player-btn:active { background: #27272a; }

	.detail-skeleton { padding-bottom: 40px; }
	.detail-backdrop-skel { width: 100%; aspect-ratio: 16/9; background: #18181b; animation: pulse 1.5s infinite; }
	.detail-content-skel { display: flex; gap: 16px; padding: 0 16px; margin-top: -80px; position: relative; z-index: 2; }
	.skel-poster { width: 110px; aspect-ratio: 2/3; border-radius: 10px; background: #18181b; flex-shrink: 0; animation: pulse 1.5s infinite; }
	.skel-info { flex: 1; padding-top: 20px; }
	.skel-line { height: 14px; border-radius: 6px; background: #18181b; animation: pulse 1.5s infinite; }
	.skel-line.w-60 { width: 60%; }
	.skel-line.w-40 { width: 40%; }
	.skel-line.w-full { width: 100%; }
	.skel-line.mt-8 { margin-top: 8px; }
	.skel-line.mt-16 { margin-top: 16px; }
	.skel-line.h-60 { height: 60px; }
	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>
