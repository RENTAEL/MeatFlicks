import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { getSystemStats } from '$lib/server/admin/service';
import { errorHandler } from '$lib/server';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		requireAdmin(locals);
		const stats = await getSystemStats();
		return json({ stats, at: Date.now() });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
