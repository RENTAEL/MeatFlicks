<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { menuOpen } from '$lib/stores/menu';
	import { getBranding } from '$lib/utils/branding';
	import { previewStore } from '$lib/state/stores/previewStore.svelte.ts';
	import { impersonationStore } from '$lib/state/stores/impersonationStore.svelte.ts';
	import { watchlist } from '$lib/state/stores/watchlistStore.svelte.ts';

	let { variant = 'desktop' }: { variant?: 'desktop' | 'mobile' } = $props();

	const sessionUser = $derived(page.data.user ?? null);
	// Authoritative admin check — real session user only, never impersonated
	const isAdmin = $derived(sessionUser?.role === 'ADMIN');

	const impersonated = $derived(impersonationStore.current);
	const isViewingAsSune = $derived(
		!!impersonated && getBranding({ displayName: impersonated.username, email: impersonated.email }) === 'sune'
	);

	interface UserEntry {
		id: string;
		username: string;
		email: string | null;
		role: string;
		createdAt: number;
	}

	let open = $state(false);
	let panelEl: HTMLElement | null = $state(null);
	let btnEl: HTMLElement | null = $state(null);
	let userList = $state<UserEntry[]>([]);

	const suneUser = $derived<UserEntry | null>(
		userList.find((u) => getBranding({ displayName: u.username, email: u.email }) === 'sune') ?? null
	);

	const adminLabel = $derived(sessionUser?.username ?? 'Admin');

	function previewSune() {
		// Prefer real Sune record from DB so id/email are accurate; fall back to synthetic
		const target: UserEntry | null = suneUser;
		if (target) {
			previewStore.set(null);
			impersonationStore.impersonate({ id: target.id, username: target.username, email: target.email });
		} else {
			previewStore.set(null);
			impersonationStore.impersonate({ id: 'sune', username: 'sune', email: null });
		}
		open = false;
		if (variant === 'mobile') menuOpen.set(false);
		void watchlist.syncFromServer();
	}

	function exitPreview() {
		impersonationStore.clear();
		previewStore.set(null);
		open = false;
		if (variant === 'mobile') menuOpen.set(false);
		void watchlist.syncFromServer();
	}

	// Load Sune user via SSE when panel opens (or when admin and menu open for mobile)
	$effect(() => {
		if (!isAdmin || (!open && !$menuOpen)) return;
		const es = new EventSource('/api/admin/users/stream');
		es.addEventListener('users', (event) => {
			try {
				const data = JSON.parse((event as MessageEvent).data) as { users: UserEntry[] };
				userList = data.users;
			} catch {}
		});
		es.addEventListener('error', () => {
			if (import.meta.env.DEV) console.warn('[PreviewSwitcher] user stream error');
		});
		return () => es.close();
	});

	// Outside click + Escape for desktop
	onMount(() => {
		if (variant !== 'desktop') return;
		const onDocClick = (e: MouseEvent) => {
			if (!open) return;
			const target = e.target as Node;
			if (panelEl?.contains(target) || btnEl?.contains(target)) return;
			open = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && open) {
				e.preventDefault();
				open = false;
				btnEl?.focus();
			}
		};
		window.addEventListener('click', onDocClick);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('click', onDocClick);
			window.removeEventListener('keydown', onKey);
		};
	});

	function onBtnKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			open = !open;
		} else if (e.key === 'Escape' && open) {
			e.preventDefault();
			open = false;
		}
	}
</script>

