<script lang="ts">
	import { mount, unmount } from 'svelte';
	import DailyQuoteOverlay from './DailyQuoteOverlay.svelte';

	let { onclose }: { onclose: () => void } = $props();

	// Portal the overlay to <body> so `position: fixed` resolves against the
	// viewport. The page content lives inside `.page-transition` whose
	// fill-mode animation applies a transform, which would otherwise become
	// the containing block for the fixed overlay and stretch it across the
	// whole page instead of the viewport.
	$effect(() => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const app = mount(DailyQuoteOverlay, { target: host, props: { onclose } });
		return () => {
			unmount(app);
			host.remove();
		};
	});
</script>
