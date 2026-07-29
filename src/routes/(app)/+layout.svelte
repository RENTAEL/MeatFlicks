<script lang="ts">
	import '../../app.css';
	import '$lib/css/mobile.css';

	import TopNav from '$lib/components/navigation/TopNav.svelte';
	import MobileNav from '$lib/components/navigation/MobileNav.svelte';
	import Footer from '$lib/components/navigation/Footer.svelte';
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
	import UblockPopup from '$lib/components/UblockPopup.svelte';
	import UserFab from '$lib/components/UserFab.svelte';
	import GavinBadge from '$lib/components/GavinBadge.svelte';

	onMount(() => {
		void (async () => {
			try {
				const { initAdBlocker } = await import('$lib/utils/adBlocker.js');
				initAdBlocker();
			} catch {}
		})();
		const cleanup = setupCloudSync();

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

		const interval = setInterval(checkVersion, 60000);
		checkVersion();

		return () => {
			clearInterval(interval);
			cleanup();
		};
	});
</script>

<svelte:head>
	<title>Streamium — Premium Streaming</title>
	<meta
		name="description"
		content="Movies, TV series, and Afrikaans content — ad-free, buffer-free, hassle-free."
	/>
</svelte:head>

<!-- Ambient background -->
<div class="bg-ambient">
	<div class="bg-gradient-top"></div>
	<div class="bg-noise"></div>
</div>

<ModeWatcher defaultMode="dark" themeColors={{ dark: '#0a0a1a', light: '#0a0a1a' }} />
<ThemeContext>
	<WatchlistContext>
		<ErrorContext>
			<TopNav />
			<div class="relative flex min-h-dvh-fallback flex-col text-foreground">
					<div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
						{#each Array.from({ length: 20 }) as _, i}
							<div
								class="absolute animate-float-up"
								style="
									left: {Math.random() * 100}%;
									width: {2 + Math.random() * 4}px;
									height: {2 + Math.random() * 4}px;
									animation-duration: {10 + Math.random() * 20}s;
									animation-delay: {Math.random() * 15}s;
									background: radial-gradient(circle, oklch({0.7 + Math.random() * 0.3} {0.1 + Math.random() * 0.15} {280 + Math.random() * 50}) 0%, transparent 100%);
									border-radius: 50%;
									opacity: {0.3 + Math.random() * 0.5};
								"
							></div>
						{/each}
					</div>
					<div class="relative z-10 flex-1" style="padding-bottom: max(4rem, calc(env(safe-area-inset-bottom, 20px) + 0.5rem));">
						<div class="page-transition">
							<slot />
						</div>
					</div>
					<MobileNav />
					<Footer class="relative z-10 hidden md:block" />
				</div>
			<GlobalErrorDisplay />
			<NotificationPortal />
			<OfflineIndicator />
			<UserFab />
			<GavinBadge />
		</ErrorContext>
	</WatchlistContext>
</ThemeContext>

<SearchOverlay />

<UblockPopup />

{#if $menuOpen}
	<div class="menu-backdrop" onclick={() => menuOpen.set(false)} role="button" tabindex="-1" aria-label="Close menu" transition:fade={{ duration: 150 }}></div>

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
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
				Home
			</a>
			<a href="/movies" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
				Movies
			</a>
			<a href="/tv" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
				TV Shows
			</a>
			<a href="/afrikaans" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
				Afrikaans
			</a>
			<a href="/watchlist" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
				My List
			</a>
			<div class="menu-divider"></div>
			<a href="/search" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
				Search
			</a>
			<a href="/history" class="menu-item" onclick={() => menuOpen.set(false)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
				History
			</a>
			{#if authStore.state.user}
				<a href="/profile" class="menu-item" onclick={() => menuOpen.set(false)}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
					Profile
				</a>
				<button class="menu-item menu-logout" onclick={() => { authStore.logout(); menuOpen.set(false); }}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
					Sign Out
				</button>
			{:else}
				<a href="/login" class="menu-item menu-login" onclick={() => menuOpen.set(false)}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
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

	.menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
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
		z-index: 81;
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
	.menu-close:active { background: rgba(255, 255, 255, 0.06); }
	.menu-close svg { width: 20px; height: 20px; }

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
	.menu-item:active { background: rgba(255, 255, 255, 0.05); }
	.menu-item svg { width: 22px; height: 22px; flex-shrink: 0; }

	.menu-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.06);
		margin: 8px 16px;
	}

	.menu-logout { color: #f87171; }
	.menu-login { color: #818cf8; }
</style>
