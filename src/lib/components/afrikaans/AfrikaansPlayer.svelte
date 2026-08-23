<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Loader2 } from '@lucide/svelte';
	import { AFRIKAANS_SOURCES, type AfSource } from './sources';

	type AfrikaansDetails = {
		tmdbId: number;
		mediaType: 'movie' | 'tv';
		title: string;
		year: string | null;
		overview: string | null;
		backdropPath: string | null;
		trailerKey: string | null;
	};

	let {
		details,
		reachability = {}
	}: {
		details: AfrikaansDetails;
		reachability?: Record<string, boolean>;
	} = $props();

	const LOAD_GRACE_MS = 9000;

	interface ChainEntry extends AfSource {
		online: boolean;
	}

	/**
	 * Ordered chain: hosts the server probe reached come first (original
	 * order preserved); offline hosts follow, still playable via manual
	 * fallback but never auto-selected.
	 */
	const CHAIN: ChainEntry[] = [
		...AFRIKAANS_SOURCES.filter((s) => reachability[s.id] !== false).map((s) => ({
			...s,
			online: true
		})),
		...AFRIKAANS_SOURCES.filter((s) => reachability[s.id] === false).map((s) => ({
			...s,
			online: false
		}))
	];

	let season = $state(1);
	let episode = $state(1);
	let sourceIndex = $state(0);
	let iframeLoaded = $state(false);
	let switching = $state(true);
	let statusNote = $state('');
	let graceTimer: ReturnType<typeof setTimeout> | null = null;
	let usingTrailerFallback = $state(false);

	let currentUrl = $derived(
		CHAIN[sourceIndex].url(details.mediaType, details.tmdbId, season, episode)
	);

	function clearGrace() {
		if (graceTimer) {
			clearTimeout(graceTimer);
			graceTimer = null;
		}
	}

	function armGrace() {
		clearGrace();
		iframeLoaded = false;
		switching = !usingTrailerFallback;
		graceTimer = setTimeout(() => advance('did not respond'), LOAD_GRACE_MS);
	}

	/**
	 * Advance to the next source. Browsers fire `load` even for failed
	 * iframes, so auto-advance is driven by (a) hosts marked offline by the
	 * server probe — skipped instantly — and (b) VidLink's own error events.
	 */
	function advance(reason: string) {
		clearGrace();
		const next = sourceIndex + 1;
		if (next < CHAIN.length) {
			const wasOffline = !CHAIN[sourceIndex].online;
			statusNote = wasOffline
				? `${CHAIN[sourceIndex].label} is offline — skipped.`
				: `${CHAIN[sourceIndex].label} failed (${reason}) — trying ${CHAIN[next].label}…`;
			sourceIndex = next;
			return;
		}
		if (!usingTrailerFallback) {
			usingTrailerFallback = true;
			switching = false;
			statusNote = 'No streaming sources responded — playing the trailer instead.';
		}
	}

	function onIframeLoad() {
		iframeLoaded = true;
		switching = false;
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
			typeof data === 'string' ? data : `${data?.type ?? ''}${data?.data ? `:${data.data}` : ''}`;
		if (/PLAYER_ERROR|error/i.test(type)) advance('player error');
		else if (/playing/i.test(type)) onIframeLoad();
	}

	onDestroy(clearGrace);

	$effect(() => {
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
					title="{details.title} — {CHAIN[sourceIndex].label}"
					allow="autoplay; encrypted-media; fullscreen"
					allowfullscreen
					onload={onIframeLoad}
				></iframe>
			{/key}
			{#if switching}
				<div class="af-loading">
					<span class="af-spin"><Loader2 size={26} aria-hidden="true" /></span>
					<span>Loading {CHAIN[sourceIndex].label}…</span>
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
				: `Source ${sourceIndex + 1}/${CHAIN.length} · ${CHAIN[sourceIndex].label}${CHAIN[sourceIndex].online ? '' : ' (offline)'}`}
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
