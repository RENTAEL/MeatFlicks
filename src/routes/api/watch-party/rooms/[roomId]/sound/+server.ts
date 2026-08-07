import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateRequestBody } from '$lib/server';
import { errorHandler } from '$lib/server';
import { playSound, SOUND_EFFECTS } from '$lib/server/watch-party/service';
import { requireUser, roomIdFromParams } from '$lib/server/watch-party/handlers';
import { z } from 'zod';

const soundSchema = z.object({ effect: z.enum(['suspense', 'jump', 'applause', 'boo']) });

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const roomId = roomIdFromParams(params);
		const user = requireUser(locals);
		const input = validateRequestBody(soundSchema, await request.json());
		await playSound(roomId, user, input.effect);
		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};