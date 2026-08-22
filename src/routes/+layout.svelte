<script lang="ts">
	import '../app.css';
	import { themeStore } from '$lib/stores/theme';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { watchlist } from '$lib/state/stores/watchlistStore.svelte';
	import { watchHistory } from '$lib/state/stores/historyStore.svelte';
	import AnnouncementBanner from '$lib/components/AnnouncementBanner.svelte';
	import GuestPresence from '$lib/components/admin/GuestPresence.svelte';
	import CommandPoller from '$lib/components/admin/CommandPoller.svelte';

	let { children } = $props();

	$effect(() => {
		$themeStore;
	});

	// Re-sync watchlist/history whenever the signed-in user changes (login,
	// logout, account switch) so a new device/log-in picks up server data and
	// guest changes made before login are uploaded.
	$effect(() => {
		const user = page.data.user;
		if (user) {
			void watchlist.syncFromServer();
			void watchHistory.syncFromServer();
		}
	});

	afterNavigate(() => {
		document.documentElement.style.scrollBehavior = 'auto';
		window.scrollTo({ top: 0, behavior: 'instant' });
		document.body.scrollTop = 0;
		requestAnimationFrame(() => {
			document.documentElement.style.scrollBehavior = '';
		});
	});
</script>

<AnnouncementBanner />
<GuestPresence />
<CommandPoller />
{@render children()}
