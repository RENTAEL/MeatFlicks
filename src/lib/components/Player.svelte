<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let {
		tmdbId,
		type = 'movie' as 'movie' | 'tv',
		season = 1,
		episode = 1,
		title = '',
		imdbId = null as string | null,
		onerror,
		preResolvedSource = null as string | null
	}: {
		tmdbId: number;
		type?: 'movie' | 'tv';
		season?: number;
		episode?: number;
		title?: string;
		imdbId?: string | null;
		onerror?: (detail: { message: string }) => void;
		preResolvedSource?: string | null;
	} = $props();

	interface ScanResult {
		id: string; name: string; movieUrl: string; tvUrl: string | null;
		status: 'working' | 'blocked' | 'dead';
	}

	let isScanning = $state(true);
	let scanError = $state('');
	let allProviders: ScanResult[] = $state([]);
	let workingProviders: ScanResult[] = $derived(allProviders.filter(p => p.status !== 'dead'));
	let currentIndex = $state(0);
	let currentProvider = $derived(workingProviders[currentIndex]);
	let currentUrl = $derived(
		type === 'tv' && currentProvider?.tvUrl
			? currentProvider.tvUrl
			: currentProvider?.movieUrl || ''
	);
	let deadProviders = $derived(allProviders.filter(p => p.status === 'dead'));
	let iframeLoaded = $state(false);
	let hasError = $state(false);
	let showServerList = $state(false);
	let autoSwitchTimer: ReturnType<typeof setTimeout> | null = $state(null);
	let isAutoSwitching = $state(false);
	let loadedProviders = $state<Set<string>>(new Set());

	async function scan() {
		if (preResolvedSource) {
			allProviders = [{
				id: 'youtube',
				name: 'YouTube',
				movieUrl: preResolvedSource,
				tvUrl: null,
				status: 'working',
			}];
			currentIndex = 0;
			isScanning = false;
			return;
		}

		isScanning = true;
		scanError = '';
		loadedProviders = new Set();
		iframeLoaded = false;
		hasError = false;

		try {
			const params = new URLSearchParams({
				tmdbId: tmdbId.toString(),
				type: type,
				season: season.toString(),
				episode: episode.toString()
			});
			if (imdbId) params.set('imdbId', imdbId);
			const res = await fetch(`/api/providers/scan?${params}`);
			if (!res.ok) throw new Error('Scan failed');
			const data = await res.json();
			allProviders = data.all || [];

			if (workingProviders.length === 0) {
				scanError = 'No working providers found';
				isScanning = false;
				return;
			}

			currentIndex = 0;
			startAutoSwitch();
		} catch (e: any) {
			scanError = e.message || 'Scan failed';
		} finally {
			isScanning = false;
		}
	}

	function startAutoSwitch() {
		stopAutoSwitch();
		autoSwitchTimer = setTimeout(() => {
			if (!iframeLoaded && workingProviders.length > 1) {
				isAutoSwitching = true;
				switchToNext();
				setTimeout(() => { isAutoSwitching = false; startAutoSwitch(); }, 500);
			}
		}, 4000);
	}

	function stopAutoSwitch() {
		if (autoSwitchTimer) { clearTimeout(autoSwitchTimer); autoSwitchTimer = null; }
	}

	function switchTo(index: number) {
		stopAutoSwitch();
		iframeLoaded = false;
		hasError = false;
		currentIndex = index;
		startAutoSwitch();
	}

	function switchToNext() {
		const next = (currentIndex + 1) % workingProviders.length;
		if (next !== currentIndex) switchTo(next);
	}

	function onIframeLoad() {
		iframeLoaded = true;
		hasError = false;
		loadedProviders.add(currentProvider?.id || '');
		stopAutoSwitch();
	}

	function onIframeError() {
		hasError = true;
		loadedProviders.delete(currentProvider?.id || '');
		if (workingProviders.length > 1 && !isAutoSwitching) {
			isAutoSwitching = true;
			switchToNext();
			setTimeout(() => { isAutoSwitching = false; startAutoSwitch(); }, 500);
		}
	}

	function retry() {
		scan();
	}

	onMount(() => { if (tmdbId) scan(); });
	$effect(() => { if (tmdbId) scan(); });
	onDestroy(() => { stopAutoSwitch(); });</script>

