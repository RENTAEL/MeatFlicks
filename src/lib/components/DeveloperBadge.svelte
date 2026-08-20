<script lang="ts">
	import { fade, scale } from 'svelte/transition';

	let open = $state(false);
	let messageIndex = $state(0);

	const messages = [
		'Hand-crafted by the developer. No AI was harmed in the making of this site. 🤖👀',
		"the developer built this. The bugs are also his. You're welcome. 🐛",
		"Made by the developer. He definitely didn't forget a semicolon somewhere. Probably.",
		"This site runs on caffeine and the developer's questionable life choices. ☕",
		'the developer wrote this. If it breaks, blame him, not the tech stack. 😎'
	];

	function cycleMessage() {
		messageIndex = (messageIndex + 1) % messages.length;
	}

	function handleClick() {
		if (open) {
			cycleMessage();
		} else {
			open = true;
		}
	}
</script>

<div class="gavin-badge-wrapper" data-app-ui>
	<button
		class="gavin-badge-btn"
		onclick={handleClick}
		aria-label="Made by the developer — click for details"
		title="Psst..."
	>
		<span class="badge-face face-default">😎</span>
		<span class="badge-face face-hover">🫡</span>
	</button>

	{#if open}
		<div class="gavin-popup" transition:scale={{ start: 0.8, duration: 250 }}>
			<div class="popup-arrow"></div>
			<div class="popup-content">
				<div class="popup-avatar">
					<span>🧑‍💻</span>
				</div>
				<div class="popup-text">
					<p class="popup-message">{messages[messageIndex]}</p>
					<p class="popup-hint">Click to cycle →</p>
				</div>
				<button class="popup-close" onclick={() => (open = false)} aria-label="Close"> ✕ </button>
			</div>
		</div>
	{/if}
</div>

<style>
	.gavin-badge-wrapper {
		position: fixed;
		bottom: 5rem;
		left: 1.5rem;
		z-index: 999;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.gavin-badge-btn {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.4rem;
		cursor: pointer;
		position: relative;
		transition: all var(--transition-base);
		box-shadow: var(--shadow-md);
	}

	.gavin-badge-btn:hover {
		transform: scale(1.1);
		border-color: var(--accent);
		box-shadow: 0 0 20px var(--accent-glow);
	}

	.badge-face {
		position: absolute;
		transition: opacity var(--transition-fast);
	}

	.badge-face.face-hover {
		opacity: 0;
	}

	.gavin-badge-btn:hover .face-default {
		opacity: 0;
	}

	.gavin-badge-btn:hover .face-hover {
		opacity: 1;
	}

	.gavin-popup {
		position: relative;
		background: var(--bg-elevated);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-lg);
		max-width: 320px;
		box-shadow: var(--shadow-lg);
		overflow: visible;
	}

	.popup-arrow {
		position: absolute;
		bottom: -8px;
		left: 16px;
		width: 16px;
		height: 16px;
		background: var(--bg-elevated);
		border-right: 1px solid var(--border-strong);
		border-bottom: 1px solid var(--border-strong);
		transform: rotate(45deg);
	}

	.popup-content {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		align-items: flex-start;
	}

	.popup-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--gradient-brand);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.popup-text {
		flex: 1;
		min-width: 0;
	}

	.popup-message {
		font-size: 0.85rem;
		color: var(--text-primary);
		line-height: 1.5;
		margin: 0 0 0.35rem;
	}

	.popup-hint {
		font-size: 0.7rem;
		color: var(--text-tertiary);
		margin: 0;
	}

	.popup-close {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		color: var(--text-tertiary);
		background: none;
		border: none;
		cursor: pointer;
		flex-shrink: 0;
		transition: color var(--transition-fast);
	}

	.popup-close:hover {
		color: var(--text-primary);
	}

	@media (max-width: 480px) {
		.gavin-badge-wrapper {
			bottom: 4.5rem;
			left: 0.75rem;
		}

		.gavin-popup {
			max-width: 280px;
		}
	}
</style>
