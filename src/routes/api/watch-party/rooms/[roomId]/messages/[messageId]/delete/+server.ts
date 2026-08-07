import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server';
import { deleteMessage } from '$lib/server/watch-party/service';
import { requireUser, roomIdFromParams } from '$lib/server/watch-party/handlers';
import { z } from 'zod';

export const POST: RequestHandler = async ({ params, locals }) => {
	try {
		const roomId = roomIdFromParams(params);
		const messageId = z.coerce.number().int().positive().parse(params.messageId);
		const user = requireUser(locals);
		await deleteMessage(roomId, user, messageId);
		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};