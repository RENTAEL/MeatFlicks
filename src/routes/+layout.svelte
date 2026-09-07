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
	import PreviewPopout from '$lib/components/media/PreviewPopout.svelte';

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

<svelte:head>
	<!-- Official Buy Me a Coffee widget — global (root layout), all data-* preserved exactly -->
	<script data-name="BMC-Widget" data-cfasync="false" src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js" data-id="HelpGavin" data-description="Support me on Buy me a coffee!" data-message="" data-color="#5F7FFF" data-position="Right" data-x_margin="18" data-y_margin="18"></script>
</svelte:head>

<AnnouncementBanner />
<GuestPresence />
<CommandPoller />
<PreviewPopout />
{@render children()}
