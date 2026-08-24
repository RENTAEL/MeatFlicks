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

	type LiveSnapshot = {
		generatedAt: number;
		rpm: number;
		rpm5: number;
		avgMs: number;
		slowest: { path: string; count: number; avgMs: number }[];
		anomalies: { path: string; perMin: number; reason: string }[];
		monitors: number;
		cost: 'low' | 'medium' | 'high';
	};

	let server: UsageSummary | null = $state(null);
	let client = $state<ReturnType<typeof getClientActivitySnapshot> | null>(null);
	let live = $state<LiveSnapshot | null>(null);
	let spark = $state<number[]>([]);
	let reduced = $state(false);
	let loading = $state(false);
	let open = $state(true);
	let timer: ReturnType<typeof setInterval> | null = null;
	let liveEs: EventSource | null = null;

	onMount(() => {
		installClientActivityMonitor();
		reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		void refresh();
		// Live dashboard — server pushes every 20s; we don't poll.
		try {
			const es = new EventSource('/api/admin/performance/live');
			es.addEventListener('metrics', (e) => {
				try {
					const snap = JSON.parse((e as MessageEvent).data) as LiveSnapshot;
					live = snap;
					spark = [...spark, snap.rpm].slice(-30);
				} catch {}
			});
			es.onerror = () => {};
			liveEs = es;
		} catch {}
		// 24h/aggregate view — lazy 30s refresh while visible.
		timer = setInterval(() => {
			if (!document.hidden) {
				client = getClientActivitySnapshot();
				if (open) void refresh();
			}
		}, 30_000);
		return () => {
			if (timer) clearInterval(timer);
			if (liveEs) liveEs.close();
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
		<!-- Live performance (server-pushed every 20s) -->
		<div class="usage-section live">
			<div class="usage-label">
				Live <span class="live-dot" class:on={!!live} aria-hidden="true"></span>
				{#if live}
					<span class="cost cost-{live.cost}" title="Estimated serverless cost impact">
						{live.cost}
					</span>
				{/if}
			</div>
			{#if live}
				<div class="live-grid">
					<div class="live-stat">
						<span class="live-num">{live.rpm}</span>
						<span class="live-cap">req/min</span>
					</div>
					<div class="live-stat">
						<span class="live-num">{live.avgMs}ms</span>
						<span class="live-cap">avg resp</span>
					</div>
					<div class="live-stat">
						<span class="live-num">{live.monitors}</span>
						<span class="live-cap">dashboards</span>
					</div>
				</div>
				<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" class:reduced>
					<polyline
						points={spark
							.map((v, i) => {
								const max = Math.max(1, ...spark);
								const x = spark.length > 1 ? (i / (spark.length - 1)) * 100 : 0;
								const y = 26 - (v / max) * 24;
								return `${x.toFixed(1)},${y.toFixed(1)}`;
							})
							.join(' ')}
					/>
				</svg>
				{#if live.slowest.length}
					<div class="live-slow">
						<span class="live-cap">slowest now</span>
						{#each live.slowest.slice(0, 4) as s (s.path)}
							<span class="live-chip">{s.path} · {s.avgMs}ms</span>
						{/each}
					</div>
				{/if}
				{#if live.anomalies.length}
					<div class="client-loop" role="alert">
						Loop suspected: {live.anomalies.map((a) => `${a.path} ${a.perMin}/min`).join(' · ')}
					</div>
				{/if}
			{:else}
				<p class="usage-empty">Connecting to live metrics…</p>
			{/if}
		</div>

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

	.live-dot {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: #3f3f46;
		margin-left: 0.35rem;
		vertical-align: middle;
	}
	.live-dot.on {
		background: #22c55e;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
	}
	.cost {
		margin-left: 0.5rem;
		padding: 0.05rem 0.5rem;
		border-radius: 999px;
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.cost-low {
		background: rgba(34, 197, 94, 0.15);
		color: #4ade80;
	}
	.cost-medium {
		background: rgba(251, 191, 36, 0.15);
		color: #fbbf24;
	}
	.cost-high {
		background: rgba(239, 68, 68, 0.18);
		color: #f87171;
	}
	.live-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.4rem;
		margin-bottom: 0.5rem;
	}
	.live-stat {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0.4rem 0.55rem;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.04);
	}
	.live-num {
		font-size: 1.15rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: #f4f4f5;
	}
	.live-cap {
		font-size: 0.66rem;
		color: #71717a;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.spark {
		width: 100%;
		height: 28px;
		display: block;
		margin-bottom: 0.5rem;
	}
	.spark polyline {
		fill: none;
		stroke: #818cf8;
		stroke-width: 1.5;
		vector-effect: non-scaling-stroke;
		transition: all 0.3s ease;
	}
	.spark.reduced polyline {
		transition: none;
	}
	.live-slow {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}
	.live-chip {
		padding: 0.12rem 0.5rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.05);
		font-size: 0.68rem;
		color: #d4d4d8;
	}
	@media (max-width: 540px) {
		.live-num {
			font-size: 1rem;
		}
	}
</style>
