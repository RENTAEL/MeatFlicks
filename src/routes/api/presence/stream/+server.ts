import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { touchPresence, readDisconnectSignal, leavePresence } from '$lib/server/presence';
import { errorHandler, UnauthorizedError } from '$lib/server';

const PING_MS = 30000;
const SIGNAL_POLL_MS = 30000;
const MAX_LIFETIME_MS = 30000;

export const config = { maxDuration: 60, memory: 256 };

const KICK_MESSAGES = [
	'You got yeeted by the dev. Reconnect when you’re ready.',
	'Oops — the dev disconnected you. No hard feelings. Try again?',
	'You’ve been disconnected. The dev kicked you. Try again, maybe.'
];

export const GET: RequestHandler = async ({ locals, request }) => {
	try {
		const user = locals.user;
		if (!user) throw new UnauthorizedError('User must be authenticated');

		await touchPresence(user.id, user.username, {});

		const encoder = new TextEncoder();
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

				const finish = () => {
					if (settled) return;
					settled = true;
					try {
						controller.close();
					} catch {
						// already closed
					}
				};

				// Keep the presence row fresh (live connection) and poll the
				// admin disconnect signal from the DB so it works across
				// serverless instances.
				const pollTimer = setInterval(async () => {
					if (settled) return;
					try {
						const signal = await readDisconnectSignal(user.id);
						if (signal) {
							const message = KICK_MESSAGES[Math.floor(signal / 1000) % KICK_MESSAGES.length];
							send(`event: disconnect\ndata: ${JSON.stringify({ message, at: signal })}\n\n`);
							await leavePresence(user.id).catch(() => {});
							finish();
							return;
						}
						await touchPresence(user.id, user.username, {});
					} catch {
						// keep the stream alive on transient errors
					}
				}, SIGNAL_POLL_MS);

				const heartbeatTimer = setInterval(() => send(': ping\n\n'), PING_MS);
				const timeout = setTimeout(finish, MAX_LIFETIME_MS);

				const cleanup = () => {
					clearInterval(pollTimer);
					clearInterval(heartbeatTimer);
					clearTimeout(timeout);
					finish();
				};

				request.signal.addEventListener('abort', cleanup);
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
