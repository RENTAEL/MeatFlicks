import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { touchPresence } from '$lib/server/presence';

const GUEST_PREFIX = 'guest:';

/**
 * Anonymous presence heartbeat. The browser generates a random session id
 * (stored in sessionStorage) so admin can see — and end — guest sessions
 * alongside logged-in ones. Rows live in the same presence registry and are
 * pruned automatically after 70s of silence.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => null)) as {
			sessionId?: unknown;
			path?: unknown;
			title?: unknown;
		} | null;

		const rawSid = typeof body?.sessionId === 'string' ? body.sessionId : '';
		if (!/^[\w-]{8,64}$/.test(rawSid)) {
			return json({ ok: false, error: 'Valid sessionId is required' }, { status: 400 });
		}

		const rawPath = typeof body?.path === 'string' ? body.path : null;
		const rawTitle = typeof body?.title === 'string' ? body.title : null;

		await touchPresence(`${GUEST_PREFIX}${rawSid}`, 'Guest', {
			path: rawPath ? rawPath.slice(0, 160) : null,
			title: rawTitle ? rawTitle.slice(0, 120) : null
		});

		return json({ ok: true });
	} catch {
		// Presence for guests is strictly best-effort — never surface errors.
		return json({ ok: true });
	}
};
