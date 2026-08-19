<script lang="ts">
	import '../app.css';
	import { themeStore } from '$lib/stores/theme';
	import { afterNavigate } from '$app/navigation';

	let { children } = $props();

	$effect(() => {
		$themeStore;
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

{@render children()}
