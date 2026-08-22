import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { getAnnouncement, setAnnouncement, clearAnnouncement } from '$lib/server/admin/service';
import { errorHandler } from '$lib/server';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		requireAdmin(locals);
		return json({ announcement: await getAnnouncement() });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const admin = requireAdmin(locals);
		const body = (await request.json().catch(() => null)) as {
			text?: string;
			target?: string;
		} | null;
		const text = body?.text?.trim() ?? '';
		if (!text) {
			return json({ ok: false, error: 'Announcement text is required' }, { status: 400 });
		}
		const announcement = await setAnnouncement(text, admin.username, body?.target ?? 'all');
		return json({ ok: true, announcement });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const DELETE: RequestHandler = async ({ locals }) => {
	try {
		requireAdmin(locals);
		await clearAnnouncement();
		return json({ ok: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
