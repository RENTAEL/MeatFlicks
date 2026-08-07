import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateRequestBody } from '$lib/server';
import { errorHandler } from '$lib/server';
import { kickMember } from '$lib/server/watch-party/service';
import { requireUser, roomIdFromParams } from '$lib/server/watch-party/handlers';
import { z } from 'zod';

const kickSchema = z.object({ userId: z.string().trim().min(1).max(200) });

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const roomId = roomIdFromParams(params);
		const user = requireUser(locals);
		const input = validateRequestBody(kickSchema, await request.json());
		await kickMember(roomId, user, input.userId);
		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};