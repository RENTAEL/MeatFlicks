<script lang="ts">
	let {
		tmdbId,
		title = '',
		type = 'movie' as 'movie' | 'tv',
		subtitleUrl = '',
		youtubeId = '',
		sources = [] as Array<{ label: string; url: string; type: string; quality?: string }>,
		season,
		episode,
	}: {
		tmdbId: number;
		title?: string;
		type?: 'movie' | 'tv';
		subtitleUrl?: string;
		youtubeId?: string;
		sources?: Array<{ label: string; url: string; type: string; quality?: string }>;
		season?: number | null;
		episode?: number | null;
	} = $props();

	type PlayerState = 'loading' | 'youtube' | 'scraper' | 'custom' | 'no_source';
	let state: PlayerState = $state('loading');
	let currentSource = $state('');
	let currentLabel = $state('');
	let errorMessage = $state('');
	let submitUrl = $state('');
	let customSources = $state(sources);

	let sourceQueue: Array<{ label: string; url: string; type: string }> = $derived.by(() => {
		const q: Array<{ label: string; url: string; type: string }> = [];
		if (youtubeId) {
			q.push({
				label: 'YouTube',
				url: `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`,
				type: 'youtube',
			});
		}
		for (const s of customSources) {
			q.push({ label: s.label, url: s.url, type: s.type });
		}
		return q;
	});

	let currentQueueIndex = $state(-1);

	function startPlayback() {
		state = 'loading';
		errorMessage = '';
		currentQueueIndex = -1;
		tryNext();
	}

	async function tryNext() {
		currentQueueIndex++;
		if (currentQueueIndex >= sourceQueue.length) {
			await tryScraperFallback();
			return;
		}
		const source = sourceQueue[currentQueueIndex];
		currentSource = source.url;
		currentLabel = source.label;
		if (source.type === 'youtube') {
			state = 'youtube';
		} else {
			state = 'custom';
		}
	}

	async function tryScraperFallback() {
		try {
			const params = new URLSearchParams({ tmdbId: String(tmdbId), type });
			if (season) params.set('season', String(season));
			if (episode) params.set('episode', String(episode));
			const res = await fetch(`/api/stream?${params}`);
			if (res.ok) {
				const data = await res.json();
				const url = data.url || data.streamUrl;
				if (url) {
					currentSource = url;
					currentLabel = 'External Source';
					state = 'scraper';
					return;
				}
			}
		} catch {}
		state = 'no_source';
		errorMessage = 'No playable source found for this title.';
	}

	function handleIframeError() {
		tryNext();
	}

	function retry() {
		startPlayback();
	}

	async function handleSubmit() {
		if (!submitUrl) return;
		try {
			await fetch('/api/sources/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tmdbId, type, url: submitUrl, label: 'User Submitted' }),
			});
			customSources = [...customSources, { label: 'User Submitted', url: submitUrl, type: 'embed' }];
			submitUrl = '';
			state = 'custom';
			currentSource = submitUrl;
			currentLabel = 'User Submitted';
		} catch {}
	}
</script>

