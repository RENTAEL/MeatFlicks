<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';

	let visible = $state(false);

	const STORAGE_KEY = 'ublock_popup_dismissed';
	const uaBrands =
		typeof navigator !== 'undefined'
			? ((navigator as { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands ?? [])
					.map((b) => b.brand)
					.join(' ')
			: '';
	const browser = uaBrands || (typeof navigator !== 'undefined' ? navigator.userAgent : '');

	const isSupported =
		/Chrome|Edge|Brave|Chromium/i.test(browser) && !/iOS|iPhone|iPad/i.test(browser);

	const links = {
		chrome:
			'https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh',
		edge: 'https://microsoftedge.microsoft.com/addons/detail/ublock-origin-lite/cimighlppcgcoapaliogpjjdehbnofjd'
	};

	function getStoreLink(): string {
		if (/Edge/i.test(browser)) return links.edge;
		return links.chrome;
	}

	function dismiss() {
		visible = false;
		try {
			localStorage.setItem(STORAGE_KEY, 'true');
		} catch {}
	}

	onMount(() => {
		if (!isSupported) return;
		try {
			// The adblocker intro owns the very first visit — don't stack on top of it.
			if (!localStorage.getItem('adblocker_intro_seen')) return;
		} catch {}
		const dismissed = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
		if (!dismissed) {
			setTimeout(() => {
				visible = true;
			}, 1500);
		}
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

	<div class="popup" data-app-ui transition:fly={{ y: 30, duration: 250 }}>
		<button class="popup-close" onclick={dismiss} aria-label="Dismiss">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>

		<div class="popup-icon">🛡️</div>
		<h3 class="popup-title">Block Annoying Popups</h3>
		<p class="popup-text">
			Video players on this site may open popups. Install
			<strong>uBlock Origin Lite</strong> to block them automatically. It's free, lightweight, and takes
			10 seconds.
		</p>

		<a href={getStoreLink()} target="_blank" rel="noopener" class="popup-cta">
			Install uBlock Origin Lite →
		</a>

		<p class="popup-settings-hint">
			You can find this again anytime in <a href="/settings" onclick={dismiss}>Settings</a>.
		</p>
	</div>
{/if}

<style>
	.popup-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1000;
	}

	.popup {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1001;
		width: 420px;
		max-width: calc(100vw - 32px);
		background: #1e1b4b;
		border: 1px solid rgba(129, 140, 248, 0.25);
		border-radius: 16px;
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
		color: #a5b4fc;
		cursor: pointer;
		padding: 4px;
		border-radius: 6px;
	}
	.popup-close:hover {
		background: rgba(129, 140, 248, 0.1);
		color: #e0e7ff;
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
		font-size: 20px;
		font-weight: 700;
		color: #e0e7ff;
		margin: 0 0 8px;
	}
	.popup-text {
		font-size: 14px;
		color: #a5b4fc;
		line-height: 1.6;
		margin: 0 0 20px;
	}
	.popup-text strong {
		color: #e0e7ff;
	}

	.popup-cta {
		display: inline-block;
		background: #4338ca;
		color: #fff;
		padding: 12px 24px;
		border-radius: 10px;
		font-weight: 600;
		font-size: 15px;
		text-decoration: none;
		transition: background 0.15s;
	}
	.popup-cta:hover {
		background: #6366f1;
	}

	.popup-settings-hint {
		margin-top: 16px;
		font-size: 12px;
		color: #9ca3af;
	}
	.popup-settings-hint a {
		color: #818cf8;
		text-decoration: underline;
	}
</style>
