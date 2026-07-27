<script lang="ts">
	import { page } from '$app/state';
	import { Search, Bell, Menu } from '@lucide/svelte';

	let scrolled = $state(false);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const onScroll = () => { scrolled = window.scrollY > 20; };
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	const navLinks = [
		{ label: 'Home', href: '/' },
		{ label: 'Movies', href: '/movies' },
		{ label: 'TV Series', href: '/tv-shows' },
	];

	const isActive = (href: string) => {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	};
</script>

<header
	class="sticky top-0 z-50 h-14 border-b backdrop-blur-2xl transition-all duration-300 md:h-16 {scrolled
		? 'bg-background/85 shadow-sm'
		: 'bg-background/50'}"
	style="border-color: rgba(255,255,255,0.06)"
>
	<div class="mx-auto flex h-full max-w-screen-2xl items-center gap-4 px-4 md:px-6">
		<button
			type="button"
			class="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground md:hidden"
			aria-label="Open navigation menu"
			onclick={() => {}}
		>
			<Menu class="size-5" />
		</button>

		<a href="/" class="flex items-center gap-1.5 text-lg font-bold tracking-tight text-foreground">
			Streamium
		</a>

		<nav class="ml-6 hidden items-center gap-1 md:flex">
			{#each navLinks as link}
				<a
					href={link.href}
					class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {isActive(link.href)
						? 'text-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div class="ml-auto flex items-center gap-2">
			<a
				href="/search"
				class="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
				aria-label="Search"
			>
				<Search class="size-5" />
			</a>
			<button
				type="button"
				class="hidden size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground sm:flex"
				aria-label="Notifications"
			>
				<Bell class="size-5" />
			</button>
		</div>
	</div>
</header>
