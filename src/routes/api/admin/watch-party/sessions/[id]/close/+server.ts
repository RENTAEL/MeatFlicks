import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin, roomIdSchema } from '$lib/server/watch-party/handlers';
import { adminCloseRoom } from '$lib/server/watch-party/service';
import { errorHandler, NotFoundError } from '$lib/server';

export const POST: RequestHandler = async ({ params, locals }) => {
	try {
		requireAdmin(locals);
		const parsed = roomIdSchema.safeParse(params.id);
		if (!parsed.success) throw new NotFoundError('Room not found');
		const closed = await adminCloseRoom(parsed.data);
		return json({ ok: closed });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
