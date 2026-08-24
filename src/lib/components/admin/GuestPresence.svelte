<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { X } from '@lucide/svelte';
	import { getReportedPlayback } from '$lib/playback/reportPlayback';

	// Anonymous visitors report presence so admins can see (and end) their
	// sessions. Logged-in users are covered by PresencePing.
	let ended = $state(false);
	let endMessage = $state('');

	function getSessionId(): string {
		try {
			let sid = sessionStorage.getItem('guest-sid');
			if (!sid) {
				sid =
					typeof crypto !== 'undefined' && 'randomUUID' in crypto
						? crypto.randomUUID()
						: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
				sessionStorage.setItem('guest-sid', sid);
			}
			return sid;
		} catch {
			return '';
		}
	}

	onMount(() => {
		if (page.data.user) return; // logged-in — PresencePing handles it
		const sid = getSessionId();
		if (!sid) return;

		let es: EventSource | null = null;

		const ping = () => {
			// Hidden tabs aren't really "online" — no heartbeat, no stream.
			if (document.hidden) return;
			const path = page.url.pathname + page.url.search;
			const title = document.title
				.replace(/\s*[—–|-]\s*Streamium.*$/i, '')
				.trim()
				.slice(0, 120);
			void fetch('/api/presence/guest/heartbeat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId: sid, path, title, playing: getReportedPlayback() }),
				keepalive: true
			}).catch(() => {});
		};

		const openStream = () => {
			if (es || document.hidden) return;
			es = new EventSource(`/api/presence/guest/stream?sid=${encodeURIComponent(sid)}`);
			es.addEventListener('disconnect', (event) => {
				const data = JSON.parse((event as MessageEvent).data) as { message?: string };
				endMessage = data.message ?? 'Your session was ended.';
				ended = true;
				clearInterval(timer);
				es?.close();
				es = null;
			});
		};

		const closeStream = () => {
			es?.close();
			es = null;
		};

		// Background tabs must drop their SSE connection — on Fluid Compute
		// each open stream bills Active CPU for its whole lifetime, so an
		// idle tab in the background is pure waste.
		const onVisibility = () => {
			if (document.hidden) {
				closeStream();
			} else {
				ping();
				openStream();
			}
		};
		document.addEventListener('visibilitychange', onVisibility);

		ping();
		const timer = setInterval(ping, 25000);
		openStream();

		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisibility);
			closeStream();
		};
	});
</script>

{#if ended}
	<div class="guest-ended" role="status">
		<span>👋 {endMessage}</span>
		<button type="button" aria-label="Dismiss" onclick={() => (ended = false)}>
			<X size={14} aria-hidden="true" />
		</button>
	</div>
{/if}

<style>
	.guest-ended {
		position: fixed;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 2500;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 1rem;
		border-radius: var(--radius-lg);
		background: var(--bg-card);
		border: 1px solid var(--border-strong);
		color: var(--text-primary);
		font-size: 0.85rem;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
		animation: guest-in 0.3s ease;
	}
	.guest-ended button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-full);
		border: none;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
	}
	@keyframes guest-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
</style>
