<script lang="ts">
	import { onMount } from 'svelte';
	import { X, Megaphone } from '@lucide/svelte';

	let announcement = $state<{ text: string; at: number; by: string } | null>(null);
	let dismissed = $state(false);

	onMount(() => {
		const timer = setInterval(async () => {
			try {
				const res = await fetch('/api/announcement');
				if (res.ok) {
					const data = (await res.json()) as { announcement: typeof announcement };
					if (data.announcement && !dismissed) announcement = data.announcement;
				}
			} catch {
				// banner is best-effort; ignore network hiccups
			}
		}, 60000);

		void fetch('/api/announcement')
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data?.announcement) announcement = data.announcement;
			})
			.catch(() => {});

		return () => clearInterval(timer);
	});
</script>

{#if announcement && !dismissed}
	<div class="announcement-banner" role="status">
		<Megaphone size={16} aria-hidden="true" />
		<span class="announcement-text">{announcement.text}</span>
		<button
			class="announcement-dismiss"
			type="button"
			aria-label="Dismiss announcement"
			onclick={() => (dismissed = true)}
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
	}

	.announcement-dismiss:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}
</style>
