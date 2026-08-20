<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { isDesktopDevice } from '$lib/utils/device';

	let { isLoggedIn = false }: { isLoggedIn?: boolean } = $props();

	let visible = $state(false);
	const STORAGE_KEY = 'adblocker_intro_seen';

	function dismiss() {
		visible = false;
		try {
			localStorage.setItem(STORAGE_KEY, '1');
		} catch {
			// storage unavailable — popup just won't nag again this session
		}
	}

	onMount(() => {
		if (!isDesktopDevice()) return;
		try {
			if (localStorage.getItem(STORAGE_KEY)) return;
		} catch {
			return;
		}
		const timer = setTimeout(() => {
			visible = true;
		}, 1800);
		return () => clearTimeout(timer);
	});
</script>

{#if visible}
	<div
		class="popup-backdrop"
		data-app-ui
		onclick={dismiss}
		onkeydown={(e) => e.key === 'Escape' && dismiss()}
		role="button"
		tabindex="-1"
		aria-label="Close"
		transition:fade={{ duration: 150 }}
	></div>

	<div
		class="popup"
		data-app-ui
		transition:fly={{ y: 30, duration: 250 }}
		role="dialog"
		aria-modal="true"
		aria-label="Adblocker intro"
	>
		<button class="popup-close" onclick={dismiss} aria-label="Dismiss">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>

		<div class="popup-icon" aria-hidden="true">🛡️</div>
		{#if isLoggedIn}
			<h3 class="popup-title">The adblocker? It's in Settings.</h3>
			<p class="popup-text">
				Streamium's adblocker options are waiting for you in Settings. PC only, obviously — sorry
				mobile, you're on your own. 🖥️
			</p>
			<a href="/settings" onclick={dismiss} class="popup-cta">Open Settings →</a>
		{:else}
			<h3 class="popup-title">Adblocker? PC users only.</h3>
			<p class="popup-text">
				Yep, Streamium has adblocker options — they live in Settings, and Settings is members-only.
				Create a free account and it's all yours. Oh, and it's PC only. Suck it, mobile users. 🤣
			</p>
			<div class="popup-actions">
				<a href="/signup" onclick={dismiss} class="popup-cta">Create account</a>
				<button type="button" class="popup-later" onclick={dismiss}>Maybe later</button>
			</div>
		{/if}

		<p class="popup-hint">You can find this again anytime in Settings.</p>
	</div>
{/if}

<style>
	.popup-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		z-index: 1000;
	}

	.popup {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1001;
		width: 440px;
		max-width: calc(100vw - 32px);
		background: var(--bg-card, #1e1b4b);
		border: 1px solid rgba(129, 140, 248, 0.35);
		border-radius: var(--radius-lg, 16px);
		padding: 32px 28px 24px;
		text-align: center;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
	}

	.popup-close {
		position: absolute;
		top: 12px;
		right: 12px;
		background: none;
		border: none;
		color: var(--text-secondary, #a5b4fc);
		cursor: pointer;
		padding: 4px;
		border-radius: 6px;
	}

	.popup-close:hover {
		background: rgba(129, 140, 248, 0.1);
		color: var(--text-primary, #e0e7ff);
	}

	.popup-close svg {
		width: 18px;
		height: 18px;
	}

	.popup-icon {
		font-size: 40px;
		margin-bottom: 12px;
	}

	.popup-title {
		font-size: 1.25rem;
		font-weight: var(--font-weight-extrabold, 700);
		color: var(--text-primary, #e0e7ff);
		margin: 0 0 10px;
	}

	.popup-text {
		font-size: 0.9rem;
		color: var(--text-secondary, #a5b4fc);
		line-height: 1.6;
		margin: 0 0 20px;
	}

	.popup-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.popup-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--gradient-brand, #4338ca);
		color: #fff;
		padding: 12px 24px;
		border-radius: var(--radius-full, 10px);
		font-weight: 600;
		font-size: 0.95rem;
		text-decoration: none;
		transition:
			background 0.15s,
			transform 0.15s;
	}

	.popup-cta:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 20px var(--accent-glow, rgba(99, 102, 241, 0.4));
	}

	.popup-later {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 12px 18px;
		border-radius: var(--radius-full, 10px);
		background: var(--bg-elevated, rgba(255, 255, 255, 0.06));
		border: 1px solid var(--border-stream, rgba(255, 255, 255, 0.12));
		color: var(--text-secondary, #a5b4fc);
		font-size: 0.9rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
	}

	.popup-later:hover {
		color: var(--text-primary, #e0e7ff);
	}

	.popup-hint {
		margin-top: 16px;
		font-size: 0.75rem;
		color: var(--text-tertiary, #9ca3af);
	}
</style>
