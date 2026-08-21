<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { authStore } from '$lib/state/stores/authStore.svelte.ts';
	import { menuOpen } from '$lib/stores/menu';
	import { getBranding, isAdminUser } from '$lib/utils/branding';
	import type { BrandingType, PreviewBranding } from '$lib/utils/branding';
	import { previewStore } from '$lib/state/stores/previewStore.svelte.ts';
	import { impersonationStore } from '$lib/state/stores/impersonationStore.svelte.ts';
	import { watchlist } from '$lib/state/stores/watchlistStore.svelte.ts';

	let { variant = 'desktop' }: { variant?: 'desktop' | 'mobile' } = $props();

	const sessionUser = $derived(page.data.user ?? null);
	const firebaseUser = $derived(authStore.state.user);
	const isAdmin = $derived(
		isAdminUser(firebaseUser) ||
			(sessionUser
				? isAdminUser({ displayName: sessionUser.username, email: sessionUser.email })
				: false)
	);

	const preview = $derived(previewStore.current);
	const impersonated = $derived(impersonationStore.current);
	const actual = $derived(
		getBranding(firebaseUser) ??
			(sessionUser
				? getBranding({ displayName: sessionUser.username, email: sessionUser.email })
				: null)
	);
	const effective = $derived(
		impersonated
			? getBranding({ displayName: impersonated.username, email: impersonated.email })
			: preview === 'streamium'
				? null
				: (preview ?? actual)
	);

	// Real-time user list for impersonation
	interface UserEntry {
		id: string;
		username: string;
		email: string | null;
		role: string;
		createdAt: number;
	}

	const options: { label: string; value: PreviewBranding | null; hint?: string }[] = [
		{ label: 'Midnight', value: 'midnight', hint: 'ghostbunny_779' },
		{ label: 'Sofia', value: 'sofia', hint: 'cocolemon' },
		{ label: 'user (custom)', value: 'custom', hint: 'user' },
		{ label: 'Streamium', value: 'streamium', hint: 'default' }
	];

	function isActive(value: PreviewBranding | null): boolean {
		if (impersonated) return false;
		return effective === value;
	}

	function isUserActive(userId: string): boolean {
		return impersonated?.id === userId;
	}

	function pick(value: PreviewBranding | null) {
		impersonationStore.clear();
		previewStore.set(value);
		open = false;
		if (variant === 'mobile') menuOpen.set(false);
	}

	function impersonate(user: UserEntry) {
		previewStore.set(null);
		impersonationStore.impersonate({ id: user.id, username: user.username, email: user.email });
		open = false;
		if (variant === 'mobile') menuOpen.set(false);
		// Refresh watchlist to show impersonated user's data (empty for new users like aftermidnight)
		void watchlist.syncFromServer();
	}

	function clearImpersonation() {
		impersonationStore.clear();
		previewStore.set(null);
		open = false;
		if (variant === 'mobile') menuOpen.set(false);
		void watchlist.syncFromServer();
	}

	let open = $state(false);
	let connected = $state(false);
	let userList = $state<UserEntry[]>([]);
	let userError = $state<string | null>(null);

	// Real-time user list - reconnect when admin status changes
	$effect(() => {
		if (!isAdmin) return;
		const es = new EventSource('/api/admin/users/stream');
		es.addEventListener('users', (event) => {
			const data = JSON.parse((event as MessageEvent).data) as {
				users: UserEntry[];
				count: number;
				at: number;
			};
			userList = data.users;
		});
		es.addEventListener('error', (event) => {
			userError = 'Failed to load user list';
			console.error('[PreviewSwitcher] user stream error:', event);
		});
		es.onopen = () => (connected = true);
		es.onerror = () => {
			connected = false;
		};
		return () => es.close();
	});

	// Close handlers for desktop variant
	onMount(() => {
		if (variant !== 'desktop') return;
		const close = () => {
			open = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		window.addEventListener('click', close);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('click', close);
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

{#if isAdmin}
	{#if variant === 'desktop'}
		<div class="preview-root">
			<button
				type="button"
				class="preview-btn"
				class:active={open || preview !== null || !!impersonated}
				aria-label="Preview as user"
				aria-expanded={open}
				onclick={(e) => {
					e.stopPropagation();
					open = !open;
				}}
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
			</button>

			{#if open}
				<div
					class="preview-panel"
					role="menu"
					aria-label="Preview as user"
					tabindex="-1"
					transition:fly={{ y: 8, duration: 120 }}
				>
					<div class="preview-panel-title">Preview as user</div>
					{#each options as option (option.value)}
						<button
							type="button"
							class="preview-option"
							class:selected={isActive(option.value)}
							role="menuitem"
							onclick={() => pick(option.value)}
						>
							<span class="preview-option-label">{option.label}</span>
							{#if option.hint}
								<span class="preview-option-hint">{option.hint}</span>
							{/if}
							{#if isActive(option.value)}
								<span class="preview-check" aria-hidden="true">✓</span>
							{/if}
						</button>
					{/each}
					<div class="preview-divider"></div>
					{#if userList.length > 0}
						<div class="preview-panel-title">View as User</div>
						{#each userList as user (user.id)}
							<button
								type="button"
								class="preview-option"
								class:selected={isUserActive(user.id)}
								role="menuitem"
								onclick={() => impersonate(user)}
							>
								<span class="preview-option-label">{user.username}</span>
								<span class="preview-option-hint">{user.email || 'no email'}</span>
								{#if isUserActive(user.id)}
									<span class="preview-check" aria-hidden="true">✓</span>
								{/if}
							</button>
						{/each}
					{:else}
						<div class="preview-empty">No users found</div>
					{/if}
					<div class="preview-divider"></div>
					<button
						type="button"
						class="preview-option"
						class:selected={preview === null && !impersonated}
						disabled={preview === null && !impersonated}
						role="menuitem"
						onclick={clearImpersonation}
					>
						<span class="preview-option-label">Back to me</span>
						{#if preview === null && !impersonated}
							<span class="preview-check" aria-hidden="true">✓</span>
						{/if}
					</button>
				</div>
			{/if}
		</div>
	{:else}
		<div class="preview-mobile">
			<div class="preview-mobile-title">Preview as user</div>
			{#each options as option (option.value)}
				<button
					type="button"
					class="menu-item preview-mobile-option"
					class:selected={isActive(option.value)}
					onclick={() => pick(option.value)}
				>
					<span class="preview-option-label">{option.label}</span>
					<span class="preview-option-hint">{option.hint}</span>
					{#if isActive(option.value)}
						<span class="preview-check" aria-hidden="true">✓</span>
					{/if}
				</button>
			{/each}
			<div class="preview-divider"></div>
			{#if userList.length > 0}
				<div class="preview-mobile-title">View as User</div>
				{#each userList as user (user.id)}
					<button
						type="button"
						class="menu-item preview-mobile-option"
						class:selected={isUserActive(user.id)}
						onclick={() => impersonate(user)}
					>
						<span class="preview-option-label">{user.username}</span>
						<span class="preview-option-hint">{user.email || 'no email'}</span>
						{#if isUserActive(user.id)}
							<span class="preview-check" aria-hidden="true">✓</span>
						{/if}
					</button>
				{/each}
			{/if}
			<div class="preview-divider"></div>
			<button
				type="button"
				class="menu-item preview-mobile-option"
				class:selected={preview === null && !impersonated}
				disabled={preview === null && !impersonated}
				onclick={clearImpersonation}
			>
				<span class="preview-option-label">Back to me</span>
				{#if preview === null && !impersonated}
					<span class="preview-check" aria-hidden="true">✓</span>
				{/if}
			</button>
		</div>
	{/if}
{/if}

<style>
	.preview-root {
		position: relative;
	}

	.preview-btn {
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

	.preview-btn:hover {
		color: var(--text-primary);
		background: var(--bg-card);
	}

	.preview-btn.active {
		color: var(--accent-color, #818cf8);
		background: var(--bg-card);
	}

	.preview-panel {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 120;
		min-width: 210px;
		padding: 0.4rem;
		border-radius: var(--radius-lg);
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
	}

	.preview-panel-title,
	.preview-mobile-title {
		font-size: 0.7rem;
		font-weight: var(--font-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-secondary);
		padding: 0.4rem 0.6rem;
	}

	.preview-option {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.6rem;
		border-radius: var(--radius-md);
		font-size: 0.85rem;
		color: var(--text-primary);
		background: transparent;
		border: none;
		text-align: left;
		transition: all var(--transition-fast);
	}

	.preview-option:hover:not(:disabled) {
		background: var(--accent-soft);
	}

	.preview-option:disabled {
		opacity: 0.5;
	}

	.preview-option.selected {
		color: var(--accent-color, #818cf8);
		font-weight: var(--font-weight-semibold);
	}

	.preview-option-label {
		flex: 1;
	}

	.preview-option-hint {
		font-size: 0.72rem;
		color: var(--text-secondary);
	}

	.preview-check {
		color: var(--accent-color, #818cf8);
		font-size: 0.8rem;
	}

	.preview-divider {
		height: 1px;
		margin: 0.3rem 0;
		background: var(--border-stream);
	}

	.preview-mobile {
		margin-top: 0.25rem;
	}

	.preview-mobile-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.preview-mobile-option.selected {
		color: var(--accent-color, #818cf8);
		font-weight: var(--font-weight-semibold);
	}

	.preview-empty {
		padding: 0.45rem 0.6rem;
		font-size: 0.8rem;
		color: var(--text-tertiary);
		font-style: italic;
	}
</style>
