<script lang="ts">
	import { impersonationStore } from '$lib/state/stores/impersonationStore.svelte.ts';

	const impersonated = $derived(impersonationStore.current);
</script>

{#if impersonated}
	<div class="impersonation-banner" role="status" aria-live="polite">
		<span class="impersonation-text">
			Viewing as <strong>{impersonated.username}</strong>
			{#if impersonated.email}
				<span class="impersonation-email">({impersonated.email})</span>
			{/if}
		</span>
		<button type="button" class="impersonation-exit" onclick={() => impersonationStore.clear()}>
			Exit view
		</button>
	</div>
{/if}

<style>
	.impersonation-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		background: linear-gradient(90deg, #4338ca, #7c3aed);
		color: white;
		font-size: 0.85rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.impersonation-text {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.impersonation-email {
		opacity: 0.85;
		font-size: 0.8rem;
	}

	.impersonation-exit {
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius-full);
		background: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}

	.impersonation-exit:hover {
		background: rgba(255, 255, 255, 0.3);
	}
</style>
