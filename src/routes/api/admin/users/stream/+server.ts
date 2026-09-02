import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { errorHandler } from '$lib/server';

// SSE that mostly idle-waits. NOTE: `memory` is ignored on Hobby + Fluid —
// every instance is pinned at 2GB — so the only lever on Provisioned Memory
// is how long the instance is held. Admin-only, so volume is low, but a
// shorter lifetime still halves the GB-Hrs each open panel costs.
const MAX_LIFETIME_MS = 25_000;

export const config = { maxDuration: 30, memory: 256 };

export const GET: RequestHandler = async ({ locals, request }) => {
	try {
		requireAdmin(locals);

		const stream = new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();
				let closed = false;
				let lastSig = '';

				const send = (data: unknown) => {
					if (closed) return;
					try {
						controller.enqueue(encoder.encode(`event: users\ndata: ${JSON.stringify(data)}\n\n`));
					} catch {
						closed = true;
					}
				};

				const fetchAndSend = async () => {
					if (closed) return;
					try {
						const allUsers = await db
							.select({
								id: users.id,
								username: users.username,
								email: users.email,
								role: users.role,
								createdAt: users.createdAt
							})
							.from(users)
							.all();

						const sig = allUsers.map((u) => u.id).join(',');
						if (sig === lastSig) return;
						lastSig = sig;

						send({
							users: allUsers,
							count: allUsers.length,
							at: Date.now()
						});
					} catch (err) {
						console.error('[users/stream] fetch failed:', err);
						try {
							controller.enqueue(
								encoder.encode(
									`event: error\ndata: ${JSON.stringify({ error: 'Failed to fetch users' })}\n\n`
								)
							);
						} catch {
							closed = true;
						}
					}
				};

				await fetchAndSend();

				const interval = setInterval(fetchAndSend, 30_000);
				const heartbeat = setInterval(() => {
					if (!closed) {
						try {
							controller.enqueue(encoder.encode(`: heartbeat\n\n`));
						} catch {
							closed = true;
						}
					}
				}, 15_000);

				// Route the lifetime cap through cleanup so both intervals are
				// cleared. Closing the controller on its own left them armed,
				// which kept the Fluid instance alive after the stream ended.
				const timeout = setTimeout(() => cleanup(), MAX_LIFETIME_MS);

				const cleanup = () => {
					closed = true;
					clearInterval(interval);
					clearInterval(heartbeat);
					clearTimeout(timeout);
					try {
						controller.close();
					} catch {}
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

