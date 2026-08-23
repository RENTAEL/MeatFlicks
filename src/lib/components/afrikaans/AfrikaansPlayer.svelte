<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Loader2 } from '@lucide/svelte';
	import { AFRIKAANS_SOURCES, youtubeEmbedUrl, type AfSource } from './sources';

	type AfrikaansDetails = {
		tmdbId: number;
		mediaType: 'movie' | 'tv';
		title: string;
		year: string | null;
		overview: string | null;
		backdropPath: string | null;
		trailerKey: string | null;
		youtubeIds: string[];
	};

	let {
		details,
		reachability = {}
	}: {
		details: AfrikaansDetails;
		reachability?: Record<string, boolean>;
	} = $props();

	const YT_GRACE_MS = 10_000;

	type ChainEntry =
		| { kind: 'youtube'; videoId: string; label: string }
		| { kind: 'embed'; source: AfSource; online: boolean };

	/**
	 * Playback chain for this title:
	 *   1. curated + TMDb YouTube videos (primary — reliable, never blocked)
	 *   2. probed embed hosts (fallback; offline hosts sink to the tail)
	 * Titles with no YouTube source at all show a clean "no source" state
	 * instead of a guaranteed-dead embed player.
	 */
	// The chain is fixed per title — details never changes for this route,
	// so capturing its current value here is intentional.
	// svelte-ignore state_referenced_locally
	const CHAIN: ChainEntry[] = [
		...details.youtubeIds.map((videoId) => ({
			kind: 'youtube' as const,
			videoId,
			label: details.youtubeIds.indexOf(videoId) === 0 ? 'YouTube · primary' : 'YouTube'
		})),
		...AFRIKAANS_SOURCES.filter((s) => reachability[s.id] !== false).map((source) => ({
			kind: 'embed' as const,
			source,
			online: true
		})),
		...AFRIKAANS_SOURCES.filter((s) => reachability[s.id] === false).map((source) => ({
			kind: 'embed' as const,
			source,
			online: false
		}))
	];

	const hasYoutube = $derived(details.youtubeIds.length > 0);

	let season = $state(1);
	let episode = $state(1);
	let sourceIndex = $state(0);
	let iframeLoaded = $state(false);
	let switching = $state(true);
	let statusNote = $state('');
	let graceTimer: ReturnType<typeof setTimeout> | null = null;
	let ytHandshakeTimer: ReturnType<typeof setTimeout> | null = null;
	// svelte-ignore state_referenced_locally
	let usingNoSource = $state(details.youtubeIds.length === 0);

	let currentUrl = $derived.by(() => {
		const entry = CHAIN[sourceIndex];
		if (!entry) return '';
		if (entry.kind === 'youtube') return youtubeEmbedUrl(entry.videoId, pageOrigin());
		return entry.source.url(details.mediaType, details.tmdbId, season, episode);
	});
	let currentIsYouTube = $derived(CHAIN[sourceIndex]?.kind === 'youtube');

	function pageOrigin(): string {
		return typeof window !== 'undefined' ? window.location.origin : '';
	}

	function clearTimers() {
		if (graceTimer) {
			clearTimeout(graceTimer);
			graceTimer = null;
		}
		if (ytHandshakeTimer) {
			clearTimeout(ytHandshakeTimer);
			ytHandshakeTimer = null;
		}
	}

	function armSource() {
		clearTimers();
		iframeLoaded = false;
		switching = !usingNoSource && sourceIndex < CHAIN.length;
		if (sourceIndex >= CHAIN.length) return;
		graceTimer = setTimeout(() => advance('did not respond'), YT_GRACE_MS);
		if (currentIsYouTube) {
			// Ask the embedded YouTube player to report lifecycle events so
			// unavailable videos (onError) auto-skip and playback confirms.
			ytHandshakeTimer = setTimeout(() => {
				const frame = document.querySelector<HTMLIFrameElement>('.af-stage iframe');
				frame?.contentWindow?.postMessage(
					JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
					'*'
				);
			}, 1500);
		}
	}

	function advance(reason: string) {
		clearTimers();
		const next = sourceIndex + 1;
		if (next < CHAIN.length) {
			statusNote = `${entryLabel(sourceIndex)} failed (${reason}) — trying ${entryLabel(next)}…`;
			sourceIndex = next;
			return;
		}
		switching = false;
		statusNote = hasYoutube ? 'None of the sources for this title are working right now.' : '';
	}

	function entryLabel(i: number): string {
		const entry = CHAIN[i];
		if (!entry) return 'Source';
		return entry.kind === 'youtube' ? entry.label : `Embed · ${entry.source.label}`;
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
		const origin = event.origin || '';
		const isYouTube = origin.endsWith('youtube-nocookie.com') || origin.endsWith('youtube.com');
		if (isYouTube) {
			try {
				const data = JSON.parse(typeof event.data === 'string' ? event.data : '{}');
				if (data?.event === 'onError') {
					advance(`unavailable (${data.info ?? 'error'})`);
					return;
				}
				if (
					data?.event === 'onStateChange' &&
					(data?.info === 1 || data?.info?.playerState === 1)
				) {
					// Confirmed playback — stop the fallback clock.
					clearTimers();
					switching = false;
					return;
				}
			} catch {
				// non-JSON message from YouTube — ignore
			}
			return;
		}
		if (event.origin !== 'https://vidlink.pro') return;
		const data = event.data as { type?: string; data?: string } | string | null;
		const type =
			typeof data === 'string' ? data : `${data?.type ?? ''}${data?.data ? `:${data.data}` : ''}`;
		if (/PLAYER_ERROR|error/i.test(type)) advance('player error');
		else if (/playing/i.test(type)) onIframeLoad();
	}

	onDestroy(clearTimers);

	$effect(() => {
		void currentUrl;
		armSource();
	});
