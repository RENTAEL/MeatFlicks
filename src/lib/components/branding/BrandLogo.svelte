<script lang="ts">
	import { page } from '$app/state';
	import { authStore } from '$lib/state/stores/authStore.svelte.ts';
	import { getBranding } from '$lib/utils/branding';
	import { themeStore } from '$lib/stores/theme';
	import { previewStore } from '$lib/state/stores/previewStore.svelte.ts';
	import { impersonationStore } from '$lib/state/stores/impersonationStore.svelte.ts';
	import CustomLogo from './CustomLogo.svelte';
	import MidnightLogo from './MidnightLogo.svelte';
	import SofiaLogo from './SofiaLogo.svelte';

	let { size = 'md', class: className = '' }: { size?: 'sm' | 'md' | 'lg'; class?: string } =
		$props();

	const sessionUser = $derived(page.data.user ?? null);
	const firebaseUser = $derived(authStore.state.user);
	const impersonated = $derived(impersonationStore.current);
	const actualBranding = $derived(
		getBranding(firebaseUser) ??
			(sessionUser
				? getBranding({ displayName: sessionUser.username, email: sessionUser.email })
				: null)
	);
	const previewBranding = $derived(previewStore.current);
	const branding = $derived(
		impersonated
			? (getBranding({ displayName: impersonated.username, email: impersonated.email }) ?? null)
			: previewBranding === 'streamium'
				? null
				: (previewBranding ?? actualBranding)
	);

	$effect(() => {
		// Brand themes: Sofia carries its series palette; everything else uses
		// the user's explicit choice or the standard default.
		if (previewBranding === 'sofia') {
			themeStore.setBrandTheme('sofia', true);
		} else {
			themeStore.setBrandTheme(branding);
		}
	});
</script>

{#if branding === 'midnight'}
	<a href="/" class="logo {className}" title="Midnight" aria-label="Midnight Home">
		<MidnightLogo {size} />
		<span class="logo-text">Midnight</span>
	</a>
{:else if branding === 'sofia'}
	<a href="/" class="logo {className}" title="Sofia the First" aria-label="Sofia Home">
		<SofiaLogo {size} />
		<span class="logo-text logo-text-sofia">Sofia</span>
	</a>
{:else if branding === 'custom'}
	<a href="/" class="logo {className}" title="user" aria-label="Custom Home">
		<CustomLogo {size} />
		<span class="logo-text logo-text-custom">user</span>
	</a>
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

	.logo-text-sofia {
		background: linear-gradient(90deg, #fcd34d, #f472b6, #a78bfa);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
</style>
