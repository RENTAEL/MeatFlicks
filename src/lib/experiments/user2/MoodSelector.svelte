<script lang="ts">
	import { page } from '$app/state';
	import { MOODS, getMood, setMood, isGlobalExperimentEnabled, type Mood } from '../user2';

	const user = $derived(page.data.user ?? null);
	const enabled = $derived(isGlobalExperimentEnabled('moodSelector', user as any));
	let mood = $state<Mood | null>(null);

	$effect(() => {
		mood = getMood(user as any);
	});

	function pick(m: Mood) {
		mood = m === mood ? null : m;
		setMood(mood, user as any);
	}
</script>

{#if enabled}
	<div class="mood-wrap">
		<div class="mood-label">Mood</div>
		<div class="mood-row">
			{#each MOODS as m}
				<button
					class="mood-btn"
					class:active={m === mood}
					onclick={() => pick(m)}
					aria-label="Set mood {m}"
					aria-pressed={m === mood}
				>
					{m}
				</button>
			{/each}
		</div>
		{#if mood}
			<p class="mood-hint">You’re feeling {mood} — just for you.</p>
		{/if}
	</div>
{/if}

<style>
	.mood-wrap {
		padding: 0.9rem 1rem;
		border-radius: 12px;
		background: var(--bg-card);
		border: 1px solid var(--border-stream);
	}
	.mood-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-secondary);
		margin-bottom: 0.45rem;
	}
	.mood-row {
		display: flex;
		gap: 0.4rem;
	}
	.mood-btn {
		width: 38px;
		height: 38px;
		border-radius: 10px;
		border: 1px solid var(--border-stream);
		background: var(--bg-elevated);
		font-size: 1.15rem;
		cursor: pointer;
		transition:
			transform 0.12s,
			border-color 0.12s,
			background 0.12s;
	}
	.mood-btn:hover {
		transform: translateY(-1px);
		border-color: var(--accent-stream);
	}
	.mood-btn.active {
		background: linear-gradient(135deg, #a855f7, #06b6d4);
		border-color: transparent;
		transform: scale(1.06);
	}
	.mood-hint {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}
</style>
