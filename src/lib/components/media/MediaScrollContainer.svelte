<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import MediaCard from './MediaCard.svelte';
	import ScrollRow from '$lib/components/ScrollRow.svelte';
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

	<ScrollRow gap="0.75rem" snap={true}>
		{#snippet children()}
			{#each items as item, i (item.id)}
				<div class="shrink-0 snap-start">
					<MediaCard
						movie={item}
						priority={i < 4}
						href={(item as any).resumeHref ?? undefined}
						progressPercent={(item as any).progressPercent ?? null}
						progressLabel={(item as any).progressLabel ?? null}
					/>
				</div>
			{/each}
		{/snippet}
	</ScrollRow>
</div>
