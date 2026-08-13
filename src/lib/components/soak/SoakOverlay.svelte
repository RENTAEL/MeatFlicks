<script lang="ts">
	import { soakState, soakEntries, soakClear, isSoak } from '$lib/soak/soak';

	let open = $state(true);
</script>

{#if isSoak()}
	<div class="soak-panel" class:soak-collapsed={!open}>
		<div class="soak-head">
			<span class="soak-title">SOAK</span>
			<span class="soak-role">{$soakState.role ?? '?'}</span>
			<span
				class="soak-status"
				class:st-synced={$soakState.status === 'synced'}
				class:st-drifted={$soakState.status === 'drifted'}
				class:st-syncing={$soakState.status === 'syncing'}
				class:st-host={$soakState.status === 'host'}>{$soakState.status}</span
			>
			<button class="soak-btn" onclick={() => (open = !open)} aria-label="Collapse soak panel"
				>{open ? '–' : '+'}</button
			>
			<button class="soak-btn" onclick={soakClear}>clear</button>
		</div>
		{#if open}
			<div class="soak-grid">
				<span class="soak-k">host</span>
				<span class="soak-v">{$soakState.hostPos.toFixed(1)}s</span>
				<span class="soak-k">member</span>
				<span class="soak-v">{$soakState.memberPos.toFixed(1)}s</span>
				<span class="soak-k">drift</span>
				<span
					class="soak-v soak-drift"
					class:drift-ok={Math.abs($soakState.drift) <= 2}
					class:drift-bad={Math.abs($soakState.drift) > 2}
					>{$soakState.drift > 0 ? '+' : ''}{$soakState.drift}s</span
				>
				<span class="soak-k">seq</span>
				<span class="soak-v">{$soakState.seq}</span>
				<span class="soak-k">provider</span>
				<span class="soak-v">{$soakState.provider ?? '-'}</span>
				<span class="soak-k">iframe</span>
				<span class="soak-v">{$soakState.iframeLoaded ? 'loaded' : '—'}</span>
			</div>
			<div class="soak-last">last: {$soakState.lastAction || '-'}</div>
			<div class="soak-log">
				{#each $soakEntries.slice(-24) as e, i (e.at + ':' + i)}
					<div class="soak-line">
						<span class="soak-ts">{new Date(e.at).toISOString().slice(11, 23)}</span>
						<span class="soak-kind">{e.kind}</span>
						<span class="soak-msg">{e.msg}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.soak-panel {
		position: fixed;
		top: 64px;
		right: 12px;
		z-index: 9999;
		width: 400px;
		background: rgba(10, 10, 11, 0.94);
		border: 1px solid #3f3f46;
		border-radius: 10px;
		color: #d4d4d8;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 10px;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
		overflow: hidden;
	}
	.soak-collapsed {
		width: auto;
	}
	.soak-head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: #18181b;
		border-bottom: 1px solid #27272a;
	}
	.soak-title {
		font-weight: 700;
		letter-spacing: 1px;
		color: #e4e4e7;
	}
	.soak-role {
		text-transform: uppercase;
		font-weight: 700;
		color: #a78bfa;
	}
	.soak-status {
		text-transform: uppercase;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 4px;
		background: #27272a;
	}
	.st-synced {
		color: #22c55e;
	}
	.st-drifted {
		color: #f59e0b;
	}
	.st-syncing {
		color: #38bdf8;
	}
	.st-host {
		color: #a78bfa;
	}
	.soak-btn {
		margin-left: auto;
		background: #27272a;
		color: #a1a1aa;
		border: 1px solid #3f3f46;
		border-radius: 4px;
		font-size: 10px;
		padding: 1px 8px;
		cursor: pointer;
	}
	.soak-btn:hover {
		color: #e4e4e7;
	}
	.soak-grid {
		display: grid;
		grid-template-columns: 64px 1fr 64px 1fr;
		gap: 2px 10px;
		padding: 8px 10px;
	}
	.soak-k {
		color: #71717a;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.soak-v {
		color: #e4e4e7;
	}
	.soak-drift.drift-ok {
		color: #22c55e;
	}
	.soak-drift.drift-bad {
		color: #f59e0b;
		font-weight: 700;
	}
	.soak-last {
		padding: 2px 10px 6px;
		color: #a1a1aa;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.soak-log {
		max-height: 220px;
		overflow-y: auto;
		border-top: 1px solid #27272a;
		padding: 4px 0;
	}
	.soak-line {
		display: flex;
		gap: 8px;
		padding: 1px 10px;
		white-space: nowrap;
	}
	.soak-ts {
		color: #52525b;
		flex-shrink: 0;
	}
	.soak-kind {
		color: #818cf8;
		flex-shrink: 0;
		min-width: 72px;
	}
	.soak-msg {
		color: #d4d4d8;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
