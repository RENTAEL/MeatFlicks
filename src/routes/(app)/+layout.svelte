<script lang="ts">
	import '../../app.css';

	import { page } from '$app/stores';
	import PresencePing from '$lib/components/PresencePing.svelte';
	import TopNav from '$lib/components/navigation/TopNav.svelte';
	import BottomNav from '$lib/components/mobile/BottomNav.svelte';
	import MobileHeader from '$lib/components/mobile/MobileHeader.svelte';
	import Footer from '$lib/components/navigation/Footer.svelte';
	import MediaDetailSheet from '$lib/components/media/MediaDetailSheet.svelte';
	import PreviewPopout from '$lib/components/media/PreviewPopout.svelte';
	import GlobalErrorDisplay from '$lib/components/global/GlobalErrorDisplay.svelte';
	import { NotificationPortal } from '$lib/components/global';
	import SearchOverlay from '$lib/components/SearchOverlay.svelte';
	import { OfflineIndicator } from '$lib/components/ui';
	import ThemeContext from '$lib/state/contexts/ThemeContext.svelte';
	import WatchlistContext from '$lib/state/contexts/WatchlistContext.svelte';
	import ErrorContext from '$lib/state/contexts/ErrorContext.svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { setupCloudSync } from '$lib/firebase/sync';
	import { menuOpen } from '$lib/stores/menu';
	import { authStore } from '$lib/state/stores/authStore.svelte.ts';
	import PreviewSwitcher from '$lib/components/branding/PreviewSwitcher.svelte';
	import ImpersonationBanner from '$lib/components/ImpersonationBanner.svelte';
	import User2Global from '$lib/experiments/user2/User2Global.svelte';
	import SurpriseMe from '$lib/experiments/user2/SurpriseMe.svelte';
	import UblockPopup from '$lib/components/UblockPopup.svelte';
	import AdblockerIntroPopup from '$lib/components/AdblockerIntroPopup.svelte';
	import MobileBrowserPopup from '$lib/components/MobileBrowserPopup.svelte';
	import PrivateTabModal from '$lib/components/PrivateTabModal.svelte';
	import UserFab from '$lib/components/UserFab.svelte';
	import DeveloperBadge from '$lib/components/DeveloperBadge.svelte';
	import SuneLoading from '$lib/components/branding/SuneLoading.svelte';

	// Fewer ambient particles on small screens — heavy blurred layers over
	// video cost frames on low-end phones.
	let particleCount = $state(20);
	// Ambient animations freeze entirely while a video is playing so the
	// decoder never competes for frames.
	let videoLive = $state(false);
	let suneLoading = $state(true);
	onMount(() => {
		const mq = window.matchMedia('(max-width: 768px)');
		const apply = () => (particleCount = mq.matches ? 8 : 20);
		apply();
		mq.addEventListener('change', apply);
		const onPlayback = (e: Event) => {
			videoLive = Boolean((e as CustomEvent).detail?.playing);
		};
		window.addEventListener('streamium-playback', onPlayback);
		const t = setTimeout(() => (suneLoading = false), 900);
		return () => {
			mq.removeEventListener('change', apply);
			window.removeEventListener('streamium-playback', onPlayback);
			clearTimeout(t);
		};
	});

	const suneLoadingVisible = $derived.by(() => {
		if (!suneLoading) return false;
		if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-branding') === 'sune') return true;
		// Also check effective user directly as fallback
		const u = $page.data?.user;
		if (!u) return false;
		const imp = typeof localStorage !== 'undefined' ? localStorage.getItem('impersonated_user') : null;
		if (imp) {
			try {
				const p = JSON.parse(imp);
				if (p?.username?.toLowerCase() === 'sune') return true;
			} catch {}
		}
		return u.username?.toLowerCase() === 'sune';
	});

	onMount(() => {
		void (async () => {
			try {
				const { initAdBlocker } = await import('$lib/utils/adBlocker.js');
				initAdBlocker();
			} catch {}
		})();
		const cleanup = setupCloudSync();

		// Version check: detect a new deployment and reload. Runs once on load
		// and whenever the tab becomes visible again (e.g. after a deploy) —
		// no continuous polling. Skipped in dev, where /_app/version.json
		// doesn't exist (avoids a 404 in the console on every tick).
		if (!import.meta.env.DEV) {
			const checkVersion = async () => {
				try {
					const res = await fetch('/_app/version.json', { cache: 'no-cache' });
					if (res.ok) {
						const { version } = await res.json();
						const current = localStorage.getItem('app-version');
						if (current && current !== version) {
							localStorage.removeItem('app-version');
							window.location.reload();
						}
						localStorage.setItem('app-version', version);
					}
				} catch {}
			};

			checkVersion();
			const onVisible = () => {
				if (!document.hidden) checkVersion();
			};
			document.addEventListener('visibilitychange', onVisible);
			return () => {
				document.removeEventListener('visibilitychange', onVisible);
				cleanup();
			};
		}

		return () => cleanup();
	});
