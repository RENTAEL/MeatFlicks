import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NotFoundError, errorHandler } from '$lib/server';
import { getRoomState, getRoomTick, touchMemberActivity } from '$lib/server/watch-party/service';
import { requireUser, roomIdFromParams } from '$lib/server/watch-party/handlers';
import { subscribeRoom } from '$lib/server/watch-party/events';

// The SSE event bus (subscribeRoom) still pushes instantly on real room
// events — this tick is only the cross-instance backup, so it can be lazy.
// (Tighter ticks burned Fluid CPU: each connection bills Active CPU for its
// full lifetime.)
const TICK_MS = 5000;
const HEARTBEAT_MS = 15000;
// Hobby + Fluid pins every instance at 2GB, so Provisioned Memory can only be
// cut by holding the instance for less time. A shorter lifetime means the
// client reconnects more often, which is the cheap side of this account's
// budget (invocations) traded against the expensive one (GB-Hrs).
// Must stay comfortably under maxDuration so we close cleanly instead of
// being killed mid-write.
const MAX_LIFETIME_MS = 20000;

export const config = {
	maxDuration: 25,
	memory: 256
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
		let pushInFlight = false;

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

				const versionOf = (
					tick: {
						seq: number;
						closedAt: number | null;
						lastMessageId: number;
						soundSeq: number;
					} | null
				) =>
					tick
						? `${tick.seq}:${tick.closedAt ?? ''}:${tick.lastMessageId}:${tick.soundSeq}`
						: 'gone';

				const push = async () => {
					if (settled || pushInFlight) return;
					pushInFlight = true;
					try {
						const tick = await getRoomTick(roomId);
						const version = versionOf(tick);
						if (version === lastVersion) return;
						lastVersion = version;
						const state = await getRoomState(roomId, user, { sinceMessageId: since });
						// The room changed while we were reading state; skip this
						// snapshot so a stale one never lands after a fresher one.
						if (versionOf(await getRoomTick(roomId)) !== version) return;
						since = state.lastMessageId;
						send(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
					} catch (error) {
						console.error(
							`[stream] ${roomId} push failed:`,
							error instanceof Error ? error.message : String(error)
						);
					} finally {
						pushInFlight = false;
					}
				};

				const unsubscribe = subscribeRoom(roomId, (payload) => {
					if (payload?.type === 'kick') {
						send(`event: kick\ndata: ${JSON.stringify(payload)}\n\n`);
					}
					void push();
				});

				const tickTimer = setInterval(() => {
					void push();
				}, TICK_MS);

				const heartbeatTimer = setInterval(() => {
					send(`: ping\n\n`);
					void touchMemberActivity(roomId, user.id);
				}, HEARTBEAT_MS);

				// The lifetime cap has to run the full cleanup, not just close the
				// controller. Closing alone left both intervals armed and the room
				// subscription registered, so the heartbeat kept writing
				// touchMemberActivity every 15s for a client that was already gone
				// — holding the 2GB Fluid instance alive doing nothing.
				const timeout = setTimeout(() => cleanup(), MAX_LIFETIME_MS);

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
