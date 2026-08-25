import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { adminKickUser } from '$lib/server/watch-party/service';
import { signalDisconnect } from '$lib/server/presence';
import { revokeUserSessions } from '$lib/server/session-revocation';
import { errorHandler } from '$lib/server';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		requireAdmin(locals);
		const body = (await request.json().catch(() => null)) as { userId?: string } | null;
		const userId = body?.userId?.trim() ?? '';
		if (!userId) {
			return json({ ok: false, error: 'userId is required' }, { status: 400 });
		}

		// Anonymous visitors have no watch-party membership and no server
		// session to revoke. Set the disconnect signal only — do NOT delete the
		// row here, or the (SSE-free) guest heartbeat would have nothing to
		// read. The heartbeat detects the signal and cleans up the row itself.
		if (userId.startsWith('guest:')) {
			await signalDisconnect(userId);
			return json({ ok: true, guest: true });
		}

		const roomResult = await adminKickUser(userId);
		await signalDisconnect(userId);
		await revokeUserSessions(userId);
		return json({ ok: true, ...roomResult });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
