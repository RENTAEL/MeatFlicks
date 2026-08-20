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
		const roomResult = await adminKickUser(userId);
		await signalDisconnect(userId);
		await revokeUserSessions(userId);
		return json({ ok: true, ...roomResult });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
