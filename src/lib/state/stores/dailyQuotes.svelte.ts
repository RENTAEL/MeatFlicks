import { browser } from '$app/environment';

export const QUOTE_CATEGORIES = ['funny', 'deep', 'dark', 'general', 'dating'] as const;

export type QuoteCategory = (typeof QUOTE_CATEGORIES)[number];

export const QUOTE_CATEGORY_LABELS: Record<QuoteCategory, string> = {
	funny: 'Funny',
	deep: 'Deep',
	dark: 'Dark',
	general: 'General',
	dating: 'Dating'
};

export type DailyQuoteClient = {
	quote: string;
	author: string;
	category: QuoteCategory;
	day: string;
	source: 'api' | 'fallback';
};

const CACHE_PREFIX = 'streamium.dq.';
const inMemoryCache = new Map<string, DailyQuoteClient>();

function todayUtc(): string {
	return new Date().toISOString().slice(0, 10);
}

function readLocalCache(category: QuoteCategory): DailyQuoteClient | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(CACHE_PREFIX + category);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as DailyQuoteClient;
		if (parsed?.day === todayUtc() && parsed?.category === category) return parsed;
	} catch {
		// ignore corrupted cache
	}
	return null;
}

function writeLocalCache(category: QuoteCategory, quote: DailyQuoteClient) {
	if (!browser) return;
	try {
		localStorage.setItem(CACHE_PREFIX + category, JSON.stringify(quote));
	} catch {
		// storage full/unavailable — cache is best-effort
	}
}

export async function fetchDailyQuote(category: QuoteCategory): Promise<DailyQuoteClient> {
	const memKey = `${category}:${todayUtc()}`;
	const mem = inMemoryCache.get(memKey);
	if (mem) return mem;

	const cached = readLocalCache(category);
	if (cached) {
		inMemoryCache.set(memKey, cached);
		return cached;
	}

	const response = await fetch(`/api/quotes/daily?category=${encodeURIComponent(category)}`);
	if (!response.ok) throw new Error('Failed to load daily quote');
	const data = (await response.json()) as DailyQuoteClient;
	inMemoryCache.set(memKey, data);
	writeLocalCache(category, data);
	return data;
}
