import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDailyQuote, isQuoteCategory, QUOTE_CATEGORIES } from '$lib/server/quotes/quote-service';
import { errorHandler } from '$lib/server';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const raw = url.searchParams.get('category') ?? 'general';
		const category = isQuoteCategory(raw) ? raw : 'general';
		const quote = await getDailyQuote(category);
		return json({ ...quote, categories: QUOTE_CATEGORIES });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
