<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { isUser2, bumpStreakIfNeeded, getStreak } from '../user2';

	const user = $derived(page.data.user ?? null);
	const enabled = $derived(isUser2(user as any));
	let count = $state(0);

	onMount(() => {
		if (!enabled) return;
		count = bumpStreakIfNeeded();
	});

	$effect(() => {
		if (enabled) count = getStreak().count;
	});
</script>

{#if enabled}
	<span class="streak-badge" title="{count} day streak" aria-label="{count} day streak">
		<span aria-hidden="true">🔥</span>
		{count}
	</span>
{/if}

<style>
	.streak-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		background: linear-gradient(135deg, #ff6b00, #ff3b30);
		color: white;
		font-size: 0.78rem;
		font-weight: 700;
		box-shadow: 0 2px 8px rgba(255, 59, 48, 0.35);
	}
</style>
