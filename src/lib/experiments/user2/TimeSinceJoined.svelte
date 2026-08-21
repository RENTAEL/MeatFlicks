<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { isUser2, formatTimeSince } from '../user2';

	const user = $derived(page.data.user ?? null);
	const enabled = $derived(isUser2(user as any));

	let text = $state('');
	let joinedAt = $derived(
		(page.data as any)?.profile?.createdAt ??
			(page.data as any)?.profile?.memberSince ??
			(page.data as any)?.user?.createdAt ??
			null
	);

	function tick() {
		text = formatTimeSince(joinedAt);
	}

	onMount(() => {
		if (!enabled) return;
		tick();
		const id = setInterval(tick, 60000);
		return () => clearInterval(id);
	});

	$effect(() => {
		if (enabled) tick();
	});
</script>

{#if enabled}
	<div class="time-card">
		<div class="time-label">⏱ Time since joined</div>
		<div class="time-value">{text}</div>
	</div>
{/if}

<style>
	.time-card {
		padding: 0.9rem 1rem;
		border-radius: 12px;
		background: linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(6, 182, 212, 0.12));
		border: 1px solid rgba(168, 85, 247, 0.18);
	}
	.time-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-secondary);
		margin-bottom: 0.25rem;
	}
	.time-value {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
	}
</style>
