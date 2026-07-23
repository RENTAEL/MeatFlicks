<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import MediaCard from './MediaCard.svelte';
	import type { LibraryMedia } from '$lib/types/library';

	let {
		title,
		media: items,
		linkTo
	}: {
		title: string;
		media: LibraryMedia[];
		linkTo?: string;
	} = $props();

	let itemsCount = $derived(items?.length ?? 0);

	function getLinkHref(path?: string): string {
		if (!path) return '/';
		if (path.startsWith('/')) return path;
		return `/${path.replace(/^\/+/, '')}`;
	}
</script>

<div class="px-[5%] py-6 sm:px-[10%] sm:py-8">
	<div class="mb-4 flex items-center gap-2 sm:mb-6">
		<h2 class="text-xl font-semibold text-foreground sm:text-3xl">{title}</h2>
		{#if linkTo}
			<a
				rel="external"
				href={getLinkHref(linkTo)}
				data-sveltekit-preload-data="hover"
				class="group flex items-center text-foreground transition-colors duration-300 hover:text-primary"
			>
				<span
					class="text-[11px] font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:text-small"
				>
					See All
				</span>
				<ChevronRight class="size-3 transition-transform duration-300 group-hover:translate-x-1 sm:size-4" />
			</a>
		{/if}
	</div>

	<div
		class="-mx-[5%] flex snap-x snap-mandatory gap-2 overflow-x-auto px-[5%] pb-4 sm:mx-0 sm:gap-4 sm:px-0 md:gap-4"
		style="-webkit-overflow-scrolling: touch; scrollbar-width: none;"
	>
		{#each items as item, i (item.id)}
			<div class="shrink-0 snap-start">
				<MediaCard movie={item} priority={i < 4} />
			</div>
		{/each}
	</div>
</div>

<style>
	div::-webkit-scrollbar { display: none; }
</style>
