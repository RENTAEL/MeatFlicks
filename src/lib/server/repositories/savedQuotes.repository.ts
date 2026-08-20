import { db } from '$lib/server/db';
import { savedQuotes } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createId } from '$lib/server/id';

export type SavedQuote = {
	id: string;
	quoteText: string;
	quoteAuthor: string;
	category: string;
	createdAt: number;
};

export const savedQuotesRepository = {
	async getSavedQuotes(userId: string): Promise<SavedQuote[]> {
		try {
			const rows = await db
				.select({
					id: savedQuotes.id,
					quoteText: savedQuotes.quoteText,
					quoteAuthor: savedQuotes.quoteAuthor,
					category: savedQuotes.category,
					createdAt: savedQuotes.createdAt
				})
				.from(savedQuotes)
				.where(eq(savedQuotes.userId, userId))
				.orderBy(desc(savedQuotes.createdAt));
			return rows;
		} catch (error) {
			console.error('Error fetching saved quotes:', error);
			return [];
		}
	},

	async addSavedQuote(
		userId: string,
		quote: { quoteText: string; quoteAuthor: string; category: string }
	): Promise<SavedQuote | null> {
		try {
			const existing = await db
				.select({ id: savedQuotes.id })
				.from(savedQuotes)
				.where(
					and(
						eq(savedQuotes.userId, userId),
						eq(savedQuotes.quoteText, quote.quoteText),
						eq(savedQuotes.quoteAuthor, quote.quoteAuthor)
					)
				)
				.limit(1)
				.get();

			if (existing) {
				return null;
			}

			const id = createId();
			await db.insert(savedQuotes).values({
				id,
				userId,
				quoteText: quote.quoteText,
				quoteAuthor: quote.quoteAuthor,
				category: quote.category,
				createdAt: Date.now()
			});
			return {
				id,
				quoteText: quote.quoteText,
				quoteAuthor: quote.quoteAuthor,
				category: quote.category,
				createdAt: Date.now()
			};
		} catch (error) {
			console.error('Error saving quote:', error);
			throw new Error('Failed to save quote');
		}
	},

	async removeSavedQuote(userId: string, id: string): Promise<boolean> {
		try {
			const result = await db
				.delete(savedQuotes)
				.where(and(eq(savedQuotes.userId, userId), eq(savedQuotes.id, id)));
			return (result.rowsAffected ?? 0) > 0;
		} catch (error) {
			console.error('Error removing saved quote:', error);
			throw new Error('Failed to remove saved quote');
		}
	}
};

export type SavedQuotesRepository = typeof savedQuotesRepository;
