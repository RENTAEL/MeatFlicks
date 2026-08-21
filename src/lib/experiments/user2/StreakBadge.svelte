<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { bumpStreakIfNeeded, getStreak, isGlobalExperimentEnabled } from '../user2';

	const user = $derived(page.data.user ?? null);
	const enabled = $derived(isGlobalExperimentEnabled('streak', user as any));
	let count = $state<number | null>(null); // null = not yet read, avoids 0→N flicker

	onMount(() => {
		if (!enabled) return;
		count = bumpStreakIfNeeded(user as any);
	});

	$effect(() => {
		if (enabled && count === null) count = getStreak(user as any).count;
	});
</script>

{#if enabled && count !== null}
	<span class="streak-badge" title="{count} day streak" aria-label="{count} day streak">
		<span class="flame" aria-hidden="true">🔥</span>
		<span class="num">{count}</span>
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
		line-height: 1;
		box-shadow: 0 2px 8px rgba(255, 59, 48, 0.35);
	}
	.flame {
		font-size: 0.85em;
		line-height: 1;
	}
	.num {
		font-variant-numeric: tabular-nums; /* stable width, no badge jiggle */
	}
</style>
