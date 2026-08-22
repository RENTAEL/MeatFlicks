<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { playSoundEffect, unlockAudio } from '$lib/watch-party/sounds';

	type Command = { id: number; type: string; target: string; at: number };

	let scareActive = $state(false);
	let peekabooActive = $state(false);
	let surpriseActive = $state(false);
	let bananaActive = $state(false);

	function guestSid(): string | null {
		if (page.data.user) return null;
		try {
			return sessionStorage.getItem('guest-sid');
		} catch {
			return null;
		}
	}

	function fire(type: string) {
		switch (type) {
			case 'jumpscare':
				if (scareActive) return;
				scareActive = true;
				playSoundEffect('jump');
				setTimeout(() => (scareActive = false), 1800);
				break;
			case 'peekaboo':
				if (peekabooActive) return;
				peekabooActive = true;
				playSoundEffect('suspense');
				setTimeout(() => (peekabooActive = false), 4000);
				break;
			case 'surprise':
				if (surpriseActive) return;
				surpriseActive = true;
				playSoundEffect('applause');
				setTimeout(() => (surpriseActive = false), 3800);
				break;
			case 'banana':
				if (bananaActive) return;
				bananaActive = true;
				const stop = () => (bananaActive = false);
				window.addEventListener('click', stop, { once: true });
				setTimeout(() => {
					bananaActive = false;
					window.removeEventListener('click', stop);
				}, 8000);
				break;
		}
	}

	onMount(() => {
		// Browsers require a user gesture before audio can play — unlock on
		// first interaction so admin-triggered sounds actually come through.
		const unlock = () => unlockAudio();
		window.addEventListener('pointerdown', unlock, { once: true, passive: true });
		window.addEventListener('keydown', unlock, { once: true });

		let stopped = false;
		let timer: ReturnType<typeof setTimeout>;

		const lastIdRaw = () => {
			try {
				return Number(localStorage.getItem('cmd-last-id') ?? '0') || 0;
			} catch {
				return 0;
			}
		};
		const setLastId = (id: number) => {
			try {
				localStorage.setItem('cmd-last-id', String(id));
			} catch {}
		};

		async function poll() {
			if (stopped) return;
			const sid = guestSid();
			try {
				const params = new URLSearchParams({ since: String(lastIdRaw()) });
				if (sid) params.set('sid', sid);
				const res = await fetch(`/api/commands?${params}`, { credentials: 'include' });
				if (res.ok) {
					const data = (await res.json()) as { commands: Command[]; latestId: number };
					for (const cmd of data.commands ?? []) fire(cmd.type);
					if (typeof data.latestId === 'number') setLastId(data.latestId);
				}
			} catch {
				// polling is best-effort
			} finally {
				if (!stopped) timer = setTimeout(poll, 4000);
			}
		}
		void poll();

		return () => {
			stopped = true;
			clearTimeout(timer);
			window.removeEventListener('pointerdown', unlock);
			window.removeEventListener('keydown', unlock);
		};
	});
</script>

{#if scareActive}
	<div class="jumpscare-overlay" aria-hidden="true">
		<span class="scare-face">😱</span>
	</div>
{/if}

{#if peekabooActive}
	<div class="peekaboo-pop" role="status">Peekaboo! 👀</div>
{/if}

{#if surpriseActive}
	<div class="prank-overlay" aria-hidden="true">
		<div class="prank-card">
			<span class="prank-emojis">🎉 🎊 🍌</span>
			<span class="prank-title">You've been pranked!</span>
			<span class="prank-sub">Nothing is broken. Probably.</span>
		</div>
	</div>
{/if}

<svelte:body class:banana-cursor={bananaActive} />

<style>
	.jumpscare-overlay {
		position: fixed;
		inset: 0;
		z-index: 3000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(circle at 50% 50%, rgba(180, 0, 0, 0.85), rgba(40, 0, 0, 0.96));
		animation:
			scare-flash 0.18s steps(2) infinite,
			scare-shake 0.4s linear;
		pointer-events: none;
	}
	.scare-face {
		font-size: clamp(8rem, 30vw, 20rem);
		line-height: 1;
		animation: scare-shake 0.3s linear infinite;
	}
	@keyframes scare-flash {
		50% {
			background: radial-gradient(
				circle at 50% 50%,
				rgba(255, 255, 255, 0.9),
				rgba(120, 0, 0, 0.95)
			);
		}
	}
	@keyframes scare-shake {
		0%,
		100% {
			transform: translate(0, 0);
		}
		25% {
			transform: translate(-10px, 6px);
		}
		50% {
			transform: translate(8px, -8px);
		}
		75% {
			transform: translate(-6px, -4px);
		}
	}

	.peekaboo-pop {
		position: fixed;
		right: 24px;
		bottom: 24px;
		z-index: 2999;
		padding: 1rem 1.5rem;
		border-radius: var(--radius-xl);
		background: linear-gradient(135deg, #a855f7, #06b6d4);
		color: white;
		font-size: 1.25rem;
		font-weight: 800;
		box-shadow: 0 12px 36px rgba(168, 85, 247, 0.5);
		animation:
			peek-wiggle 0.7s ease-in-out infinite alternate,
			peek-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
		pointer-events: none;
	}
	@keyframes peek-in {
		from {
			transform: scale(0) rotate(-14deg);
			opacity: 0;
		}
		to {
			transform: scale(1) rotate(0deg);
			opacity: 1;
		}
	}
	@keyframes peek-wiggle {
		from {
			transform: rotate(-4deg) translateY(0);
		}
		to {
			transform: rotate(4deg) translateY(-6px);
		}
	}

	.prank-overlay {
		position: fixed;
		inset: 0;
		z-index: 2998;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(10, 5, 25, 0.82);
		backdrop-filter: blur(4px);
		animation: prank-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
		pointer-events: none;
	}
	.prank-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem 2.75rem;
		border-radius: var(--radius-xl);
		background: linear-gradient(135deg, #a855f7, #06b6d4);
		color: white;
		text-align: center;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
		animation: prank-bounce 0.8s ease-in-out infinite alternate;
	}
	.prank-emojis {
		font-size: 2.4rem;
		line-height: 1;
	}
	.prank-title {
		font-size: 1.6rem;
		font-weight: 900;
	}
	.prank-sub {
		font-size: 0.85rem;
		opacity: 0.85;
	}
	@keyframes prank-in {
		from {
			opacity: 0;
			transform: scale(0.7);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}
	@keyframes prank-bounce {
		from {
			transform: translateY(0) rotate(-1deg);
		}
		to {
			transform: translateY(-10px) rotate(1deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.jumpscare-overlay,
		.scare-face,
		.peekaboo-pop,
		.prank-overlay,
		.prank-card {
			animation: none !important;
		}
	}
</style>
