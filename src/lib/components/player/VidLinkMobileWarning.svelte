<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	let {
		onTryOther,
		onPlayAnyway,
		onDismiss
	}: {
		onTryOther: () => void;
		onPlayAnyway: () => void;
		onDismiss: () => void;
	} = $props();
</script>

<div
	class="popup-backdrop"
	data-app-ui
	onclick={onDismiss}
	onkeydown={(e) => e.key === 'Escape' && onDismiss()}
	role="button"
	tabindex="-1"
	aria-label="Close"
	transition:fade={{ duration: 150 }}
></div>

<div
	class="popup"
	data-app-ui
	transition:fly={{ y: 30, duration: 250 }}
	role="alertdialog"
	aria-label="VidLink mobile warning"
>
	<button class="popup-close" onclick={onDismiss} aria-label="Dismiss">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	</button>

	<div class="popup-icon">🧊</div>
	<h3 class="popup-title">Heads up: VidLink + your phone = enemies</h3>
	<p class="popup-text">
		This provider and mobile phones get along about as well as two cats in a bathtub. It plays a
		smooth 10 seconds — a beautiful sizzle reel for what could have been — then freezes like it saw
		a ghost. Desktop? Chef's kiss. Your phone? Chef's <em>why</em>.
	</p>

	<div class="popup-actions">
		<button type="button" class="popup-cta" onclick={onTryOther}> 🚀 Try another provider </button>
		<button type="button" class="popup-secondary" onclick={onPlayAnyway}>
			🧊 Play anyway (I like danger)
		</button>
	</div>

	<p class="popup-settings-hint">
		💻 Desktop browsers run VidLink flawlessly — this warning is phone-only.
	</p>
</div>

<style>
	.popup-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1200;
	}

	.popup {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 1201;
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
	.popup-text em {
		color: #e0e7ff;
	}

	.popup-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 16px;
	}

	.popup-cta {
		background: #4338ca;
		color: #fff;
		padding: 12px 24px;
		border: none;
		border-radius: 10px;
		font-weight: 600;
		font-size: 15px;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s;
	}
	.popup-cta:hover {
		background: #6366f1;
	}

	.popup-secondary {
		background: transparent;
		color: #a5b4fc;
		padding: 10px 24px;
		border: 1px solid rgba(129, 140, 248, 0.35);
		border-radius: 10px;
		font-weight: 500;
		font-size: 14px;
		font-family: inherit;
		cursor: pointer;
		transition: all 0.15s;
	}
	.popup-secondary:hover {
		background: rgba(129, 140, 248, 0.12);
		color: #e0e7ff;
	}

	.popup-settings-hint {
		margin-top: 16px;
		font-size: 12px;
		color: #9ca3af;
		line-height: 1.5;
	}
</style>
