<script lang="ts">
	import { Loader2, AlertTriangle } from '@lucide/svelte';

	let {
		status = 'joining',
		message = '',
		onretry,
		ondismiss
	}: {
		status?: 'joining' | 'error';
		message?: string;
		onretry?: () => void;
		ondismiss?: () => void;
	} = $props();
</script>

{#if status === 'joining'}
	<div class="wp-join-overlay" role="status" aria-live="polite">
		<div class="wp-join-card">
			<span class="wp-join-spin"><Loader2 size={28} aria-hidden="true" /></span>
			<span class="wp-join-title">Joining watch party…</span>
			<span class="wp-join-sub">Setting up the room and syncing playback</span>
		</div>
	</div>
{:else}
	<div class="wp-join-overlay" role="alert" aria-live="assertive">
		<div class="wp-join-card wp-join-error">
			<AlertTriangle size={26} aria-hidden="true" />
			<span class="wp-join-title">Couldn't start the watch party</span>
			<span class="wp-join-sub">{message || 'Something went wrong. Please try again.'}</span>
			<div class="wp-join-actions">
				{#if onretry}
					<button type="button" class="wp-join-btn" onclick={onretry}>Try again</button>
				{/if}
				{#if ondismiss}
					<button type="button" class="wp-join-btn wp-join-btn-ghost" onclick={ondismiss}>
						Cancel
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.wp-join-overlay {
		position: fixed;
		inset: 0;
		z-index: 2500;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(9, 9, 11, 0.72);
		backdrop-filter: blur(3px);
		animation: wp-join-fade 0.18s ease-out;
	}
	.wp-join-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.55rem;
		padding: 1.75rem 2.25rem;
		border-radius: 1rem;
		border: 1px solid var(--border, #27272a);
		background: var(--card, #18181b);
		color: var(--foreground, #fafafa);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
		text-align: center;
		max-width: min(90vw, 360px);
		animation: wp-join-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.wp-join-title {
		font-size: 1rem;
		font-weight: 700;
	}
	.wp-join-sub {
		font-size: 0.8rem;
		color: var(--muted-foreground, #a1a1aa);
		line-height: 1.4;
	}
	.wp-join-error :global(svg) {
		color: #f59e0b;
	}
	.wp-join-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.wp-join-btn {
		padding: 0.45rem 1.1rem;
		border-radius: 0.6rem;
		border: none;
		background: var(--primary, #eab308);
		color: var(--primary-foreground, #18181b);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: filter 0.15s ease;
	}
	.wp-join-btn:hover {
		filter: brightness(1.08);
	}
	.wp-join-btn-ghost {
		background: transparent;
		border: 1px solid var(--border, #3f3f46);
		color: var(--foreground, #fafafa);
	}
	.wp-join-spin {
		display: inline-flex;
		color: var(--afrikaans-accent, #f5a623);
	}
	.wp-join-spin :global(svg) {
		animation: wp-join-rotate 0.9s linear infinite;
	}
	@keyframes wp-join-rotate {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes wp-join-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes wp-join-pop {
		from {
			transform: scale(0.92);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.wp-join-spin,
		.wp-join-overlay,
		.wp-join-card {
			animation: none !important;
		}
	}
</style>
