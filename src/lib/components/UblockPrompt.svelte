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
		if (/Firefox/.test(ua) && /Android/.test(ua)) { browserName = 'Firefox'; return true; }
		if (/Firefox/.test(ua) && !/Mobile/.test(ua)) { browserName = 'Firefox'; return true; }
		if (/Edg/.test(ua) && !/Mobile/.test(ua)) { browserName = 'Edge'; return true; }
		if (/Chrome/.test(ua) && !/Mobile/.test(ua)) { browserName = 'Chrome'; return true; }
		return false;
	}

	function getStoreLink(): string {
		switch (browserName) {
			case 'Firefox': return 'https://addons.mozilla.org/firefox/addon/ublock-origin/';
			case 'Edge': return 'https://microsoftedge.microsoft.com/addons/detail/ublock-origin/odfafepnkmbhccpbejgmiehpchacaeak';
			default: return 'https://chromewebstore.google.com/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm';
		}
	}

	function dismiss() {
		show = false;
		try { localStorage.setItem('ublock_prompt_dismissed', 'true'); } catch {}
	}

	onMount(() => {
		try {
			if (localStorage.getItem('ublock_prompt_dismissed') === 'true') return;
		} catch { return; }
		if (!ublockSupported()) return;
		setTimeout(() => { show = true; }, 2000);
	});
</script>

{#if show}
	<div transition:fly={{ y: -60, duration: 400 }} class="ublock-banner">
		<div class="ublock-content">
			<div class="ublock-left">
				<svg class="ublock-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
					<path d="M9 12l2 2 4-4" stroke-width="2"/>
				</svg>
				<div class="ublock-text">
					<div class="ublock-heading">Block popups & trackers</div>
					<div class="ublock-sub">Install uBlock Origin for {browserName} — free, open-source, takes 10 seconds</div>
				</div>
			</div>
			<div class="ublock-right">
				<a href={getStoreLink()} target="_blank" rel="noopener noreferrer" class="ublock-btn">Install</a>
				<button onclick={dismiss} class="ublock-close" aria-label="Dismiss">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.ublock-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		background: linear-gradient(135deg, #1e1b4b, #312e81);
		border-bottom: 1px solid rgba(129, 140, 248, 0.3);
		padding: 10px 16px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
	}
	.ublock-content {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.ublock-left {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;
	}
	.ublock-shield {
		width: 28px;
		height: 28px;
		color: #818cf8;
		flex-shrink: 0;
	}
	.ublock-text { min-width: 0; }
	.ublock-heading {
		font-size: 14px;
		font-weight: 700;
		color: #e4e4e7;
		line-height: 1.3;
	}
	.ublock-sub {
		font-size: 12px;
		color: #a1a1aa;
		line-height: 1.4;
		margin-top: 1px;
	}
	.ublock-right {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}
	.ublock-btn {
		display: inline-flex;
		align-items: center;
		padding: 7px 16px;
		background: #818cf8;
		color: #fff;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
		transition: background 0.15s;
	}
	.ublock-btn:active { background: #6366f1; }
	.ublock-close {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: #6366f1;
		cursor: pointer;
		border-radius: 6px;
		flex-shrink: 0;
	}
	.ublock-close svg { width: 16px; height: 16px; }
	.ublock-close:active { background: rgba(99, 102, 241, 0.15); }

	@media (max-width: 480px) {
		.ublock-banner { padding: 8px 12px; }
		.ublock-shield { width: 22px; height: 22px; }
		.ublock-heading { font-size: 13px; }
		.ublock-sub { font-size: 11px; }
		.ublock-btn { font-size: 12px; padding: 6px 12px; }
	}
</style>
