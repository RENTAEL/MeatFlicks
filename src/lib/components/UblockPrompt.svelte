<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	let show = $state(false);
	let browserName = $state('');

	function ublockSupported(): boolean {
		const ua = navigator.userAgent;
		if (/iPhone|iPad|iPod/.test(ua)) return false;
		if (/Brave/.test(ua)) return false;
		if (/SamsungBrowser|OPR|UCBrowser/.test(ua)) return false;
		if (/Firefox/.test(ua)) { browserName = 'Firefox'; return true; }
		if (/Edg/.test(ua) && !/Mobile/.test(ua)) { browserName = 'Edge'; return true; }
		if (/Chrome/.test(ua) && !/Mobile/.test(ua)) { browserName = 'Chrome'; return true; }
		return false;
	}

	function getStoreLink(): string {
		switch (browserName) {
			case 'Firefox': return 'https://addons.mozilla.org/firefox/addon/ublock-origin-lite/';
			case 'Edge': return 'https://microsoftedge.microsoft.com/addons/detail/ublock-origin-lite/cimighlppcgcoapaliogpjjdehbnofhn';
			default: return 'https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh';
		}
	}

	function dismiss() {
		show = false;
		try { localStorage.setItem('ublock_lite_prompt_dismissed', 'true'); } catch {}
	}

	onMount(() => {
		try {
			if (localStorage.getItem('ublock_lite_prompt_dismissed') === 'true') return;
		} catch { return; }
		if (!ublockSupported()) return;
		setTimeout(() => { show = true; }, 2000);
	});
</script>

{#if show}
	<div transition:fly={{ y: -60, duration: 400 }} class="ublock-banner">
		<div class="ublock-content">
			<svg class="ublock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
				<polyline points="9 12 11 14 15 10"/>
			</svg>
			<div class="ublock-text">
				<span class="ublock-cta">Block popups & trackers</span>
				<span class="ublock-sub">Install uBlock Origin Lite for {browserName} — free, open-source, 10 seconds</span>
			</div>
			<a href={getStoreLink()} target="_blank" rel="noopener noreferrer" class="ublock-btn">Install</a>
			<button onclick={dismiss} class="ublock-close" aria-label="Dismiss">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
				</svg>
			</button>
		</div>
	</div>
{/if}

<style>
	.ublock-banner {
		position: fixed;
		top: 0; left: 0; right: 0;
		z-index: 100;
		background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
		border-bottom: 1px solid rgba(129, 140, 248, 0.3);
		padding: 0 16px;
	}
	.ublock-content {
		display: flex;
		align-items: center;
		gap: 12px;
		max-width: 900px;
		margin: 0 auto;
		padding: 12px 0;
		min-height: 48px;
	}
	.ublock-icon {
		width: 28px; height: 28px;
		flex-shrink: 0;
		color: #818cf8;
	}
	.ublock-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.ublock-cta {
		font-size: 14px;
		font-weight: 700;
		color: #e0e7ff;
		line-height: 1.3;
	}
	.ublock-sub {
		font-size: 12px;
		color: #a5b4fc;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.4;
	}
	.ublock-btn {
		padding: 8px 18px;
		background: #818cf8;
		color: #fff;
		border-radius: 8px;
		text-decoration: none;
		font-size: 13px;
		font-weight: 700;
		white-space: nowrap;
		flex-shrink: 0;
		transition: background 0.15s;
	}
	.ublock-btn:active { background: #6366f1; }
	.ublock-close {
		width: 32px; height: 32px;
		display: flex; align-items: center; justify-content: center;
		background: none; border: none; color: #6366f1;
		cursor: pointer; border-radius: 6px; flex-shrink: 0;
	}
	.ublock-close:active { color: #a5b4fc; }
	.ublock-close svg { width: 16px; height: 16px; }

	@media (max-width: 600px) {
		.ublock-content { gap: 8px; padding: 10px 0; }
		.ublock-icon { width: 22px; height: 22px; }
		.ublock-cta { font-size: 13px; }
		.ublock-sub { font-size: 11px; }
		.ublock-btn { padding: 6px 14px; font-size: 12px; }
	}
</style>
