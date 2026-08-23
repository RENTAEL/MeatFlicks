<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Loader2 } from '@lucide/svelte';

	type AfrikaansDetails = {
		tmdbId: number;
		mediaType: 'movie' | 'tv';
		title: string;
		year: string | null;
		overview: string | null;
		backdropPath: string | null;
		trailerKey: string | null;
	};

	let { details }: { details: AfrikaansDetails } = $props();

	const LOAD_GRACE_MS = 9000;

	interface AfSource {
		id: string;
		label: string;
		url: (kind: 'movie' | 'tv', id: number, s: number, e: number) => string;
		reportsEvents: boolean;
	}

	/**
	 * Isolated source chain for the Afrikaans section only — deliberately
	 * independent from the main catalog's provider system so changes here can
	 * never affect other playback paths.
	 */
	const SOURCES: AfSource[] = [
		{
			id: 'vidlink',
			label: 'VidLink',
			reportsEvents: true,
			url: (k, id, s, e) =>
				k === 'movie'
					? `https://vidlink.pro/movie/${id}?autoplay=true&title=false&poster=true`
					: `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true&title=false&poster=true`
		},
		{
			id: 'vidsrc-to',
			label: 'VidSrc',
			reportsEvents: false,
			url: (k, id, s, e) =>
				k === 'movie'
					? `https://vidsrc.to/embed/movie/${id}`
					: `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
		},
		{
			id: 'vidsrc-xyz',
			label: 'VidSrc XYZ',
			reportsEvents: false,
			url: (k, id, s, e) =>
				k === 'movie'
					? `https://vidsrc.xyz/embed/movie/${id}`
					: `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`
		},
		{
			id: '2embed',
			label: '2Embed',
			reportsEvents: false,
			url: (k, id, s, e) =>
				k === 'movie'
					? `https://www.2embed.cc/embed/${id}`
					: `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`
		},
		{
			id: 'vidsrc-pm',
			label: 'VidSrc PM',
			reportsEvents: false,
			url: (k, id, s, e) =>
				k === 'movie'
					? `https://vidsrc.pm/embed/movie/${id}`
					: `https://vidsrc.pm/embed/tv/${id}/${s}/${e}`
		}
	];

	let season = $state(1);
	let episode = $state(1);
	let sourceIndex = $state(0);
	let iframeLoaded = $state(false);
	let switching = $state(true);
	let statusNote = $state('');
	let graceTimer: ReturnType<typeof setTimeout> | null = null;

	let currentUrl = $derived(
		SOURCES[sourceIndex].url(details.mediaType, details.tmdbId, season, episode)
	);
	let usingTrailerFallback = $state(false);

	function clearGrace() {
		if (graceTimer) {
			clearTimeout(graceTimer);
			graceTimer = null;
		}
	}

	function armGrace() {
		clearGrace();
		iframeLoaded = false;
		switching = true;
		graceTimer = setTimeout(() => {
			// No load event within the grace window — the host is dead or
			// unreachable. Move to the next source automatically.
			advance('source did not respond');
		}, LOAD_GRACE_MS);
	}

	function advance(reason: string) {
		clearGrace();
		if (sourceIndex < SOURCES.length - 1) {
			statusNote = `${SOURCES[sourceIndex].label} failed (${reason}) — trying ${SOURCES[sourceIndex + 1].label}…`;
			sourceIndex += 1;
		} else if (!usingTrailerFallback) {
			usingTrailerFallback = true;
			switching = false;
			statusNote = 'No streaming sources responded — playing the trailer instead.';
		}
	}

	function onIframeLoad() {
		iframeLoaded = true;
		switching = false;
		clearGrace();
	}

	function manualNext() {
		advance('skipped');
	}

	function stepSeason(delta: number) {
		season = Math.min(50, Math.max(1, season + delta));
	}

	function stepEpisode(delta: number) {
		episode = Math.max(1, episode + delta);
	}

	function onMessage(event: MessageEvent) {
		if (event.origin !== 'https://vidlink.pro') return;
		const data = event.data as { type?: string; data?: string } | string | null;
		const type =
			typeof data === 'string' ? data : (data?.type ?? '') + (data?.data ? `:${data.data}` : '');
		if (/PLAYER_ERROR|error/i.test(type)) advance('player error');
		else if (/playing|PLAYER_PLAYBACK/i.test(type)) onIframeLoad();
	}

	onMount(() => {
		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	});

	onDestroy(clearGrace);

	$effect(() => {
		// Re-arm the grace timer whenever the active source URL changes.
		void currentUrl;
		armGrace();
	});
