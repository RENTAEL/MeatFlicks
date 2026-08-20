<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getCsrfTokenClient } from '$lib/utils/csrf.client';
	import { LogIn, X } from '@lucide/svelte';

	// Heartbeat reporting "I'm online and on this page" to the server-side
	// presence registry, plus a live presence stream that the admin can
	// terminate (with a playful "you've been yeeted" screen on this end).
	let started = $state(false);
	let kicked = $state(false);
	let kickMessage = $state('');

	function ping() {
		if (!started) started = true;
		const path = $page.url.pathname + $page.url.search;
		const title = document.title
			.replace(/\s*[—–|-]\s*Streamium.*$/i, '')
			.trim()
			.slice(0, 120);
		void (async () => {
			try {
				const token = await getCsrfTokenClient();
				if (!token) return;
				await fetch('/api/presence/heartbeat', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
					body: JSON.stringify({ path, title }),
					credentials: 'include',
					keepalive: true
				});
			} catch {
				// presence is best-effort
			}
		})();
	}

	function logInAgain() {
		window.location.assign('/login');
	}

	onMount(() => {
		ping();
		const timer = setInterval(ping, 25000);

		const es = new EventSource('/api/presence/stream');
		es.addEventListener('disconnect', (event) => {
			const data = JSON.parse((event as MessageEvent).data) as { message?: string };
			kickMessage = data.message ?? 'You got yeeted by the dev. Reconnect when you’re ready.';
			kicked = true;
			clearInterval(timer);
			es.close();
		});
		es.onerror = () => {
			// EventSource auto-reconnects; transient hiccups are fine.
		};

		const onVisibility = () => {
			if (document.visibilityState === 'visible') ping();
		};
		const onHide = () => {
			try {
				navigator.sendBeacon('/api/presence/leave', new Blob(['1'], { type: 'text/plain' }));
			} catch {
				// beacon not available — prune will clear us shortly
			}
		};
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pagehide', onHide);
		return () => {
			clearInterval(timer);
			es.close();
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pagehide', onHide);
		};
	});
</script>

{#if kicked}
	<div class="kick-overlay" role="alertdialog" aria-modal="true" aria-label="Session ended">
		<div class="kick-card">
			<span class="kick-emoji" aria-hidden="true">👋</span>
			<h2 class="kick-title">Session ended</h2>
			<p class="kick-msg">{kickMessage}</p>
			<div class="kick-actions">
				<button class="kick-retry" type="button" onclick={logInAgain}>
					<LogIn size={15} aria-hidden="true" /> Log in again
				</button>
				<button
					class="kick-dismiss"
					type="button"
					aria-label="Dismiss"
					onclick={() => (kicked = false)}
				>
					<X size={15} aria-hidden="true" />
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.kick-overlay {
		position: fixed;
		inset: 0;
		z-index: 999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background: rgba(5, 5, 15, 0.78);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
	}

	.kick-card {
		width: min(400px, 100%);
		text-align: center;
		padding: 2.25rem 1.75rem;
		border-radius: var(--radius-xl);
		background: var(--bg-card);
		border: 1px solid rgba(124, 92, 252, 0.35);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
	}

	.kick-emoji {
		font-size: 2.6rem;
		line-height: 1;
		display: block;
		margin-bottom: 0.6rem;
	}

	.kick-title {
		margin: 0 0 0.6rem;
		font-size: 1.3rem;
		font-weight: var(--font-weight-extrabold, 800);
		background: linear-gradient(135deg, #a78bfa, #f472b6);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.kick-msg {
		margin: 0 0 1.4rem;
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--text-primary);
	}

	.kick-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
	}

	.kick-retry {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.6rem 1.4rem;
		border-radius: var(--radius-full);
		border: none;
		background: var(--gradient-brand);
		color: #fff;
		font-size: 0.9rem;
		font-weight: var(--font-weight-semibold, 600);
		font-family: inherit;
		cursor: pointer;
		transition: all var(--transition-base);
	}

	.kick-retry:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 20px var(--accent-glow);
	}

	.kick-dismiss {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: var(--radius-full);
		border: 1px solid var(--border-stream);
		background: var(--bg-elevated);
		color: var(--text-secondary);
		cursor: pointer;
	}
</style>