{#if isAdmin}
	{#if variant === 'desktop'}
		<div class="preview-root">
			<button
				bind:this={btnEl}
				type="button"
				class="preview-btn"
				class:active={open || isViewingAsSune}
				class:impersonating={isViewingAsSune}
				aria-label={isViewingAsSune ? 'Previewing as Sune — open preview menu' : 'Preview as Sune'}
				aria-expanded={open}
				aria-haspopup="menu"
				onclick={(e) => {
					e.stopPropagation();
					open = !open;
				}}
				onkeydown={onBtnKeydown}
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
					aria-hidden="true"
				>
					<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
					<circle cx="12" cy="12" r="3" />
				</svg>
				{#if isViewingAsSune}
					<span class="preview-dot" aria-hidden="true"></span>
				{/if}
			</button>

			{#if open}
				<div
					bind:this={panelEl}
					class="preview-panel"
					role="menu"
					aria-label="Preview Sune"
					transition:fly={{ y: 8, duration: 160 }}
				>
					{#if isViewingAsSune}
						<div class="preview-banner" role="status" aria-live="polite">
							<span class="preview-banner-icon" aria-hidden="true">❦</span>
							<div class="preview-banner-text">
								<strong>Viewing as Sune</strong>
								<span>Rose Court theme active</span>
							</div>
						</div>
						<p class="preview-desc">You are seeing Sune’s personalized experience. Exit to return to your admin view.</p>
						<button type="button" class="preview-action preview-exit" role="menuitem" onclick={exitPreview}>
							Exit preview
						</button>
					{:else}
						<div class="preview-header">Preview</div>
						<p class="preview-current">
							Viewing as <strong>{adminLabel}</strong>
							<span class="preview-role">Admin</span>
						</p>
						<p class="preview-desc">Preview Sune’s dark-regal Rose Court theme as Sune sees it.</p>
						<button type="button" class="preview-action preview-enter" role="menuitem" onclick={previewSune}>
							<span class="preview-action-icon" aria-hidden="true">🌹</span>
							Preview Sune’s view
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Mobile variant — inside drawer -->
		<div class="preview-mobile">
			{#if isViewingAsSune}
				<div class="preview-mobile-banner">
					<span aria-hidden="true">❦</span>
					<strong>Viewing as Sune</strong>
				</div>
				<p class="preview-mobile-desc">Rose Court theme active.</p>
				<button type="button" class="menu-item preview-mobile-action preview-exit" onclick={exitPreview}>
					Exit preview
				</button>
			{:else}
				<p class="preview-mobile-current">Viewing as <strong>{adminLabel}</strong></p>
				<button type="button" class="menu-item preview-mobile-action preview-enter" onclick={previewSune}>
					<span aria-hidden="true">🌹</span> Preview Sune’s view
				</button>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.preview-root {
		position: relative;
	}

	.preview-btn {
		position: relative;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-full);
		color: var(--text-secondary);
		background: transparent;
		border: 1px solid transparent;
		transition:
			color var(--transition-fast),
			background var(--transition-fast),
			border-color var(--transition-fast),
			box-shadow var(--transition-fast);
	}

	.preview-btn:hover {
		color: var(--text-primary);
		background: var(--bg-card);
		border-color: var(--border-stream);
	}

	.preview-btn.active {
		color: #e7c663;
		background: rgba(212, 175, 55, 0.1);
		border-color: rgba(212, 175, 55, 0.28);
		box-shadow: 0 0 14px rgba(212, 175, 55, 0.18);
	}

	.preview-btn.impersonating {
		color: #e7c663;
		background: linear-gradient(135deg, rgba(142, 29, 46, 0.18), rgba(212, 175, 55, 0.12));
		border-color: rgba(212, 175, 55, 0.32);
		animation: suneEyeGlow 2.8s ease-in-out infinite alternate;
	}

	.preview-dot {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #d4af37;
		box-shadow: 0 0 6px rgba(212, 175, 55, 0.9);
		border: 1px solid #140d12;
	}

	@keyframes suneEyeGlow {
		0% {
			box-shadow: 0 0 0 rgba(212, 175, 55, 0);
		}
		100% {
			box-shadow: 0 0 14px rgba(212, 175, 55, 0.22);
		}
	}

	.preview-panel {
		position: absolute;
		top: calc(100% + 10px);
		right: 0;
		z-index: 120;
		width: 300px;
		padding: 1rem;
		border-radius: 16px;
		background: #140d12;
		border: 1px solid rgba(212, 175, 55, 0.22);
		box-shadow:
			0 16px 40px rgba(0, 0, 0, 0.55),
			0 0 32px rgba(142, 29, 46, 0.14),
			inset 0 1px 0 rgba(212, 175, 55, 0.08);
	}

	.preview-header {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #e7c663;
		margin-bottom: 0.5rem;
	}

	.preview-current {
		margin: 0;
		font-size: 0.9rem;
		color: #f6edf0;
		line-height: 1.4;
	}

	.preview-current strong {
		color: #f6edf0;
	}

	.preview-role {
		margin-left: 0.4rem;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		background: rgba(212, 175, 55, 0.12);
		border: 1px solid rgba(212, 175, 55, 0.2);
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #e7c663;
	}

	.preview-banner {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.75rem 0.85rem;
		border-radius: 12px;
		background: linear-gradient(135deg, rgba(142, 29, 46, 0.9), rgba(142, 29, 46, 0.7) 55%, rgba(212, 175, 55, 0.18));
		border: 1px solid rgba(212, 175, 55, 0.28);
		margin-bottom: 0.7rem;
	}

	.preview-banner-icon {
		font-size: 1.4rem;
		color: #e7c663;
		text-shadow: 0 0 10px rgba(212, 175, 55, 0.5);
	}

	.preview-banner-text {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
	}

	.preview-banner-text strong {
		font-size: 0.95rem;
		color: #fbf6ee;
	}

	.preview-banner-text span {
		font-size: 0.75rem;
		color: rgba(251, 246, 238, 0.78);
	}

	.preview-desc {
		margin: 0 0 0.9rem;
		font-size: 0.82rem;
		line-height: 1.45;
		color: #c9b3bc;
	}

	.preview-action {
		width: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.65rem 1rem;
		border-radius: 12px;
		font-size: 0.9rem;
		font-weight: 700;
		border: 1px solid transparent;
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast),
			background var(--transition-fast),
			border-color var(--transition-fast);
	}

	.preview-action:active {
		transform: scale(0.99);
	}

	.preview-enter {
		background: linear-gradient(135deg, #8e1d2e 0%, #b3243a 45%, #d4af37 100%);
		color: #fbf6ee;
		box-shadow: 0 4px 16px rgba(212, 175, 55, 0.22);
	}

	.preview-enter:hover {
		box-shadow: 0 6px 22px rgba(212, 175, 55, 0.3);
		transform: translateY(-1px);
	}

	.preview-exit {
		background: #1f1419;
		color: #f6edf0;
		border-color: rgba(212, 175, 55, 0.22);
	}

	.preview-exit:hover {
		background: #2a1a20;
		border-color: rgba(212, 175, 55, 0.32);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
	}

	.preview-action-icon {
		font-size: 1rem;
	}

	/* Mobile variant */
	.preview-mobile {
		padding: 0.5rem 0;
	}

	.preview-mobile-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.75rem;
		border-radius: 12px;
		background: linear-gradient(135deg, rgba(142, 29, 46, 0.9), rgba(212, 175, 55, 0.18));
		border: 1px solid rgba(212, 175, 55, 0.22);
		color: #fbf6ee;
		font-size: 0.9rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
	}

	.preview-mobile-current {
		margin: 0 0 0.5rem;
		padding: 0 0.5rem;
		font-size: 0.85rem;
		color: #c9b3bc;
	}

	.preview-mobile-current strong {
		color: #f6edf0;
	}

	.preview-mobile-desc {
		margin: 0 0 0.6rem;
		padding: 0 0.5rem;
		font-size: 0.78rem;
		color: #8a6f7a;
	}

	.preview-mobile-action {
		width: 100%;
		justify-content: center;
		border-radius: 12px;
		font-weight: 700;
	}

	@media (prefers-reduced-motion: reduce) {
		.preview-btn.impersonating {
			animation: none !important;
		}
		.preview-panel {
			transition: none !important;
		}
	}
</style>
