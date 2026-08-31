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
	import DemonSlayerEye from './DemonSlayerEye.svelte';
	import SuneRoseLogo from './SuneRoseLogo.svelte';
	import { isUser2, getRandomFunFact } from '$lib/experiments/user2';

	let { size = 'md', class: className = '' }: { size?: 'sm' | 'md' | 'lg'; class?: string } =
		$props();

	let logoClicks = $state<number[]>([]);
	let logoToast = $state('');
	let logoToastTimer: ReturnType<typeof setTimeout> | null = null;

	function handleLogoClick(e: MouseEvent) {
		const u = sessionUser ?? (firebaseUser ? { username: firebaseUser.displayName } : null);
		if (!isUser2(u as any)) return;
		const now = Date.now();
		logoClicks = [...logoClicks.filter((t) => now - t < 2000), now];
		if (logoClicks.length >= 5) {
			logoClicks = [];
			logoToast = getRandomFunFact();
			if (logoToastTimer) clearTimeout(logoToastTimer);
			logoToastTimer = setTimeout(() => (logoToast = ''), 3200);
		}
	}

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

	// For demon_slayer, show the user's username as the site name (per-user personalization)
	const demonSlayerName = $derived(
		impersonated?.username ?? sessionUser?.username ?? firebaseUser?.displayName ?? 'aftermidnight'
	);

	$effect(() => {
		// Brand themes: Sofia, Demon Slayer and Midnight Neon carry their palettes
		if (previewBranding === 'sofia') {
			themeStore.setBrandTheme('sofia', true);
		} else if (branding === 'demon_slayer' || previewBranding === 'demon_slayer') {
			themeStore.setBrandTheme('demon_slayer', true);
		} else if (branding === 'midnight_neon' || previewBranding === 'midnight_neon') {
			themeStore.setBrandTheme('midnight_neon', true);
		} else if (branding === 'sune' || previewBranding === 'sune') {
			themeStore.setBrandTheme('sune', true);
		} else {
			themeStore.setBrandTheme(branding);
		}
		// Premium: set data-branding for immersive backgrounds (all brands get equal polish)
		// Sune's view is the template, but each brand gets its own premium treatment.
		const activeBranding = previewBranding && previewBranding !== 'streamium' ? previewBranding : branding;
		if (typeof document !== 'undefined') {
			const el = document.documentElement;
			if (activeBranding) el.setAttribute('data-branding', activeBranding);
			else el.removeAttribute('data-branding');
			// Also reflect effective theme for Sune parity: any impersonation shows premium
			if (impersonated) el.setAttribute('data-premium', 'true');
			else el.removeAttribute('data-premium');
		}
	});
</script>

{#if branding === 'midnight'}
	<a
		href="/"
		class="logo {className}"
		title="Midnight"
		aria-label="Midnight Home"
		onclick={handleLogoClick}
	>
		<MidnightLogo {size} />
		<span class="logo-text">Midnight</span>
	</a>
{:else if branding === 'sofia'}
	<a
		href="/"
		class="logo {className}"
		title="Sofia the First"
		aria-label="Sofia Home"
		onclick={handleLogoClick}
	>
		<SofiaLogo {size} />
		<span class="logo-text logo-text-sofia">Sofia</span>
	</a>
{:else if branding === 'custom'}
	<a
		href="/"
		class="logo {className}"
		title="user"
		aria-label="Custom Home"
		onclick={handleLogoClick}
	>
		<CustomLogo {size} />
		<span class="logo-text logo-text-custom">user</span>
	</a>
{:else if branding === 'demon_slayer'}
	<a
		href="/"
		class="logo {className}"
		title={demonSlayerName}
		aria-label="{demonSlayerName} Home"
		onclick={handleLogoClick}
	>
		<DemonSlayerEye {size} />
		<span class="logo-text logo-text-demon">{demonSlayerName}</span>
	</a>
{:else if branding === 'midnight_neon'}
	<a
		href="/"
		class="logo logo-neon {className}"
		title="user2 · Midnight Neon"
		aria-label="user2 Home"
		onclick={handleLogoClick}
	>
		<MidnightLogo {size} />
		<span class="logo-text logo-text-neon">user2</span>
	</a>
{:else if branding === 'sune'}
	<a
		href="/"
		class="logo {className}"
		title="Sune"
		aria-label="Sune Home"
		onclick={handleLogoClick}
	>
		<SuneRoseLogo {size} />
		<span class="logo-text logo-text-sune">Sune</span>
	</a>
{:else}
	<a
		href="/"
		class="logo {className}"
		title="Streamium"
		aria-label="Streamium Home"
		onclick={handleLogoClick}
	>
		{#if size === 'sm'}
			<span class="logo-icon-sm">▶</span>
		{:else}
			<span class="logo-icon">▶</span>
		{/if}
		<span class="logo-text">Streamium</span>
	</a>
{/if}

{#if logoToast}
	<div class="logo-easter-toast" role="status">{logoToast}</div>
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

	.logo-text-demon {
		background: linear-gradient(90deg, #ff3b30, #ff8c00, #ff3b30);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		letter-spacing: -0.03em;
		text-shadow: 0 0 12px rgba(255, 59, 48, 0.35);
	}

	.logo-text-sune {
		background: linear-gradient(90deg, #e7c663, #d4af37, #b3243a);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		letter-spacing: 0.01em;
		text-shadow: 0 0 14px rgba(212, 175, 55, 0.28);
	}

	.logo-neon {
		filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.35));
	}

	.logo-text-neon {
		background: linear-gradient(90deg, #a855f7, #06b6d4, #a855f7);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		background-size: 200% 100%;
		animation: neonShift 3s linear infinite;
	}

	@keyframes neonShift {
		0% {
			background-position: 0% 50%;
		}
		100% {
			background-position: 200% 50%;
		}
	}

	.logo-easter-toast {
		position: fixed;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 9999;
		max-width: min(90vw, 420px);
		padding: 0.85rem 1.2rem;
		border-radius: 12px;
		background: linear-gradient(135deg, #a855f7, #06b6d4);
		color: white;
		font-size: 0.9rem;
		font-weight: 600;
		text-align: center;
		box-shadow: 0 8px 32px rgba(168, 85, 247, 0.35);
		animation: toastIn 0.3s ease;
		pointer-events: none;
	}

	@keyframes toastIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
</style>
