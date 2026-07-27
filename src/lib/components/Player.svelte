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

	let currentProviderIndex = $state(0);
	let currentUrl = $state('');
	let showIframe = $state(false);
	let playerFrame: HTMLIFrameElement | undefined = $state(undefined);

	function switchToProvider(index: number) {
		currentProviderIndex = index;
		showIframe = false;
		const provider = providers[currentProviderIndex];
		currentUrl = provider.buildUrl(tmdbId);
		setTimeout(() => {
			showIframe = true;
		}, 3000);
	}

	function tryNextProvider() {
		const next = (currentProviderIndex + 1) % providers.length;
		switchToProvider(next);
	}

	function requestFullscreen() {
		const iframe = playerFrame;
		if (!iframe) return;
		const container = iframe.parentElement;
		if (container?.requestFullscreen) {
			container.requestFullscreen();
		}
	}

	onMount(() => {
		currentProviderIndex = 0;
		switchToProvider(0);
	});
</script>

<div class="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl shadow-black/50">
	{#if !showIframe}
		<div class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950">
			<div class="h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500"></div>
			<div class="text-center">
				<p class="text-sm text-zinc-400">Loading {providers[currentProviderIndex].name}...</p>
				<p class="mt-1 text-xs text-zinc-600">Server will appear shortly</p>
			</div>
		</div>
	{:else}
		<iframe
			bind:this={playerFrame}
			src={currentUrl}
			title="Video player for {title}"
			sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
			allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
			referrerpolicy="no-referrer"
			loading="eager"
			class="h-full w-full border-0"
		></iframe>

		<div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
			<div class="flex items-center gap-2 pointer-events-auto">
				<span class="text-xs font-medium text-zinc-400 bg-black/60 px-2 py-1 rounded">
					{providers[currentProviderIndex].name}
				</span>
				<button
					onclick={tryNextProvider}
					class="rounded-md bg-indigo-600/80 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
				>
					Stuck? Try next server →
				</button>
			</div>
		</div>

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
			onclick={() => switchToProvider(i)}
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

{#if import.meta.env.DEV}
	<div class="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
		<p class="mb-1 text-xs font-medium text-zinc-500">DEBUG</p>
		<p class="text-xs text-zinc-500">Current: {providers[currentProviderIndex].name}</p>
		<p class="text-xs text-zinc-500">
			URL:
			<a href={currentUrl} target="_blank" rel="noreferrer" class="underline text-indigo-400">{currentUrl}</a>
		</p>
		<p class="text-xs text-zinc-500">tmdbId: {tmdbId}</p>
		<div class="mt-2 flex flex-wrap gap-2">
			{#each providers as p, i}
				<a
					href={p.buildUrl(tmdbId)}
					target="_blank"
					rel="noreferrer"
					class="text-xs underline {i === currentProviderIndex ? 'text-green-400' : 'text-zinc-500'}">
					{p.name}
				</a>
			{/each}
		</div>
	</div>
{/if}
