import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server';
import { getRoomState } from '$lib/server/watch-party/service';
import { requireUser, roomIdFromParams } from '$lib/server/watch-party/handlers';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	try {
		const roomId = roomIdFromParams(params);
		const sinceRaw = url.searchParams.get('since');
		const since = sinceRaw ? Number(sinceRaw) : undefined;
		const state = await getRoomState(roomId, requireUser(locals), {
			sinceMessageId: Number.isFinite(since) ? since : undefined
		});
		return json(state);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};