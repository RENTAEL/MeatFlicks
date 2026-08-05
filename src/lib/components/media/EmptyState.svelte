<script lang="ts">
	import { getImageUrl } from '$lib/utils/image';

	let {
		icon = 'film',
		title,
		subtitle = '',
		actionLabel = '',
		onAction,
		compact = false,
		backdrop = null
	}: {
		icon?: 'film' | 'search' | 'error';
		title: string;
		subtitle?: string;
		actionLabel?: string;
		onAction?: () => void;
		compact?: boolean;
		backdrop?: string | null;
	} = $props();
</script>

<div class="empty-state {compact ? 'empty-state--compact' : ''}" class:has-backdrop={backdrop}>
	{#if backdrop}
		<img
			class="empty-state__bg"
			src={getImageUrl(backdrop, 'w780')}
			alt=""
			aria-hidden="true"
		/>
		<div class="empty-state__overlay"></div>
	{/if}

	<div class="empty-state__content">
		<div class="empty-state__icon">
			{#if icon === 'search'}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
				</svg>
			{:else if icon === 'error'}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
				</svg>
			{/if}
		</div>
		<p class="empty-state__title">{title}</p>
		{#if subtitle}
			<p class="empty-state__subtitle">{subtitle}</p>
		{/if}
		{#if actionLabel}
			<button class="empty-state__action" onclick={onAction}>{actionLabel}</button>
		{/if}
	</div>
</div>

<style>
	.empty-state {
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		min-height: 240px;
		padding: 2rem 1.5rem;
		border-radius: 1rem;
		border: 1px dashed rgba(129, 140, 248, 0.25);
		background:
			radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.12), transparent 60%),
			linear-gradient(160deg, rgba(30, 27, 75, 0.55), rgba(9, 9, 11, 0.85));
	}
	.empty-state--compact {
		min-height: 180px;
	}
	.empty-state__bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.18;
		transform: scale(1.02);
	}
	.empty-state__overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(9, 9, 11, 0.55), rgba(9, 9, 11, 0.85));
	}
	.empty-state__content {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		max-width: 420px;
	}
	.empty-state__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		margin-bottom: 6px;
		border-radius: 9999px;
		background: rgba(99, 102, 241, 0.12);
		border: 1px solid rgba(129, 140, 248, 0.35);
		color: #a5b4fc;
	}
	.empty-state__icon svg {
		width: 26px;
		height: 26px;
	}
	.empty-state__title {
		font-size: 16px;
		font-weight: 600;
		color: #e4e4e7;
	}
	.empty-state__subtitle {
		font-size: 13px;
		color: #a1a1aa;
	}
	.empty-state__action {
		margin-top: 10px;
		padding: 9px 18px;
		border-radius: 9999px;
		background: rgba(99, 102, 241, 0.9);
		border: 1px solid rgba(129, 140, 248, 0.4);
		color: #fff;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}
	.empty-state__action:hover {
		background: rgba(99, 102, 241, 1);
	}
</style>
