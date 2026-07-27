<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Home, Search, PlayCircle, User, Library, Film } from '@lucide/svelte';

	const navItems = [
		{ href: '/', icon: Home, label: 'Home' },
		{ href: '/explore/movies', icon: Film, label: 'Movies' },
		{ href: '/explore/tv-shows', icon: PlayCircle, label: 'TV' },
		{ href: '/anime', icon: PlayCircle, label: 'Anime' },
		{ href: '/search', icon: Search, label: 'Search' }
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
	class="bottom-nav-safe fixed inset-x-0 bottom-0 z-50 border-t border-border/30 bg-background/80 backdrop-blur-xl transition-transform duration-300 md:hidden"
	class:translate-y-full={!isVisible}
	style="padding-bottom: max(8px, calc(env(safe-area-inset-bottom, 20px) + 4px));"
>
	<div class="flex items-center justify-around py-1.5">
		{#each navItems as { href, icon: Icon, label }}
			{@const isActive = page.url.pathname === href || (href !== '/' && page.url.pathname.startsWith(href))}
			<button
				type="button"
				class={isActive
					? 'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors min-h-[44px] min-w-[44px] rounded-lg text-primary bg-zinc-800/30'
					: 'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground'}
				onclick={() => goto(href)}
			>
				<Icon class="size-5" />
				<span>{label}</span>
			</button>
		{/each}
	</div>
</nav>