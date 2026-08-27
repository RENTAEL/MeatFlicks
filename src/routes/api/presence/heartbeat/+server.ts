import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { touchPresence, readDisconnectSignal, leavePresence } from '$lib/server/presence';
import { validateCsrfForApi } from '$lib/server/csrf';
import { errorHandler, UnauthorizedError } from '$lib/server';

const KICK_MESSAGES = [
	'You got yeeted by the dev. Reconnect when you’re ready.',
	'Oops — the dev disconnected you. No hard feelings. Try again?',
	'You’ve been disconnected. The dev kicked you. Try again, maybe.'
];

export const POST: RequestHandler = async (event) => {
	try {
		await validateCsrfForApi(event);
		const user = event.locals.user;
		if (!user) throw new UnauthorizedError('User must be authenticated');

		const body = (await event.request.json().catch(() => null)) as {
			path?: unknown;
			title?: unknown;
			playing?: unknown;
		} | null;

		const rawPath = typeof body?.path === 'string' ? body.path : null;
		const rawTitle = typeof body?.title === 'string' ? body.title : null;
		const rawPlaying = typeof body?.playing === 'boolean' ? body.playing : null;

		await touchPresence(user.id, user.username, {
			path: rawPath ? rawPath.slice(0, 160) : null,
			title: rawTitle ? rawTitle.slice(0, 120) : null,
			playing: rawPlaying
		});

		// Pull-based kick delivery: no SSE is held open, so an idle tab costs
		// nothing on Fluid. The client shows the ended screen on the next
		// heartbeat (<=45s).
		const signal = await readDisconnectSignal(user.id);
		if (signal) {
			await leavePresence(user.id).catch(() => {});
			return json({
				ok: true,
				ended: true,
				message: KICK_MESSAGES[Math.floor(signal / 1000) % KICK_MESSAGES.length]
			});
		}

		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
