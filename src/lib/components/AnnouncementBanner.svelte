<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { X, Megaphone } from '@lucide/svelte';

	type Announcement = { text: string; at: number; by: string; target?: string } | null;

	let announcement = $state<Announcement>(null);
	let visible = $state(false);

	function matchesTarget(target: string | undefined): boolean {
		const t = target ?? 'all';
		if (t === 'all') return true;
		const user = page.data.user;
		const sid = getGuestSid();
		if (t === 'auth') return !!user;
		if (t.startsWith('user:')) return user?.id === t.slice(5);
		if (t.startsWith('guest:')) return !user && !!sid && sid === t.slice(6);
		return true;
	}

	function getGuestSid(): string | null {
		if (page.data.user) return null;
		try {
			return sessionStorage.getItem('guest-sid');
		} catch {
			return null;
		}
	}

	function dismissedKey(at: number): string {
		return `ann-dismissed-${at}`;
	}

	function evaluate(a: Announcement) {
		if (!a) {
			visible = false;
			return;
		}
		try {
			// Dismissal is per-browser and keyed to this specific announcement,
			// so it survives reloads — but a fresh announcement (new timestamp)
			// shows again, and it stays live for new visitors until the admin
			// clears it.
			if (localStorage.getItem(dismissedKey(a.at)) === '1') {
				visible = false;
				return;
			}
		} catch {}
		visible = matchesTarget(a.target);
	}

	function dismiss() {
		visible = false;
		if (announcement) {
			try {
				localStorage.setItem(dismissedKey(announcement.at), '1');
			} catch {}
		}
	}

	onMount(() => {
		const load = async () => {
			try {
				const res = await fetch('/api/announcement');
				if (res.ok) {
					const data = (await res.json()) as { announcement: Announcement };
					announcement = data.announcement ?? null;
					evaluate(announcement);
				}
			} catch {
				// banner is best-effort; ignore network hiccups
			}
		};
		void load();
		const timer = setInterval(() => {
			// Hidden tabs stop polling — the banner is invisible anyway and
			// repeat hits are served from the CDN cache while visible.
			if (!document.hidden) void load();
		}, 60000);
		return () => clearInterval(timer);
	});
</script>

{#if visible && announcement}
	<div class="announcement-banner" role="status">
		<Megaphone size={16} aria-hidden="true" />
		<span class="announcement-text">{announcement.text}</span>
		<button
			class="announcement-dismiss"
			type="button"
			aria-label="Dismiss announcement"
			onclick={dismiss}
		>
			<X size={15} aria-hidden="true" />
		</button>
	</div>
{/if}

<style>
	.announcement-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		padding: 0.5rem 1rem;
		background: linear-gradient(90deg, rgba(124, 92, 252, 0.15), rgba(236, 72, 153, 0.15));
		border-bottom: 1px solid rgba(124, 92, 252, 0.35);
		color: var(--text-primary);
		font-size: 0.85rem;
		text-align: center;
	}

	.announcement-text {
		flex: 1 1 auto;
		max-width: 820px;
	}

	.announcement-dismiss {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		border-radius: var(--radius-full);
		background: transparent;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		flex-shrink: 0;
	}

	.announcement-dismiss:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}
</style>
