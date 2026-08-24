<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Activity, AlertTriangle, RefreshCw } from '@lucide/svelte';
	import {
		installClientActivityMonitor,
		getClientActivitySnapshot
	} from '$lib/monitor/clientActivity';
	import { getCsrfTokenClient } from '$lib/utils/csrf.client';

	type UsageSummary = {
		live: {
			path: string;
			lastMinute: number;
			last5mPerMin: number;
			avgMs: number;
			maxMs: number;
		}[];
		anomalies: { path: string; perMin: number; reason: string }[];
		day: { path: string; count: number; avgMs: number; maxMs: number }[];
		total24h: number;
		generatedAt: number;
	};

	let server: UsageSummary | null = $state(null);
	let client = $state<ReturnType<typeof getClientActivitySnapshot> | null>(null);
	let loading = $state(false);
	let open = $state(true);
	let timer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		installClientActivityMonitor();
		void refresh();
		// Dashboard refresh is deliberately lazy: 30s while visible.
		timer = setInterval(() => {
			if (!document.hidden) {
				client = getClientActivitySnapshot();
				if (open) void refresh();
			}
		}, 30_000);
		return () => {
			if (timer) clearInterval(timer);
		};
	});

	async function refresh() {
		loading = true;
		try {
			const token = await getCsrfTokenClient();
			const res = await fetch('/api/admin/usage', {
				headers: token ? { 'X-CSRF-Token': token } : undefined
			});
			if (res.ok) server = await res.json();
		} catch {}
		loading = false;
	}

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});
</script>

<div class="usage">
	<button type="button" class="usage-head" onclick={() => (open = !open)} aria-expanded={open}>
		<span class="usage-title">
			<Activity size={14} aria-hidden="true" /> Usage &amp; Performance
			{#if server?.anomalies?.length}
				<span class="usage-alert" title={server.anomalies.map((a) => a.reason).join('\n')}>
					<AlertTriangle size={12} aria-hidden="true" />
					{server.anomalies.length} anomal{server.anomalies.length === 1 ? 'y' : 'ies'}
				</span>
			{/if}
		</span>
		<span
			class="usage-refresh"
			role="button"
			tabindex="-1"
			aria-label="Refresh"
			onclick={(e) => {
				e.stopPropagation();
				void refresh();
			}}
		>
			<span class:spin={loading}><RefreshCw size={13} aria-hidden="true" /></span>
		</span>
	</button>

	{#if open}
		{#if server?.anomalies?.length}
			<div class="anom-banner" role="alert">
				<AlertTriangle size={13} aria-hidden="true" />
				<div>
					{#each server.anomalies as a (a.path)}
						<div>âš ï¸ <strong>{a.path}</strong> â€” {a.reason}</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="usage-section">
			<div class="usage-label">This tab (client activity, last 60s)</div>
			{#if client}
				{#if client.loops.length > 0}
					<div class="client-loop" role="alert">
						Loop suspected: {client.loops.join(' Â· ')}
					</div>
				{/if}
				<div class="client-grid">
					{#each client.fetchPerMin as f (f.target)}
						<span class="client-item" class:hot={f.perMin >= 10}>{f.target} Â· {f.perMin}/min</span>
					{/each}
					{#each client.eventSourceOpen as e (e.target)}
						<span class="client-item">SSE {e.target}</span>
					{/each}
					<span class="client-item dim"
						>{client.intervalCount} intervals Â· tightest {client.tightestIntervalMs}ms</span
					>
				</div>
			{:else}
				<p class="usage-empty">Open any page in this tab to see live client activity.</p>
			{/if}
		</div>

		<div class="usage-section">
			<div class="usage-label">
				Server Â· last hour
				{#if server}<span class="dim">Â· {server.total24h} requests / 24h</span>{/if}
			</div>
			{#if server && server.live.length > 0}
				<div class="srv-rows">
					{#each server.live.slice(0, 10) as r (r.path)}
						<div class="srv-row">
							<span class="srv-path" title={r.path}>{r.path}</span>
							<span class="srv-num">{r.last5mPerMin}/min</span>
							<span class="srv-num" class:slow={r.avgMs > 1500}>{r.avgMs}ms avg</span>
							<span class="srv-num dim" class:slow={r.maxMs > 8000}>{r.maxMs}ms max</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="usage-empty">No server traffic recorded in this instance yet.</p>
			{/if}
		</div>

		{#if server && server.day.length > 0}
			<div class="usage-section">
				<div class="usage-label">Last 24h (all instances, from Turso)</div>
				<div class="srv-rows">
					{#each server.day.slice(0, 8) as d (d.path)}
						<div class="srv-row">
							<span class="srv-path" title={d.path}>{d.path}</span>
							<span class="srv-num">{d.count} req</span>
							<span class="srv-num dim">{d.avgMs}ms avg</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.usage {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.02);
	}
	.usage-head {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.85rem;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 700;
	}
	.usage-head:hover {
		background: rgba(255, 255, 255, 0.04);
	}
	.usage-title {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}
	.usage-alert {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.05rem 0.5rem;
		border-radius: 999px;
		background: rgba(239, 68, 68, 0.15);
		color: #f87171;
		font-size: 0.72rem;
	}
	.usage-refresh :global(svg) {
		transition: transform 0.3s;
	}
	.usage-refresh {
		color: #71717a;
	}
	.anom-banner {
		display: flex;
		gap: 0.5rem;
		margin: 0 0.65rem 0.6rem;
		padding: 0.55rem 0.7rem;
		border-radius: 8px;
		border: 1px solid rgba(239, 68, 68, 0.35);
		background: rgba(239, 68, 68, 0.08);
		color: #fca5a5;
		font-size: 0.78rem;
		line-height: 1.5;
	}
	.usage-section {
		padding: 0.35rem 0.85rem 0.7rem;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
	.usage-label {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #71717a;
		margin-bottom: 0.4rem;
	}
	.usage-empty {
		margin: 0;
		font-size: 0.78rem;
		color: #71717a;
	}
	.client-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.client-item {
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.05);
		font-size: 0.72rem;
		color: #d4d4d8;
	}
	.client-item.hot {
		background: rgba(239, 68, 68, 0.15);
		color: #fca5a5;
	}
	.client-item.dim {
		color: #71717a;
	}
	.client-loop {
		margin-bottom: 0.4rem;
		padding: 0.4rem 0.6rem;
		border-radius: 8px;
		background: rgba(239, 68, 68, 0.12);
		color: #fca5a5;
		font-size: 0.76rem;
	}
	.srv-rows {
		display: flex;
		flex-direction: column;
	}
	.srv-row {
		display: grid;
		grid-template-columns: minmax(140px, 2fr) 70px 80px 80px;
		gap: 0.4rem;
		padding: 0.3rem 0;
		font-size: 0.76rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}
	.srv-path {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: #e4e4e7;
	}
	.srv-num {
		color: #a1a1aa;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.srv-num.slow {
		color: #fbbf24;
	}
	.dim {
		color: #71717a;
	}
	.spin {
		animation: usage-rotate 0.9s linear infinite;
	}
	@keyframes usage-rotate {
		to {
			transform: rotate(360deg);
		}
	}
</style>