<div class="player-wrapper">
	{#if state === 'loading'}
		<div class="player-state">
			<div class="spinner"></div>
			<p>Soek bron vir "{title}"...</p>
			<p class="state-sub">Finding a playable source...</p>
		</div>
	{/if}

	{#if state === 'youtube'}
		<iframe
			src={currentSource}
			allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
			class="player-iframe"
			title="YouTube: {title}"
		></iframe>
	{/if}

	{#if state === 'scraper' || state === 'custom'}
		<iframe
			src={currentSource}
			allow="autoplay; fullscreen; picture-in-picture"
			class="player-iframe"
			title="Player: {title}"
		></iframe>
	{/if}

	{#if state === 'no_source'}
		<div class="player-state error-state">
			<p class="error-icon">🎬</p>
			<h3>Nie beskikbaar nie / Not Available</h3>
			<p class="error-detail">{errorMessage}</p>
			<p class="error-hint">
				Afrikaanse films is dikwels op YouTube beskikbaar. Probeer self soek:
			</p>
			<a
				href="https://www.youtube.com/results?search_query={encodeURIComponent(title + ' full movie Afrikaans')}"
				target="_blank"
				rel="noopener"
				class="youtube-search-btn"
			>
				🔍 Soek op YouTube / Search YouTube
			</a>
			<div class="submit-section">
				<p class="submit-hint">Het jy 'n werkende skakel? / Got a working link?</p>
				<div class="submit-form">
					<input
						type="url"
						placeholder="https://..."
						bind:value={submitUrl}
						class="submit-input"
					/>
					<button onclick={handleSubmit} class="submit-btn">Stuur / Submit</button>
				</div>
			</div>
			<button onclick={retry} class="retry-btn">Probeer weer / Retry</button>
		</div>
	{/if}

	{#if currentLabel && state !== 'loading' && state !== 'no_source'}
		<div class="source-badge">
			<span class="source-dot"></span>
			{currentLabel}
		</div>
	{/if}

	{#if (sourceQueue.length > 1) && (state === 'youtube' || state === 'custom')}
		<div class="source-switcher">
			{#each sourceQueue as source, i}
				<button
					class="source-btn"
					class:active={i === currentQueueIndex}
					onclick={() => { currentQueueIndex = i; currentSource = source.url; currentLabel = source.label; state = source.type === 'youtube' ? 'youtube' : 'custom'; }}
				>
					{source.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.player-wrapper {
		position: relative; width: 100%; height: 100%;
		background: #000; border-radius: 12px; overflow: hidden;
	}
	.player-state {
		display: flex; flex-direction: column; align-items: center;
		justify-content: center; height: 100%; padding: 40px 24px;
		text-align: center; color: #a5b4fc;
	}
	.state-sub { font-size: 13px; color: #6b7280; margin-top: 4px; }
	.spinner {
		width: 40px; height: 40px;
		border: 3px solid rgba(129,140,248,0.2);
		border-top-color: #818cf8;
		border-radius: 50%; animation: spin 0.8s linear infinite;
		margin-bottom: 16px;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.error-state { color: #a5b4fc; }
	.error-icon { font-size: 56px; margin: 0 0 12px; }
	.error-state h3 { font-size: 20px; color: #e0e7ff; margin: 0 0 8px; }
	.error-detail { font-size: 14px; color: #f87171; margin: 0 0 16px; }
	.error-hint { font-size: 13px; color: #6b7280; margin: 0 0 12px; }

	.youtube-search-btn {
		display: inline-block; background: #ff0000; color: #fff;
		padding: 10px 20px; border-radius: 8px; text-decoration: none;
		font-size: 14px; font-weight: 600; margin-bottom: 20px;
	}
	.youtube-search-btn:hover { background: #cc0000; }

	.submit-section {
		border-top: 1px solid rgba(129,140,248,0.1);
		padding-top: 20px; margin-top: 20px;
		width: 100%; max-width: 400px;
	}
	.submit-hint { font-size: 13px; color: #6b7280; margin: 0 0 8px; }
	.submit-form { display: flex; gap: 8px; }
	.submit-input {
		flex: 1; padding: 8px 12px;
		background: rgba(30,27,75,0.7);
		border: 1px solid rgba(129,140,248,0.15);
		border-radius: 8px; color: #e0e7ff; font-size: 13px;
	}
	.submit-btn {
		background: #818cf8; color: #fff; border: none;
		padding: 8px 16px; border-radius: 8px;
		font-size: 13px; cursor: pointer; white-space: nowrap;
	}

	.player-iframe { width: 100%; height: 100%; border: none; }

	.source-badge {
		position: absolute; bottom: 12px; right: 12px;
		display: flex; align-items: center; gap: 6px;
		background: rgba(0,0,0,0.7); color: #a5b4fc;
		font-size: 11px; padding: 4px 10px; border-radius: 6px;
	}
	.source-dot { width: 6px; height: 6px; border-radius: 50%; background: #34d399; }

	.source-switcher {
		position: absolute; top: 12px; right: 12px;
		display: flex; gap: 6px;
	}
	.source-btn {
		background: rgba(0,0,0,0.6); color: #a5b4fc;
		border: 1px solid rgba(129,140,248,0.2);
		padding: 4px 10px; border-radius: 6px;
		font-size: 11px; cursor: pointer;
	}
	.source-btn:hover { background: rgba(129,140,248,0.2); color: #e0e7ff; }
	.source-btn.active { background: #818cf8; color: #fff; border-color: #818cf8; }

	.retry-btn {
		margin-top: 16px; padding: 8px 20px;
		background: rgba(129,140,248,0.1); color: #c7d2fe;
		border: 1px solid rgba(129,140,248,0.2);
		border-radius: 8px; font-size: 13px; cursor: pointer;
	}
</style>
