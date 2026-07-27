<script lang="ts">
	import { MOVIE_PROVIDERS } from '$lib/config/providers';
	import { onMount } from 'svelte';

	let {
		tmdbId,
		title = ''
	}: {
		tmdbId: number;
		title?: string;
	} = $props();

	const providers = MOVIE_PROVIDERS;
	const AUTO_SEARCH_TIMEOUT = 6000;

	let currentProviderIndex = $state(0);
	let currentUrl = $state('');
	let isLoading = $state(true);
	let error = $state('');
	let playerFrame: HTMLIFrameElement | undefined = $state(undefined);
	let autoSearchActive = $state(false);
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	function clearSearchTimer() {
		if (searchTimer !== undefined) {
			clearTimeout(searchTimer);
			searchTimer = undefined;
		}
	}

	function loadStream() {
		isLoading = true;
		error = '';
		const provider = providers[currentProviderIndex];
		currentUrl = provider.buildUrl(tmdbId);
	}

	function onProviderTimeout() {
		if (!autoSearchActive) return;
		if (currentProviderIndex < providers.length - 1) {
			currentProviderIndex++;
			loadStream();
			searchTimer = setTimeout(onProviderTimeout, AUTO_SEARCH_TIMEOUT);
		} else {
			autoSearchActive = false;
			isLoading = false;
			error = 'All servers are currently unavailable. Please try again later.';
		}
	}

	function startAutoSearch() {
		clearSearchTimer();
		autoSearchActive = true;
		currentProviderIndex = 0;
		loadStream();
		searchTimer = setTimeout(onProviderTimeout, AUTO_SEARCH_TIMEOUT);
	}

	function handleIframeLoad() {
		isLoading = false;
		if (autoSearchActive) {
			clearSearchTimer();
			autoSearchActive = false;
		}
		error = '';
	}

	function handleIframeError() {
		isLoading = false;
		if (autoSearchActive) {
			onProviderTimeout();
		} else if (currentProviderIndex < providers.length - 1) {
			currentProviderIndex++;
			loadStream();
		} else {
			error = 'All servers are currently unavailable. Please try again later.';
		}
	}

	function switchProvider(index: number) {
		clearSearchTimer();
		autoSearchActive = false;
		currentProviderIndex = index;
		loadStream();
	}

	function tryNextProvider() {
		clearSearchTimer();
		autoSearchActive = false;
		currentProviderIndex = (currentProviderIndex + 1) % providers.length;
		loadStream();
	}

	function retry() {
		startAutoSearch();
	}

	onMount(() => {
		startAutoSearch();
	});

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
				{#if autoSearchActive}
					<p class="text-sm text-amber-400">Auto-searching for available server...</p>
					<p class="mt-1 text-xs text-zinc-500">Trying {providers[currentProviderIndex].name}</p>
					<div class="mt-3 flex items-center justify-center gap-1">
						{#each providers as _, i}
							<div
								class="h-1 w-6 rounded-full transition-all {i === currentProviderIndex
									? 'bg-indigo-500'
									: i < currentProviderIndex
										? 'bg-zinc-600'
										: 'bg-zinc-800'}"
							></div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-zinc-400">Connecting to {providers[currentProviderIndex].name}...</p>
					<p class="mt-1 text-xs text-zinc-600">This may take a moment</p>
				{/if}
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
			title="Video player for {title}"
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
