<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { searchOpen } from '$lib/stores/search';
	import { authStore } from '$lib/state/stores/authStore.svelte.ts';
	import { icons } from './icons';

	const tabs = [
		{ id: 'home', href: '/', icon: 'home', label: 'Home' },
		{ id: 'explore', href: '/explore/movies', icon: 'explore', label: 'Explore' },
		{ id: 'search', icon: 'search', label: 'Search', action: 'search' as const },
		{ id: 'watchlist', href: '/watchlist', icon: 'heart', label: 'Watchlist' },
		{ id: 'profile', href: authStore.state.user ? '/profile' : '/login', icon: 'user', label: 'Profile' },
	];

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

	function isActive(tab: typeof tabs[number]): boolean {
		if (tab.action === 'search') return false;
		if (!tab.href) return false;
		if (tab.href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(tab.href);
	}
</script>

<nav
	class="bottom-nav"
	class:hidden={!isVisible}
	style="padding-bottom: max(4px, env(safe-area-inset-bottom, 0px));"
>
	{#each tabs as tab}
		{@const active = isActive(tab)}
		<button
			type="button"
			class="bottom-nav-item"
			class:active
			onclick={() => tab.action === 'search' ? searchOpen.set(true) : goto(tab.href!)}
			aria-label={tab.label}
		>
			<span class="bottom-nav-icon">{@html icons[tab.icon as keyof typeof icons]}</span>
			<span class="bottom-nav-label">{tab.label}</span>
		</button>
	{/each}
</nav>
