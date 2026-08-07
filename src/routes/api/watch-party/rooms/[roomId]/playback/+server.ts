import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateRequestBody } from '$lib/server';
import { errorHandler } from '$lib/server';
import { updatePlayback } from '$lib/server/watch-party/service';
import { requireUser, roomIdFromParams } from '$lib/server/watch-party/handlers';
import { z } from 'zod';

const playbackSchema = z.object({
	action: z.enum(['play', 'pause', 'seek']),
	position: z.coerce.number().finite().min(0).optional()
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const roomId = roomIdFromParams(params);
		const user = requireUser(locals);
		const input = validateRequestBody(playbackSchema, await request.json());
		await updatePlayback(roomId, user, input);
		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};