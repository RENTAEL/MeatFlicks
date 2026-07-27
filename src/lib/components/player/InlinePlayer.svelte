<script lang="ts">
	import { X, Maximize, Minimize, AlertCircle, ExternalLink } from '@lucide/svelte';
	import { browser } from '$app/environment';
	import { dev } from '$app/environment';

	let {
		src,
		title,
		onClose,
		compact = false
	}: {
		src: string;
		title: string;
		onClose: (reason?: 'error' | 'user') => void;
		compact?: boolean;
	} = $props();

	let frameRef = $state<HTMLIFrameElement | null>(null);
	let wrapperRef = $state<HTMLDivElement | null>(null);
	let isFullscreen = $state(false);
	let isFakeFs = $state(false);
	let isLoading = $state(true);
	let hasError = $state(false);
	let loadTimeout: ReturnType<typeof setTimeout> | null = null;
	let controlsVisible = $state(true);
	let controlsTimer: ReturnType<typeof setTimeout> | null = null;
	let showOpenNewTab = $state(false);

	function isIOS() {
		return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	}

	function isMobile() {
		return window.innerWidth <= 768;
	}

	/* ─── NATIVE FULLSCREEN EVENTS ─── */
	function onFullscreenChange() {
		const fsEl = (document as any).fullscreenElement ||
			(document as any).webkitFullscreenElement ||
			(document as any).mozFullScreenElement;
		if (!fsEl && isFullscreen && !isFakeFs) {
			isFullscreen = false;
			document.body.style.overflow = '';
		}
	}

	$effect(() => {
		document.addEventListener('fullscreenchange', onFullscreenChange);
		document.addEventListener('webkitfullscreenchange', onFullscreenChange);
		document.addEventListener('mozfullscreenchange', onFullscreenChange);
		return () => {
			document.removeEventListener('fullscreenchange', onFullscreenChange);
			document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
			document.removeEventListener('mozfullscreenchange', onFullscreenChange);
		};
	});

	/* ─── FAKE FULLSCREEN EVENTS ─── */
	$effect(() => {
		if (!isFakeFs) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') exitFullscreen();
		}
		function onPop() { exitFullscreen(); }
		window.addEventListener('keydown', onKey);
		window.addEventListener('popstate', onPop);
		return () => {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('popstate', onPop);
		};
	});

	$effect(() => {
		if (isFakeFs && wrapperRef) {
			wrapperRef.addEventListener('touchstart', handleTouchStart, { passive: true });
			wrapperRef.addEventListener('touchend', handleTouchEnd, { passive: true });
			return () => {
				wrapperRef?.removeEventListener('touchstart', handleTouchStart);
				wrapperRef?.removeEventListener('touchend', handleTouchEnd);
			};
		}
	});

	/* ─── RESIZE / ORIENTATION ─── */
	function handleFsResize() {
		if (!isFakeFs || !wrapperRef) return;
		requestAnimationFrame(() => {
			if (!wrapperRef) return;
			wrapperRef.style.width = '100vw';
			wrapperRef.style.height = '100dvh';
		});
	}

	$effect(() => {
		if (isFakeFs) {
			window.addEventListener('resize', handleFsResize);
			window.addEventListener('orientationchange', handleFsResize);
			if ('visualViewport' in window) {
				(window as any).visualViewport?.addEventListener('resize', handleFsResize);
			}
			return () => {
				window.removeEventListener('resize', handleFsResize);
				window.removeEventListener('orientationchange', handleFsResize);
				if ('visualViewport' in window) {
					(window as any).visualViewport?.removeEventListener('resize', handleFsResize);
				}
			};
		}
	});

	/* ─── ENTER FULLSCREEN (3-TIER) ─── */
	function enterFullscreen() {
		if (!wrapperRef || !frameRef) return;

		if (isIOS()) {
			enterFakeFullscreen();
			return;
		}

		tryTier1();
	}

	function tryTier1() {
		if (!wrapperRef) return;
		try {
			const p = wrapperRef.requestFullscreen();
			if (p) {
				p.then(() => {
					isFullscreen = true;
					isFakeFs = false;
				}).catch(() => {
					enterFakeFullscreen();
				});
			} else {
				isFullscreen = true;
				isFakeFs = false;
			}
		} catch {
			enterFakeFullscreen();
		}
	}

	function enterFakeFullscreen() {
		if (!wrapperRef) return;
		isFullscreen = true;
		isFakeFs = true;
		showOpenNewTab = false;

		Object.assign(wrapperRef.style, {
			position: 'fixed',
			top: '0',
			left: '0',
			right: '0',
			bottom: '0',
			width: '100vw',
			height: '100dvh',
			zIndex: '99999',
			background: '#000',
			margin: '0',
			borderRadius: '0',
			maxWidth: 'none',
			maxHeight: 'none',
			overflow: 'hidden',
			touchAction: 'none',
		});
		wrapperRef.setAttribute('data-fake-fs', 'true');
		document.body.style.overflow = 'hidden';
		document.body.style.position = 'fixed';
		document.body.style.width = '100%';
		if (frameRef) {
			frameRef.style.borderRadius = '0';
			frameRef.style.width = '100%';
			frameRef.style.height = '100%';
		}
		showControls();

		/* push a history state so back button exits fake FS */
		if (browser) {
			window.history.pushState({ fakeFs: true }, '');
		}

		/* show "open in new tab" fallback after 5s if still in fake FS */
		setTimeout(() => {
			if (isFakeFs) showOpenNewTab = true;
		}, 5000);
	}

	function showControls() {
		controlsVisible = true;
		if (controlsTimer) clearTimeout(controlsTimer);
		controlsTimer = setTimeout(() => {
			controlsVisible = false;
		}, 3000);
	}

	function toggleControls() {
		if (controlsVisible) {
			controlsVisible = false;
			if (controlsTimer) clearTimeout(controlsTimer);
		} else {
			showControls();
		}
	}

	/* ─── EXIT FULLSCREEN ─── */
	function exitFullscreen() {
		if (isFakeFs) {
			exitFakeFullscreen();
			return;
		}
		try {
			const method =
				(document as any).exitFullscreen?.bind(document) ||
				(document as any).webkitExitFullscreen?.bind(document) ||
				(document as any).mozCancelFullScreen?.bind(document);
			if (method) method();
		} catch {}
		isFullscreen = false;
		isFakeFs = false;
		document.body.style.overflow = '';
		document.body.style.position = '';
		document.body.style.width = '';
	}

	function exitFakeFullscreen() {
		if (!wrapperRef) return;
		isFullscreen = false;
		isFakeFs = false;
		wrapperRef.removeAttribute('data-fake-fs');
		wrapperRef.style.position = '';
		wrapperRef.style.top = '';
		wrapperRef.style.left = '';
		wrapperRef.style.right = '';
		wrapperRef.style.bottom = '';
		wrapperRef.style.width = '';
		wrapperRef.style.height = '';
		wrapperRef.style.zIndex = '';
		wrapperRef.style.background = '';
		wrapperRef.style.margin = '';
		wrapperRef.style.borderRadius = '';
		wrapperRef.style.maxWidth = '';
		wrapperRef.style.maxHeight = '';
		wrapperRef.style.overflow = '';
		wrapperRef.style.touchAction = '';
		document.body.style.overflow = '';
		document.body.style.position = '';
		document.body.style.width = '';
		if (frameRef) {
			frameRef.style.borderRadius = '';
			frameRef.style.width = '';
			frameRef.style.height = '';
		}
		if (controlsTimer) clearTimeout(controlsTimer);
	}

	/* ─── TIER 3: OPEN IN NEW TAB ─── */
	function openInNewTab() {
		if (src) {
			window.open(src, '_blank', 'noopener,noreferrer');
		}
	}

	/* ─── SWIPE DOWN GESTURE ─── */
	let touchStartY = 0;
	let touchStartX = 0;
	let touchStartTime = 0;

	function handleTouchStart(e: TouchEvent) {
		touchStartY = e.touches[0].clientY;
		touchStartX = e.touches[0].clientX;
		touchStartTime = Date.now();
	}

	function handleTouchEnd(e: TouchEvent) {
		if (!isFakeFs) return;
		const dy = e.changedTouches[0].clientY - touchStartY;
		const dx = Math.abs(e.changedTouches[0].clientX - touchStartX);
		const dt = Date.now() - touchStartTime;
		const velocity = dy / Math.max(dt, 1);
		if (dy > 80 && dx < 60 && velocity > 0.3) {
			exitFullscreen();
		}
	}

	/* ─── IFRAME EVENTS ─── */
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

	function closeWithError() {
		onClose('error');
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

<div
	bind:this={wrapperRef}
	class={compact
		? 'w-full h-full bg-black'
		: 'player-safe fixed inset-0 z-[100] flex items-center justify-center bg-black/90'}
	class:fake-fs={isFakeFs}
	onclick={(e) => {
		if (isFakeFs) { e.stopPropagation(); toggleControls(); }
	}}
>
	<div
		class={compact
			? 'relative w-full h-full max-w-full mx-0 flex flex-col'
			: 'relative w-full max-w-5xl aspect-video mx-4'}
		class:fs-active={isFullscreen}
	>
		<!-- Top controls bar -->
		<div
			class="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 pt-3 pb-8 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300"
			class:opacity-0={isFakeFs && !controlsVisible}
			class:opacity-100={!isFakeFs || controlsVisible}
			onclick={(e) => e.stopPropagation()}
		>
			{#if isFakeFs && title}
				<span class="text-sm font-medium text-white/90 truncate max-w-[60%]">{title}</span>
			{:else}
				<span></span>
			{/if}
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={(e) => { e.stopPropagation(); isFullscreen ? exitFullscreen() : enterFullscreen(); }}
					class="flex items-center justify-center size-9 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-sm bg-black/30"
					aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
					title="Fullscreen"
				>
					{#if isFullscreen}
						<Minimize class="size-4" />
					{:else}
						<Maximize class="size-4" />
					{/if}
				</button>
				<button
					type="button"
					class="flex items-center justify-center size-9 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-sm bg-black/30"
					onclick={(e) => { e.stopPropagation(); if (isFullscreen) exitFullscreen(); onClose('user'); }}
					aria-label="Close player"
				>
					<X class="size-5" />
				</button>
			</div>
		</div>

		{#if isLoading}
			<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
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
					<button type="button" class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90" onclick={retry}>Retry</button>
					<button type="button" class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent" onclick={closeWithError}>Close</button>
				</div>
			</div>
		{/if}

		<!-- Tap overlay to show controls when hidden in fake FS -->
		{#if isFakeFs && !controlsVisible}
			<div
				class="absolute inset-0 z-10"
				onclick={(e) => { e.stopPropagation(); showControls(); }}
				role="button"
				tabindex="-1"
				aria-label="Show controls"
			></div>
		{/if}

		<iframe
			bind:this={frameRef}
			src={src}
			title={title}
			class="h-full w-full"
			class:hidden={hasError}
			class:rounded-lg={!isFullscreen}
			allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
			onload={handleIframeLoad}
			onerror={handleIframeError}
			referrerpolicy="no-referrer"
			sandbox="allow-scripts allow-same-origin" allowfullscreen
			webkit-airplay="allow"
			x-webkit-airplay="allow"
		></iframe>
	</div>
</div>

<!-- Fake FS close button (always visible in fake FS) -->
{#if isFakeFs}
	<button
		class="fake-fs-close"
		class:opacity-0={!controlsVisible}
		class:opacity-100={controlsVisible}
		onclick={(e) => { e.stopPropagation(); exitFullscreen(); }}
		aria-label="Exit fullscreen"
		style="transition: opacity 0.3s ease;"
	>
		<Minimize class="size-5" />
	</button>
{/if}

<!-- Tier 3 fallback -->
{#if isFakeFs && showOpenNewTab}
	<div class="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100001]">
		<button
			class="flex items-center gap-2 px-4 py-3 rounded-full bg-white/10 backdrop-blur-md text-white text-sm font-medium border border-white/20"
			onclick={openInNewTab}
		>
			<ExternalLink class="size-4" />
			Open in browser
		</button>
	</div>
{/if}

<!-- Dev debug indicator -->
{#if dev && isFakeFs}
	<div class="fixed top-2 left-2 z-[100002] px-2 py-1 rounded bg-yellow-500/80 text-black text-[10px] font-bold">
		Fake FS Active — iOS
	</div>
{/if}

<style>
	.fake-fs {
		transition: none !important;
		touch-action: none;
		-webkit-overflow-scrolling: touch;
		-webkit-user-select: none;
		user-select: none;
	}

	.fake-fs iframe {
		object-fit: contain;
	}

	.fs-active {
		aspect-ratio: unset !important;
		max-width: none !important;
		margin: 0 !important;
		width: 100% !important;
		height: 100% !important;
		border-radius: 0 !important;
	}

	.fake-fs-close {
		position: fixed;
		top: 12px;
		right: 12px;
		z-index: 100000;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		border: none;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		animation: fadeIn 200ms ease-out;
		transition: background 0.15s ease, transform 0.15s ease;
	}

	.fake-fs-close:hover {
		background: rgba(255, 255, 255, 0.2);
		transform: scale(1.1);
	}

	.fake-fs-close:active {
		transform: scale(0.95);
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: scale(0.9); }
		to { opacity: 1; transform: scale(1); }
	}
</style>
