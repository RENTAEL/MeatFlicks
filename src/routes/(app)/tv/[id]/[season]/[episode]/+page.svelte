<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Player from '$lib/components/Player.svelte';
	import { resolveNextEpisode } from '$lib/episodeNav';
	import { createWatchParty } from '$lib/watch-party/client';
	import WpJoinOverlay from '$lib/components/watch-party/WpJoinOverlay.svelte';

	let show: any = $state(null);
	let episodes: any[] = $state([]);
	let imdbId = $state<string | null>(null);
	let isLoading = $state(true);

	let tmdbId = $derived(Number(page.params.id));
	let seasonNum = $derived(Number(page.params.season));
	let episodeNum = $derived(Number(page.params.episode));

	let currentEpIndex = $derived(
		episodes.findIndex((e: any) => e.season_number === seasonNum && e.episode_number === episodeNum)
	);
	let hasPrev = $derived(currentEpIndex > 0);
	let hasNext = $derived(currentEpIndex >= 0 && currentEpIndex < episodes.length - 1);
	let next = $derived(resolveNextEpisode(show?.seasons || [], episodes, seasonNum, episodeNum));

	async function load() {
		isLoading = true;
		try {
			const [showRes, seasonRes, tvMetaRes] = await Promise.all([
				fetch(`/api/tmdb/tv/${tmdbId}`),
				fetch(`/api/tmdb/tv/${tmdbId}/season/${seasonNum}`),
				fetch(`/api/tv/${tmdbId}`).catch(() => null)
			]);
			show = await showRes.json();
			const seasonData = await seasonRes.json();
			episodes = seasonData.episodes || [];
			if (tvMetaRes?.ok) {
				const tvMeta = await tvMetaRes.json();
				imdbId = tvMeta.imdbId || null;
			}

			if (episodes.length > 0 && currentEpIndex === -1) {
				goto(`/tv/${tmdbId}`, { replaceState: true });
				return;
			}

			recordWatch();
		} catch (e) {
			console.error('Failed to load episode:', e);
		} finally {
			isLoading = false;
		}
	}

	async function recordWatch() {
		try {
			await fetch('/api/history', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: 'tv',
					season: seasonNum,
					episode: episodeNum
				})
			});
		} catch {}

		try {
			await fetch('/api/track', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					imdbId: '',
					title: show?.name || '',
					type: 'episode',
					progress: 0,
					season: seasonNum,
					episode: episodeNum
				})
			});
		} catch {}
	}

	function goEpisode(ep: any) {
		goto(`/tv/${tmdbId}/${ep.season_number}/${ep.episode_number}`, {
			replaceState: false,
			noScroll: true
		});
	}

	let joining = $state(false);
	let joinError = $state('');

	async function startParty() {
		if (joining) return;
		joining = true;
		joinError = '';
		const result = await createWatchParty({
			mediaType: 'tv',
			tmdbId,
			season: seasonNum,
			episode: episodeNum
		});
		if (result.ok) {
			await goto(`/watch/${result.roomId}`);
			return;
		}
		if (result.reason === 'auth') {
			await goto(`/login?next=${encodeURIComponent(`/tv/${tmdbId}/${seasonNum}/${episodeNum}`)}`);
			return;
		}
		joinError =
			result.reason === 'timeout'
				? 'The room took too long to respond. Check your connection and retry.'
				: 'The server could not create the room right now. Retrying usually fixes it.';
	}

	function retryParty() {
		startParty();
	}

	function dismissJoin() {
		joining = false;
		joinError = '';
	}

	$effect(() => {
		if (tmdbId && seasonNum && episodeNum) load();
	});
</script>

