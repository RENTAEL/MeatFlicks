/**
 * Client activity monitor — pure in-memory, zero network cost.
 *
 * Wraps window.fetch, EventSource and setInterval to count activity per
 * target in a 60-second ring. Exposes window.__clientActivity for the admin
 * usage dashboard so a runaway polling loop (the Watch Party incident) is
 * visible immediately in the tab it's happening in.
 *
 * Installed once from the root layout. Wrappers are pass-through — behavior
 * is identical to the native calls.
 */

const RING_MS = 60_000;

type ActivityEntry = { count: number; timestamps: number[] };

type ActivityStore = {
	fetch: Map<string, ActivityEntry>;
	eventSource: Map<string, ActivityEntry>;
	intervals: { ms: number; target: string; created: number }[];
	installed: boolean;
};

const g = globalThis as typeof globalThis & { __clientActivity?: ActivityStore };

export function getActivityStore(): ActivityStore {
	g.__clientActivity ??= {
		fetch: new Map(),
		eventSource: new Map(),
		intervals: [],
		installed: false
	};
	return g.__clientActivity;
}

function prune(entry: ActivityEntry): ActivityEntry {
	const cutoff = Date.now() - RING_MS;
	entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
	entry.count = entry.timestamps.length;
	return entry;
}

function bump(map: Map<string, ActivityEntry>, key: string): void {
	const entry = map.get(key) ?? { count: 0, timestamps: [] };
	entry.timestamps.push(Date.now());
	map.set(key, prune(entry));
}

export function installClientActivityMonitor(): void {
	const store = getActivityStore();
	if (store.installed || typeof window === 'undefined') return;
	store.installed = true;

	const nativeFetch = window.fetch.bind(window);
	window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
		try {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
			const path = url.startsWith('/') ? url.split('?')[0] : new URL(url).pathname;
			bump(store.fetch, path);
		} catch {}
		return nativeFetch(input as RequestInfo, init);
	}) as typeof window.fetch;

	const NativeEventSource = window.EventSource;
	if (NativeEventSource) {
		const Wrapped = function (this: unknown, url: string | URL, config?: EventSourceInit) {
			try {
				const href = typeof url === 'string' ? url : url.href;
				const path = href.startsWith('/') ? href.split('?')[0] : new URL(href).pathname;
				bump(store.eventSource, path);
			} catch {}
			return new NativeEventSource(url, config);
		} as unknown as typeof EventSource;
		Wrapped.prototype = NativeEventSource.prototype;
		(window as { EventSource: typeof EventSource }).EventSource = Wrapped;
	}

	const nativeSetInterval = window.setInterval.bind(window);
	window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
		try {
			const ms = Number(timeout ?? 0);
			if (ms > 0 && ms <= 60_000) {
				const target =
					typeof handler === 'function'
						? handler.name || 'anonymous'
						: String(handler).slice(0, 40);
				store.intervals.push({ ms, target, created: Date.now() });
				if (store.intervals.length > 200) store.intervals.splice(0, store.intervals.length - 200);
			}
		} catch {}
		return nativeSetInterval(handler as TimerHandler, timeout, ...args);
	}) as typeof window.setInterval;
}

export function getClientActivitySnapshot(): {
	fetchPerMin: { target: string; perMin: number }[];
	eventSourceOpen: { target: string; perMin: number }[];
	intervalCount: number;
	tightestIntervalMs: number;
	loops: string[];
} {
	const store = getActivityStore();
	const fetchPerMin = Array.from(store.fetch.entries())
		.map(([target, e]) => ({ target, perMin: prune(e).count }))
		.sort((a, b) => b.perMin - a.perMin)
		.slice(0, 12);
	const eventSourceOpen = Array.from(store.eventSource.entries())
		.map(([target, e]) => ({ target, perMin: prune(e).count }))
		.sort((a, b) => b.perMin - a.perMin)
		.slice(0, 8);
	const loops = fetchPerMin
		.filter((f) => f.perMin >= 10)
		.map((f) => `${f.target}: ${f.perMin}/min`);
	const tightest =
		store.intervals
			.slice(-50)
			.map((i) => i.ms)
			.sort((a, b) => a - b)[0] ?? 0;
	return {
		fetchPerMin,
		eventSourceOpen,
		intervalCount: store.intervals.length,
		tightestIntervalMs: tightest,
		loops
	};
}
