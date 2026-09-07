<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { SUPPORT_URL, SUPPORT_LABEL, pickSupportTooltip } from '$lib/config/support';

	let tooltip = $state('');
	let showTip = $state(false);

	onMount(() => {
		tooltip = pickSupportTooltip();
	});

	function reveal() {
		if (!tooltip) tooltip = pickSupportTooltip();
		showTip = true;
	}

	function hide() {
		showTip = false;
	}
</script>

<div class="coffee-fab-wrap">
	{#if showTip}
		<span class="coffee-tip" role="tooltip" transition:fade={{ duration: 140 }}>{tooltip}</span>
	{/if}
	<a
		href={SUPPORT_URL}
		target="_blank"
		rel="noopener noreferrer"
		class="coffee-fab"
		aria-label={`${SUPPORT_LABEL} to support the developer`}
		aria-expanded={showTip}
		onmouseenter={reveal}
		onfocus={reveal}
		onmouseleave={hide}
		onblur={hide}
		onclick={hide}
	>
		<svg
			class="coffee-cup"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M17 8h1a4 4 0 1 1 0 8h-1" />
			<path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
			<line x1="6" x2="6" y1="2" y2="4" />
			<line x1="10" x2="10" y1="2" y2="4" />
			<line x1="14" x2="14" y1="2" y2="4" />
		</svg>
	</a>
</div>

<style>
	.coffee-fab-wrap {
		position: fixed;
		left: 14px;
		bottom: calc(var(--nav-height, 64px) + env(safe-area-inset-bottom, 0px) + 14px);
		z-index: 490;
		display: flex;
		align-items: center;
		gap: 10px;
		pointer-events: none;
	}

	.coffee-fab {
		pointer-events: auto;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 999px;
		color: #e7c663;
		background: rgba(20, 13, 18, 0.88);
		border: 1px solid rgba(142, 29, 46, 0.35);
		box-shadow:
			0 4px 16px rgba(0, 0, 0, 0.4),
			0 0 12px rgba(142, 29, 46, 0.12);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			color 0.2s ease;
	}

	.coffee-fab:hover {
		color: #f3d9a4;
		border-color: rgba(142, 29, 46, 0.6);
		box-shadow:
			0 6px 20px rgba(0, 0, 0, 0.45),
			0 0 18px rgba(142, 29, 46, 0.28);
	}

	.coffee-fab:focus-visible {
		outline: 2px solid rgba(212, 175, 55, 0.9);
		outline-offset: 2px;
	}

	.coffee-cup {
		width: 18px;
		height: 18px;
	}

	.coffee-tip {
		pointer-events: none;
		position: absolute;
		left: calc(100% + 10px);
		bottom: 2px;
		max-width: min(240px, 60vw);
		padding: 0.45rem 0.7rem;
		border-radius: 10px;
		background: #140d12;
		border: 1px solid rgba(212, 175, 55, 0.22);
		color: #f6edf0;
		font-size: 0.78rem;
		line-height: 1.35;
		white-space: normal;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	}

	@media (min-width: 769px) {
		.coffee-fab-wrap {
			left: 22px;
			bottom: 22px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.coffee-fab {
			transition: none;
		}
	}
</style>
