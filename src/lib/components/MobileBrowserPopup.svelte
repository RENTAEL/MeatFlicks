<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { isDesktopDevice } from '$lib/utils/device';

	let visible = $state(false);
	const STORAGE_KEY = 'mobile_browser_rec_seen';

	const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
	const isIos = /iPhone|iPad|iPod|iOS/i.test(ua);
	const braveUrl = isIos
		? 'https://apps.apple.com/app/brave-private-web-browser/id1052879175'
		: 'https://play.google.com/store/apps/details?id=com.brave.browser';
	const firefoxUrl = isIos
		? 'https://apps.apple.com/app/firefox-private-safe-browser/id989804926'
		: 'https://play.google.com/store/apps/details?id=org.mozilla.firefox';

	function dismiss() {
		visible = false;
		try {
			localStorage.setItem(STORAGE_KEY, '1');
		} catch {
			// storage unavailable — popup just won't nag again this session
		}
	}

	onMount(() => {
		// Mobile-only counterpart to the desktop adblocker — never show it on desktop.
		if (isDesktopDevice()) return;
		try {
			// At-most-once: flag is set the moment it's shown, so returning users are
			// never blocked by it again (and dismiss just closes it early).
			if (localStorage.getItem(STORAGE_KEY)) return;
			localStorage.setItem(STORAGE_KEY, '1');
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
		aria-label="Ad-free browser recommendation"
	>
		<button class="popup-close" onclick={dismiss} aria-label="Dismiss">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>

		<div class="popup-icon" aria-hidden="true">📱</div>
		<h3 class="popup-title">Ads on your phone? Rude.</h3>
		<p class="popup-text">
			The desktop adblocker doesn't work on phones — but these browsers block popups and ads all by
			themselves. Free, fast, done. No extensions, no fiddling.
		</p>
		<div class="popup-actions">
			<a href={braveUrl} target="_blank" rel="noopener" class="popup-cta" onclick={dismiss}>
				Get Brave
			</a>
			<a
				href={firefoxUrl}
				target="_blank"
				rel="noopener"
				class="popup-cta popup-cta-alt"
				onclick={dismiss}
			>
				Get Firefox
			</a>
		</div>
		<div class="popup-actions">
			<button type="button" class="popup-later" onclick={dismiss}>Maybe later</button>
		</div>

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
		margin-top: 0.5rem;
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

	.popup-cta-alt {
		background: var(--bg-elevated, rgba(255, 255, 255, 0.06));
		border: 1px solid var(--border-stream, rgba(255, 255, 255, 0.12));
		color: var(--text-primary, #e0e7ff);
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
