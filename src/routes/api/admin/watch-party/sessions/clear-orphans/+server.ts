import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { adminClearOrphanedSessions } from '$lib/server/watch-party/service';
import { errorHandler } from '$lib/server';

export const POST: RequestHandler = async ({ locals }) => {
	try {
		requireAdmin(locals);
		const result = await adminClearOrphanedSessions();
		return json({ ok: true, ...result });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
