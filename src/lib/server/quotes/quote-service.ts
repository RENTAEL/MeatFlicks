import { logger } from '../logger';
import { QUOTE_CATEGORIES, getFallbackQuote, type QuoteCategory } from '$lib/quotes/fallbackQuotes';

export { QUOTE_CATEGORIES, type QuoteCategory, FALLBACK_QUOTES } from '$lib/quotes/fallbackQuotes';

export type DailyQuote = {
	quote: string;
	author: string;
	category: QuoteCategory;
	day: string;
	source: 'api' | 'fallback';
};

const API_TIMEOUT_MS = 2500;
const inMemoryCache = new Map<string, { day: string; quote: DailyQuote }>();

function utcDayKey(date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

function pickFallback(category: QuoteCategory, day: string): DailyQuote {
	const entry = getFallbackQuote(category, day);
	return {
		quote: entry.quote,
		author: entry.author,
		category,
		day,
		source: 'fallback'
	};
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: { Accept: 'application/json' }
		});
		// Explicitly handle rate limiting and server errors as fallback triggers
		if (!res.ok) {
			if (res.status === 429) logger.warn('Quote API rate limited');
			return null;
		}
		return res;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

async function tryDummyJson(): Promise<{ quote: string; author: string } | null> {
	const res = await fetchWithTimeout('https://dummyjson.com/quotes/random');
	if (!res) return null;
	try {
		const data = (await res.json()) as { quote?: string; author?: string };
		if (typeof data.quote === 'string' && data.quote.trim().length >= 2) {
			return {
				quote: data.quote.trim(),
				author: typeof data.author === 'string' && data.author.trim() ? data.author.trim() : 'Unknown'
			};
		}
	} catch {
		// parse failure -> fallback
	}
	return null;
}

async function tryZenQuotes(): Promise<{ quote: string; author: string } | null> {
	const res = await fetchWithTimeout('https://zenquotes.io/api/random');
	if (!res) return null;
	try {
		const data = (await res.json()) as { q?: string; a?: string }[] | { q?: string; a?: string };
		const item = Array.isArray(data) ? data[0] : data;
		if (item && typeof item.q === 'string' && item.q.trim().length >= 2) {
			return {
				quote: item.q.trim(),
				author: typeof item.a === 'string' && item.a.trim() ? item.a.trim() : 'Unknown'
			};
		}
	} catch {
		// ignore
	}
	return null;
}

async function fetchFromApi(category: QuoteCategory): Promise<DailyQuote | null> {
	const day = utcDayKey();
	// Primary: dummyjson (reliable, no key, CORS-friendly via server)
	let result = await tryDummyJson();
	// Secondary: zenquotes if primary fails
	if (!result) result = await tryZenQuotes();
	if (!result) return null;
	return {
		quote: result.quote,
		author: result.author,
		category,
		day,
		source: 'api'
	};
}

export async function getDailyQuote(category: QuoteCategory): Promise<DailyQuote> {
	const day = utcDayKey();

	const cached = inMemoryCache.get(category);
	if (cached && cached.day === day) return cached.quote;

	const apiQuote = await fetchFromApi(category);
	const quote = apiQuote ?? pickFallback(category, day);
	inMemoryCache.set(category, { day, quote });

	if (apiQuote) {
		logger.info({ category }, 'Daily quote fetched from API');
	} else {
		logger.info({ category }, 'Quote API unavailable — serving curated fallback');
	}

	return quote;
}

export function isQuoteCategory(value: string): value is QuoteCategory {
	return (QUOTE_CATEGORIES as readonly string[]).includes(value);
}
