import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { touchPresence } from '$lib/server/presence';
import { validateCsrfForApi } from '$lib/server/csrf';
import { errorHandler, UnauthorizedError } from '$lib/server';

export const POST: RequestHandler = async (event) => {
	try {
		await validateCsrfForApi(event);
		const user = event.locals.user;
		if (!user) throw new UnauthorizedError('User must be authenticated');

		const body = (await event.request.json().catch(() => null)) as {
			path?: unknown;
			title?: unknown;
		} | null;

		const rawPath = typeof body?.path === 'string' ? body.path : null;
		const rawTitle = typeof body?.title === 'string' ? body.title : null;

		await touchPresence(user.id, user.username, {
			path: rawPath ? rawPath.slice(0, 160) : null,
			title: rawTitle ? rawTitle.slice(0, 120) : null
		});

		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
