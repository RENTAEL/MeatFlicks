import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateRequestBody } from '$lib/server';
import { errorHandler } from '$lib/server';
import { addMessage, deleteMessage } from '$lib/server/watch-party/service';
import { requireUser, roomIdFromParams } from '$lib/server/watch-party/handlers';
import { z } from 'zod';

const messageSchema = z.object({ body: z.string().trim().max(240) });

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const roomId = roomIdFromParams(params);
		const user = requireUser(locals);
		const input = validateRequestBody(messageSchema, await request.json());
		await addMessage(roomId, user, input);
		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};