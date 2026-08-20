import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { savedQuotesRepository } from '$lib/server/repositories/savedQuotes.repository';
import { errorHandler, ValidationError } from '$lib/server';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		if (!params.id) {
			throw new ValidationError('Quote ID is required');
		}
		await savedQuotesRepository.removeSavedQuote(user.id, params.id);
		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
