import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NotFoundError, errorHandler } from '$lib/server';
import { getRoomState, getRoomTick, touchMemberActivity } from '$lib/server/watch-party/service';
import { requireUser, roomIdFromParams } from '$lib/server/watch-party/handlers';
import { subscribeRoom } from '$lib/server/watch-party/events';

const TICK_MS = 700;
const HEARTBEAT_MS = 15000;
const MAX_LIFETIME_MS = 50000;

export const config = {
	maxDuration: 60
};

export const GET: RequestHandler = async ({ params, locals, request }) => {
	try {
		const roomId = roomIdFromParams(params);
		const user = requireUser(locals);

		const initialTick = await getRoomTick(roomId);
		if (!initialTick) throw new NotFoundError('Room not found');

		await touchMemberActivity(roomId, user.id);

		const encoder = new TextEncoder();
		let lastVersion = '';
		let since = 0;

		const stream = new ReadableStream({
			start(controller) {
				let settled = false;
				const send = (data: string) => {
					if (settled) return;
					try {
						controller.enqueue(encoder.encode(data));
					} catch {
						// client went away
					}
				};

				const push = async () => {
					if (settled) return;
					try {
						const tick = await getRoomTick(roomId);
						const version = tick ? `${tick.seq}:${tick.closedAt ?? ''}:${tick.lastMessageId}` : 'gone';
						if (version === lastVersion) return;
						console.log(`[stream] ${roomId} version ${version} (was ${lastVersion || '(initial)'}, since ${since})`);
						lastVersion = version;
						const state = await getRoomState(roomId, user, { sinceMessageId: since });
						since = state.lastMessageId;
						send(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
					} catch (error) {
						console.error(`[stream] ${roomId} push failed:`, error instanceof Error ? error.message : String(error));
					}
				};

				const unsubscribe = subscribeRoom(roomId, () => {
					void push();
				});

				const tickTimer = setInterval(() => {
					void push();
				}, TICK_MS);

				const heartbeatTimer = setInterval(() => {
					send(`: ping\n\n`);
					void touchMemberActivity(roomId, user.id);
				}, HEARTBEAT_MS);

				const timeout = setTimeout(() => {
					settled = true;
					try {
						controller.close();
					} catch {
						// already closed
					}
				}, MAX_LIFETIME_MS);

				const cleanup = () => {
					if (settled) return;
					settled = true;
					clearInterval(tickTimer);
					clearInterval(heartbeatTimer);
					clearTimeout(timeout);
					unsubscribe();
					try {
						controller.close();
					} catch {
						// already closed
					}
				};

				request.signal.addEventListener('abort', cleanup);

				void push();
			}
		});

		return new Response(stream, {
			headers: {
				'content-type': 'text/event-stream',
				'cache-control': 'no-cache, no-transform',
				connection: 'keep-alive'
			}
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
