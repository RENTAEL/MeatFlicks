import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { touchPresence, readDisconnectSignal, leavePresence } from '$lib/server/presence';

const GUEST_PREFIX = 'guest:';

/**
 * Anonymous presence heartbeat. The browser generates a random session id
 * (stored in sessionStorage) so admin can see — and end — guest sessions
 * alongside logged-in ones. Rows live in the same presence registry and are
 * pruned automatically after ~4 min of silence (240s), matching the 120s heartbeat × 2 missed-beat tolerance.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => null)) as {
			sessionId?: unknown;
			path?: unknown;
			title?: unknown;
			playing?: unknown;
		} | null;

		const rawSid = typeof body?.sessionId === 'string' ? body.sessionId : '';
		if (!/^[\w-]{8,64}$/.test(rawSid)) {
			return json({ ok: false, error: 'Valid sessionId is required' }, { status: 400 });
		}

		const rawPath = typeof body?.path === 'string' ? body.path : null;
		const rawTitle = typeof body?.title === 'string' ? body.title : null;
		const rawPlaying = typeof body?.playing === 'boolean' ? body.playing : null;

		const guestId = `${GUEST_PREFIX}${rawSid}`;
		await touchPresence(guestId, 'Guest', {
			path: rawPath ? rawPath.slice(0, 160) : null,
			title: rawTitle ? rawTitle.slice(0, 120) : null,
			playing: rawPlaying
		});

		// Pull-based admin-kick delivery: the admin sets a disconnect signal;
		// since guests no longer hold an SSE, the next heartbeat reports it.
		const signal = await readDisconnectSignal(guestId);
		if (signal) {
			await leavePresence(guestId).catch(() => {});
			return json({ ok: true, ended: true, message: 'Your session was ended by the admin.' });
		}

		return json({ ok: true });
	} catch {
		// Presence for guests is strictly best-effort — never surface errors.
		return json({ ok: true });
	}
};