<svelte:head>
	<title>
		{show?.name
			? `${show.name} — S${seasonNum}:E${episodeNum} | Streamium`
			: `TV Episode — S${seasonNum}:E${episodeNum} | Streamium`}
	</title>
	{#if show?.name}
		<meta property="og:title" content={`${show.name} — S${seasonNum}:E${episodeNum}`} />
	{/if}
</svelte:head>

{#if isLoading}
	<div class="ep-page-loading">
		<div class="ep-player-skel"></div>
		<div class="ep-info-skel">
			<div class="skel-line w-70"></div>
			<div class="skel-line w-50 mt-8"></div>
		</div>
	</div>
{:else if show}
	<div class="ep-page">
		<button class="back-btn" onclick={() => goto(`/tv/${tmdbId}`, { noScroll: true })}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
				><polyline points="15 18 9 12 15 6" /></svg
			>
			Back to {show.name}
		</button>

		<div class="ep-nav-header">
			<h2 class="ep-title">
				S{seasonNum}:E{episodeNum} — {episodes[currentEpIndex]?.name || `Episode ${episodeNum}`}
			</h2>
			<div class="ep-nav-buttons">
				<button
					class="ep-nav-btn"
					disabled={!hasPrev}
					onclick={() => goEpisode(episodes[currentEpIndex - 1])}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><polyline points="15 18 9 12 15 6" /></svg
					>
					Prev
				</button>
				<button
					class="ep-nav-btn"
					disabled={!hasNext}
					onclick={() => goEpisode(episodes[currentEpIndex + 1])}
				>
					Next
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><polyline points="9 18 15 12 9 6" /></svg
					>
				</button>
			</div>
		</div>

		<Player
			{tmdbId}
			type="tv"
			season={seasonNum}
			episode={episodeNum}
			{imdbId}
			title={`${show.name} — S${seasonNum}:E${episodeNum}`}
			runtime={episodes[currentEpIndex]?.runtime ?? null}
			backdrop={show.backdrop_path ?? null}
			{next}
			onnext={() => {
				if (next) goEpisode(next);
			}}
		/>

		<button class="word-press-btn" onclick={startParty} disabled={joining}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"
				/></svg
			>
			Start Watch Party
		</button>

		<div class="ep-section">
			<h3 class="ep-section-title">Episode List</h3>
			<div class="ep-list" class:ep-list-scroll={episodes.length > 15}>
				{#each episodes as ep (ep.id)}
					<button
						class="ep-list-item"
						class:ep-list-item-active={ep.season_number === seasonNum &&
							ep.episode_number === episodeNum}
						onclick={() => goEpisode(ep)}
					>
						<div class="ep-list-still">
							{#if ep.still_path}
								<img
									src="https://image.tmdb.org/t/p/w185{ep.still_path}"
									alt=""
									class="ep-list-still-img"
								/>
							{/if}
						</div>
						<div class="ep-list-info">
							<span class="ep-list-num">E{ep.episode_number}</span>
							<span class="ep-list-name">{ep.name}</span>
							{#if ep.runtime}
								<span class="ep-list-runtime">{ep.runtime}m</span>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}

{#if joining}
	<WpJoinOverlay
		status={joinError ? 'error' : 'joining'}
		message={joinError}
		onretry={retryParty}
		ondismiss={dismissJoin}
	/>
{/if}

<style>
	.ep-page {
		padding-top: calc(var(--header-height) + env(safe-area-inset-top, 0px) + 1.5rem);
		padding-bottom: 40px;
	}
	.back-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 10px 16px;
		background: none;
		border: none;
		color: #a1a1aa;
		font-size: 14px;
		cursor: pointer;
		font-family: inherit;
	}
	.back-btn svg {
		width: 18px;
		height: 18px;
	}

	.ep-nav-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px 12px;
		gap: 12px;
	}
	.ep-title {
		font-size: 15px;
		font-weight: 600;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ep-nav-buttons {
		display: flex;
		gap: 8px;
		flex-shrink: 0;
	}
	.ep-nav-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 14px;
		background: #18181b;
		border: 1px solid #27272a;
		border-radius: 8px;
		color: #a1a1aa;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
	}
	.ep-nav-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	.ep-nav-btn:not(:disabled):active {
		background: #27272a;
	}
	.ep-nav-btn svg {
		width: 14px;
		height: 14px;
	}

	.ep-section {
		padding: 20px 16px 0;
	}
	.ep-section-title {
		font-size: 17px;
		font-weight: 700;
		margin-bottom: 12px;
	}

	.ep-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-right: 4px;
	}
	.ep-list.ep-list-scroll {
		max-height: min(480px, 55vh);
		overflow-y: auto;
		scrollbar-width: thin;
	}
	.ep-list-item {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		gap: 10px;
		padding: 8px 10px;
		background: none;
		border: 1px solid transparent;
		border-radius: 10px;
		color: #a1a1aa;
		cursor: pointer;
		text-align: left;
		width: 100%;
		font-family: inherit;
		transition: background 0.1s;
	}
	.ep-list-item:active {
		background: #18181b;
	}
	.ep-list-item-active {
		background: rgba(129, 140, 248, 0.08);
		border-color: rgba(129, 140, 248, 0.2);
		color: #fff;
	}
	.ep-list-still {
		width: 80px;
		aspect-ratio: 16/9;
		border-radius: 6px;
		overflow: hidden;
		flex-shrink: 0;
		background: #18181b;
	}
	.ep-list-still-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.ep-list-info {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.ep-list-num {
		font-size: 12px;
		font-weight: 700;
		color: #818cf8;
	}
	.ep-list-name {
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ep-list-runtime {
		font-size: 11px;
		color: #71717a;
		margin-left: auto;
	}

	.word-press-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin: 12px 16px 0;
		padding: 8px 16px;
		background: #18181b;
		color: #c4b5fd;
		border: 1px solid #3f3f46;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
	}
	.word-press-btn:hover {
		background: #27272a;
	}
	.word-press-btn svg {
		width: 16px;
		height: 16px;
	}

	.ep-page-loading {
		padding-bottom: 40px;
	}
	.ep-player-skel {
		width: calc(100% - 32px);
		margin: 0 16px;
		aspect-ratio: 16/9;
		background: #18181b;
		border-radius: 12px;
		animation: pul 1.5s infinite;
	}
	.ep-info-skel {
		padding: 16px;
	}
	.skel-line {
		height: 14px;
		border-radius: 6px;
		background: #18181b;
		animation: pul 1.5s infinite;
	}
	.skel-line.w-70 {
		width: 70%;
	}
	.skel-line.w-50 {
		width: 50%;
	}
	.skel-line.mt-8 {
		margin-top: 8px;
	}
	@keyframes pul {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
