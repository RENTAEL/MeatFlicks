<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Hls from 'hls.js';

	let {
		tmdbId,
		title = ''
	}: {
		tmdbId: number;
		title?: string;
	} = $props();

	let videoElement: HTMLVideoElement | undefined = $state(undefined);
	let playerFrame: HTMLIFrameElement | undefined = $state(undefined);
	let hls: Hls | null = $state(null);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let streamUrl = $state('');
	let embedUrl = $state('');
	let currentProvider = $state('');
	let useNative = $state(false);
	let providers: { id: string; label: string }[] = $state([]);

	async function loadStream(preferred?: string) {
		isLoading = true;
		errorMessage = '';
		if (hls) { hls.destroy(); hls = null; }

		try {
			const params = new URLSearchParams({ tmdbId: tmdbId.toString(), mediaType: 'movie' });
			if (preferred) params.set('preferred', preferred);

			const res = await fetch(`/api/streaming?${params}`);
			const data = await res.json();

			if (!res.ok || !data.success) {
				throw new Error(data.message || 'No stream available');
			}

			const src = data.source;
			streamUrl = src.streamUrl || '';
			embedUrl = src.embedUrl || '';
			currentProvider = src.providerId || '';
			useNative = Boolean(streamUrl && /\.(m3u8|mp4)(\?|$)/.test(streamUrl));

			if (data.resolutions?.length) {
				providers = data.resolutions.map((r: any) => ({ id: r.providerId, label: r.label || r.providerId }));
			} else {
				providers = [{ id: src.providerId, label: src.providerId }];
			}

			if (useNative && videoElement) {
				const proxyUrl = `/api/hls-proxy?url=${encodeURIComponent(streamUrl)}`;
				if (Hls.isSupported()) {
					hls = new Hls({ enableWorker: true });
					hls.loadSource(proxyUrl);
					hls.attachMedia(videoElement);
					hls.on(Hls.Events.MANIFEST_PARSED, () => { videoElement!.play(); isLoading = false; });
					hls.on(Hls.Events.ERROR, (_e, data) => {
						if (data.fatal) { errorMessage = 'Stream failed. Try another server.'; isLoading = false; }
					});
				} else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
					videoElement.src = proxyUrl;
					videoElement.play();
					isLoading = false;
				} else {
					useNative = false;
					isLoading = false;
				}
			} else {
				isLoading = false;
			}
		} catch (e: any) {
			errorMessage = e.message || 'Failed to load stream';
			isLoading = false;
		}
	}

	function switchProvider(providerId: string) {
		loadStream(providerId);
	}

	function retry() {
		loadStream();
	}

	onMount(() => {
		if (tmdbId) loadStream();
	});

	$effect(() => {
		if (tmdbId) loadStream();
	});

	onDestroy(() => {
		if (hls) hls.destroy();
	});
</script>

<div class="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl shadow-black/50">
	{#if isLoading}
		<div class="absolute inset-0 flex items-center justify-center bg-zinc-950">
			<div class="flex flex-col items-center gap-3">
				<div class="h-10 w-10 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-400"></div>
				<p class="text-sm text-zinc-400">Finding stream{currentProvider ? ` via ${currentProvider}` : ''}...</p>
			</div>
		</div>
	{/if}

	{#if errorMessage}
		<div class="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/95">
			<div class="text-center space-y-3 p-6">
				<p class="text-red-400 text-sm">{errorMessage}</p>
				<div class="flex flex-wrap justify-center gap-2">
					<button onclick={retry} class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500">
						Retry
					</button>
					{#each providers as p}
						<button
							onclick={() => switchProvider(p.id)}
							class="rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 {p.id === currentProvider ? 'ring-2 ring-indigo-500 bg-zinc-800' : 'bg-zinc-800'}"
						>
							{p.label}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{:else if !isLoading}
		{#if useNative}
			<video
				bind:this={videoElement}
				controls
				crossorigin="anonymous"
				playsinline
				class="h-full w-full"
			></video>
		{:else if embedUrl}
			<iframe
				bind:this={playerFrame}
				src={embedUrl || streamUrl}
				title="Video player for {title}"
				sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
				allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
				referrerpolicy="no-referrer"
				loading="eager"
				class="h-full w-full border-0"
			></iframe>
		{/if}
	{/if}
</div>

<div class="mt-3 flex items-center gap-2">
	<span class="text-xs text-zinc-500">Server:</span>
	{#each providers as p}
		<button
			onclick={() => switchProvider(p.id)}
			class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {p.id === currentProvider
				? 'border border-indigo-500/30 bg-indigo-600/20 text-indigo-400'
				: 'border border-zinc-700/50 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'}"
		>
			{p.label}
		</button>
	{/each}
	<button
		onclick={retry}
		class="ml-auto rounded-md border border-zinc-700/50 bg-zinc-800/50 px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
	>
		Refresh
	</button>
</div>

{#if import.meta.env.DEV}
	<div class="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
		<p class="mb-1 text-xs font-medium text-zinc-500">DEBUG</p>
		<p class="text-xs text-zinc-500">Provider: {currentProvider || '-'}</p>
		<p class="text-xs text-zinc-500 truncate">Stream: {streamUrl || '-'}</p>
		<p class="text-xs text-zinc-500 truncate">Embed: {embedUrl || '-'}</p>
		<p class="text-xs text-zinc-500">Mode: {useNative ? 'Native HLS' : embedUrl ? 'Iframe' : 'None'}</p>
	</div>
{/if}