</script>

<div class="af-player">
	<div class="af-stage">
		{#if usingNoSource}
			<div class="af-none">
				<span class="af-none-icon" aria-hidden="true">🎬</span>
				<p class="af-none-title">{details.title}</p>
				<p class="af-none-text">
					Geen bron nog / No working source yet — kom binnekort / coming soon.
				</p>
			</div>
		{:else if sourceIndex < CHAIN.length}
			{#key currentUrl}
				<iframe
					src={currentUrl}
					title="{details.title} — {entryLabel(sourceIndex)}"
					allow="autoplay; encrypted-media; fullscreen"
					allowfullscreen
					onload={onIframeLoad}
				></iframe>
			{/key}
			{#if switching}
				<div class="af-loading">
					<span class="af-spin"><Loader2 size={26} aria-hidden="true" /></span>
					<span>Loading {entryLabel(sourceIndex)}…</span>
				</div>
			{/if}
		{:else}
			<div class="af-none">
				<span class="af-none-icon" aria-hidden="true">⚠️</span>
				<p class="af-none-title">{details.title}</p>
				<p class="af-none-text">No working source for this title right now.</p>
				<button
					type="button"
					class="af-retry"
					onclick={() => {
						sourceIndex = 0;
						statusNote = '';
					}}
				>
					Retry from start
				</button>
			</div>
		{/if}
	</div>

	<div class="af-bar">
		<span class="af-title">
			{details.title}{details.year ? ` (${details.year})` : ''}
			{#if details.mediaType === 'tv'}
				· S{season}:E{episode}
			{/if}
		</span>

		{#if details.mediaType === 'tv' && !usingNoSource && sourceIndex < CHAIN.length}
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
			{usingNoSource || sourceIndex >= CHAIN.length
				? '—'
				: `${entryLabel(sourceIndex)} · ${sourceIndex + 1}/${CHAIN.length}`}
		</span>
		{#if !usingNoSource && sourceIndex < CHAIN.length}
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
	.af-next,
	.af-retry {
		padding: 0.25rem 0.6rem;
		border-radius: 0.5rem;
		border: 1px solid var(--afrikaans-accent, #f5a623);
		background: transparent;
		color: var(--afrikaans-accent, #f5a623);
		font-size: 0.78rem;
		cursor: pointer;
	}
	.af-steps button:hover,
	.af-next:hover,
	.af-retry:hover {
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
		gap: 0.5rem;
		text-align: center;
		color: #a1a1aa;
		padding: 1rem;
	}
	.af-none-icon {
		font-size: 2rem;
	}
	.af-none-title {
		font-size: 1.2rem;
		font-weight: 800;
		color: #fafafa;
	}
	.af-none-text {
		max-width: 34ch;
		line-height: 1.5;
	}
</style>
