<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { isUser2 } from '../user2';

	let active = $state(false);
	let toast = $state('');

	const code = [
		'ArrowUp',
		'ArrowUp',
		'ArrowDown',
		'ArrowDown',
		'ArrowLeft',
		'ArrowRight',
		'ArrowLeft',
		'ArrowRight',
		'b',
		'a'
	];
	let pos = 0;

	const user = $derived(page.data.user ?? null);
	const enabled = $derived(isUser2(user as any));

	function trigger() {
		toast = 'You found the secret. Congrats, nerd. 🎉';
		active = true;
		// confetti burst
		const container = document.createElement('div');
		container.className = 'konami-burst';
		container.setAttribute('aria-hidden', 'true');
		for (let i = 0; i < 42; i++) {
			const dot = document.createElement('span');
			dot.className = 'konami-dot';
			dot.style.left = Math.random() * 100 + 'vw';
			dot.style.setProperty('--delay', Math.random() * 0.3 + 's');
			dot.style.setProperty('--x', (Math.random() * 200 - 100).toFixed(0) + 'px');
			dot.style.background = ['#a855f7', '#06b6d4', '#f472b6', '#facc15'][i % 4];
			container.appendChild(dot);
		}
		document.body.appendChild(container);
		setTimeout(() => container.remove(), 2200);
		setTimeout(() => {
			active = false;
			toast = '';
		}, 2800);
	}

	onMount(() => {
		const handler = (e: KeyboardEvent) => {
			if (!enabled) return;
			// ignore when typing in inputs
			const target = e.target as HTMLElement | null;
			if (
				target &&
				(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
			)
				return;
			if (e.key === code[pos]) {
				pos++;
				if (pos === code.length) {
					pos = 0;
					trigger();
				}
			} else {
				pos = e.key === 'ArrowUp' ? 1 : 0;
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	});
</script>

{#if toast}
	<div class="konami-toast" role="status">{toast}</div>
{/if}

<style>
	.konami-toast {
		position: fixed;
		top: 18%;
		left: 50%;
		transform: translateX(-50%);
		z-index: 9999;
		padding: 0.9rem 1.4rem;
		border-radius: 9999px;
		background: linear-gradient(90deg, #a855f7, #06b6d4);
		color: white;
		font-weight: 700;
		box-shadow: 0 8px 32px rgba(168, 85, 247, 0.45);
		animation: konamiIn 0.35s ease;
		pointer-events: none;
	}

	@keyframes konamiIn {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(8px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0) scale(1);
		}
	}

	:global(.konami-burst) {
		position: fixed;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: 9998;
	}

	:global(.konami-dot) {
		position: absolute;
		top: -10px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		animation: konamiFall 1.9s cubic-bezier(0.25, 1, 0.5, 1) var(--delay) forwards;
	}

	@keyframes konamiFall {
		0% {
			transform: translate3d(0, 0, 0) rotate(0deg);
			opacity: 1;
		}
		100% {
			transform: translate3d(var(--x), 100vh, 0) rotate(720deg);
			opacity: 0;
		}
	}
</style>
