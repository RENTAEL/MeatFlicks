<script lang="ts">
	import { browser } from '$app/environment';

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
	let videoEl: HTMLVideoElement | undefined = $state();
	let iframeEl: HTMLIFrameElement | undefined = $state();

	let canHover = $state(false);
	let isNear = $state(true);
	let failed = $state(false);

	let hasHover = $derived(
		browser && window.matchMedia('(hover: hover) and (pointer: fine)').matches
	);

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

	$effect(() => {
		if (!browser) return;
		canHover = hasHover;
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

	const shouldShow = $derived(active && isNear && !failed);

	function start() {
		if (youtubeKey) {
			if (iframeEl && !iframeEl.src) {
				iframeEl.src = `https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&mute=1&loop=1&playlist=${youtubeKey}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1`;
			}
		} else if (isMp4 && videoEl && src) {
			if (videoEl.src !== src) videoEl.src = src;
			videoEl.muted = true;
			videoEl.play().catch(() => {
				failed = true;
			});
		}
	}

	function stop() {
		if (videoEl && isMp4) {
			videoEl.pause();
			videoEl.currentTime = 0;
		}
		if (iframeEl && youtubeKey && iframeEl.src) {
			iframeEl.removeAttribute('src');
		}
	}

	$effect(() => {
		if (shouldShow && src && (youtubeKey || isMp4)) start();
		else stop();
	});
</script>

{#if canHover && (youtubeKey || isMp4)}
	<div
		bind:this={rootEl}
		class="hover-preview absolute inset-0 z-20 pointer-events-none overflow-hidden"
		aria-hidden="true"
	>
		{#if youtubeKey}
			<iframe
				bind:this={iframeEl}
				title={alt}
				class="hover-preview-frame h-full w-full {wrapperClass}"
				style="pointer-events: none;"
				hidden={!shouldShow}
				allow="autoplay; encrypted-media"
				tabindex="-1"
			></iframe>
		{:else if isMp4}
			<video
				bind:this={videoEl}
				class="hover-preview-video h-full w-full object-cover {wrapperClass}"
				preload="none"
				muted
				playsinline
				loop
				hidden={!shouldShow}
				onerror={() => {
					failed = true;
				}}
			></video>
		{/if}
	</div>
{/if}
