import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { savedQuotesRepository } from '$lib/server/repositories/savedQuotes.repository';
import { z } from 'zod';
import { errorHandler, ValidationError } from '$lib/server';
import { validateRequestBody } from '$lib/server/validation';
import { isQuoteCategory } from '$lib/server/quotes/quote-service';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ quotes: [] });
		}
		const quotes = await savedQuotesRepository.getSavedQuotes(user.id);
		return json({ quotes });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const validatedBody = validateRequestBody(
			z.object({
				quoteText: z.string().min(2).max(2000),
				quoteAuthor: z.string().min(1).max(200).default('Unknown'),
				category: z.string().max(50).default('general')
			}),
			body
		);

		if (!isQuoteCategory(validatedBody.category)) {
			throw new ValidationError('Invalid quote category');
		}

		const saved = await savedQuotesRepository.addSavedQuote(user.id, {
			quoteText: validatedBody.quoteText,
			quoteAuthor: validatedBody.quoteAuthor,
			category: validatedBody.category
		});

		return json({ success: true, quote: saved });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
