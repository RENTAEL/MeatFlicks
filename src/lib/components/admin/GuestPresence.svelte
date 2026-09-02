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

		const ping = () => {
			// Hidden tabs aren't really "online" — no heartbeat, no stream.
			if (document.hidden || ended) return;
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
			})
				.then((r) => r.json())
				.then((data: { ended?: boolean; message?: string }) => {
					// Pull-based kick delivery (no SSE held open): the admin kick
					// sets a signal the heartbeat reads and reports back here.
					if (data?.ended) {
						endMessage = data.message ?? 'Your session was ended by the admin.';
						ended = true;
						clearInterval(timer);
					}
				})
				.catch(() => {});
		};

		// Guests no longer hold an SSE connection — on Fluid Compute each open
		// stream bills Active CPU for its whole lifetime, and anonymous traffic is
		// the majority. They keep a lightweight heartbeat POST so admins still see
		// guest activity, but no serverless function is held open per visitor.
		ping();
		// 120s guest heartbeat (was 60s). Guest-kick lag = interval × server
		// missed-beat TTL (2) → ~4 min max, up from ~2 min. Presence-only;
		// streaming is unaffected.
		const timer = setInterval(ping, 120000);

		// Re-register the moment the tab comes back, so a returning guest shows
		// up in the admin list immediately instead of waiting out the interval.
		const onVisibility = () => {
			if (!document.hidden) ping();
		};
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisibility);
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
