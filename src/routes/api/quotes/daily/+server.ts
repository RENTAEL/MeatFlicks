import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDailyQuote, isQuoteCategory, QUOTE_CATEGORIES } from '$lib/server/quotes/quote-service';
import { errorHandler } from '$lib/server';
import { memCached, msUntilEndOfDay } from '$lib/server/memCache';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const raw = url.searchParams.get('category') ?? 'general';
		const category = isQuoteCategory(raw) ? raw : 'general';
		const day = new Date().toISOString().slice(0, 10);
		const ttl = msUntilEndOfDay();
		const quote = await memCached(`api:daily:${category}:${day}`, ttl, () =>
			getDailyQuote(category)
		);
		return json(
			{ ...quote, categories: QUOTE_CATEGORIES },
			{
				headers: {
					'Cache-Control': `public, max-age=${Math.floor(ttl / 1000)}, s-maxage=${Math.floor(ttl / 1000)}, stale-while-revalidate=3600`
				}
			}
		);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