</script>

<svelte:head>
	<title>Streamium — Premium Streaming</title>
	<meta
		name="description"
		content="Movies, TV series, and Afrikaans content — ad-free, buffer-free, hassle-free."
	/>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link
		href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{#if $page.data?.user}
	<PresencePing />
{/if}

<ImpersonationBanner />
<User2Global />
<SurpriseMe />

<!-- Ambient background — frozen while video plays (class toggled by the
     player's playback reporter) -->
<div class="bg-ambient" class:ambient-frozen={videoLive}>
	<div class="bg-gradient-top"></div>
	<div class="bg-noise"></div>
</div>

<!-- Demon Slayer custom background for aftermidnight — gated to demon_slayer theme -->
<div class="demon-slayer-bg" class:ambient-frozen={videoLive} aria-hidden="true">
	<div class="demon-slayer-bg-overlay"></div>
</div>

	<!-- Sune custom background for the Rose Court — gated to sune theme -->
	<div class="sune-bg" class:ambient-frozen={videoLive} aria-hidden="true">
		<div class="sune-bg-image" aria-hidden="true"></div>
		<div class="sune-bg-vignette" aria-hidden="true"></div>
		<div class="sune-bg-gradient" aria-hidden="true"></div>
		<div class="sune-bg-overlay"></div>
	</div>

	<!-- Premium immersive backgrounds — each brand gets Sune-level polish, gated by data-branding -->
	<div class="sofia-bg" aria-hidden="true"><div class="sofia-bg-overlay"></div></div>
	<div class="midnight-bg" aria-hidden="true"><div class="midnight-bg-overlay"></div></div>
	<div class="midnight-neon-bg" aria-hidden="true"><div class="midnight-neon-bg-overlay"></div></div>
	<div class="custom-bg" aria-hidden="true"><div class="custom-bg-overlay"></div></div>
	<div class="amber-bg" aria-hidden="true"><div class="amber-bg-overlay"></div></div>
	<div class="peruser-bg" aria-hidden="true"><div class="peruser-bg-overlay"></div></div>

	{#if suneLoadingVisible}
		<SuneLoading progress={100} />
	{/if}

<ModeWatcher defaultMode="dark" themeColors={{ dark: '#0a0a1a', light: '#0a0a1a' }} />
<ThemeContext>
	<WatchlistContext>
		<ErrorContext>
			<TopNav />
			<div
				class="relative flex min-h-dvh-fallback flex-col text-foreground"
				data-sveltekit-preload-data="hover"
			>
				<div
					class="pointer-events-none fixed inset-0 z-0 overflow-hidden"
					class:ambient-frozen={videoLive}
				>
					{#each Array.from({ length: particleCount }) as _, i}
						<div
							class="absolute animate-float-up"
							style="
									left: {Math.random() * 100}%;
									width: {2 + Math.random() * 4}px;
									height: {2 + Math.random() * 4}px;
									animation-duration: {10 + Math.random() * 20}s;
									animation-delay: {Math.random() * 15}s;
									background: radial-gradient(circle, oklch({0.7 + Math.random() * 0.3} {0.1 +
								Math.random() * 0.15} {280 + Math.random() * 50}) 0%, transparent 100%);
									border-radius: 50%;
									opacity: {0.3 + Math.random() * 0.5};
								"
						></div>
					{/each}
				</div>
				<div
					class="relative z-10 flex-1"
					style="padding-top: var(--header-height); padding-bottom: var(--content-pb, max(4rem, calc(env(safe-area-inset-bottom, 20px) + 0.5rem)));"
				>
					<div class="page-transition">
						<slot />
					</div>
				</div>
				<BottomNav />
				<MobileHeader />
				<Footer class="relative z-10 hidden md:block" />
			</div>
			<GlobalErrorDisplay />
			<NotificationPortal />
			<OfflineIndicator />
			<UserFab />
			<DeveloperBadge />
			<MediaDetailSheet />
		</ErrorContext>
	</WatchlistContext>
</ThemeContext>

<SearchOverlay />

<UblockPopup />

<AdblockerIntroPopup isLoggedIn={!!$page.data?.user} />

<MobileBrowserPopup />

<PrivateTabModal />

<PreviewPopout />

{#if $menuOpen}
	<div
		class="menu-backdrop"
		onclick={() => menuOpen.set(false)}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
				e.preventDefault();
				menuOpen.set(false);
			}
		}}
		role="button"
		tabindex="-1"
		aria-label="Close menu"
		transition:fade={{ duration: 150 }}
	></div>

	<aside class="menu-drawer" transition:fly={{ x: -280, duration: 250 }}>
		<div class="menu-header">
			<h2 class="menu-title">Menu</h2>
			<button class="menu-close" onclick={() => menuOpen.set(false)} aria-label="Close menu">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>

		<nav class="menu-nav">
			<a href="/" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline
						points="9 22 9 12 15 12 15 22"
					/></svg
				>
				Home
			</a>
			<a href="/movies" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line
						x1="7"
						y1="2"
						x2="7"
						y2="22"
					/><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /></svg
				>
				Movies
			</a>
			<a href="/tv" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><rect x="2" y="7" width="20" height="15" rx="2" ry="2" /><polyline
						points="17 2 12 7 7 2"
					/></svg
				>
				TV Shows
			</a>
			<a href="/afrikaans" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg
				>
				Afrikaans
			</a>
			<a href="/watchlist" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg
				>
				My List
			</a>
			<div class="menu-divider"></div>
			<a href="/search" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg
				>
				Search
			</a>
			<a href="/history" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg
				>
				History
			</a>
			{#if $page.data.user?.role === 'ADMIN'}
				<a href="/admin" class="menu-item" onclick={() => menuOpen.set(false)}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><circle cx="12" cy="12" r="3" /><path
							d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c0 .66.39 1.26 1 1.51zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"
						/></svg
					>
					Admin Console
				</a>
			{/if}
			<PreviewSwitcher variant="mobile" />
			{#if authStore.state.user}
				<a href="/profile" class="menu-item" onclick={() => menuOpen.set(false)}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle
							cx="12"
							cy="7"
							r="4"
						/></svg
					>
					Profile
				</a>
				<button
					class="menu-item menu-logout"
					onclick={() => {
						authStore.logout();
						menuOpen.set(false);
					}}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline
							points="16 17 21 12 16 7"
						/><line x1="21" y1="12" x2="9" y2="12" /></svg
					>
					Sign Out
				</button>
			{:else}
				<a href="/login" class="menu-item menu-login" onclick={() => menuOpen.set(false)}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline
							points="10 17 15 12 10 7"
						/><line x1="15" y1="12" x2="3" y2="12" /></svg
					>
					Sign In
				</a>
			{/if}
		</nav>
	</aside>
{/if}

<style>
	.bg-ambient {
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
	}

	/* Video is live — freeze every ambient animation so the decoder on
	 * low-end phones gets all the frames. */
	:global(.ambient-frozen),
	:global(.ambient-frozen *) {
		animation-play-state: paused !important;
	}

	.bg-gradient-top {
		position: absolute;
		top: -40%;
		left: 50%;
		transform: translateX(-50%);
		width: 1200px;
		height: 800px;
		background: radial-gradient(
			ellipse at center,
			rgba(124, 92, 252, 0.06) 0%,
			rgba(201, 75, 140, 0.03) 40%,
			transparent 70%
		);
		border-radius: 50%;
		filter: blur(80px);
	}

	.bg-noise {
		position: absolute;
		inset: 0;
		opacity: 0.015;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
	}

	/* Demon Slayer custom background — aftermidnight only, reversible via data-theme */
	.demon-slayer-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background-image: url('/demon-slayer-aftermidnight.jpg');
		background-size: cover;
		background-position: center 32%;
		background-repeat: no-repeat;
		image-rendering: -webkit-optimize-contrast;
		image-rendering: high-quality;
		opacity: 0;
		transition: opacity 0.6s ease;
		will-change: opacity;
		/* Keep image clear and sharp — light touch, not heavy wash. Pixelation hidden by overlay, not blur. */
		filter: brightness(0.94) saturate(1.04) contrast(1.04);
	}

	:global([data-theme='demon_slayer']) .demon-slayer-bg {
		opacity: 1;
	}

	.demon-slayer-bg-overlay {
		position: absolute;
		inset: 0;
		/* Designed, readable, cohesive — vignette + theme-tinted gradients, center stays clear */
		background:
			radial-gradient(
				ellipse 92% 78% at 50% 36%,
				rgba(255, 255, 255, 0) 0%,
				rgba(255, 255, 255, 0) 46%,
				rgba(5, 5, 8, 0.32) 74%,
				rgba(5, 5, 8, 0.78) 100%
			),
			linear-gradient(
				180deg,
				rgba(5, 5, 8, 0.38) 0%,
				rgba(5, 5, 8, 0.22) 30%,
				rgba(5, 5, 8, 0.52) 68%,
				rgba(5, 5, 8, 0.86) 100%
			),
			radial-gradient(ellipse 88% 52% at 50% 10%, rgba(255, 42, 18, 0.08) 0%, transparent 60%),
			radial-gradient(ellipse 62% 42% at 88% 90%, rgba(255, 107, 0, 0.06) 0%, transparent 56%);
	}

	/* Content elevation on demon theme — cards read as "on top of" background */
	:global([data-theme='demon_slayer'] .glass),
	:global([data-theme='demon_slayer'] .bg-card) {
		background: rgba(15, 10, 18, 0.82) !important;
		backdrop-filter: blur(12px) saturate(1.08);
		-webkit-backdrop-filter: blur(12px) saturate(1.08);
		border-color: rgba(255, 26, 26, 0.16) !important;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.38),
			0 0 0 1px rgba(255, 26, 26, 0.07);
	}

	/* Sune — Rose Court full-bleed background, only when data-theme='sune' (Sune account) */
	.sune-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.6s ease;
		will-change: opacity;
		overflow: hidden;
	}

	:global([data-theme='sune']) .sune-bg,
	:global([data-branding='sune']) .sune-bg {
		opacity: 1;
	}

	.sune-bg-image {
		position: absolute;
		inset: -4%;
		background-image: url('/personal/sune-roses.jpg');
		background-size: cover;
		background-position: center 42%;
		background-repeat: no-repeat;
		image-rendering: -webkit-optimize-contrast;
		image-rendering: high-quality;
		filter: brightness(0.92) saturate(1.04) contrast(1.02);
		will-change: transform;
		animation: suneKenBurns 48s ease-in-out infinite alternate;
	}

	.sune-bg-vignette {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse 92% 78% at 50% 36%, transparent 52%, rgba(8, 6, 9, 0.18) 78%, rgba(8, 6, 9, 0.72) 100%);
		pointer-events: none;
	}

	.sune-bg-gradient {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(142, 29, 46, 0.14) 0%, rgba(142, 29, 46, 0.06) 38%, transparent 58%, rgba(8, 6, 9, 0.55) 100%);
		opacity: 0.9;
		mix-blend-mode: soft-light;
		animation: suneGradientShift 22s ease-in-out infinite alternate;
		will-change: opacity, transform;
		pointer-events: none;
	}

	@keyframes suneKenBurns {
		0% {
			transform: scale(1) translate(0, 0);
		}
		100% {
			transform: scale(1.08) translate(-1.2%, 0.8%);
		}
	}

	@keyframes suneGradientShift {
		0% {
			opacity: 0.75;
			transform: translateY(0);
		}
		50% {
			opacity: 0.9;
		}
		100% {
			opacity: 0.85;
			transform: translateY(-1.5%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sune-bg-image,
		.sune-bg-gradient {
			animation: none !important;
		}
	}

	/* Premium — every brand gets Sune-level polish, gated by data-branding */
	.sofia-bg,
	.midnight-bg,
	.midnight-neon-bg,
	.custom-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.6s ease;
		will-change: opacity;
	}

	:global([data-branding='sofia']) .sofia-bg,
	:global([data-branding='midnight']) .midnight-bg,
	:global([data-branding='midnight_neon']) .midnight-neon-bg,
	:global([data-branding='custom']) .custom-bg,
	:global([data-branding='demon_slayer']) .demon-slayer-bg {
		opacity: 1;
	}

	.sune-bg-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				ellipse 96% 82% at 50% 36%,
				rgba(255, 255, 255, 0) 0%,
				rgba(255, 255, 255, 0) 52%,
				rgba(8, 6, 9, 0.28) 78%,
				rgba(8, 6, 9, 0.72) 100%
			),
			linear-gradient(
				180deg,
				rgba(8, 6, 9, 0.28) 0%,
				rgba(8, 6, 9, 0.14) 28%,
				rgba(8, 6, 9, 0.46) 68%,
				rgba(8, 6, 9, 0.84) 100%
			),
			radial-gradient(ellipse 92% 54% at 50% 6%, rgba(212, 175, 55, 0.06) 0%, transparent 60%),
			radial-gradient(ellipse 70% 44% at 86% 94%, rgba(142, 29, 46, 0.08) 0%, transparent 58%);
	}

	:global([data-theme='sune'] .glass),
	:global([data-theme='sune'] .bg-card) {
		background: rgba(20, 13, 18, 0.8) !important;
		backdrop-filter: blur(12px) saturate(1.05);
		-webkit-backdrop-filter: blur(12px) saturate(1.05);
		border-color: rgba(212, 175, 55, 0.18) !important;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.4),
			0 0 0 1px rgba(212, 175, 55, 0.08);
	}

	:global([data-theme='sune']) .header {
		border-bottom-color: rgba(212, 175, 55, 0.2) !important;
		box-shadow: 0 0 24px rgba(212, 175, 55, 0.05);
	}

	@media (max-width: 768px) {
		.sune-bg {
			background-position: center 30%;
			filter: brightness(0.96) saturate(1.05) contrast(1.02);
		}
		.sune-bg-overlay {
			background:
				radial-gradient(
					ellipse 120% 70% at 50% 26%,
					rgba(255, 255, 255, 0) 0%,
					rgba(255, 255, 255, 0) 46%,
					rgba(8, 6, 9, 0.34) 76%,
					rgba(8, 6, 9, 0.82) 100%
				),
				linear-gradient(180deg, rgba(8, 6, 9, 0.32) 0%, rgba(8, 6, 9, 0.6) 100%),
				radial-gradient(ellipse 90% 40% at 50% 4%, rgba(212, 175, 55, 0.07) 0%, transparent 60%);
		}
	}

	/* Sofia — Enchancia: royal plum + amulet violet + crown gold */
	.sofia-bg {
		background:
			radial-gradient(ellipse 90% 60% at 20% 20%, rgba(200, 168, 255, 0.14) 0%, transparent 60%),
			radial-gradient(ellipse 70% 50% at 80% 80%, rgba(252, 211, 77, 0.08) 0%, transparent 60%),
			linear-gradient(180deg, #150c22 0%, #1e1233 60%, #0a0a0f 100%);
	}
	.sofia-bg-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 96% 82% at 50% 36%, transparent 52%, rgba(21, 12, 34, 0.28) 78%, rgba(10, 10, 18, 0.72) 100%),
			linear-gradient(180deg, rgba(21, 12, 34, 0.18) 0%, transparent 40%, rgba(10, 10, 18, 0.5) 100%),
			radial-gradient(ellipse 92% 54% at 50% 6%, rgba(200, 168, 255, 0.07) 0%, transparent 60%);
	}

	/* Midnight — deep starfield */
	.midnight-bg {
		background:
			radial-gradient(ellipse 80% 60% at 50% 30%, rgba(124, 92, 252, 0.08) 0%, transparent 60%),
			linear-gradient(180deg, #070711 0%, #0a0a12 60%, #050508 100%);
	}
	.midnight-bg-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 96% 82% at 50% 36%, transparent 52%, rgba(5, 5, 12, 0.28) 78%, rgba(5, 5, 12, 0.72) 100%),
			linear-gradient(180deg, rgba(5, 5, 12, 0.14) 0%, transparent 40%, rgba(5, 5, 12, 0.5) 100%);
	}

	/* Midnight Neon — city neon */
	.midnight-neon-bg {
		background:
			radial-gradient(ellipse 90% 60% at 20% 30%, rgba(168, 85, 247, 0.14) 0%, transparent 60%),
			radial-gradient(ellipse 70% 50% at 80% 70%, rgba(6, 182, 212, 0.1) 0%, transparent 60%),
			linear-gradient(180deg, #070711 0%, #0f0a1a 60%, #050508 100%);
	}
	.midnight-neon-bg-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 96% 82% at 50% 36%, transparent 52%, rgba(7, 7, 17, 0.28) 78%, rgba(7, 7, 17, 0.72) 100%),
			linear-gradient(180deg, rgba(7, 7, 17, 0.14) 0%, transparent 40%, rgba(7, 7, 17, 0.5) 100%),
			radial-gradient(ellipse 92% 54% at 80% 20%, rgba(168, 85, 247, 0.06) 0%, transparent 60%),
			radial-gradient(ellipse 70% 44% at 20% 80%, rgba(6, 182, 212, 0.06) 0%, transparent 58%);
	}

	/* Custom — refined neutral */
	.custom-bg {
		background:
			radial-gradient(ellipse 80% 60% at 50% 20%, rgba(212, 175, 55, 0.06) 0%, transparent 60%),
			linear-gradient(180deg, #0a0a0f 0%, #111118 100%);
	}
	.custom-bg-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 96% 82% at 50% 36%, transparent 52%, rgba(10, 10, 15, 0.28) 78%, rgba(10, 10, 15, 0.72) 100%),
			linear-gradient(180deg, rgba(10, 10, 15, 0.14) 0%, transparent 40%, rgba(10, 10, 15, 0.5) 100%);
	}

	/* Amber — warm ember */
	.amber-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.6s ease;
		will-change: opacity;
		background:
			radial-gradient(ellipse 90% 60% at 20% 20%, rgba(245, 158, 11, 0.14) 0%, transparent 60%),
			radial-gradient(ellipse 70% 50% at 80% 80%, rgba(234, 88, 12, 0.08) 0%, transparent 60%),
			linear-gradient(180deg, #1a1408 0%, #241a0c 60%, #0a0a0f 100%);
	}
	.amber-bg-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 96% 82% at 50% 36%, transparent 52%, rgba(26, 20, 8, 0.28) 78%, rgba(10, 10, 15, 0.72) 100%),
			linear-gradient(180deg, rgba(26, 20, 8, 0.18) 0%, transparent 40%, rgba(10, 10, 15, 0.5) 100%);
	}
	:global([data-theme='amber']) .amber-bg,
	:global([data-branding='amber']) .amber-bg {
		opacity: 1;
	}

	/* Per-user generated — uses theme accent via CSS variables */
	.peruser-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.6s ease;
		will-change: opacity;
		background:
			radial-gradient(ellipse 90% 60% at 20% 20%, var(--accent-glow) 0%, transparent 60%),
			linear-gradient(180deg, var(--bg) 0%, var(--bg-card) 100%);
	}
	.peruser-bg-overlay {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse 96% 82% at 50% 36%, transparent 52%, rgba(0, 0, 0, 0.28) 78%, rgba(0, 0, 0, 0.72) 100%),
			linear-gradient(180deg, rgba(0, 0, 0, 0.14) 0%, transparent 40%, rgba(0, 0, 0, 0.5) 100%);
	}
	:global([data-peruser-theme^='peruser_']) .peruser-bg,
	:global([data-theme^='peruser_']) .peruser-bg {
		opacity: 1;
	}

	@media (max-width: 768px) {
		.demon-slayer-bg {
			background-position: center 22%;
			filter: brightness(0.92) saturate(1.03) contrast(1.03);
		}
		.demon-slayer-bg-overlay {
			background:
				radial-gradient(
					ellipse 98% 72% at 50% 30%,
					rgba(255, 255, 255, 0) 0%,
					rgba(255, 255, 255, 0) 42%,
					rgba(5, 5, 8, 0.38) 72%,
					rgba(5, 5, 8, 0.82) 100%
				),
				linear-gradient(180deg, rgba(5, 5, 8, 0.32) 0%, rgba(5, 5, 8, 0.68) 100%),
				radial-gradient(ellipse 90% 44% at 50% 8%, rgba(255, 42, 18, 0.07) 0%, transparent 58%);
		}
	}

	.menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 101;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
	}

	.menu-drawer {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		width: 280px;
		max-width: 85vw;
		z-index: 102;
		background: #0c0c0e;
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		flex-direction: column;
		padding-top: env(safe-area-inset-top);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.menu-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.menu-title {
		font-size: 18px;
		font-weight: 700;
	}

	.menu-close {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: #a1a1aa;
		cursor: pointer;
		border-radius: 8px;
		-webkit-tap-highlight-color: transparent;
	}
	.menu-close:active {
		background: rgba(255, 255, 255, 0.06);
	}
	.menu-close svg {
		width: 20px;
		height: 20px;
	}

	.menu-nav {
		display: flex;
		flex-direction: column;
		padding: 12px 8px;
		gap: 2px;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		border-radius: 12px;
		text-decoration: none;
		color: #d4d4d8;
		font-size: 15px;
		font-weight: 500;
		transition: background 0.1s;
		-webkit-tap-highlight-color: transparent;
		background: none;
		border: none;
		width: 100%;
		text-align: left;
		cursor: pointer;
		font-family: inherit;
	}
	.menu-item:active {
		background: rgba(255, 255, 255, 0.05);
	}
	.menu-item svg {
		width: 22px;
		height: 22px;
		flex-shrink: 0;
	}

	.menu-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.06);
		margin: 8px 16px;
	}

	.menu-logout {
		color: #f87171;
	}
	.menu-login {
		color: #818cf8;
	}
</style>
