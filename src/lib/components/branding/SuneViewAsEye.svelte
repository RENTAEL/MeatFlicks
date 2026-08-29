<script lang="ts">
	import { page } from '$app/state';
	import { impersonationStore } from '$lib/state/stores/impersonationStore.svelte.ts';
	import { watchlist } from '$lib/state/stores/watchlistStore.svelte.ts';

	// Admin-only "view as Sune" toggle. Pinned in the nav, persistent, and easy
	// to exit — clicking again drops the impersonation. Relies on the existing
	// impersonation flow, so the whole app re-skins to the Rose Court theme.
	const isAdmin = $derived(page.data.user?.role === 'ADMIN');
	const isViewingAsSune = $derived(
		impersonationStore.current?.username?.toLowerCase() === 'sune'
	);

	let busy = $state(false);

	async function toggle() {
		if (busy) return;

		if (isViewingAsSune) {
			impersonationStore.clear();
			await watchlist.syncFromServer();
			return;
		}

		busy = true;
		try {
			const res = await fetch('/api/admin/users/sune');
			if (!res.ok) return;
			const data = (await res.json()) as {
				user?: { id: string; username: string; email: string | null };
			};
			const u = data.user;
			if (!u) return;
			impersonationStore.impersonate({ id: u.id, username: u.username, email: u.email ?? '' });
			await watchlist.syncFromServer();
		} finally {
			busy = false;
		}
	}
</script>

{#if isAdmin}
	<button
		class="sune-eye"
		class:active={isViewingAsSune}
		onclick={toggle}
		aria-label={isViewingAsSune ? 'Exit Sune view' : 'View as Sune'}
		title={isViewingAsSune ? 'Exit Sune view' : 'View as Sune'}
		disabled={busy}
	>
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
		{#if isViewingAsSune}<span class="sune-eye-label">Exit Sune</span>{/if}
	</button>
{/if}

<style>
	.sune-eye {
		width: 40px;
		height: 40px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		border-radius: var(--radius-full);
		color: var(--text-secondary);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.sune-eye:hover {
		color: #e7c663;
		background: var(--bg-card);
	}

	.sune-eye.active {
		color: #d4af37;
		background: rgba(212, 175, 55, 0.14);
		box-shadow:
			0 0 0 1px rgba(212, 175, 55, 0.4),
			0 0 14px rgba(212, 175, 55, 0.25);
	}

	.sune-eye:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.sune-eye-label {
		font-size: 0.72rem;
		font-weight: 600;
		color: #e7c663;
	}
</style>
