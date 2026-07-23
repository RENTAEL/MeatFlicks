<script lang="ts">
	import { X, AlertCircle } from '@lucide/svelte';
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
	let hasError = $state(false);
	let loadTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleIframeLoad() {
		isLoading = false;
		hasError = false;
		if (loadTimeout) clearTimeout(loadTimeout);
	}

	function handleIframeError() {
		isLoading = false;
		hasError = true;
		if (loadTimeout) clearTimeout(loadTimeout);
	}

	function retry() {
		isLoading = true;
		hasError = false;
		if (frameRef) {
			const currentSrc = src;
			frameRef.src = '';
			requestAnimationFrame(() => {
				frameRef!.src = currentSrc;
			});
		}
	}

	$effect(() => {
		if (src) {
			isLoading = true;
			hasError = false;
			if (loadTimeout) clearTimeout(loadTimeout);
			loadTimeout = setTimeout(() => {
				if (isLoading) {
					hasError = true;
					isLoading = false;
				}
			}, 15000);
		}
		return () => {
			if (loadTimeout) clearTimeout(loadTimeout);
		};
	});
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

		{#if hasError}
			<div class="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-card p-6 text-center">
				<AlertCircle class="size-12 text-destructive" />
				<p class="text-lg font-semibold text-foreground">Couldn't load this video</p>
				<p class="max-w-md text-sm text-muted-foreground">
					The embed provider may be unavailable. Try selecting a different source from the provider list.
				</p>
				<div class="flex gap-3">
					<Button type="button" variant="default" onclick={retry}>
						Retry
					</Button>
					<Button type="button" variant="outline" onclick={onClose}>
						Close
					</Button>
				</div>
			</div>
		{/if}

		<iframe
			bind:this={frameRef}
			src={src}
			title={title}
			class="h-full w-full rounded-lg"
			class:hidden={hasError}
			allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
			onload={handleIframeLoad}
			onerror={handleIframeError}
			referrerpolicy="no-referrer-when-downgrade"
		></iframe>
	</div>
</div>
