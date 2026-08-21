import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET = async () => {
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();
			let closed = false;

			const send = (data: unknown) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(`event: users\ndata: ${JSON.stringify(data)}\n\n`));
				} catch {
					closed = true;
				}
			};

			const sendError = (error: string) => {
				if (closed) return;
				try {
					controller.enqueue(
						encoder.encode(`event: error\ndata: ${JSON.stringify({ error })}\n\n`)
					);
				} catch {
					closed = true;
				}
			};

			let isFirst = true;

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

					send({
						users: allUsers,
						count: allUsers.length,
						at: Date.now()
					});
				} catch (err) {
					console.error('[users/stream] fetch failed:', err);
					sendError('Failed to fetch users');
				}
			};

			// Initial fetch
			await fetchAndSend();

			// Poll for updates every 10 seconds
			const interval = setInterval(fetchAndSend, 10_000);

			// Heartbeat to keep connection alive
			const heartbeat = setInterval(() => {
				if (!closed) {
					try {
						controller.enqueue(encoder.encode(`: heartbeat\n\n`));
					} catch {
						closed = true;
					}
				}
			}, 25_000);

			return () => {
				closed = true;
				clearInterval(interval);
				clearInterval(heartbeat);
			};
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
