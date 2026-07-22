import { LRUCache } from 'lru-cache';
import type { ZodType } from 'zod';
import { env } from '../config/env';

export const CACHE_TTL_SHORT_SECONDS = env.CACHE_TTL_SHORT;
export const CACHE_TTL_MEDIUM_SECONDS = env.CACHE_TTL_MEDIUM;
export const CACHE_TTL_LONG_SECONDS = env.CACHE_TTL_LONG;
export const CACHE_TTL_SEARCH_SECONDS = 900;

export interface CacheEntry<T> {
	v: T;
	t: number;
}

type CacheEntryValue = CacheEntry<unknown>;

const CACHE_STAMPEDE_MAX_WAITERS = 10;

const lruStore = new LRUCache<string, CacheEntryValue>({
	max: env.CACHE_MEMORY_MAX_ITEMS,
	ttl: CACHE_TTL_MEDIUM_SECONDS * 1000
});

const stampedeProtection = new Map<string, CacheStampedeEntry<unknown>>();

interface CacheStampedeEntry<T = unknown> {
	promise: Promise<T>;
	timestamp: number;
	waiters: number;
}

function isCacheEntry<T>(val: unknown): val is CacheEntry<T> {
	return typeof val === 'object' && val !== null && 'v' in val && 't' in val;
}

export function buildCacheKey(
	...segments: Array<string | number | boolean | null | undefined>
): string {
	return segments
		.filter((segment) => segment !== undefined && segment !== null && segment !== '')
		.map((segment) =>
			typeof segment === 'string'
				? segment.trim().replace(/\s+/g, '-').toLowerCase()
				: typeof segment === 'boolean'
					? Number(segment).toString()
					: String(segment)
		)
		.join(':');
}

export async function getCachedValue<T>(key: string, schema?: ZodType<T>): Promise<T | undefined> {
	const entry = await getCacheEntry<T>(key, schema);
	return entry?.v;
}

async function getCacheEntry<T>(
	key: string,
	schema?: ZodType<T>
): Promise<CacheEntry<T> | undefined> {
	const memHit = lruStore.get(key);
	if (memHit !== undefined) {
		if (isCacheEntry<T>(memHit)) {
			if (schema) {
				const validation = schema.safeParse(memHit.v);
				if (!validation.success) {
					lruStore.delete(key);
					return undefined;
				}
			}
			return memHit;
		}
		const val = memHit as T;
		if (schema) {
			const validation = schema.safeParse(val);
			if (!validation.success) {
				lruStore.delete(key);
				return undefined;
			}
		}
		return { v: val, t: Date.now() };
	}
	return undefined;
}

export async function setCachedValue<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
	const ttlMs = ttlSeconds * 1000;
	const entry: CacheEntry<T> = { v: value, t: Date.now() };
	lruStore.set(key, entry, { ttl: ttlMs });
}

export async function deleteCachedValue(key: string): Promise<void> {
	lruStore.delete(key);
}

const inflight = new Map<string, Promise<unknown>>();

