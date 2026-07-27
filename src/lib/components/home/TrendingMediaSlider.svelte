<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import MediaCard from '$lib/components/media/MediaCard.svelte';
	import ScrollRow from '$lib/components/ScrollRow.svelte';
	import type { LibraryMedia } from '$lib/types/library';

	let {
		title,
		movies: items,
		linkTo
	}: {
		title: string;
		movies: LibraryMedia[];
		linkTo?: string;
	} = $props();

	let itemsCount = $derived(items?.length ?? 0);

	function getResolvedPath(path: string | undefined): string {
		if (!path) return '/#';
		return path.startsWith('/') ? path : `/${path}`;
	}
</script>

<div class="px-[10%] py-8">
	{#if linkTo}
		<a
			rel="external"
			href={getResolvedPath(linkTo)}
			data-sveltekit-preload-data="hover"
			class="group mb-6 flex w-full items-center justify-start text-foreground transition-colors duration-300 hover:text-primary"
		>
			<h2 class="text-3xl font-semibold">{title}</h2>
			<div class="ml-2 flex items-center gap-1">
				<span
					class="w-0 overflow-hidden text-sm font-medium transition-all duration-300 group-hover:w-auto"
				>
					See All
				</span>
				<ChevronRight class="size-4 transition-transform duration-300 group-hover:translate-x-1" />
			</div>
		</a>
	{:else}
		<div class="mb-6 flex w-full items-center justify-start">
			<h2 class="text-3xl font-semibold text-foreground">{title}</h2>
		</div>
	{/if}

	<ScrollRow gap="1rem" snap={true}>
		{#snippet children()}
			{#each items as item (item.id)}
				<div class="shrink-0">
					<MediaCard movie={item} />
				</div>
			{/each}
		{/snippet}
	</ScrollRow>
</div>
