<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getCsrfTokenClient } from '$lib/utils/csrf.client';

	let dropdownOpen = $state(false);
	let user = $derived(page.data.user);

	function toggleDropdown() { dropdownOpen = !dropdownOpen; }
	function closeDropdown() { dropdownOpen = false; }

	async function logout() {
		const form = new FormData();
		form.append('csrf_token', (await getCsrfTokenClient()) || '');
		await fetch('/logout', { method: 'POST', body: form });
		goto('/login');
	}
</script>

<div class="auth-nav">
	{#if user}
		<button class="user-btn" onclick={toggleDropdown} onblur={closeDropdown} aria-haspopup="true" aria-expanded={dropdownOpen}>
			<span class="avatar">{(user.username || '?')[0].toUpperCase()}</span>
			<span class="username">{user.username}</span>
			<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="6 9 12 15 18 9"/>
			</svg>
		</button>

		{#if dropdownOpen}
			<div class="dropdown" role="menu">
				<a href="/profile" class="dropdown-item" role="menuitem" onclick={closeDropdown}>Profile</a>
				<a href="/watchlist" class="dropdown-item" role="menuitem" onclick={closeDropdown}>Watchlist</a>
				<div class="dropdown-divider"></div>
				<button class="dropdown-item logout" role="menuitem" onclick={logout}>Sign Out</button>
			</div>
		{/if}
	{:else}
		<a href="/login" class="auth-btn sign-in-btn">Sign In</a>
		<a href="/signup" class="auth-btn sign-up-btn">Sign Up</a>
	{/if}
</div>

<style>
	.auth-nav {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
		position: relative;
	}

	.auth-btn {
		padding: 9px 22px;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		transition: all 0.15s;
		cursor: pointer;
		line-height: 1.4;
		font-family: inherit;
	}

	.sign-in-btn {
		background: transparent;
		color: #e0e7ff;
		border: 1.5px solid rgba(129, 140, 248, 0.4);
	}
	.sign-in-btn:active { border-color: #818cf8; background: rgba(129, 140, 248, 0.1); }

	.sign-up-btn {
		background: #818cf8;
		color: #fff;
		border: 1.5px solid #818cf8;
	}
	.sign-up-btn:active { background: #6366f1; border-color: #6366f1; }

	.user-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px 6px 6px;
		background: rgba(129, 140, 248, 0.1);
		border: 1px solid rgba(129, 140, 248, 0.25);
		border-radius: 10px;
		cursor: pointer;
		color: #e0e7ff;
		font-size: 14px;
		white-space: nowrap;
		font-family: inherit;
	}
	.user-btn:active { background: rgba(129, 140, 248, 0.18); }

	.avatar {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: #818cf8;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 14px;
		flex-shrink: 0;
	}

	.username { font-weight: 500; }

	.chevron { width: 14px; height: 14px; color: #a5b4fc; }

	.dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		min-width: 180px;
		background: #1e1b4b;
		border: 1px solid rgba(129, 140, 248, 0.25);
		border-radius: 10px;
		padding: 6px;
		z-index: 200;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}

	.dropdown-item {
		display: block;
		padding: 10px 14px;
		color: #e0e7ff;
		text-decoration: none;
		border-radius: 6px;
		font-size: 14px;
		transition: background 0.1s;
		background: none;
		border: none;
		width: 100%;
		text-align: left;
		cursor: pointer;
		font-family: inherit;
	}
	.dropdown-item:active { background: rgba(129, 140, 248, 0.12); }

	.logout { color: #f87171; }
	.logout:active { background: rgba(248, 113, 113, 0.1); }

	.dropdown-divider { border-top: 1px solid rgba(129, 140, 248, 0.15); margin: 4px 0; }

	@media (max-width: 640px) {
		.auth-btn { padding: 7px 14px; font-size: 13px; }
		.user-btn { padding: 5px 8px 5px 5px; }
		.username { display: none; }
	}
</style>
