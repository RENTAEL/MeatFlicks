<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { SUPPORT_URL, SUPPORT_LABEL, SUPPORT_TOOLTIPS } from '$lib/config/support';
	import CoffeeCup from './CoffeeCup.svelte';

	let tipIndex = 0;
	let showTip = $state(false);
	let isTouch = $state(false);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	let tipEl: HTMLElement | null = $state(null);

	onMount(() => {
		tipIndex = Math.floor(Math.random() * SUPPORT_TOOLTIPS.length);
		const onTouch = () => (isTouch = true);
		window.addEventListener('touchstart', onTouch, { once: true, passive: true });
		return () => {
			window.removeEventListener('touchstart', onTouch);
			if (hideTimer) clearTimeout(hideTimer);
		};
	});

	const tooltip = $derived(SUPPORT_TOOLTIPS[tipIndex]);

	function reveal() {
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
		showTip = true;
	}

	function scheduleHide() {
		if (hideTimer) clearTimeout(hideTimer);
		hideTimer = setTimeout(() => (showTip = false), 160);
	}

	function hideNow() {
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
		showTip = false;
	}

	function onDismissOutside(e: Event) {
		if (!showTip) return;
		const target = e.target as Node;
		if (target && (tipEl?.contains(target) || (e.currentTarget as HTMLElement)?.contains?.(target))) return;
		hideNow();
	}

	function onTapOrClick(e: MouseEvent) {
		if (!isTouch) return; // desktop: let the anchor open the link
		// Mobile: first tap reveals the tooltip, second tap opens the link
		if (!showTip) {
			e.preventDefault();
			reveal();
			// auto-dismiss so it never lingers
			if (hideTimer) clearTimeout(hideTimer);
			hideTimer = setTimeout(hideNow, 2600);
		} else {
			hideNow(); // second tap: proceed with navigation
		}
	}
</script>

<svelte:window onclick={onDismissOutside} ontouchstart={onDismissOutside} />

<div class="coffee-fab-wrap">
	<a
		href={SUPPORT_URL}
		target="_blank"
		rel="noopener noreferrer"
		class="coffee-fab"
		aria-label={`${SUPPORT_LABEL} to support the developer`}
		aria-describedby={showTip ? 'coffee-tip' : undefined}
		onmouseenter={reveal}
		onmouseleave={scheduleHide}
		onfocus={reveal}
		onblur={scheduleHide}
		onclick={onTapOrClick}
	>
		<span class="coffee-fab-sheen" aria-hidden="true"></span>
		<CoffeeCup size={19} />
	</a>

	{#if showTip}
		<span
			bind:this={tipEl}
			id="coffee-tip"
			class="coffee-tip"
			role="tooltip"
			in:fly={{ y: 4, duration: 180 }}
			out:fade={{ duration: 120 }}
		>
			{tooltip}
			<span class="coffee-tip-arrow" aria-hidden="true"></span>
		</span>
	{/if}
</div>

<style>
	.coffee-fab-wrap {
		position: fixed;
		right: 24px;
		bottom: 88px;
		z-index: 480;
		display: flex;
		align-items: center;
		gap: 10px;
		/* entrance: gentle fade + rise, once */
		animation: fab-enter 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.6s both;
	}

	.coffee-fab {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 999px;
		color: #e7c663;
		background:
			radial-gradient(circle at 30% 25%, rgba(212, 175, 55, 0.1), transparent 55%),
			linear-gradient(180deg, rgba(42, 26, 32, 0.92), rgba(20, 13, 18, 0.92));
		border: 1px solid rgba(212, 175, 55, 0.24);
		box-shadow:
			0 2px 6px rgba(0, 0, 0, 0.35),
			0 10px 24px rgba(0, 0, 0, 0.45),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		overflow: hidden;
		transition:
			transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
			border-color 0.28s ease,
			color 0.28s ease,
			box-shadow 0.28s ease;
	}

	/* sheen — reads as a real button surface */
	.coffee-fab-sheen {
		position: absolute;
		inset: 0;
		background: linear-gradient(160deg, rgba(255, 255, 255, 0.09) 0%, transparent 42%);
		pointer-events: none;
	}

	.coffee-fab:hover {
		transform: translateY(-2px);
		color: #e0576f; /* readable burgundy shift */
		border-color: rgba(142, 29, 46, 0.65);
		box-shadow:
			0 4px 10px rgba(0, 0, 0, 0.4),
			0 14px 30px rgba(0, 0, 0, 0.5),
			0 0 22px rgba(142, 29, 46, 0.32),
			inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}

	.coffee-fab:active {
		transform: translateY(0);
	}

	.coffee-fab:focus-visible {
		outline: 2px solid rgba(212, 175, 55, 0.9);
		outline-offset: 3px;
	}

	/* Polished tooltip — styled element with arrow, not a title attribute */
	.coffee-tip {
		position: absolute;
		right: calc(100% + 12px);
		top: 50%;
		transform: translateY(-50%);
		width: max-content;
		max-width: min(250px, 62vw);
		padding: 0.55rem 0.8rem;
		border-radius: 12px;
		background: linear-gradient(180deg, #2a1a20, #140d12);
		border: 1px solid rgba(212, 175, 55, 0.26);
		box-shadow:
			0 10px 28px rgba(0, 0, 0, 0.55),
			0 0 18px rgba(142, 29, 46, 0.14);
		color: #f6edf0;
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1.4;
		text-align: left;
	}

	.coffee-tip-arrow {
		position: absolute;
		right: -5px;
		top: 50%;
		width: 9px;
		height: 9px;
		background: #22141a;
		border-right: 1px solid rgba(212, 175, 55, 0.26);
		border-top: 1px solid rgba(212, 175, 55, 0.26);
		transform: translateY(-50%) rotate(45deg);
	}

	@keyframes fab-enter {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 768px) {
		.coffee-fab-wrap {
			right: 16px;
			bottom: calc(var(--nav-height, 64px) + env(safe-area-inset-bottom, 0px) + 72px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.coffee-fab-wrap {
			animation: none;
		}
		.coffee-fab,
		.coffee-tip {
			transition: none !important;
		}
		.coffee-fab:hover {
			transform: none;
		}
	}
</style>
