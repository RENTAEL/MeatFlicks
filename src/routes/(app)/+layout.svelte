<script lang="ts">
	import '../../app.css';

	import AppShell from '$lib/components/navigation/Sidebar.svelte';
	import BottomNav from '$lib/components/navigation/BottomNav.svelte';
	import Footer from '$lib/components/navigation/Footer.svelte';
	import GlobalErrorDisplay from '$lib/components/global/GlobalErrorDisplay.svelte';
	import { NotificationPortal } from '$lib/components/global';
	import { OfflineIndicator } from '$lib/components/ui';
	import ThemeContext from '$lib/state/contexts/ThemeContext.svelte';
	import WatchlistContext from '$lib/state/contexts/WatchlistContext.svelte';
	import ErrorContext from '$lib/state/contexts/ErrorContext.svelte';
	import { ModeWatcher } from 'mode-watcher';
	import { onMount } from 'svelte';
	import { setupCloudSync } from '$lib/firebase/sync';

	onMount(() => {
		const cleanup = setupCloudSync();

		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.ready.then((reg) => {
				reg.addEventListener('updatefound', () => {
					const newWorker = reg.installing;
					if (newWorker) {
						newWorker.addEventListener('statechange', () => {
							if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
								if (confirm('A new version is available. Refresh to update?')) {
									window.location.reload();
								}
							}
						});
					}
				});
			});
		}

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
	<title>Streamium - Your Ultimate Streaming Universe</title>
	<meta
		name="description"
		content="Discover and stream your favorite movies and TV shows on Streamium."
	/>
</svelte:head>

<ModeWatcher defaultMode="dark" themeColors={{ dark: '#0a0a1a', light: '#0a0a1a' }} />
<ThemeContext>
	<WatchlistContext>
		<ErrorContext>
			<AppShell>
				<div class="relative flex min-h-svh flex-col text-foreground">
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
					<div class="relative z-10 flex-1 pb-16 md:pb-0">
						<slot />
					</div>
					<BottomNav />
					<Footer class="relative z-10 hidden md:block" />
				</div>
			</AppShell>
			<GlobalErrorDisplay />
			<NotificationPortal />
			<OfflineIndicator />
		</ErrorContext>
	</WatchlistContext>
</ThemeContext>
