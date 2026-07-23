<script lang="ts">
	import { X, ExternalLink } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	let {
		src,
		title,
		onClose
	}: {
		src: string;
		title: string;
		onClose: () => void;
	} = $props();

	let frameRef = $state<HTMLIFrameElement | null>(null);
	let isLoading = $state(true);

	function handleIframeLoad() {
		isLoading = false;
	}
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90">
	<div class="relative w-full max-w-5xl aspect-video mx-4">
		<div class="absolute -top-10 right-0 flex items-center gap-2 z-10">
			<span class="text-sm text-white/70 truncate max-w-[300px]">{title}</span>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				class="text-white/70 hover:text-white hover:bg-white/10"
				onclick={onClose}
				aria-label="Close player"
			>
				<X class="size-5" />
			</Button>
		</div>

		{#if isLoading}
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="shimmer size-12 rounded-full"></div>
			</div>
		{/if}

		<iframe
			bind:this={frameRef}
			src={src}
			title={title}
			class="h-full w-full rounded-lg"
			allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
			allowfullscreen
			onload={handleIframeLoad}
			sandbox="allow-same-origin allow-scripts allow-forms allow-presentation allow-popups"
		></iframe>
	</div>
</div>
