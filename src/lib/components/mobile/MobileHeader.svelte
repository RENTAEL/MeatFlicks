<script lang="ts">
	import { page } from '$app/state';
	import { searchOpen } from '$lib/stores/search';
	import { menuOpen } from '$lib/stores/menu';
	import { authStore } from '$lib/state/stores/authStore.svelte.ts';
	import { icons } from './icons';

	let isVisible = $state(true);
	let lastScrollY = 0;

	function onScroll() {
		const currentY = window.scrollY;
		isVisible = currentY < lastScrollY || currentY < 60;
		lastScrollY = currentY;
	}

	$effect(() => {
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	function pageTitle(): string {
		const path = page.url.pathname;
		if (path === '/') return 'Streamium';
		const seg = path.split('/').filter(Boolean)[0] || '';
		return seg.charAt(0).toUpperCase() + seg.slice(1);
	}
</script>

<header
	class="mobile-header"
	class:hidden={!isVisible}
	style="padding-top: env(safe-area-inset-top, 0px);"
>
	<div class="mobile-header-inner">
		<button type="button" class="mobile-header-btn" onclick={() => menuOpen.set(true)} aria-label="Menu">
			{@html icons.menu}
		</button>
		<span class="mobile-header-title">{pageTitle()}</span>
		<button type="button" class="mobile-header-btn" onclick={() => searchOpen.set(true)} aria-label="Search">
			{@html icons.search}
		</button>
	</div>
</header>
