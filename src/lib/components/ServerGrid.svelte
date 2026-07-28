<script lang="ts">
	import type { ProbeResult } from '$lib/providers/scanner';

	let {
		results = [] as ProbeResult[],
		activeProviderId = null as string | null,
		scanning = false,
		onselect = (_result: ProbeResult) => {}
	} = $props<{
		results?: ProbeResult[];
		activeProviderId?: string | null;
		scanning?: boolean;
		onselect?: (result: ProbeResult) => void;
	}>();

	let upCount = $derived(results.filter((r: ProbeResult) => r.status === 'up').length);
	let downCount = $derived(results.filter((r: ProbeResult) => r.status === 'down').length);
	let checkingCount = $derived(results.filter((r: ProbeResult) => r.status === 'checking').length);
</script>

<div class="server-grid-wrapper">
	<div class="server-status-bar">
		<span class="status-label">🎯 Servers</span>
		<span class="status-counts">
			{#if scanning}
				<span class="count checking">Scanning {checkingCount} remaining...</span>
			{:else}
				<span class="count up">{upCount} working</span>
				{#if downCount > 0}
					<span class="count down">{downCount} offline</span>
				{/if}
			{/if}
		</span>
	</div>

	<div class="server-grid">
		{#each results as result (result.provider.id)}
			<button
				class="server-card"
				class:active={result.provider.id === activeProviderId}
				class:up={result.status === 'up'}
				class:down={result.status === 'down'}
				class:checking={result.status === 'checking'}
				onclick={() => onselect(result)}
				disabled={result.status === 'down'}
			>
				<div class="status-dot">
					{#if result.status === 'up'}
						<span class="dot green"></span>
					{:else if result.status === 'down'}
						<span class="dot red"></span>
					{:else}
						<span class="dot yellow pulse"></span>
					{/if}
				</div>

				<div class="server-info">
					<span class="server-name">{result.provider.icon} {result.provider.name}</span>
					<span class="server-quality">
						{result.provider.quality}
						{#if result.latency}
							· {result.latency}ms
						{/if}
					</span>
				</div>

				<div class="server-action">
					{#if result.status === 'up'}
						<span class="badge working">✓ Working</span>
					{:else if result.status === 'down'}
						<span class="badge offline">✗ Offline</span>
					{:else}
						<span class="badge scanning">⟳ Checking</span>
					{/if}
				</div>

				{#if result.provider.id === activeProviderId}
					<div class="active-indicator">NOW PLAYING</div>
				{/if}
			</button>
		{/each}
	</div>

	{#if results.length === 0}
		<div class="empty-state">
			<p>No servers configured. Add providers to start scanning.</p>
		</div>
	{/if}
</div>

<style>
	.server-grid-wrapper {
		margin-top: 1rem;
		padding: 0;
	}

	.server-status-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: rgba(255,255,255,0.03);
		border-radius: 10px 10px 0 0;
		border: 1px solid rgba(255,255,255,0.06);
		border-bottom: none;
	}

	.status-label {
		font-weight: 600;
		font-size: 0.9rem;
		color: #ccc;
	}

	.status-counts {
		display: flex;
		gap: 1rem;
		font-size: 0.8rem;
	}

	.count.up { color: #4ade80; }
	.count.down { color: #f87171; }
	.count.checking { color: #fbbf24; }

	.server-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.5rem;
		padding: 0.5rem;
		background: rgba(0,0,0,0.15);
		border-radius: 0 0 10px 10px;
		border: 1px solid rgba(255,255,255,0.06);
		border-top: none;
	}

	.server-card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: rgba(255,255,255,0.03);
		border: 1px solid rgba(255,255,255,0.06);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		color: inherit;
		font-family: inherit;
		font-size: inherit;
		width: 100%;
		overflow: hidden;
	}

	.server-card:hover:not(:disabled) {
		background: rgba(255,255,255,0.06);
		border-color: rgba(255,255,255,0.12);
		transform: translateY(-1px);
	}

	.server-card:active:not(:disabled) {
		transform: scale(0.98);
	}

	.server-card.active {
		background: rgba(245, 158, 11, 0.1);
		border-color: rgba(245, 158, 11, 0.4);
		box-shadow: 0 0 15px rgba(245, 158, 11, 0.1);
	}

	.server-card.down {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.server-card.down:hover {
		transform: none;
		background: rgba(255,255,255,0.03);
	}

	.server-card.checking {
		opacity: 0.7;
	}

	.status-dot {
		flex-shrink: 0;
	}

	.dot {
		display: block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.dot.green {
		background: #4ade80;
		box-shadow: 0 0 6px rgba(74, 222, 128, 0.5);
	}

	.dot.red {
		background: #f87171;
	}

	.dot.yellow {
		background: #fbbf24;
	}

	.dot.pulse {
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.3; }
	}

	.server-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.server-name {
		font-weight: 500;
		font-size: 0.85rem;
		color: #e0e0e0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.server-quality {
		font-size: 0.7rem;
		color: #888;
	}

	.server-action {
		flex-shrink: 0;
	}

	.badge {
		font-size: 0.65rem;
		padding: 3px 8px;
		border-radius: 12px;
		font-weight: 600;
		white-space: nowrap;
	}

	.badge.working {
		background: rgba(74, 222, 128, 0.15);
		color: #4ade80;
	}

	.badge.offline {
		background: rgba(248, 113, 113, 0.15);
		color: #f87171;
	}

	.badge.scanning {
		background: rgba(251, 191, 36, 0.15);
		color: #fbbf24;
	}

	.active-indicator {
		position: absolute;
		top: 4px;
		right: 6px;
		font-size: 0.55rem;
		font-weight: 700;
		color: #f59e0b;
		letter-spacing: 0.5px;
	}

	.empty-state {
		padding: 2rem;
		text-align: center;
		color: #666;
	}

	@media (max-width: 640px) {
		.server-grid-wrapper {
			margin-top: 0;
		}
		.server-status-bar {
			display: none;
		}
		.server-grid {
			display: flex;
			gap: 6px;
			padding: 8px 12px;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
			border-radius: 0;
			border: none;
			background: transparent;
		}
		.server-grid::-webkit-scrollbar {
			display: none;
		}
		.server-card {
			flex-shrink: 0;
			width: auto;
			min-width: auto;
			padding: 6px 14px;
			gap: 4px;
			border-radius: 20px;
			border: 1px solid rgba(255,255,255,0.15);
			background: transparent;
			font-size: 0.78rem;
			min-height: 36px;
		}
		.server-card:hover:not(:disabled) {
			background: transparent;
			border-color: rgba(255,255,255,0.15);
			transform: none;
		}
		.server-card.active {
			background: #f59e0b;
			border-color: #f59e0b;
			box-shadow: none;
		}
		.server-card.active .server-name {
			color: #000;
		}
		.server-card.active .server-quality {
			color: rgba(0,0,0,0.6);
		}
		.server-name {
			font-size: 0.78rem;
			color: rgba(255,255,255,0.7);
		}
		.server-quality,
		.server-action,
		.status-dot,
		.active-indicator {
			display: none;
		}
		.server-card.down {
			display: none;
		}
	}
</style>
