import { browser } from '$app/environment';
import { getFallbackQuote, type QuoteCategory } from '$lib/quotes/fallbackQuotes';

export { QUOTE_CATEGORIES, type QuoteCategory } from '$lib/quotes/fallbackQuotes';

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

function pickLocalFallback(category: QuoteCategory, day: string): DailyQuoteClient {
	const entry = getFallbackQuote(category, day);
	return { quote: entry.quote, author: entry.author, category, day, source: 'fallback' };
}

export async function fetchDailyQuote(category: QuoteCategory): Promise<DailyQuoteClient> {
	const day = todayUtc();
	const memKey = `${category}:${day}`;
	const mem = inMemoryCache.get(memKey);
	if (mem) return mem;

	const cached = readLocalCache(category);
	if (cached) {
		inMemoryCache.set(memKey, cached);
		return cached;
	}

	try {
		const response = await fetch(`/api/quotes/daily?category=${encodeURIComponent(category)}`);
		if (response.ok) {
			const data = (await response.json()) as DailyQuoteClient;
			// Basic validation — ensure we have a quote
			if (typeof data.quote === 'string' && data.quote.trim().length >= 2) {
				inMemoryCache.set(memKey, data);
				writeLocalCache(category, data);
				return data;
			}
		}
	} catch {
		// network failure -> fallback below
	}

	// Graceful local fallback — never throw, never blank
	const fallback = pickLocalFallback(category, day);
	inMemoryCache.set(memKey, fallback);
	writeLocalCache(category, fallback);
	return fallback;
}