export async function withCache<T>(
	key: string,
	ttlSeconds: number,
	factory: () => Promise<T>,
	options: {
		stampedeProtection?: boolean;
		cacheOnError?: boolean;
		errorTtlSeconds?: number;
		swrSeconds?: number;
		schema?: ZodType<T>;
	} = {}
): Promise<T> {
	const {
		stampedeProtection: useStampedeProtection = true,
		cacheOnError = false,
		errorTtlSeconds = 60,
		swrSeconds,
		schema
	} = options;

	const entry = await getCacheEntry<T>(key, schema);
	if (entry !== undefined) {
		if (swrSeconds !== undefined && Date.now() - entry.t > swrSeconds * 1000) {
			const pendingRefresh = inflight.get(key);
			if (!pendingRefresh) {
				const refreshTask = (async () => {
					try {
						const newValue = await factory();
						await setCachedValue(key, newValue, ttlSeconds);
					} catch { }
					finally { inflight.delete(key); }
				})();
				inflight.set(key, refreshTask);
			}
		}
		return entry.v;
	}

	if (useStampedeProtection) {
		const existingStampede = stampedeProtection.get(key) as CacheStampedeEntry<T> | undefined;
		if (existingStampede) {
			if (existingStampede.waiters >= CACHE_STAMPEDE_MAX_WAITERS) {
				// Too many waiters
			} else {
				existingStampede.waiters++;
				try { return await existingStampede.promise; }
				finally { existingStampede.waiters--; }
			}
		}
	}

	const pending = inflight.get(key);
	if (pending) return pending as Promise<T>;

	let stampedeEntry: CacheStampedeEntry<T> | undefined;
	if (useStampedeProtection) {
		const promise = (async () => {
			try { return await factory(); }
			catch (error) {
				if (cacheOnError) await setCachedValue(key, null as T, errorTtlSeconds);
				throw error;
			}
		})();
		stampedeEntry = { promise, timestamp: Date.now(), waiters: 1 };
		stampedeProtection.set(key, stampedeEntry as CacheStampedeEntry<unknown>);
	}

	const task = (async () => {
		try {
			const value = stampedeEntry ? await stampedeEntry.promise : await factory();
			if (value !== undefined) await setCachedValue(key, value, ttlSeconds);
			else if (cacheOnError) await setCachedValue(key, null as T, errorTtlSeconds);
			return value;
		} catch (error) {
			if (cacheOnError) await setCachedValue(key, null as T, errorTtlSeconds);
			throw error;
		} finally {
			inflight.delete(key);
			if (stampedeEntry) stampedeProtection.delete(key);
		}
	})();

	inflight.set(key, task);
	return task;
}

export async function withCacheRefresh<T>(
	key: string,
	ttlSeconds: number,
	factory: () => Promise<T>,
	swrSeconds: number = Math.floor(ttlSeconds / 2),
	schema?: ZodType<T>
): Promise<T> {
	return withCache(key, ttlSeconds, factory, { swrSeconds, stampedeProtection: true, schema });
}

export async function warmCache<T>(
	keys: string[],
	ttlSeconds: number,
	factory: (key: string) => Promise<T>,
	concurrency: number = 3
): Promise<void> {
	// Memory-only warming
}

export function getCacheStats() {
	return { lruSize: lruStore.size, lruMax: lruStore.max, stampedeEntries: stampedeProtection.size };
}

export function buildVersionedCacheKey(version: string, ...segments: Array<string | number | boolean | null | undefined>): string {
	return buildCacheKey('v' + version, ...segments);
}

export async function invalidateCachePattern(pattern: string): Promise<number> {
	let invalidated = 0;
	const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
	const regex = new RegExp(`^${escapedPattern}$`);
	const lruKeys = Array.from(lruStore.keys());
	for (const key of lruKeys) {
		if (regex.test(key)) { lruStore.delete(key); invalidated++; }
	}
	return invalidated;
}

export async function invalidateCachePrefix(prefix: string): Promise<number> {
	return invalidateCachePattern(`${prefix}*`);
}

export async function invalidateTmdbId(tmdbId: number, mediaType?: 'movie' | 'tv' | 'anime'): Promise<number> {
	const patterns: string[] = [];
	if (mediaType) patterns.push(`tmdb:${mediaType}:${tmdbId}:*`);
	else { patterns.push(`tmdb:movie:${tmdbId}:*`, `tmdb:tv:${tmdbId}:*`, `tmdb:anime:${tmdbId}:*`); }
	let total = 0;
	for (const p of patterns) total += await invalidateCachePattern(p);
	return total;
}

export async function invalidateStreamingSource(tmdbId: number, mediaType: 'movie' | 'tv' | 'anime', season?: number, episode?: number): Promise<number> {
	let pattern = `streaming:${mediaType}:${tmdbId}`;
	if (season !== undefined) { pattern += `:${season}`; if (episode !== undefined) pattern += `:${episode}`; pattern += '*'; }
	else pattern += '*';
	return invalidateCachePattern(pattern);
}
