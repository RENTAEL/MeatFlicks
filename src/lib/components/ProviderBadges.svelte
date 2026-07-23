<script lang="ts">
	import { onMount } from 'svelte';
	import { providerCache } from '$lib/stores/providerCache.svelte';
	import { providerQueue } from '$lib/utils/providerQueue';

	type WatchProvider = {
		logo_path: string | null;
		provider_id: number;
		provider_name: string;
		display_priority: number;
	};

	let {
		movieId,
		size = 'small',
		showRentBuy = false
	}: {
		movieId: number;
		size?: 'small' | 'large';
		showRentBuy?: boolean;
	} = $props();

	let providers = $state<WatchProvider[] | null>(null);
	let loading = $state(false);

	onMount(() => {
		if (providerCache.has(movieId)) {
			providerCache.get(movieId).then((result) => {
				if (result && result.flatrate.length > 0) {
					providers = result.flatrate;
				} else if (showRentBuy && result && (result.rent.length > 0 || result.buy.length > 0)) {
					providers = [...result.rent, ...result.buy];
				}
			});
			return;
		}
		loading = true;
		providerQueue.enqueue(String(movieId), async () => {
			const result = await providerCache.get(movieId);
			if (result) {
				if (result.flatrate.length > 0) {
					providers = result.flatrate;
				} else if (showRentBuy && (result.rent.length > 0 || result.buy.length > 0)) {
					providers = [...result.rent, ...result.buy];
				}
			}
			loading = false;
		});
	});

	const visibleProviders = $derived(providers ? providers.slice(0, 3) : []);
	const overflowCount = $derived(providers ? Math.max(0, providers.length - 3) : 0);
	const logoSize = $derived(size === 'small' ? 'size-6' : 'size-8');
</script>

{#if loading}
	<div class="flex items-center gap-1">
		<div class="{logoSize} animate-pulse rounded-full bg-muted/40"></div>
		<div class="{logoSize} animate-pulse rounded-full bg-muted/40"></div>
	</div>
{:else if visibleProviders.length > 0}
	<div class="flex items-center gap-1.5">
		{#each visibleProviders as provider}
			<img
				src={provider.logo_path
					? `https://image.tmdb.org/t/p/w45${provider.logo_path}`
					: ''}
				alt={provider.provider_name}
				title={provider.provider_name}
				class="{logoSize} rounded object-contain bg-background/80 shadow-sm"
				loading="lazy"
			/>
		{/each}
		{#if overflowCount > 0}
			<span class="text-xs text-muted-foreground">+{overflowCount} more</span>
		{/if}
	</div>
{/if}
