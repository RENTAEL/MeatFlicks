<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import {
		playSoundEffect,
		unlockAudio,
		isSoundUnlocked
	} from '$lib/watch-party/sounds';

	type Command = {
		id: number;
		type: string;
		target: string;
		at: number;
		payload?: { seconds?: number } | null;
	};

	let scareActive = $state(false);
	let peekabooActive = $state(false);
	let surpriseActive = $state(false);
	let bananaActive = $state(false);
	let ghostTypingUntil = $state(0);
	let ghostSeconds = $state(8);
	let ghostTimer: ReturnType<typeof setTimeout> | null = null;
	let ghostTicker: ReturnType<typeof setInterval> | null = null;

	// The banana prank is a body-class toggle; bind it imperatively so it
	// applies reliably regardless of hydration timing.
	$effect(() => {
		document.body.classList.toggle('banana-cursor', bananaActive);
	});

	function guestSid(): string | null {
		if (page.data.user) return null;
		try {
			return sessionStorage.getItem('guest-sid');
		} catch {
			return null;
		}
	}

	let queuedEffect: { kind: string; at: number } | null = null;

	/**
	 * Media-element sound path. Web Audio only produces output after a
	 * gesture IN THE CURRENT session, so a passively-watching target would
	 * hear nothing. Unlocked <audio> elements behave differently: once an
	 * element has been play()-ed inside a gesture (muted), it can be
	 * replayed programmatically forever — even for viewers who never touch
	 * anything again.
	 */
	const EFFECT_FILES: Record<string, string> = {
		jump: '/sounds/jumpscare.mp3',
		suspense: '/sounds/suspense.mp3',
		applause: '/sounds/applause.mp3',
		boo: '/sounds/boo.mp3'
	};
	let audioPool: Record<string, HTMLAudioElement> = {};
	let mediaUnlocked = false;

	function initAudioPool() {
		if (Object.keys(audioPool).length > 0 || typeof document === 'undefined') return;
		for (const [kind, src] of Object.entries(EFFECT_FILES)) {
			const el = new Audio(src);
			// 'none', not 'auto': this pool exists to be unlocked by a gesture,
			// not to be prefetched. Every visitor (logged out included) mounts
			// this component, and 'auto' downloaded all four files up front.
			// The element still loads on demand when .play() is called, so both
			// unlockMedia() and tryPlaySound() keep working.
			el.preload = 'none';
			el.volume = 0.85;
			audioPool[kind] = el;
		}
	}

	function unlockMedia() {
		if (mediaUnlocked) return;
		mediaUnlocked = true;
		initAudioPool();
		for (const el of Object.values(audioPool)) {
			el.muted = true;
			const pr = el.play();
			if (pr && typeof pr.then === 'function') {
				pr.then(() => {
					el.pause();
					try {
						el.currentTime = 0;
					} catch {}
					el.muted = false;
				}).catch(() => {
					el.muted = false;
				});
			}
		}
	}

	function tryPlaySound(kind: string) {
		initAudioPool();
		if (mediaUnlocked) {
			const el = audioPool[kind];
			if (el) {
				try {
					el.pause();
				} catch {}
				el.muted = false;
				el.volume = 0.85;
				try {
					el.currentTime = 0;
				} catch {}
				const pr = el.play();
				if (pr && typeof pr.catch === 'function') {
					pr.catch(() => {
						// Element refused — fall back to the Web Audio path.
						unlockAudio();
						playSoundEffect(kind);
					});
				}
				return;
			}
		}
		if (!isSoundUnlocked()) unlockAudio();
		playSoundEffect(kind);
		queuedEffect = { kind, at: Date.now() };
	}

	function onGesture() {
		unlockMedia();
		unlockAudio();
		if (queuedEffect && Date.now() - queuedEffect.at < 60_000) {
			playSoundEffect(queuedEffect.kind);
		}
		queuedEffect = null;
	}

	function fire(type: string, payload?: { seconds?: number } | null) {
		switch (type) {
			case 'jumpscare':
				if (scareActive) return;
				scareActive = true;
				tryPlaySound('jump');
				setTimeout(() => (scareActive = false), 1800);
				break;
			case 'peekaboo':
				if (peekabooActive) return;
				peekabooActive = true;
				tryPlaySound('suspense');
				setTimeout(() => (peekabooActive = false), 4000);
				break;
			case 'surprise':
				if (surpriseActive) return;
				surpriseActive = true;
				tryPlaySound('applause');
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
			case 'ghosttyping':
				if (ghostTypingUntil > Date.now()) return;
				const secs = Math.min(15, Math.max(3, Math.round(Number(payload?.seconds) || 8)));
				ghostTypingUntil = Date.now() + secs * 1000;
				ghostSeconds = secs;
				if (ghostTimer) clearTimeout(ghostTimer);
				ghostTimer = setTimeout(() => {
					ghostTypingUntil = 0;
				}, secs * 1000);
				break;
		}
	}

	onMount(() => {
		// Audio buffers are NOT warmed here. preloadSounds() fetches all four
		// effect files (~437KB) and this component mounts for every visitor,
		// logged out included. unlockAudio() already calls preloadSounds() on
		// the first user gesture, which is early enough for effects to fire.
		initAudioPool();
		window.addEventListener('pointerdown', onGesture, { passive: true });
		window.addEventListener('keydown', onGesture);
		window.addEventListener('touchstart', onGesture, { passive: true });

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

		// Every poll is a serverless invocation that hits the database, and this
		// component mounts for every visitor on every page. A flat 4s interval
		// meant one idle background tab burned ~900 invocations an hour, which is
		// what pushed the project past its function-CPU quota. Three guards:
		// never poll a hidden tab, start slower, and back off while nothing is
		// happening — resetting the moment a command actually arrives.
		const BASE_DELAY = 8000;
		const MAX_DELAY = 60000;
		let delay = BASE_DELAY;

		function schedule(next: number) {
			if (stopped) return;
			clearTimeout(timer);
			timer = setTimeout(poll, next);
		}

		async function poll() {
			if (stopped) return;

			// A hidden tab cannot show an effect, so there is nothing to poll for.
			// onVisible() polls immediately when the tab comes back.
			if (typeof document !== 'undefined' && document.hidden) {
				// visibilitychange is what actually wakes this back up; the long
				// timer is only a fallback for browsers that miss the event.
				schedule(MAX_DELAY);
				return;
			}

			const sid = guestSid();
			try {
				const params = new URLSearchParams({ since: String(lastIdRaw()) });
				if (sid) params.set('sid', sid);
				const res = await fetch(`/api/commands?${params}`, { credentials: 'include' });
				if (res.ok) {
					const data = (await res.json()) as { commands: Command[]; latestId: number };
					const commands = data.commands ?? [];
					for (const cmd of commands) fire(cmd.type, cmd.payload);
					if (typeof data.latestId === 'number') setLastId(data.latestId);
					// Something happened — go back to responsive polling.
					delay = commands.length > 0 ? BASE_DELAY : Math.min(delay * 1.5, MAX_DELAY);
				} else {
					delay = Math.min(delay * 1.5, MAX_DELAY);
				}
			} catch {
				// polling is best-effort
				delay = Math.min(delay * 1.5, MAX_DELAY);
			} finally {
				schedule(delay);
			}
		}

		function onVisible() {
			if (stopped || document.hidden) return;
			// Back to attentive polling, and check right away for anything missed.
			delay = BASE_DELAY;
			schedule(0);
		}
		document.addEventListener('visibilitychange', onVisible);

		void poll();

		return () => {
			stopped = true;
			clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVisible);
			if (ghostTimer) clearTimeout(ghostTimer);
			if (ghostTicker) clearInterval(ghostTicker);
			window.removeEventListener('pointerdown', onGesture);
			window.removeEventListener('keydown', onGesture);
			window.removeEventListener('touchstart', onGesture);
		};
	});

	// Ticks the ghost typing countdown while it is active.
	const ghostActive = $derived(ghostTypingUntil > Date.now());
	$effect(() => {
		if (ghostActive) {
			ghostTicker = setInterval(() => {
				if (ghostTypingUntil <= Date.now()) {
					ghostTypingUntil = 0;
				}
			}, 500);
		} else if (ghostTicker) {
			clearInterval(ghostTicker);
			ghostTicker = null;
		}
		return () => {
			if (ghostTicker) {
				clearInterval(ghostTicker);
				ghostTicker = null;
			}
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

{#if ghostActive}
	<div class="ghost-typing" role="status" aria-label="Someone is typing">
		<span class="ghost-avatar" aria-hidden="true">👻</span>
		<span class="ghost-name">Someone is typing</span>
		<span class="ghost-dots" aria-hidden="true"><i></i><i></i><i></i></span>
	</div>
{/if}

<style>
	/* Banana cursor prank — must be global to reach <body>, and !important
	 * to override the app's per-element pointer cursors site-wide. */
	:global(body.banana-cursor),
	:global(body.banana-cursor *) {
		cursor:
			url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><text x='1' y='21' font-size='21'>🍌</text></svg>")
				6 4,
			auto !important;
	}

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

	/* Ghost typing prank — a fake "someone is typing…" pill. Purely visual:
	 * no message is ever composed or sent behind it. */
	.ghost-typing {
		position: fixed;
		left: 24px;
		bottom: 24px;
		z-index: 2997;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 0.95rem;
		border-radius: 999px;
		background: var(--bg-card, #18181b);
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
		font-size: 0.82rem;
		color: #d4d4d8;
		animation: ghost-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
		pointer-events: none;
	}
	.ghost-avatar {
		font-size: 1rem;
		line-height: 1;
		animation: ghost-bob 1.6s ease-in-out infinite;
	}
	.ghost-name {
		font-weight: 600;
	}
	.ghost-dots {
		display: inline-flex;
		gap: 3px;
		align-items: center;
	}
	.ghost-dots i {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #a1a1aa;
		animation: ghost-dot 1.2s ease-in-out infinite;
	}
	.ghost-dots i:nth-child(2) {
		animation-delay: 0.15s;
	}
	.ghost-dots i:nth-child(3) {
		animation-delay: 0.3s;
	}
	@keyframes ghost-in {
		from {
			transform: translateY(8px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
	@keyframes ghost-bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-2px);
		}
	}
	@keyframes ghost-dot {
		0%,
		60%,
		100% {
			opacity: 0.25;
			transform: translateY(0);
		}
		30% {
			opacity: 1;
			transform: translateY(-2px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.jumpscare-overlay,
		.scare-face,
		.peekaboo-pop,
		.prank-overlay,
		.prank-card,
		.ghost-typing,
		.ghost-avatar,
		.ghost-dots i {
			animation: none !important;
		}
	}
</style>
