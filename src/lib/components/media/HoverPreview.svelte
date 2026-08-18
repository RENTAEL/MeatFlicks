<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { openPopout, closePopout } from '$lib/state/stores/popoutPreviewStore.svelte';

	let {
		src,
		alt = 'Preview',
		active = false,
		class: wrapperClass = ''
	}: {
		src?: string | null;
		alt?: string;
		active?: boolean;
		class?: string;
	} = $props();

	let rootEl = $state<HTMLElement | null>(null);

	let canHover = $state(false);
	let isNear = $state(true);

	$effect(() => {
		if (!browser) return;
		canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
	});

	let hasSrc = $derived.by(() => {
		if (!src) return false;
		const ytMatch = src.match(
			/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/
		);
		if (ytMatch) return true;
		if (/^[a-zA-Z0-9_-]{11}$/.test(src)) return true;
		return /\.(mp4|webm|ogv|m4v)(\?|#|$)/i.test(src);
	});

	let io: IntersectionObserver | null = null;
	$effect(() => {
		if (!browser || !canHover) return;
		const el = rootEl;
		if (!el) return;
		io = new IntersectionObserver(
			(entries) => {
				isNear = entries[0]?.isIntersecting ?? true;
			},
			{ rootMargin: '150px' }
		);
		io.observe(el);
		return () => {
			io?.disconnect();
			io = null;
		};
	});

	$effect(() => {
		if (active && isNear && hasSrc && canHover && rootEl && src) {
			openPopout(rootEl, src, alt.replace(/\s*Trailer$/i, ''));
		} else {
			closePopout();
		}
	});

	onDestroy(() => {
		closePopout();
	});
</script>

{#if canHover && hasSrc}
	<div
		bind:this={rootEl}
		class="hover-preview pointer-events-none absolute inset-0 {wrapperClass}"
		aria-hidden="true"
	></div>
{/if}
