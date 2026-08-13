import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateRequestBody } from '$lib/server';
import { errorHandler } from '$lib/server';
import { addToQueue } from '$lib/server/watch-party/service';
import { requireUser, roomIdFromParams } from '$lib/server/watch-party/handlers';
import { z } from 'zod';

const addQueueSchema = z.object({
	mediaType: z.enum(['movie', 'tv']),
	tmdbId: z.coerce.number().int().positive(),
	season: z.coerce.number().int().positive().optional(),
	episode: z.coerce.number().int().positive().optional(),
	title: z.string().trim().min(1).max(200),
	provider: z
		.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(100) })
		.nullable()
		.optional()
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const roomId = roomIdFromParams(params);
		const user = requireUser(locals);
		const input = validateRequestBody(addQueueSchema, await request.json());
		await addToQueue(roomId, user, input);
		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
