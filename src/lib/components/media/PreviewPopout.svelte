<script lang="ts">
	import { popoutPreviewStore } from '$lib/state/stores/previewStore.svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { Star } from '@lucide/svelte';

	let rect = $state({ top: 0, left: 0, width: 0, height: 0 });

	$effect(() => {
		if (popoutPreviewStore.anchorEl && browser) {
			const r = popoutPreviewStore.anchorEl.getBoundingClientRect();
			rect = {
				top: r.top,
				left: r.left,
				width: r.width,
				height: r.height
			};
		}
	});

	const isOpen = $derived(popoutPreviewStore.anchorEl !== null);
</script>

{#if isOpen}
	<div
		transition:fade={{ duration: 200 }}
		class="fixed inset-0 z-[100] pointer-events-none flex items-start justify-start"
	>
		<div
			transition:fly={{ y: 10, duration: 300 }}
			class="absolute pointer-events-auto overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/20"
			style="
				top: {Math.max(10, rect.top - 20)}px;
				left: {Math.max(10, rect.left)}px;
				width: {Math.min(window?.innerWidth ?? 1280 - 20, 320)}px;
				height: {Math.min(window?.innerHeight ?? 800 - 20, 180)}px;
			"
		>
			{#if popoutPreviewStore.src}
				<video
					src={popoutPreviewStore.src}
					autoplay
					muted
					loop
					playsinline
					class="h-full w-full object-cover opacity-80"
				/>
			{/if}

			<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
			
			<div class="absolute bottom-0 left-0 right-0 p-4">
				<h4 class="text-lg font-bold text-white truncate drop-shadow-lg">
					{popoutPreviewStore.title}
				</h4>
				
				<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/80">
					{#if popoutPreviewStore.rating}
						<span class="flex items-center gap-1">
							<Star class="size-3 text-yellow-400" fill="currentColor" />
							{popoutPreviewStore.rating}
						</span>
					{/if}
					{#if popoutPreviewStore.year}
						<span>{popoutPreviewStore.year}</span>
					{/if}
					{#if popoutPreviewStore.genres.length > 0}
						<span class="truncate max-w-[180px]">{popoutPreviewStore.genres.slice(0, 3).join(' · ')}</span>
					{/if}
				</div>

				{#if popoutPreviewStore.overview}
					<p class="mt-2 text-xs leading-relaxed text-white/70 line-clamp-2">
						{popoutPreviewStore.overview}
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
