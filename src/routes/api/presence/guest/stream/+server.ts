import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readDisconnectSignal, leavePresence } from '$lib/server/presence';

const PING_MS = 15000;
const SIGNAL_POLL_MS = 5000;
const MAX_LIFETIME_MS = 50000;

export const config = { maxDuration: 60, memory: 256 };

/**
 * Guest variant of the presence stream: polls the same admin disconnect
 * signal in the DB, keyed by the anonymous session id, so "End session"
 * works on anonymous visitors too.
 */
export const GET: RequestHandler = async ({ url, request }) => {
	try {
		const sid = url.searchParams.get('sid') ?? '';
		if (!/^[\w-]{8,64}$/.test(sid)) {
			return json({ ok: false, error: 'Valid sid is required' }, { status: 400 });
		}
		const guestId = `guest:${sid}`;

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

				const pollTimer = setInterval(async () => {
					if (settled) return;
					try {
						const signal = await readDisconnectSignal(guestId);
						if (signal) {
							send(
								`event: disconnect\ndata: ${JSON.stringify({
									message: 'Your session was ended by the admin.',
									at: signal
								})}\n\n`
							);
							await leavePresence(guestId).catch(() => {});
							finish();
							return;
						}
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
		return json({ ok: false }, { status: 400 });
	}
};
