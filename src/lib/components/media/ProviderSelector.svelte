<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { providerSettings } from '$lib/streaming/providerSettingsStore.svelte';
	import type { ProviderSettings } from '$lib/streaming/providerSettingsStore.svelte';

	export interface Provider {
		id: string;
		name: string;
		quality?: string;
		type?: string;
		icon?: string;
		working: boolean | null;
	}

	let {
		providers = [],
		open = $bindable(false),
		isTv = false,
		season = 1,
		episode = 1,
		onselect,
		ontestProvider,
		onclose
	} = $props();

	let selectedProvider = $state('');
	let isAutoScanning = $state(false);
	let autoScanResults: Record<string, boolean> = $state({});
	let autoScanCurrent = $state('');
	let autoScanFound: string | null = $state(null);
	let showSettings = $state(false);
	let dragIndex: number | null = $state(null);

	const autoSelect = $derived(providerSettings.settings.autoSelect);
	const sortedProviders = $derived.by(() => {
		const order = providerSettings.getProviderOrder();
		const sorted = [...providers].sort(
			(a, b) => order.indexOf(a.id) - order.indexOf(b.id) || providers.indexOf(a) - providers.indexOf(b)
		);
		return sorted;
	});

	let scoresCache: { providerId: string; score: number; successes: number; failures: number }[] = $state([]);

	async function loadScores() {
		const { providerScoring } = await import('$lib/streaming/provider-scoring');
		scoresCache = providerScoring.getAllScores();
	}

	function select(providerId: string) {
		selectedProvider = providerId;
		onselect?.({ detail: { providerId, season, episode } } as any);
		open = false;
	}

	function close() {
		if (!isAutoScanning) {
			onclose?.({} as any);
			open = false;
		}
		showSettings = false;
	}

	function reportBroken(providerId: string) {
		fetch('/api/streaming/report-broken', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ providerId })
		}).catch(() => {});
	}

	async function autoScan() {
		isAutoScanning = true;
		autoScanFound = null;
		autoScanResults = {};
		autoScanCurrent = '';

		const { providerScoring } = await import('$lib/streaming/provider-scoring');
		const ordered = providerScoring.getOrderedProviders(providers.map((p: Provider) => p.id));
		const scanOrder = [...sortedProviders].sort((a, b) => ordered.indexOf(a.id) - ordered.indexOf(b.id));

		for (const provider of scanOrder) {
			if (autoScanFound) break;

			autoScanCurrent = provider.id;
			ontestProvider?.({ detail: {
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
			}} as any);

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

	function moveProvider(index: number, direction: -1 | 1) {
		const order = [...providerSettings.settings.providerOrder];
		const target = index + direction;
		if (target < 0 || target >= order.length) return;
		[order[index], order[target]] = [order[target], order[index]];
		providerSettings.setProviderOrder(order);
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

	function getProviderScore(id: string): number | null {
		const entry = scoresCache.find(s => s.providerId === id);
		return entry ? entry.score : null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	$effect(() => {
		if (open) {
			loadScores();
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
		role="button"
		tabindex="-1"
		onclick={close}
		transition:fade={{ duration: 200 }}
	></div>

	<!-- Modal -->
	<div
		class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl bg-zinc-900 p-6 shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:top-1/2 md:max-w-md md:-translate-y-1/2 md:rounded-2xl md:m-4"
		transition:fly={{ y: 100, duration: 300 }}
	>
		<!-- Header -->
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<button
					class="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
					onclick={() => { showSettings = false; }}
					title="Back"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
				</button>
				<h2 class="text-lg font-bold text-white">{showSettings ? 'Provider Settings' : 'Choose Media Player'}</h2>
			</div>
			<div class="flex items-center gap-2">
				{#if !showSettings}
					<button
						class="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
						onclick={() => (showSettings = true)}
						title="Provider settings"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
					</button>
				{/if}
				<button
					class="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
					onclick={close}
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		{#if showSettings}
			<!-- Settings Panel -->
			<div class="space-y-4">
				<div class="flex items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-3">
					<span class="text-sm text-zinc-300">Auto-select best provider</span>
					<button
						class="relative h-6 w-11 rounded-full transition {autoSelect ? 'bg-indigo-600' : 'bg-zinc-600'}"
						onclick={() => providerSettings.setAutoSelect(!autoSelect)}
					>
						<div class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition {autoSelect ? 'translate-x-5' : 'translate-x-0'}" />
					</button>
				</div>

				<p class="text-xs text-zinc-500">Drag to reorder providers. Toggle to enable/disable.</p>

				<div class="max-h-[50vh] space-y-1 overflow-y-auto">
					{#each providerSettings.settings.providerOrder as pid, i}
						{@const provider = providers.find(p => p.id === pid)}
						{@const isDisabled = providerSettings.settings.disabledProviders.includes(pid)}
						{@const score = getProviderScore(pid)}
						<div
							class="flex items-center gap-2 rounded-lg px-3 py-2 transition {isDisabled ? 'opacity-40' : 'bg-zinc-800/30'}"
						>
							<div class="flex flex-col gap-0.5">
								<button class="text-zinc-500 hover:text-white disabled:opacity-20" onclick={() => moveProvider(i, -1)} disabled={i === 0}>
									<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" /></svg>
								</button>
								<button class="text-zinc-500 hover:text-white disabled:opacity-20" onclick={() => moveProvider(i, 1)} disabled={i === providerSettings.settings.providerOrder.length - 1}>
									<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
								</button>
							</div>
							<span class="text-lg">{getProviderIcon({ id: pid, name: provider?.name || pid, working: null }) }</span>
							<div class="flex-1">
								<p class="text-sm text-zinc-300">{provider?.name || pid}</p>
								{#if score !== null}
									<p class="text-xs text-zinc-500">Reliability: {Math.round(score * 100)}%</p>
								{/if}
							</div>
							<button
								class="rounded p-1 text-zinc-500 hover:text-white transition"
								onclick={() => providerSettings.toggleProvider(pid)}
							>
								{#if isDisabled}
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
								{:else}
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
								{/if}
							</button>
						</div>
					{/each}
				</div>

				<button
					class="w-full rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
					onclick={() => providerSettings.reset()}
				>
					Reset to defaults
				</button>
			</div>
		{:else}
			<!-- Auto Select Toggle -->
			<div class="mb-3 flex items-center justify-between rounded-lg bg-zinc-800/30 px-3 py-2">
				<span class="text-xs text-zinc-400">Auto-select</span>
				<button
					class="relative h-5 w-9 rounded-full transition {autoSelect ? 'bg-indigo-600' : 'bg-zinc-600'}"
					onclick={() => providerSettings.setAutoSelect(!autoSelect)}
				>
					<div class="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition {autoSelect ? 'translate-x-4' : 'translate-x-0'}" />
				</button>
			</div>

			<!-- Auto Scan Button -->
			<button
				class="mb-4 w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-white font-semibold transition hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
				onclick={autoScan}
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
			<div class="max-h-[50vh] space-y-2 overflow-y-auto">
				{#each sortedProviders as provider (provider.id)}
					<button
						class="w-full rounded-lg border border-zinc-800 bg-zinc-800/50 px-4 py-3 text-left transition hover:border-zinc-600 hover:bg-zinc-800"
						class:border-green-500={autoScanResults[provider.id] === true}
						class:border-red-500={autoScanResults[provider.id] === false}
						class:opacity-50={isAutoScanning && autoScanCurrent === provider.id}
						onclick={() => select(provider.id)}
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
									<button
										class="rounded p-0.5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition"
										onclick={(e) => { e.stopPropagation(); reportBroken(provider.id); }}
										title="Report broken"
									>
										<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
									</button>
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

				{#if Object.values(autoScanResults).filter(Boolean).length === 0 && Object.keys(autoScanResults).length > 0}
					<div class="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
						<p class="text-sm font-medium text-red-400">No working streams found</p>
						<p class="mt-1 text-xs text-red-400/70">All providers failed to load. This may be temporary.</p>
						<button
							class="mt-3 rounded-lg bg-zinc-700 px-4 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-600"
							onclick={autoScan}
						>
							Retry all
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Footer hint -->
		<p class="mt-3 text-center text-xs text-zinc-600">
			Press <kbd class="rounded border border-zinc-700 px-1 text-zinc-500">Esc</kbd> to close
		</p>
	</div>
{/if}