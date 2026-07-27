<script lang="ts">
	import { TV_PROVIDERS } from '$lib/config/providers';

	let {
		tmdbId,
		season,
		episode,
		title = ''
	}: {
		tmdbId: number;
		season: number;
		episode: number;
		title?: string;
	} = $props();

	const providers = TV_PROVIDERS;

	let currentProviderIndex = $state(0);
	let currentUrl = $state('');
	let isLoading = $state(true);
	let error = $state('');
	let playerFrame: HTMLIFrameElement | undefined = $state(undefined);

	function switchProvider(index: number) {
		currentProviderIndex = index;
		loadStream();
	}

	function tryNextProvider() {
		currentProviderIndex = (currentProviderIndex + 1) % providers.length;
		loadStream();
	}

	async function loadStream() {
		isLoading = true;
		error = '';
		const provider = providers[currentProviderIndex];
		currentUrl = provider.buildUrl(tmdbId, season, episode);
	}

	function handleIframeLoad() {
		isLoading = false;
		error = '';
	}

	function handleIframeError() {
		isLoading = false;
		if (currentProviderIndex < providers.length - 1) {
			currentProviderIndex++;
			loadStream();
		} else {
			error = 'All servers are currently unavailable. Please try again later.';
		}
	}

	function retry() {
		loadStream();
	}

	function requestFullscreen() {
		const iframe = playerFrame;
		if (!iframe) return;
		const container = iframe.parentElement;
		if (container?.requestFullscreen) {
			container.requestFullscreen();
		}
	}
</script>

<div class="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl shadow-black/50">
	{#if isLoading && !error}
		<div class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950">
			<div class="h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500"></div>
			<div class="text-center">
				<p class="text-sm text-zinc-400">Connecting to {providers[currentProviderIndex].name}...</p>
				<p class="mt-1 text-xs text-zinc-600">Loading S{season} E{episode}</p>
			</div>
		</div>
	{:else if error}
		<div class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950 p-6">
			<div class="mb-2 text-5xl">😞</div>
			<p class="text-center text-zinc-300">{error}</p>
			<div class="mt-2 flex flex-wrap justify-center gap-2">
				<button
					onclick={retry}
					class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
				>
					Retry
				</button>
				{#each providers as provider, i}
					<button
						onclick={() => switchProvider(i)}
						class="rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 {i === currentProviderIndex ? 'ring-2 ring-indigo-500 bg-zinc-800' : 'bg-zinc-800'}"
					>
						{provider.name}
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<iframe
			bind:this={playerFrame}
			src={currentUrl}
			title="Video player for {title} S{season} E{episode}"
			allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
			referrerpolicy="no-referrer"
			class="h-full w-full"
			loading="lazy"
			onload={handleIframeLoad}
			onerror={handleIframeError}
		></iframe>

		<button
			onclick={requestFullscreen}
			class="absolute bottom-4 right-4 rounded-lg bg-black/60 p-2.5 text-white backdrop-blur-sm transition-all hover:bg-black/80 focus:opacity-100 opacity-0 hover:opacity-100"
			aria-label="Enter fullscreen"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="15 3 21 3 21 9"></polyline>
				<polyline points="9 21 3 21 3 15"></polyline>
				<line x1="21" y1="3" x2="14" y2="10"></line>
				<line x1="3" y1="21" x2="10" y2="14"></line>
			</svg>
		</button>
	{/if}
</div>

<div class="mt-3 flex items-center gap-2">
	<span class="text-xs text-zinc-500">Server:</span>
	{#each providers as provider, i}
		<button
			onclick={() => switchProvider(i)}
			class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {i === currentProviderIndex
				? 'border border-indigo-500/30 bg-indigo-600/20 text-indigo-400'
				: 'border border-zinc-700/50 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'}"
		>
			{provider.name}
		</button>
	{/each}
	<button
		onclick={tryNextProvider}
		class="ml-auto rounded-md border border-zinc-700/50 bg-zinc-800/50 px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
	>
		Try next →
	</button>
</div>
