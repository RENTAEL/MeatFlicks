import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateRequestBody, errorHandler } from '$lib/server';
import { setSoundControl } from '$lib/server/watch-party/service';
import { requireUser, roomIdFromParams } from '$lib/server/watch-party/handlers';
import { z } from 'zod';

const soundControlSchema = z.object({
	userId: z.string().min(1).max(100),
	granted: z.boolean()
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const roomId = roomIdFromParams(params);
		const user = requireUser(locals);
		const input = validateRequestBody(soundControlSchema, await request.json());
		await setSoundControl(roomId, user, input.userId, input.granted);
		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
