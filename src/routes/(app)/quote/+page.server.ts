import { htmlCacheControl } from '$lib/server/caching';
import type { PageServerLoad } from './$types';
import { getDailyQuote, isQuoteCategory } from '$lib/server/quotes/quote-service';
import { MAX_QUOTE_URL_CHARS } from '$lib/utils/quoteShare';

export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });

	const rawCategory = url.searchParams.get('category') ?? 'general';
	const category = isQuoteCategory(rawCategory) ? rawCategory : 'general';
	const quoteText = url.searchParams.get('q')?.trim();
	const author = url.searchParams.get('a')?.trim();
	const day = url.searchParams.get('day')?.trim();

	if (quoteText && author) {
		return {
			quote: {
				quote: quoteText.slice(0, MAX_QUOTE_URL_CHARS),
				author: author.slice(0, 200),
				category,
				day: day || 'today',
				source: 'fallback' as const
			}
		};
	}

	const quote = await getDailyQuote(category);
	return { quote };
};
