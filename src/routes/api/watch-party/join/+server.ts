import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateRequestBody } from '$lib/server';
import { errorHandler } from '$lib/server';
import { joinRoom } from '$lib/server/watch-party/service';
import { requireUser, roomIdSchema } from '$lib/server/watch-party/handlers';
import { z } from 'zod';

const joinSchema = z.object({ roomId: roomIdSchema });

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = requireUser(locals);
		const body = await request.json();
		const input = validateRequestBody(joinSchema, body);

		await joinRoom(input.roomId, user);
		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};