</script>

<div class="af-player">
	<div class="af-stage">
		{#if usingTrailerFallback}
			{#if details.trailerKey}
				<iframe
					src={`https://www.youtube-nocookie.com/embed/${details.trailerKey}?autoplay=1`}
					title="{details.title} trailer"
					allow="autoplay; encrypted-media; fullscreen"
					allowfullscreen
				></iframe>
			{:else}
				<div class="af-none">
					<p class="af-none-title">{details.title}</p>
					<p>No streams available for this title right now.</p>
				</div>
			{/if}
		{:else}
			{#key currentUrl}
				<iframe
					src={currentUrl}
					title="{details.title} — {SOURCES[sourceIndex].label}"
					allow="autoplay; encrypted-media; fullscreen"
					allowfullscreen
					onload={onIframeLoad}
				></iframe>
			{/key}
			{#if switching}
				<div class="af-loading">
					<span class="af-spin"><Loader2 size={26} aria-hidden="true" /></span>
					<span>Loading {SOURCES[sourceIndex].label}…</span>
				</div>
			{/if}
		{/if}
	</div>

	<div class="af-bar">
		<span class="af-title">
			{details.title}{details.year ? ` (${details.year})` : ''}
			{#if details.mediaType === 'tv'}
				· S{season}:E{episode}
			{/if}
		</span>

		{#if details.mediaType === 'tv' && !usingTrailerFallback}
			<span class="af-steps">
				<button type="button" onclick={() => stepSeason(-1)} aria-label="Previous season">S−</button
				>
				<button type="button" onclick={() => stepSeason(1)} aria-label="Next season">S+</button>
				<button type="button" onclick={() => stepEpisode(-1)} aria-label="Previous episode"
					>E−</button
				>
				<button type="button" onclick={() => stepEpisode(1)} aria-label="Next episode">E+</button>
			</span>
		{/if}

		<span class="af-status" role="status">{statusNote}</span>
		<span class="af-src">
			{usingTrailerFallback
				? 'Trailer'
				: `Source ${sourceIndex + 1}/${SOURCES.length} · ${SOURCES[sourceIndex].label}`}
		</span>
		{#if !usingTrailerFallback}
			<button type="button" class="af-next" onclick={manualNext}>Try next ▸</button>
		{/if}
	</div>
</div>

<style>
	.af-player {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0 1.25rem;
		max-width: 1400px;
		margin: 0 auto;
	}
	.af-stage {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		border-radius: 0.9rem;
		overflow: hidden;
		background: #000;
		box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
	}
	.af-stage iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}
	.af-loading {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		background: rgba(9, 9, 11, 0.82);
		color: #d4d4d8;
		font-size: 0.9rem;
		pointer-events: none;
	}
	.af-spin {
		display: inline-flex;
		color: var(--afrikaans-accent, #f5a623);
	}
	.af-spin :global(svg) {
		animation: af-rotate 0.9s linear infinite;
	}
	@keyframes af-rotate {
		to {
			transform: rotate(360deg);
		}
	}
	.af-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.85rem;
		color: #d4d4d8;
	}
	.af-title {
		font-weight: 700;
		color: #fafafa;
	}
	.af-steps {
		display: inline-flex;
		gap: 0.3rem;
	}
	.af-steps button,
	.af-next {
		padding: 0.25rem 0.6rem;
		border-radius: 0.5rem;
		border: 1px solid var(--afrikaans-accent, #f5a623);
		background: transparent;
		color: var(--afrikaans-accent, #f5a623);
		font-size: 0.78rem;
		cursor: pointer;
	}
	.af-steps button:hover,
	.af-next:hover {
		background: color-mix(in srgb, var(--afrikaans-accent, #f5a623) 14%, transparent);
	}
	.af-status {
		flex: 1;
		min-width: 12rem;
		font-size: 0.78rem;
		color: #a1a1aa;
	}
	.af-src {
		font-size: 0.78rem;
		color: var(--afrikaans-accent, #f5a623);
	}
	.af-none {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		text-align: center;
		color: #a1a1aa;
		padding: 1rem;
	}
	.af-none-title {
		font-size: 1.2rem;
		font-weight: 800;
		color: #fafafa;
	}
</style>
