/**
 * Tiny per-instance in-memory TTL cache. Used to keep frequently-read,
 * rarely-changing data (announcements, feature flags, daily quotes) off the
 * DB / external APIs on every request. Keyed by string; values live for a
 * configurable TTL within a warm serverless instance. NOT for user-specific
 * or auth-gated data.
 */

type Entry = { value: unknown; expires: number };

const globalKey = '__memCache';
const g = globalThis as typeof globalThis & { [globalKey]?: Map<string, Entry> };
g[globalKey] ??= new Map();
const store = g[globalKey];

export function memGet<T>(key: string): T | undefined {
	const entry = store.get(key);
	if (!entry) return undefined;
	if (entry.expires < Date.now()) {
		store.delete(key);
		return undefined;
	}
	return entry.value as T;
}

export function memSet<T>(key: string, value: T, ttlMs: number): void {
	store.set(key, { value, expires: Date.now() + ttlMs });
}

export async function memCached<T>(
	key: string,
	ttlMs: number,
	producer: () => Promise<T>
): Promise<T> {
	const hit = memGet<T>(key);
	if (hit !== undefined) return hit;
	const value = await producer();
	memSet(key, value, ttlMs);
	return value;
}

export function msUntilEndOfDay(now: Date = new Date()): number {
	const end = new Date(now);
	end.setHours(24, 0, 0, 0);
	return Math.max(60_000, end.getTime() - now.getTime());
}
