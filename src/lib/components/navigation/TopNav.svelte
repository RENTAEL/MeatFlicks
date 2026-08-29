<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { searchOpen } from '$lib/stores/search';
	import { getCsrfTokenClient } from '$lib/utils/csrf.client';
	import ThemeToggle from '$lib/themes/ThemeToggle.svelte';
	import BrandLogo from '$lib/components/branding/BrandLogo.svelte';
	import PreviewSwitcher from '$lib/components/branding/PreviewSwitcher.svelte';

	import { getScrollY, addScrollListener } from '$lib/utils/scrollPosition';
	import { WATCH_PARTY_ENABLED } from '$lib/config/watchParty';

	let scrolled = $state(false);
	let adminOpen = $state(false);
	let AdminSessionsPanel = $state<
		typeof import('$lib/components/admin/ActiveSessionsPanel.svelte').default | null
	>(null);

	async function toggleAdminSessions() {
		adminOpen = !adminOpen;
		if (adminOpen && !AdminSessionsPanel) {
			AdminSessionsPanel = (await import('$lib/components/admin/ActiveSessionsPanel.svelte'))
				.default;
		}
	}

	onMount(() => {
		return addScrollListener(() => {
			scrolled = getScrollY() > 20;
		});
	});

	let currentPath = $derived(page.url.pathname);

	function isActive(path: string) {
		if (path === '/') return currentPath === '/';
		return currentPath.startsWith(path);
	}

	async function signOut() {
		const form = new FormData();
		form.append('csrf_token', (await getCsrfTokenClient()) || '');
		await fetch('/logout', { method: 'POST', body: form });
		goto('/login');
	}
</script>

<header class="header" class:scrolled>
	<div class="header-inner container">
		<!-- Logo -->
		<BrandLogo size="md" />

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
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				>
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

					<PreviewSwitcher variant="desktop" />
					{#if WATCH_PARTY_ENABLED}
						<a href="/watch-party" class="wp-btn">
							<svg
								width="15"
								height="15"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path
									d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z"
								/></svg
							>
							Watch Party
						</a>
					{/if}
					{#if WATCH_PARTY_ENABLED && page.data.user?.role === 'ADMIN'}
						<a href="/admin" class="wp-btn admin-console-btn" aria-label="Open admin console">
							<svg
								width="15"
								height="15"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="12" cy="12" r="3" />
								<path
									d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
								/>
							</svg>
							Admin
						</a>
						<button
							class="wp-btn admin-sessions-btn"
							aria-expanded={adminOpen}
							aria-label="Active watch-party sessions"
							onclick={toggleAdminSessions}
						>
							<svg
								width="15"
								height="15"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg
							>
							Active Sessions
						</button>
					{/if}
					<button class="signout-btn" onclick={signOut}>Sign Out</button>
				</div>
			{:else}
				<a href="/login" class="signin-btn">Sign In</a>
			{/if}
		</div>
	</div>
</header>

{#if adminOpen && AdminSessionsPanel}
	<AdminSessionsPanel onclose={() => (adminOpen = false)} />
{/if}

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

	.wp-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-full);
		font-size: 0.85rem;
		font-weight: var(--font-weight-semibold);
		color: var(--text-primary);
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
		transition: all var(--transition-fast);
	}

	.wp-btn:hover {
		background: var(--bg-card-hover);
		border-color: var(--accent-color, #818cf8);
		color: var(--accent-color, #818cf8);
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
		.nav-desktop {
			display: none;
		}
		.user-menu {
			display: none;
		}
		.signin-btn {
			display: none;
		}
	}
</style>
