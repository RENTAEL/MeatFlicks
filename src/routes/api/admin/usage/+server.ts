import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { getUsageSummary } from '$lib/server/usage';
import { errorHandler } from '$lib/server';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		requireAdmin(locals);
		return json(await getUsageSummary());
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
