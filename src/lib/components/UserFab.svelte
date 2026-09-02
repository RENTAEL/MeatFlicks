<script lang="ts">
	import { page } from '$app/state';
	import { fly, fade } from 'svelte/transition';

	let open = $state(false);
	let fabEl: HTMLDivElement | undefined = $state();
	let user = $derived(page.data.user);

	function toggle() { open = !open; }
	function close() { open = false; }

	function handleClickOutside(e: MouseEvent) {
		if (fabEl && !fabEl.contains(e.target as Node)) close();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside);
			document.addEventListener('keydown', handleKeydown);
			return () => {
				document.removeEventListener('click', handleClickOutside);
				document.removeEventListener('keydown', handleKeydown);
			};
		}
	});
</script>

<div class="fab-container" bind:this={fabEl}>
	{#if open}
		<div class="backdrop" onclick={close} onkeydown={(e) => e.key === 'Escape' && close()} role="button" tabindex="-1" aria-label="Close menu" transition:fade={{ duration: 150 }}></div>
	{/if}

	{#if open}
		<div class="fab-panel" transition:fly={{ y: 20, duration: 200 }}>
			{#if user}
				<div class="panel-header">
					<span class="panel-avatar">{(user.username || '?')[0].toUpperCase()}</span>
					<div class="panel-user-info">
						<span class="panel-username">{user.username}</span>
						<span class="panel-email">{user.email ?? ''}</span>
					</div>
				</div>
				<div class="panel-divider"></div>
			{/if}

			<a href="/history" class="panel-item" onclick={close}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
				Watch History
			</a>

			<a href="/watchlist" class="panel-item" onclick={close}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
				Watchlist
			</a>

			<a href="/tv" class="panel-item" onclick={close}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
				TV Shows
			</a>

			<a href="/settings" class="panel-item" onclick={close}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
				Settings
			</a>

			<div class="panel-divider"></div>

			{#if user}
				<form action="/logout" method="POST">
					<button type="submit" class="panel-item logout" onclick={close}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
						Sign Out
					</button>
				</form>
			{:else}
				<a href="/login" class="panel-item" onclick={close}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
					Sign In
				</a>
				<a href="/signup" class="panel-item highlight" onclick={close}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
					Create Account
				</a>
			{/if}
		</div>
	{/if}

	<button class="fab-btn" class:active={open} onclick={toggle} aria-label={open ? 'Close menu' : 'Open menu'}>
		{#if user}
			<span class="fab-avatar">{(user.username || '?')[0].toUpperCase()}</span>
		{:else}
			<svg class="fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
				<circle cx="12" cy="7" r="4"/>
			</svg>
		{/if}
	</button>
</div>

<style>
	.fab-container {
		position: fixed;
		bottom: 24px;
		right: 24px;
		z-index: 500;
		display: flex;
		flex-direction: column-reverse;
		align-items: flex-end;
		gap: 12px;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.3);
		z-index: -1;
	}
	.fab-panel {
		width: 260px;
		background: #1e1b4b;
		border: 1px solid rgba(129,140,248,0.2);
		border-radius: 14px;
		padding: 8px;
		box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(129,140,248,0.08);
		overflow: hidden;
	}
	.panel-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 8px;
	}
	.panel-avatar {
		width: 36px; height: 36px;
		border-radius: 10px;
		background: #818cf8;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 16px;
		flex-shrink: 0;
	}
	.panel-user-info { display: flex; flex-direction: column; min-width: 0; }
	.panel-username { font-weight: 600; font-size: 14px; color: #e0e7ff; }
	.panel-email { font-size: 12px; color: #a5b4fc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.panel-divider { border-top: 1px solid rgba(129,140,248,0.12); margin: 4px 0; }
	.panel-item {
		display: flex; align-items: center; gap: 10px;
		padding: 11px 10px;
		color: #c7d2fe; text-decoration: none;
		font-size: 14px; border-radius: 8px;
		transition: background 0.1s;
		width: 100%; box-sizing: border-box;
		background: none; border: none; cursor: pointer; text-align: left; font-family: inherit;
	}
	.panel-item:active { background: rgba(129,140,248,0.1); color: #e0e7ff; }
	.panel-item svg { width: 18px; height: 18px; flex-shrink: 0; color: #818cf8; }
	.panel-item.highlight {
		background: rgba(129,140,248,0.15);
		color: #e0e7ff;
		font-weight: 600;
	}
	.panel-item.highlight:active { background: rgba(129,140,248,0.25); }
	.logout { color: #f87171; }
	.logout svg { color: #f87171; }
	.logout:active { background: rgba(248,113,113,0.08); }

	.fab-btn {
		width: 48px; height: 48px;
		border-radius: 14px;
		background: #312e81;
		border: 1px solid rgba(129,140,248,0.3);
		cursor: pointer;
		display: flex; align-items: center; justify-content: center;
		transition: all 0.2s;
		box-shadow: 0 4px 16px rgba(0,0,0,0.3);
		padding: 0;
	}
	.fab-btn:hover { background: #3730a3; transform: scale(1.05); }
	.fab-btn.active { background: #818cf8; border-color: #818cf8; }
	.fab-icon { width: 22px; height: 22px; color: #c7d2fe; }
	.fab-btn.active .fab-icon { color: #fff; }
	.fab-avatar {
		width: 28px; height: 28px;
		border-radius: 8px;
		background: #818cf8; color: #fff;
		display: flex; align-items: center; justify-content: center;
		font-weight: 700; font-size: 15px;
	}
	.fab-btn.active .fab-avatar { background: #fff; color: #312e81; }

	@media (max-width: 640px) {
		/* The FAB sits above the bottom tab bar (z-index 500 vs 100) and covers
		 * the Profile tab. Profile is reachable as a tab here, so hide it. */
		.fab-container { display: none; }
		.fab-panel { width: calc(100vw - 32px); max-width: 300px; }
		.fab-btn { width: 44px; height: 44px; border-radius: 12px; }
	}
</style>
