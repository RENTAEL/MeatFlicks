import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { listActiveSessions } from '$lib/server/watch-party/service';
import { errorHandler } from '$lib/server';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		requireAdmin(locals);
		const sessions = await listActiveSessions();
		return json({ sessions, at: Date.now() });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
