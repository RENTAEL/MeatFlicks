import type { DailyQuoteClient } from '$lib/state/stores/dailyQuotes.svelte';

export const QUOTE_OG_IMAGE = 'https://streamium-cosmic.vercel.app/icon-512.png';

export const MAX_QUOTE_URL_CHARS = 1000;

export function buildQuoteShareUrl(
	quote: Pick<DailyQuoteClient, 'quote' | 'author' | 'category' | 'day'>
): string {
	const params = new URLSearchParams({
		category: quote.category,
		day: quote.day,
		q: quote.quote.slice(0, MAX_QUOTE_URL_CHARS),
		a: quote.author.slice(0, 200)
	});
	return `/quote?${params.toString()}`;
}
