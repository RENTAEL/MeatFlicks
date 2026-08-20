import { getCsrfTokenClient } from '$lib/utils/csrf.client';

export type SavedQuote = {
	id: string;
	quoteText: string;
	quoteAuthor: string;
	category: string;
	createdAt: number;
};

const buildJsonHeadersWithCsrf = async (): Promise<Record<string, string>> => {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = await getCsrfTokenClient();
	if (token) {
		headers['X-CSRF-Token'] = token;
	}
	return headers;
};

export const savedQuotesStore = {
	async getQuotes(): Promise<SavedQuote[]> {
		const response = await fetch('/api/quotes', { credentials: 'include' });
		if (!response.ok) return [];
		const data = (await response.json()) as { quotes?: SavedQuote[] };
		return data.quotes ?? [];
	},

	async saveQuote(quote: {
		quoteText: string;
		quoteAuthor: string;
		category: string;
	}): Promise<SavedQuote | null> {
		const response = await fetch('/api/quotes', {
			method: 'POST',
			headers: await buildJsonHeadersWithCsrf(),
			body: JSON.stringify(quote),
			credentials: 'include'
		});
		if (!response.ok) return null;
		const data = (await response.json()) as { success?: boolean; quote?: SavedQuote | null };
		return data.success ? (data.quote ?? null) : null;
	},

	async removeQuote(id: string): Promise<boolean> {
		const response = await fetch(`/api/quotes/${encodeURIComponent(id)}`, {
			method: 'DELETE',
			headers: await buildJsonHeadersWithCsrf(),
			credentials: 'include'
		});
		return response.ok;
	}
};
