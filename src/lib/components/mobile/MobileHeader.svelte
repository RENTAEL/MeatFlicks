<script lang="ts">
	import { page } from '$app/state';
	import { searchOpen } from '$lib/stores/search';
	import { menuOpen } from '$lib/stores/menu';
	import { icons } from './icons';
	import BrandLogo from '$lib/components/branding/BrandLogo.svelte';
	import { getScrollY, addScrollListener } from '$lib/utils/scrollPosition';
	let isVisible = $state(true);
	let lastScrollY = 0;
	function onScroll() {
		const currentY = getScrollY();
		isVisible = currentY < lastScrollY || currentY < 60;
		lastScrollY = currentY;
	}
	$effect(() => {
		return addScrollListener(onScroll);
	});
	function pageTitle(): string {
		const path = page.url.pathname;
		if (path === '/') return 'Streamium';
		const seg = path.split('/').filter(Boolean)[0] || '';
		return seg.charAt(0).toUpperCase() + seg.slice(1);
	}
</script>

<header class="mobile-header" class:hidden={!isVisible}>
	<div class="mobile-header-inner">
		<button
			type="button"
			class="mobile-header-btn"
			onclick={() => menuOpen.set(true)}
			aria-label="Menu"
		>
			{@html icons.menu}
		</button>
		<BrandLogo size="sm" />
		<div class="mobile-header-actions">
			<button
				type="button"
				class="mobile-header-btn"
				onclick={() => searchOpen.set(true)}
				aria-label="Search"
			>
				{@html icons.search}
			</button>
			<a
				href={page.data.user ? '/profile' : '/login'}
				class="mobile-header-btn mobile-header-profile"
				aria-label={page.data.user ? 'Profile' : 'Sign in'}
			>
				{#if page.data.user}
					<span class="mobile-avatar">{(page.data.user.username as string).charAt(0).toUpperCase()}</span>
				{:else}
					{@html icons.user}
				{/if}
			</a>
		</div>
	</div>
</header>

<style>
	.mobile-header {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		height: var(--header-height);
		transition: all var(--transition-base);
		background: rgba(9, 9, 11, 0.7);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.mobile-header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 100%;
		padding: 0 1rem;
		gap: 0.5rem;
	}

	.mobile-header-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.mobile-header-profile {
		text-decoration: none;
	}

	.mobile-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--gradient-brand);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		color: white;
		flex-shrink: 0;
	}

	.mobile-header-btn {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		color: var(--text-secondary);
		background: transparent;
		border: none;
		transition: all var(--transition-fast);
	}

	.mobile-header-btn:hover {
		color: var(--text-primary);
		background: var(--bg-card);
	}

	.mobile-header :global(svg) {
		width: 22px;
		height: 22px;
	}

	@media (min-width: 768px) {
		.mobile-header {
			display: none;
		}
	}
</style>
