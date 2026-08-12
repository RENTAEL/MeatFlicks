<script lang="ts">
	import { authStore } from '$lib/state/stores/authStore.svelte.ts';
	import MidnightLogo from './MidnightLogo.svelte';

	let { size = 'md', class: className = '' }: { size?: 'sm' | 'md' | 'lg'; class?: string } =
		$props();

	function isMidnightUser(): boolean {
		const user = authStore.state.user;
		if (!user) return false;
		return user.displayName === 'ghostbunny_779' || user.email === 'ghostbunny_779@example.com';
	}
</script>

{#if isMidnightUser()}
	<MidnightLogo {size} class={className} />
{:else}
	<a href="/" class="logo {className}" title="Streamium" aria-label="Streamium Home">
		{#if size === 'sm'}
			<span class="logo-icon-sm">▶</span>
		{:else}
			<span class="logo-icon">▶</span>
		{/if}
		<span class="logo-text">Streamium</span>
	</a>
{/if}

<style>
	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: var(--font-weight-extrabold);
		font-size: 1.25rem;
		letter-spacing: -0.02em;
		transition: opacity var(--transition-fast);
		text-decoration: none;
	}

	.logo:hover {
		opacity: 0.85;
	}

	.logo-icon,
	.logo-icon-sm {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
		background: var(--gradient-brand);
		color: white;
	}

	.logo-icon {
		width: 32px;
		height: 32px;
		font-size: 0.75rem;
	}

	.logo-icon-sm {
		width: 24px;
		height: 24px;
		font-size: 0.6rem;
	}

	.logo-text {
		background: var(--gradient-brand-horizontal);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
</style>
