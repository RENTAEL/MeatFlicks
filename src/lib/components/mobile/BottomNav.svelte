<script lang="ts">
	import { page } from '$app/stores';
	import { icons } from './icons';
	import { searchOpen } from '$lib/stores/search';
	const navItems: { href: string; label: string; icon: keyof typeof icons; action?: 'search' }[] = [
		{ href: '/', label: 'Home', icon: 'home' },
		{ href: '/movies', label: 'Movies', icon: 'grid' },
		{ href: '/tv', label: 'Series', icon: 'list' },
		{ href: '/search', label: 'Search', icon: 'search', action: 'search' as const }
	];
	$: path = $page.url.pathname;
	function isActive(href: string): boolean {
		if (href === '/') return path === '/';
		return path.startsWith(href);
	}
</script>

<nav class="bottom-nav" aria-label="Main navigation">
	<div class="bottom-nav-bg"></div>
	{#each navItems as item}
		{@const active = isActive(item.href)}
		{#if item.action === 'search'}
			<button
				type="button"
				class="bottom-nav-item {active ? 'active' : ''}"
				onclick={() => searchOpen.set(true)}
				aria-label={item.label}
				aria-current={active ? 'page' : undefined}
			>
				<span class="bottom-nav-icon">{@html icons[item.icon]}</span>
				<span class="bottom-nav-label">{item.label}</span>
			</button>
		{:else}
			<a
				href={item.href}
				class="bottom-nav-item {active ? 'active' : ''}"
				aria-label={item.label}
				aria-current={active ? 'page' : undefined}
			>
				<span class="bottom-nav-icon">{@html icons[item.icon]}</span>
				<span class="bottom-nav-label">{item.label}</span>
			</a>
		{/if}
	{/each}
</nav>

<style>
	.bottom-nav {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: space-around;
		height: calc(64px + env(safe-area-inset-bottom));
		padding-bottom: env(safe-area-inset-bottom);
		background: transparent;
	}

	.bottom-nav-bg {
		position: absolute;
		inset: 0;
		background: rgba(9, 9, 11, 0.85);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.bottom-nav-item {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		width: 100%;
		min-height: 64px;
		padding: 8px 4px 4px;
		min-width: 44px;
		min-height: 44px;
		color: var(--text-secondary);
		font-size: 10px;
		font-weight: var(--font-weight-medium);
		text-decoration: none;
		transition: all var(--transition-fast);
		-webkit-tap-highlight-color: transparent;
	}

	.bottom-nav-item:active {
		transform: scale(0.96);
	}

	.bottom-nav-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		flex-shrink: 0;
	}

	.bottom-nav-icon :global(svg) {
		width: 22px;
		height: 22px;
		stroke: currentColor;
	}

	.bottom-nav-label {
		font-size: 10px;
		font-weight: var(--font-weight-medium);
		line-height: 1;
		white-space: nowrap;
	}

	/* Active state with pill highlight */
	.bottom-nav-item.active {
		color: var(--accent-color, #818cf8);
	}

	.bottom-nav-item.active::before {
		content: '';
		position: absolute;
		top: 4px;
		left: 50%;
		transform: translateX(-50%);
		width: calc(100% - 16px);
		max-width: 88px;
		height: calc(100% - 8px);
		min-height: 48px;
		background: var(--accent-soft);
		border-radius: var(--radius-full);
		z-index: -1;
		box-shadow:
			0 4px 16px var(--accent-glow),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.bottom-nav-item.active .bottom-nav-label {
		font-weight: var(--font-weight-semibold);
		color: var(--accent-color, #818cf8);
	}

	.bottom-nav-item.active .bottom-nav-icon :global(svg) {
		stroke: var(--accent-color, #818cf8);
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.bottom-nav-item,
		.bottom-nav-item::before {
			transition: none;
		}
		.bottom-nav-item:active {
			transform: none;
		}
	}

	@media (min-width: 768px) {
		.bottom-nav {
			display: none;
		}
	}
</style>
