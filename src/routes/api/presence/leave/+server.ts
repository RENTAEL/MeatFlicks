import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { leavePresence } from '$lib/server/presence';
import { errorHandler } from '$lib/server';

// sendBeacon cannot set headers, so this endpoint intentionally skips CSRF —
// leaving presence is a harmless no-op even if forged.
export const POST: RequestHandler = async ({ locals }) => {
	try {
		if (locals.user) await leavePresence(locals.user.id);
		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
