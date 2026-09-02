import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { listActiveSessions, type ActiveSession } from '$lib/server/watch-party/service';
import { subscribeAllRooms } from '$lib/server/watch-party/events';
import { errorHandler } from '$lib/server';

const REFRESH_MS = 30000;
const HEARTBEAT_MS = 15000;
// Admin-only stream, so volume is low, but each open connection still holds a
// 2GB Fluid instance for its whole lifetime. Half the hold, half the GB-Hrs.
const MAX_LIFETIME_MS = 25000;

export const config = { maxDuration: 30, memory: 256 };

const signatureOf = (sessions: ActiveSession[]) =>
	sessions
		.map((s) => `${s.roomId}:${s.seq}:${s.playing}:${s.position}:${s.lastActivityAt}:${s.members}`)
		.join(',');
const versionOf = (sessions: ActiveSession[]) => `${sessions.length}|${signatureOf(sessions)}`;

export const GET: RequestHandler = async ({ locals, request }) => {
	try {
		requireAdmin(locals);

		const encoder = new TextEncoder();
		let lastVersion = '';
		let pushInFlight = false;
		let settled = false;

		const stream = new ReadableStream({
			start(controller) {
				const send = (data: string) => {
					if (settled) return;
					try {
						controller.enqueue(encoder.encode(data));
					} catch {
						// stream closed
					}
				};

				const push = async () => {
					if (settled || pushInFlight) return;
					pushInFlight = true;
					try {
						const sessions = await listActiveSessions();
						const version = versionOf(sessions);
						if (version === lastVersion) return;
						lastVersion = version;
						send(`event: sessions\ndata: ${JSON.stringify({ sessions, at: Date.now() })}\n\n`);
					} catch {
						// keep the stream alive on transient errors
					} finally {
						pushInFlight = false;
					}
				};

				const unsubscribe = subscribeAllRooms(() => void push());

				// Catch changes that don't publish (member heartbeats/timeouts,
				// position drift, cleanup sweeps).
				const refreshTimer = setInterval(() => void push(), REFRESH_MS);
				const heartbeatTimer = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
				// Route the lifetime cap through cleanup so the intervals are
				// cleared and the room subscription is released. Closing the
				// controller on its own left both timers armed and the global
				// listener registered, keeping the instance alive after the
				// stream had already ended.
				const timeout = setTimeout(() => cleanup(), MAX_LIFETIME_MS);

				const cleanup = () => {
					clearInterval(refreshTimer);
					clearInterval(heartbeatTimer);
					clearTimeout(timeout);
					unsubscribe();
					if (!settled) {
						settled = true;
						try {
							controller.close();
						} catch {
							// already closed
						}
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

