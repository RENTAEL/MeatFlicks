<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { searchOpen } from '$lib/stores/search';
	import ThemeToggle from '$lib/themes/ThemeToggle.svelte';

	let scrolled = $state(false);

	onMount(() => {
		const handleScroll = () => {
			scrolled = window.scrollY > 20;
		};
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	});

	let currentPath = $derived(page.url.pathname);

	function isActive(path: string) {
		if (path === '/') return currentPath === '/';
		return currentPath.startsWith(path);
	}

	async function signOut() {
		const form = new FormData();
		form.append('csrf_token', page.data.csrfToken || '');
		await fetch('/logout', { method: 'POST', body: form });
		goto('/login');
	}
</script>

<header class="header" class:scrolled>
	<div class="header-inner container">
		<!-- Logo -->
		<a href="/" class="logo" title="Streamium — blame the developer if it's slow">
			<span class="logo-icon">▶</span>
			<span class="logo-text">Streamium</span>
		</a>

		<!-- Desktop nav -->
		<nav class="nav-desktop">
			<a href="/" class="nav-link" class:active={isActive('/')}>Home</a>
			<a href="/movies" class="nav-link" class:active={isActive('/movies')}>Movies</a>
			<a href="/tv" class="nav-link" class:active={isActive('/tv')}>TV Series</a>
			<a href="/afrikaans" class="nav-link" class:active={isActive('/afrikaans')}>Afrikaans</a>
		</nav>

		<!-- Right side -->
		<div class="header-right">
			<ThemeToggle />
			<button class="icon-btn search-btn" aria-label="Search" onclick={() => searchOpen.set(true)}>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
					<circle cx="11" cy="11" r="8"></circle>
					<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
				</svg>
			</button>

			{#if page.data.user}
				<div class="user-menu">
					<a href="/profile" class="profile-link">
						<div class="avatar-sm">{(page.data.user.username || '?').charAt(0).toUpperCase()}</div>
						<span class="username-label">{page.data.user.username}</span>
					</a>
					<button class="signout-btn" onclick={signOut}>Sign Out</button>
				</div>
			{:else}
				<a href="/login" class="signin-btn">Sign In</a>
			{/if}
		</div>
	</div>
</header>

<style>
	.header {
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

	.header.scrolled {
		background: var(--glass-bg);
		backdrop-filter: blur(var(--glass-blur));
		-webkit-backdrop-filter: blur(var(--glass-blur));
		border-bottom: 1px solid var(--glass-border);
	}

	.header-inner {
		height: 100%;
		display: flex;
		align-items: center;
		gap: 2rem;
	}

	/* Logo */
	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: var(--font-weight-extrabold);
		font-size: 1.25rem;
		letter-spacing: -0.02em;
		transition: opacity var(--transition-fast);
	}

	.logo:hover {
		opacity: 0.85;
	}

	.logo-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		background: var(--gradient-brand);
		color: white;
		font-size: 0.75rem;
	}

	.logo-text {
		background: var(--gradient-brand-horizontal);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	/* Desktop nav */
	.nav-desktop {
		display: flex;
		gap: 0.25rem;
		flex: 1;
	}

	.nav-link {
		padding: 0.5rem 1rem;
		border-radius: var(--radius-full);
		font-size: 0.9rem;
		font-weight: var(--font-weight-medium);
		color: var(--text-secondary);
		transition: all var(--transition-fast);
	}

	.nav-link:hover {
		color: var(--text-primary);
		background: var(--accent-soft);
	}

	.nav-link.active {
		color: white;
		background: var(--accent-soft);
		font-weight: var(--font-weight-semibold);
	}

	/* Right side */
	.header-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.icon-btn {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		color: var(--text-secondary);
		transition: all var(--transition-fast);
	}

	.icon-btn:hover {
		color: var(--text-primary);
		background: var(--bg-card);
	}

	/* User menu */
	.user-menu {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.profile-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-full);
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
		transition: all var(--transition-fast);
	}

	.profile-link:hover {
		background: var(--bg-card-hover);
		border-color: var(--border-strong);
	}

	.avatar-sm {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--gradient-brand);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		font-weight: var(--font-weight-bold);
		color: white;
	}

	.username-label {
		font-size: 0.85rem;
		font-weight: var(--font-weight-medium);
		color: var(--text-primary);
	}

	.signout-btn {
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-full);
		font-size: 0.85rem;
		color: var(--text-secondary);
		transition: all var(--transition-fast);
	}

	.signout-btn:hover {
		color: #f87171;
		background: rgba(239, 68, 68, 0.1);
	}

	.signin-btn {
		padding: 0.5rem 1.25rem;
		border-radius: var(--radius-full);
		background: var(--gradient-brand);
		color: white;
		font-size: 0.9rem;
		font-weight: var(--font-weight-semibold);
		transition: all var(--transition-fast);
		box-shadow: 0 2px 12px var(--accent-glow);
	}

	.signin-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 20px var(--accent-glow);
	}

	@media (max-width: 768px) {
		.nav-desktop { display: none; }
		.user-menu { display: none; }
		.signin-btn { display: none; }
	}
</style>
