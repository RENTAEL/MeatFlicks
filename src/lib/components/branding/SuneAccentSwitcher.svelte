<script lang="ts">
	import { getBranding } from '$lib/utils/branding';
	import { page } from '$app/state';
	import { impersonationStore } from '$lib/state/stores/impersonationStore.svelte.ts';
	import { suneAccentStore, SUNE_ACCENTS, SUNE_ACCENT_LABELS, type SuneAccent } from '$lib/stores/suneAccent';

	let current = $state<SuneAccent>(suneAccentStore.current);

	function set(accent: SuneAccent) {
		suneAccentStore.set(accent);
		current = accent;
	}

	// Only visible to Sune (or admin viewing as Sune)
	const effectiveUser = $derived(impersonationStore.current ?? page.data.user);
	const isSune = $derived(
		!!effectiveUser && getBranding({ displayName: effectiveUser.username, email: effectiveUser.email ?? null }) === 'sune'
	);
</script>

{#if isSune}
	<div class="sune-accent-switcher" role="group" aria-label="Sune accent variant">
		<span class="sune-accent-label">Accent</span>
		<div class="sune-accent-options">
			{#each SUNE_ACCENTS as accent (accent)}
				<button
					type="button"
					class="sune-accent-btn"
					class:active={current === accent}
					aria-pressed={current === accent}
					aria-label={SUNE_ACCENT_LABELS[accent]}
					title={SUNE_ACCENT_LABELS[accent]}
					onclick={() => set(accent)}
				>
					<span class="sune-accent-dot" data-accent={accent} aria-hidden="true"></span>
					{SUNE_ACCENT_LABELS[accent]}
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.sune-accent-switcher {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-top: 0.9rem;
	}

	.sune-accent-label {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #e7c663;
	}

	.sune-accent-options {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.sune-accent-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		border: 1px solid rgba(212, 175, 55, 0.18);
		background: rgba(255, 255, 255, 0.04);
		color: #c9b3bc;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.sune-accent-btn:hover {
		border-color: rgba(212, 175, 55, 0.32);
		color: #f6edf0;
		background: rgba(212, 175, 55, 0.08);
	}

	.sune-accent-btn.active {
		background: linear-gradient(135deg, #8e1d2e, #d4af37);
		border-color: transparent;
		color: #fbf6ee;
		box-shadow: 0 2px 10px rgba(212, 175, 55, 0.22);
	}

	.sune-accent-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.sune-accent-dot[data-accent='rose-gold'] {
		background: linear-gradient(135deg, #d4af37, #e7c663);
	}
	.sune-accent-dot[data-accent='midnight-rose'] {
		background: linear-gradient(135deg, #5a0f1e, #8e1d2e);
	}
	.sune-accent-dot[data-accent='crimson'] {
		background: linear-gradient(135deg, #a51d33, #e7c663);
	}

	@media (prefers-reduced-motion: reduce) {
		.sune-accent-btn {
			transition: none;
		}
	}
</style>
