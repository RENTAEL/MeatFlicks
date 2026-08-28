<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { isMobileDevice } from '$lib/utils/device';

	let visible = $state(false);
	let showHowTo = $state(false);

	// Once-per-session flag (sessionStorage): the modal appears at most once per
	// browser session and re-arms on a new session.
	const STORAGE_KEY = 'private_tab_modal_seen';
	// Key owned by MobileBrowserPopup. On a user's FIRST mobile session that popup
	// is about to show, so we yield this session and let the two never stack.
	const BROWSER_REC_KEY = 'mobile_browser_rec_seen';

	const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
	const isIos = /iPhone|iPad|iPod|iOS/i.test(ua);

	// Browsers refuse to open a true incognito window via JS, so we hand the user
	// the exact manual steps instead. Tailored per platform.
	const howTo = isIos
		? 'In Safari: tap the Tabs icon (two overlapping squares) → “Private” → “+”. The shadows welcome you.'
		: 'In Chrome: tap ⋮ (three dots) → “New incognito tab”. Step into the quiet.';

	function dismiss() {
		visible = false;
		try {
			sessionStorage.setItem(STORAGE_KEY, '1');
		} catch {
			// storage unavailable — just don't nag again this session
		}
	}

	function openPrivate() {
		showHowTo = true;
	}

	onMount(() => {
		if (!isMobileDevice()) return;
		try {
			if (sessionStorage.getItem(STORAGE_KEY)) return;
			if (!localStorage.getItem(BROWSER_REC_KEY)) return; // first session → let MobileBrowserPopup handle it
			sessionStorage.setItem(STORAGE_KEY, '1');
		} catch {
			return;
		}
		const timer = setTimeout(() => {
			visible = true;
		}, 2200);
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
		aria-label="Watch in a private tab"
	>
		<button class="popup-close" onclick={dismiss} aria-label="Dismiss">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>

		<div class="popup-icon" aria-hidden="true">🌑</div>
		<h3 class="popup-title">The noise hates the dark.</h3>
		<p class="popup-text">
			The loud ones — ads, pop-ups, the things that follow — can't find you in a private tab.
			Chrome's private tab is the quiet path: cleaner, calmer, ad-free.
		</p>
		<p class="popup-text popup-text-secondary">
			Other doors work too. But the shadows are strongest in Chrome's private tab.
		</p>

		{#if showHowTo}
			<div class="popup-howto">{howTo}</div>
			<div class="popup-actions">
				<button type="button" class="popup-cta" onclick={dismiss}>Got it — into the shadows</button>
			</div>
		{:else}
			<div class="popup-actions">
				<button type="button" class="popup-cta" onclick={openPrivate}>Open in Private Tab →</button>
			</div>
			<div class="popup-actions">
				<button type="button" class="popup-later" onclick={dismiss}>I'll risk it</button>
			</div>
		{/if}

		<p class="popup-hint">We can't force the shadows for you. This stays here, once per visit.</p>
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

	.popup-text-secondary {
		margin-top: -10px;
		margin-bottom: 18px;
		opacity: 0.85;
	}

	.popup-howto {
		font-size: 0.85rem;
		color: var(--text-primary, #e0e7ff);
		background: var(--bg-elevated, rgba(255, 255, 255, 0.06));
		border: 1px solid var(--border-stream, rgba(255, 255, 255, 0.12));
		border-radius: var(--radius-md, 10px);
		padding: 12px 14px;
		line-height: 1.55;
		margin: 0 0 18px;
		text-align: left;
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
		font-family: inherit;
		border: none;
		cursor: pointer;
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