<div class="player-root">
	<div class="iframe-container">
		{#if isScanning}
			<div class="overlay">
				<div class="spinner"></div>
				<p class="overlay-text">Scanning {allProviders.length || '25'} providers...</p>
			</div>
		{/if}

		{#if scanError && !isScanning}
			<div class="overlay">
				<svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
				<p class="overlay-text">{scanError}</p>
				<button onclick={retry} class="retry-btn">Retry Scan</button>
			</div>
		{/if}

		{#if !iframeLoaded && !isScanning && !scanError && currentProvider}
			<div class="overlay loading-overlay">
				<div class="spinner"></div>
				<p class="overlay-text">Loading via {currentProvider.name}...</p>
				{#if isAutoSwitching}
					<p class="overlay-sub">Auto-switching to next provider...</p>
				{/if}
			</div>
		{/if}

		{#if currentUrl}
			<iframe
				src={currentUrl}
				class="player-iframe"
				allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; gyroscope"
				referrerpolicy="origin"
				title={title || 'Video Player'}
				onload={onIframeLoad}
				onerror={onIframeError}
			></iframe>
		{/if}
	</div>

	<div class="provider-bar">
		<div class="provider-bar-left">
			<span class="dot" class:dot-working={iframeLoaded} class:dot-loading={!iframeLoaded && !isScanning}></span>
			<span class="provider-name">{currentProvider?.name || ''}</span>
			{#if iframeLoaded}
				<span class="badge badge-working">Live</span>
			{/if}
		</div>
		<div class="provider-bar-right">
			{#if workingProviders.length > 0}
				<span class="count">{workingProviders.length} server{workingProviders.length !== 1 ? 's' : ''}</span>
				<button onclick={() => showServerList = !showServerList} class="switch-btn" aria-label="Switch server">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="switch-icon">
						<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
					</svg>
					Switch
				</button>
			{/if}
		</div>
	</div>

	{#if showServerList}
		<div class="server-list">
			<div class="server-list-header">
				<span>Select Server</span>
				<button onclick={() => showServerList = false} class="close-btn" aria-label="Close">&times;</button>
			</div>
			<div class="server-list-body">
				{#each allProviders as p, i}
					{@const isWorking = p.status !== 'dead'}
					{@const isLoaded = loadedProviders.has(p.id)}
					{@const isCurrent = workingProviders.indexOf(p) === currentIndex && isWorking}
					{#if isWorking}
						<button
							onclick={() => { const idx = workingProviders.indexOf(p); if (idx >= 0) { showServerList = false; switchTo(idx); } }}
							class="server-item"
							class:current={isCurrent}
							class:loaded={isLoaded}
						>
							<div class="server-item-left">
								<span class="item-dot" class:dot-working={isLoaded}></span>
								<span>{p.name}</span>
								{#if isCurrent}<span class="current-label">Current</span>{/if}
							</div>
							<span class="server-status" class:working={isLoaded} class:failing={!isLoaded && isCurrent && !isScanning}>
								{isLoaded ? '✓ Working' : isCurrent ? '⟳ Trying...' : 'Ready'}
							</span>
						</button>
					{/if}
				{/each}

				{#if deadProviders.length > 0}
					<div class="dead-section">
						<button onclick={(e) => { const el = e.currentTarget.nextElementSibling as HTMLElement; if (el) el.classList.toggle('hidden'); }} class="dead-toggle">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="dead-chevron"><polyline points="6 9 12 15 18 9"/></svg>
							{deadProviders.length} dead
						</button>
						<div class="dead-list hidden">
							{#each deadProviders as p}
								<div class="dead-item">{p.name}</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
			<div class="server-list-footer">
				<button onclick={retry} class="rescan-btn">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="rescan-icon"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
					Rescan All
				</button>
			</div>
		</div>
	{/if}
</div>

{#if import.meta.env.DEV}
	<div class="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
		<p class="mb-1 text-xs font-medium text-zinc-500">DEBUG</p>
		<p class="text-xs text-zinc-500">Provider: {currentProvider?.name || '-'}</p>
		<p class="text-xs text-zinc-500 truncate">URL: {currentUrl || '-'}</p>
		<p class="text-xs text-zinc-500">Loaded: {iframeLoaded ? 'Yes' : 'No'}</p>
		<p class="text-xs text-zinc-500">Working: {workingProviders.length} / {allProviders.length}</p>
	</div>
{/if}

<style>
	.player-root { display: flex; flex-direction: column; width: 100%; background: #0a0a0b; border-radius: 12px; overflow: hidden; border: 1px solid #1f1f23; }
	.iframe-container { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; }
	.player-iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }
	.overlay { position: absolute; inset: 0; z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: rgba(0,0,0,0.9); backdrop-filter: blur(8px); }
	.loading-overlay { background: rgba(0,0,0,0.75); pointer-events: none; }
	.spinner { width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #818cf8; border-radius: 50%; animation: spin 0.7s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.overlay-text { color: #d4d4d8; font-size: 14px; font-weight: 500; }
	.overlay-sub { color: #71717a; font-size: 12px; }
	.error-icon { width: 36px; height: 36px; color: #f87171; }
	.retry-btn { padding: 8px 20px; background: #27272a; color: #d4d4d8; border: 1px solid #3f3f46; border-radius: 8px; font-size: 13px; cursor: pointer; }
	.retry-btn:hover { background: #3f3f46; }

	.provider-bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #111113; border-top: 1px solid #1f1f23; gap: 12px; flex-wrap: wrap; }
	.provider-bar-left { display: flex; align-items: center; gap: 8px; }
	.provider-name { font-size: 13px; font-weight: 500; color: #e4e4e7; }
	.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
	.dot-working { background: #22c55e; }
	.dot-loading { background: #f59e0b; animation: pulse 1.5s ease-in-out infinite; }
	@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
	.badge { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
	.badge-working { background: #064e3b; color: #6ee7b7; }
	.count { font-size: 11px; color: #71717a; }
	.switch-btn { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: #27272a; color: #d4d4d8; border: 1px solid #3f3f46; border-radius: 6px; font-size: 12px; cursor: pointer; }
	.switch-btn:hover { background: #3f3f46; }
	.switch-icon { width: 14px; height: 14px; }

	.server-list { border-top: 1px solid #1f1f23; background: #0c0c0e; max-height: 360px; overflow-y: auto; }
	.server-list-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 10px; position: sticky; top: 0; background: #0c0c0e; border-bottom: 1px solid #1f1f23; font-size: 13px; font-weight: 600; color: #e4e4e7; }
	.close-btn { background: none; border: none; color: #71717a; font-size: 20px; cursor: pointer; padding: 4px; line-height: 1; }
	.close-btn:hover { color: #e4e4e7; }
	.server-list-body { padding: 6px; }
	.server-item { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 10px 12px; background: none; border: 1px solid transparent; border-radius: 8px; cursor: pointer; text-align: left; color: #e4e4e7; font-size: 13px; }
	.server-item:hover { background: #18181b; }
	.server-item.current { border-color: #3f3f46; background: #18181b; }
	.server-item.loaded { border-color: #064e3b; }
	.server-item-left { display: flex; align-items: center; gap: 10px; }
	.item-dot { width: 8px; height: 8px; border-radius: 50%; background: #3f3f46; flex-shrink: 0; }
	.dot-working { background: #22c55e; }
	.current-label { font-size: 10px; color: #818cf8; margin-left: 6px; font-weight: 600; }
	.server-status { font-size: 11px; font-weight: 500; }
	.server-status.working { color: #4ade80; }
	.server-status.failing { color: #fbbf24; }

	.dead-section { margin-top: 8px; padding: 0 6px; }
	.dead-toggle { display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 12px; background: none; border: none; color: #52525b; font-size: 12px; cursor: pointer; }
	.dead-toggle:hover { color: #a1a1aa; }
	.dead-chevron { width: 14px; height: 14px; }
	.dead-list.hidden { display: none; }
	.dead-item { padding: 6px 20px; font-size: 12px; color: #52525b; }

	.server-list-footer { padding: 10px 14px; border-top: 1px solid #1f1f23; position: sticky; bottom: 0; background: #0c0c0e; }
	.rescan-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 8px 16px; background: #18181b; color: #a1a1aa; border: 1px solid #27272a; border-radius: 8px; font-size: 13px; cursor: pointer; }
	.rescan-btn:hover { background: #27272a; color: #e4e4e7; }
	.rescan-icon { width: 16px; height: 16px; }
</style>
