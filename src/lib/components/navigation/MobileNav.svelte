<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Home, Search, TrendingUp, Heart, User } from '@lucide/svelte';

	const navItems = [
		{ href: '/', icon: Home, iconActive: Home, label: 'Home' },
		{ href: '/explore/movies', icon: TrendingUp, iconActive: TrendingUp, label: 'Trending' },
		{ href: '/search', icon: Search, iconActive: Search, label: 'Search' },
		{ href: '/watchlist', icon: Heart, iconActive: Heart, label: 'Watchlist' },
		{ href: '/profile', icon: User, iconActive: User, label: 'Profile' },
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
</script>

<nav
	class="mobile-tab-bar fixed inset-x-0 bottom-0 z-50 border-t border-white/10 transition-transform duration-300 md:hidden"
	class:translate-y-full={!isVisible}
	style="padding-bottom: max(8px, calc(env(safe-area-inset-bottom, 20px) + 4px)); background: rgba(0,0,0,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);"
>
	<div class="flex items-center justify-around py-1.5">
		{#each navItems as { href, icon: Icon, label }}
			{@const isActive = page.url.pathname === href || (href !== '/' && page.url.pathname.startsWith(href))}
			<button
				type="button"
				class="flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium min-h-[44px] min-w-[44px] rounded-lg transition-colors"
				class:text-primary={isActive}
				class:text-muted-foreground={!isActive}
				style={isActive ? '--tw-text-opacity: 1; color: #f59e0b;' : ''}
				onclick={() => goto(href)}
			>
				{#if isActive}
					<Icon class="size-5" style="fill: #f59e0b; color: #f59e0b;" />
				{:else}
					<Icon class="size-5" />
				{/if}
				<span class="text-[10px]">{label}</span>
			</button>
		{/each}
	</div>
</nav>

<style>
	.mobile-tab-bar button:active {
		transform: scale(0.92);
		transition: transform 0.1s ease;
	}

	.mobile-tab-bar button {
		transition: color 0.15s ease, transform 0.1s ease;
	}
</style>
