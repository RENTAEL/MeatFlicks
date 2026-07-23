<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	export interface Provider {
		id: string;
		name: string;
		quality?: string;
		type?: string;
		icon?: string;
		working: boolean | null;
	}

	let { providers = [], open = $bindable(false), isTv = false, season = 1, episode = 1 } = $props();

	const dispatch = createEventDispatcher();

	let selectedProvider = $state('');
	let isAutoScanning = $state(false);
	let autoScanResults: Record<string, boolean> = $state({});
	let autoScanCurrent = $state('');
	let autoScanFound: string | null = $state(null);

	function select(providerId: string) {
		selectedProvider = providerId;
		dispatch('select', { providerId, season, episode });
		open = false;
	}

	function close() {
		if (!isAutoScanning) {
			dispatch('close');
			open = false;
		}
	}

	async function autoScan() {
		isAutoScanning = true;
		autoScanFound = null;
		autoScanResults = {};
		autoScanCurrent = '';

		for (const provider of providers) {
			if (autoScanFound) break;

			autoScanCurrent = provider.id;
			dispatch('testProvider', {
				providerId: provider.id,
				season,
				episode,
				callback: (working: boolean) => {
					autoScanResults[provider.id] = working;
					if (working) {
						autoScanFound = provider.id;
						isAutoScanning = false;
						setTimeout(() => {
							select(provider.id);
						}, 800);
					}
				}
			});

			await new Promise(resolve => setTimeout(resolve, 5000));

			if (autoScanResults[provider.id] === undefined) {
				autoScanResults[provider.id] = false;
			}
		}

		if (!autoScanFound) {
			isAutoScanning = false;
			autoScanCurrent = '';
		}
	}

	function getProviderIcon(provider: Provider): string {
		if (provider.icon) return provider.icon;
		const icons: Record<string, string> = {
			vidcloud: '☁️',
			vidlink: '🔗',
			vidsrc: '🎬',
			'2embed': '🎯',
			embed: '📺',
			stream: '📡',
			upcloud: '⬆️',
			vidplay: '▶️',
			filemoon: '🌙',
			mycloud: '☁️',
			doodstream: '🎥',
			mixdrop: '💧',
			streamtape: '📼',
			voe: '🎞️',
			mp4upload: '📁',
			hydrax: '🌊',
			rabbitstream: '🐇',
			smashystream: '💥'
		};
		return icons[provider.id] || icons[provider.name.toLowerCase()] || '🎬';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
		on:click={close}
		transition:fade={{ duration: 200 }}
	/>

	<!-- Modal -->
	<div
		class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl bg-zinc-900 p-6 shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:top-1/2 md:max-w-md md:-translate-y-1/2 md:rounded-2xl md:m-4"
		transition:fly={{ y: 100, duration: 300 }}
	>
		<!-- Header -->
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-bold text-white">Choose Media Player</h2>
			<button
				class="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
				on:click={close}
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Auto Scan Button -->
		<button
			class="mb-4 w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-white font-semibold transition hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
			on:click={autoScan}
			disabled={isAutoScanning}
		>
			{#if isAutoScanning}
				<span class="flex items-center justify-center gap-2">
					<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
					Scanning: {autoScanCurrent}...
				</span>
			{:else if autoScanFound}
				✅ Found: {autoScanFound}
			{:else if Object.keys(autoScanResults).length > 0 && !autoScanFound}
				❌ No working player found
			{:else}
				🔍 Auto — Find Working Player
			{/if}
		</button>

		<!-- Provider List -->
		<div class="max-h-[60vh] space-y-2 overflow-y-auto">
			{#each providers as provider (provider.id)}
				<button
					class="w-full rounded-lg border border-zinc-800 bg-zinc-800/50 px-4 py-3 text-left transition hover:border-zinc-600 hover:bg-zinc-800"
					class:border-green-500={autoScanResults[provider.id] === true}
					class:border-red-500={autoScanResults[provider.id] === false}
					class:opacity-50={isAutoScanning && autoScanCurrent === provider.id}
					on:click={() => select(provider.id)}
					disabled={isAutoScanning}
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<span class="text-xl">{getProviderIcon(provider)}</span>
							<div>
								<p class="font-medium text-white">{provider.name}</p>
								{#if provider.type}
									<p class="text-xs text-zinc-500">{provider.type}</p>
								{/if}
							</div>
						</div>
						<div class="flex items-center gap-2">
							{#if provider.quality}
								<span class="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
									{provider.quality}
								</span>
							{/if}
							{#if autoScanResults[provider.id] === true}
								<span class="text-green-500">✅</span>
							{:else if autoScanResults[provider.id] === false}
								<span class="text-red-500">❌</span>
							{:else}
								<span class="text-zinc-600">→</span>
							{/if}
						</div>
					</div>
				</button>
			{/each}

			{#if providers.length === 0}
				<p class="py-8 text-center text-zinc-500">
					No media players available.<br />
					Try refreshing or check your connection.
				</p>
			{/if}
		</div>

		<!-- Footer hint -->
		<p class="mt-3 text-center text-xs text-zinc-600">
			Press <kbd class="rounded border border-zinc-700 px-1 text-zinc-500">Esc</kbd> to close
		</p>
	</div>
{/if}