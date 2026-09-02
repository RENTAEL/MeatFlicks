import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { getLiveSnapshot, registerLiveConnection } from '$lib/server/usage';
import { errorHandler } from '$lib/server';

const PUSH_MS = 20_000;
// This was 5 minutes against a 60s maxDuration, so the timeout could never
// fire: every connection ran the platform limit and was killed mid-write,
// which meant finish() never ran and release() never decremented the live
// connection count. Keep the lifetime under maxDuration so the stream always
// closes itself cleanly and the admin EventSource reconnects.
const MAX_LIFETIME_MS = 25_000;

export const config = { maxDuration: 30, memory: 256 };

export const GET: RequestHandler = async ({ locals, request }) => {
	try {
		requireAdmin(locals);

		const encoder = new TextEncoder();
		let settled = false;
		const release = registerLiveConnection();

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

				const push = () => {
					const snap = getLiveSnapshot();
					send(`event: metrics\ndata: ${JSON.stringify(snap)}\n\n`);
				};

				push();
				const timer = setInterval(push, PUSH_MS);
				const heartbeat = setInterval(() => send(': ping\n\n'), PUSH_MS);
				const timeout = setTimeout(finish, MAX_LIFETIME_MS);

				function finish() {
					if (settled) return;
					settled = true;
					clearInterval(timer);
					clearInterval(heartbeat);
					clearTimeout(timeout);
					release();
					try {
						controller.close();
					} catch {
						// already closed
					}
				}

				request.signal.addEventListener('abort', finish);
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
