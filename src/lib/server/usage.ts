/**
 * Usage & performance monitor â€” deliberately almost free.
 *
 * The request hook records (path, duration) into an in-memory ring of
 * one-minute buckets. Nothing touches the DB per request. Every few minutes
 * the next request that happens flushes expired buckets to Turso in ONE
 * batched statement and prunes rows older than 48h â€” that is the entire
 * DB cost of this feature.
 *
 * Anomaly rule: a path averaging â‰¥ LOOP_REQS_PER_MIN requests/min over the
 * last 5 full minutes is flagged as a probable polling loop (the original
 * Watch Party overage was a 4s poll = 15/min).
 */

import { lt, sql } from 'drizzle-orm';

const BUCKET_MS = 60_000;
const BUCKETS_KEPT = 60; // 1h in memory
const LOOP_REQS_PER_MIN = 15;
const FLUSH_EVERY_MS = 3 * 60_000;
const RETAIN_DB_MS = 48 * 60 * 60_000;

type Bucket = { count: number; totalMs: number; maxMs: number };

const globalKey = '__usageMonitor';
const g = globalThis as typeof globalThis & {
	[globalKey]?: {
		buckets: Map<number, Map<string, Bucket>>;
		lastFlush: number;
		flushing: boolean;
	};
};

g[globalKey] ??= { buckets: new Map(), lastFlush: 0, flushing: false };
const store = g[globalKey];

const STATIC_PREFIXES = [
	'/_app/',
	'/sounds/',
	'/favicon',
	'/icon-',
	'/manifest.json',
	'/.netlify/'
];

function bucketOf(ts: number): number {
	return Math.floor(ts / BUCKET_MS) * BUCKET_MS;
}

export function recordRequest(pathname: string, durationMs: number): void {
	if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return;
	const path = pathname.length > 80 ? pathname.slice(0, 80) : pathname;
	const b = bucketOf(Date.now());
	let bucket = store.buckets.get(b);
	if (!bucket) {
		bucket = new Map();
		store.buckets.set(b, bucket);
		// drop buckets older than the memory window
		for (const old of store.buckets.keys()) {
			if (old < b - BUCKETS_KEPT * BUCKET_MS) store.buckets.delete(old);
		}
	}
	const entry = bucket.get(path) ?? { count: 0, totalMs: 0, maxMs: 0 };
	entry.count += 1;
	entry.totalMs += Math.max(0, Math.round(durationMs));
	entry.maxMs = Math.max(entry.maxMs, Math.max(0, Math.round(durationMs)));
	bucket.set(path, entry);
}

type UsageRow = { bucket: number; path: string; count: number; totalMs: number; maxMs: number };

/** Flush expired in-memory buckets to Turso (one batched upsert) + prune. */
async function flush(): Promise<void> {
	if (store.flushing) return;
	store.flushing = true;
	try {
		const now = Date.now();
		const rows: UsageRow[] = [];
		for (const [bucketMin, paths] of store.buckets) {
			if (bucketMin >= bucketOf(now)) continue; // current minute still live
			for (const [path, e] of paths) rows.push({ bucket: bucketMin, path, ...e });
		}
		if (rows.length > 0) {
			const { db } = await import('./db');
			const { usageStats } = await import('./db/schema');
			await db
				.insert(usageStats)
				.values(rows)
				.onConflictDoUpdate({
					target: [usageStats.bucket, usageStats.path],
					set: {
						count: sql`excluded.count + ${usageStats.count}`,
						totalMs: sql`excluded.totalMs + ${usageStats.totalMs}`,
						maxMs: sql`max(excluded.maxMs, ${usageStats.maxMs})`
					}
				})
				.run();
			for (const [bucketMin, paths] of store.buckets) {
				if (bucketMin < bucketOf(now)) store.buckets.delete(bucketMin);
			}
			if (Math.random() < 0.1) {
				await db.delete(usageStats).where(lt(usageStats.bucket, now - RETAIN_DB_MS));
			}
		}
		store.lastFlush = now;
	} catch {
		// monitoring must never break the app
	} finally {
		store.flushing = false;
	}
}

async function maybeFlush(): Promise<void> {
	if (Date.now() - store.lastFlush < FLUSH_EVERY_MS) return;
	await flush();
}

export type UsageSummary = {
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

export async function getUsageSummary(): Promise<UsageSummary> {
	void maybeFlush();
	const now = Date.now();
	const currentBucket = bucketOf(now);
	const perPath = new Map<
		string,
		{ counts: number[]; totalMs: number; count: number; maxMs: number }
	>();

	const buckets = Array.from(store.buckets.entries()).sort((a, b) => a[0] - b[0]);
	for (const [bucketMin, paths] of buckets) {
		const idx = Math.floor((currentBucket - bucketMin) / BUCKET_MS); // 0 = current minute
		if (idx < 0 || idx > 59) continue;
		for (const [path, e] of paths) {
			const agg = perPath.get(path) ?? {
				counts: new Array(60).fill(0),
				totalMs: 0,
				count: 0,
				maxMs: 0
			};
			agg.counts[idx] += e.count;
			agg.totalMs += e.totalMs;
			agg.count += e.count;
			agg.maxMs = Math.max(agg.maxMs, e.maxMs);
			perPath.set(path, agg);
		}
	}

	const live: UsageSummary['live'] = [];
	const anomalies: UsageSummary['anomalies'] = [];
	for (const [path, agg] of perPath) {
		const last5 = agg.counts.slice(1, 6).reduce((a, b) => a + b, 0) / 5;
		const lastMinute = agg.counts[0];
		const avgMs = agg.count > 0 ? Math.round(agg.totalMs / agg.count) : 0;
		live.push({
			path,
			lastMinute,
			last5mPerMin: Math.round(last5 * 10) / 10,
			avgMs,
			maxMs: agg.maxMs
		});
		if (last5 >= LOOP_REQS_PER_MIN) {
			anomalies.push({
				path,
				perMin: Math.round(last5 * 10) / 10,
				reason: `Averaging ${Math.round(last5 * 10) / 10} requests/min over the last 5 minutes â€” looks like a polling loop.`
			});
		}
	}
	live.sort((a, b) => b.last5mPerMin - a.last5mPerMin || b.lastMinute - a.lastMinute);
	anomalies.sort((a, b) => b.perMin - a.perMin);

	let day: UsageSummary['day'] = [];
	let total24h = 0;
	try {
		const { db } = await import('./db');
		const { usageStats } = await import('./db/schema');
		const rows = await db
			.select({
				path: usageStats.path,
				count: sql<number>`sum(${usageStats.count})`,
				avgMs: sql<number>`cast(avg(${usageStats.totalMs} * 1.0 / ${usageStats.count}) as integer)`,
				maxMs: sql<number>`max(${usageStats.maxMs})`
			})
			.from(usageStats)
			.where(sql`${usageStats.bucket} > ${currentBucket - 24 * 60 * BUCKET_MS}`)
			.groupBy(usageStats.path)
			.orderBy(sql`sum(${usageStats.count}) desc`)
			.limit(15)
			.all();
		day = rows.map((r) => ({
			path: r.path,
			count: Number(r.count),
			avgMs: Number(r.avgMs ?? 0),
			maxMs: Number(r.maxMs ?? 0)
		}));
		total24h = day.reduce((a, b) => a + b.count, 0);
	} catch {
		// DB aggregation is best-effort; live numbers still work
	}

	return {
		live: live.slice(0, 20),
		anomalies: anomalies.slice(0, 8),
		day,
		total24h,
		generatedAt: now
	};
}
