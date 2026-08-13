import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server';
import { removeFromQueue } from '$lib/server/watch-party/service';
import { requireUser, roomIdFromParams } from '$lib/server/watch-party/handlers';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const roomId = roomIdFromParams(params);
		const user = requireUser(locals);
		const itemId = Number(params.itemId);
		if (!Number.isInteger(itemId) || itemId <= 0) {
			return json({ error: 'Invalid queue item id' }, { status: 400 });
		}
		await removeFromQueue(roomId, user, itemId);
		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
