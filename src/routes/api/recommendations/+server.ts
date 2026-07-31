import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server';
import { getPersonalizedRecommendations } from '$lib/server/services/search.service';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ media: [] });
		}

		const media = await getPersonalizedRecommendations(user.id);
		return json({ media });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
