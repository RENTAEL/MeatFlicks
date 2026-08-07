import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateRequestBody } from '$lib/server';
import { errorHandler } from '$lib/server';
import { leaveRoom } from '$lib/server/watch-party/service';
import { requireUser, roomIdSchema } from '$lib/server/watch-party/handlers';
import { z } from 'zod';

const leaveSchema = z.object({ roomId: roomIdSchema });

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = requireUser(locals);
		const input = validateRequestBody(leaveSchema, await request.json());
		const result = await leaveRoom(input.roomId, user);
		return json({ ok: true, closedRoom: result.closedRoom });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};