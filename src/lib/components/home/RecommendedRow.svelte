<script lang="ts">
	import MediaScrollContainer from '$lib/components/media/MediaScrollContainer.svelte';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { LibraryMovie } from '$lib/types/library';

	let recommendedMedia = $state<LibraryMovie[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		if (!page.data.user) {
			isLoading = false;
			return;
		}

		try {
			const res = await fetch('/api/recommendations', { credentials: 'include' });
			if (!res.ok) throw new Error(res.statusText);

			const data = (await res.json()) as { media: LibraryMovie[] };
			recommendedMedia = data.media ?? [];
		} catch (error) {
			console.error('[RecommendedRow] Failed to fetch:', error);
		} finally {
			isLoading = false;
		}
	});
</script>

{#if !isLoading && recommendedMedia.length > 0}
	<MediaScrollContainer title="Recommended For You" media={recommendedMedia} />
{/if}
