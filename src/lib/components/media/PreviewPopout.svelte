<script lang="ts">
	import { browser } from '$app/environment';
	import { popoutPreviewStore, closePopout } from '$lib/state/stores/popoutPreviewStore.svelte';

	let videoEl: HTMLVideoElement | undefined = $state();
	let iframeEl: HTMLIFrameElement | undefined = $state();

	let canHover = $state(false);
	let visible = $state(false);
	let entered = $state(false);
	let leaveTimer: ReturnType<typeof setTimeout> | null = null;
	let pos = $state({ left: 0, top: 0, origin: 'top' });

	$effect(() => {
		if (!browser) return;
		canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
	});

	const WIDTH = 400;
	const MARGIN = 12;
	const TITLEBAR = 40;

	const anchorEl = $derived(popoutPreviewStore.anchorEl);
	const title = $derived(popoutPreviewStore.title || 'Preview');
	const src = $derived(popoutPreviewStore.src);

	let youtubeKey = $derived.by(() => {
		if (!src) return null;
		const ytMatch = src.match(
			/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/
		);
		if (ytMatch) return ytMatch[1];
		if (/^[a-zA-Z0-9_-]{11}$/.test(src)) return src;
		return null;
	});

	let isMp4 = $derived(!!src && !youtubeKey && /\.(mp4|webm|ogv|m4v)(\?|#|$)/i.test(src));

	function computePos(el: HTMLElement) {
		const r = el.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const height = Math.round((WIDTH * 9) / 16) + TITLEBAR;
		let top = r.bottom + 10;
		let origin = 'top';
		if (top + height > vh - MARGIN) {
			top = r.top - height - 10;
			origin = 'bottom';
		}
		top = Math.max(MARGIN, Math.min(top, vh - height - MARGIN));
		const left = Math.max(MARGIN, Math.min(r.left + r.width / 2 - WIDTH / 2, vw - WIDTH - MARGIN));
		return { left, top, origin };
	}

	function applyPosition() {
		const el = anchorEl;
		if (!el) return;
		pos = computePos(el);
	}

	function stopMedia() {
		if (videoEl) {
			videoEl.pause();
			videoEl.currentTime = 0;
		}
		if (iframeEl) iframeEl.removeAttribute('src');
	}

	$effect(() => {
		if (!browser || !canHover) return;
		const el = anchorEl;
		const mediaSrc = src;
		if (el && mediaSrc && (youtubeKey || isMp4)) {
			if (leaveTimer) {
				clearTimeout(leaveTimer);
				leaveTimer = null;
			}
			visible = true;
			requestAnimationFrame(() => requestAnimationFrame(() => (entered = true)));
			applyPosition();
			if (youtubeKey) {
				if (!iframeEl || !iframeEl.src.includes(youtubeKey)) {
					if (iframeEl) {
						iframeEl.src = `https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&mute=1&loop=1&playlist=${youtubeKey}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1`;
					}
				}
			} else if (isMp4 && videoEl) {
				if (videoEl.src !== mediaSrc) videoEl.src = mediaSrc;
				videoEl.muted = true;
				videoEl.play().catch(() => {});
			}
			let raf = 0;
			const onScroll = () => {
				if (raf) return;
				raf = requestAnimationFrame(() => {
					raf = 0;
					applyPosition();
				});
			};
			window.addEventListener('scroll', onScroll, true);
			window.addEventListener('resize', onScroll);
			return () => {
				window.removeEventListener('scroll', onScroll, true);
				window.removeEventListener('resize', onScroll);
				if (raf) cancelAnimationFrame(raf);
			};
		} else {
			entered = false;
			stopMedia();
			if (visible) {
				leaveTimer = setTimeout(() => {
					visible = false;
					leaveTimer = null;
				}, 190);
			}
		}
	});
</script>

{#if canHover}
	<div
		class="preview-popout fixed z-[90] pointer-events-none"
		class:entered
		hidden={!visible}
		style="left: {pos.left}px; top: {pos.top}px; width: {WIDTH}px; transform-origin: center {pos.origin};"
		aria-hidden="true"
	>
		{#if youtubeKey || isMp4}
			<div
				class="overflow-hidden rounded-2xl border border-white/10 bg-[#101018] shadow-[0_24px_60px_oklch(0_0_0/0.6)]"
			>
				<div class="truncate px-3 py-2 text-sm font-semibold text-white/90">{title}</div>
				{#if youtubeKey}
					<iframe
						bind:this={iframeEl}
						class="preview-popout-frame block aspect-video w-full"
						style="pointer-events: none;"
						hidden={!entered}
						allow="autoplay; encrypted-media"
						{title}
						tabindex="-1"
					></iframe>
				{:else if isMp4}
					<video
						bind:this={videoEl}
						class="preview-popout-video block aspect-video w-full object-cover"
						preload="none"
						muted
						playsinline
						loop
						hidden={!visible}
						onerror={() => {
							closePopout();
						}}
					></video>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.preview-popout {
		transform: translateY(12px) scale(0.88);
		opacity: 0;
		transition:
			transform 180ms cubic-bezier(0.2, 0.75, 0.3, 1),
			opacity 180ms ease-out;
	}
	.preview-popout.entered {
		transform: translateY(0) scale(1);
		opacity: 1;
	}
</style>
