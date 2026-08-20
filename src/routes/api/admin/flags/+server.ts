import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { getFeatureFlags, setFeatureFlag } from '$lib/server/admin/service';
import { errorHandler } from '$lib/server';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		requireAdmin(locals);
		return json({ flags: await getFeatureFlags() });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		requireAdmin(locals);
		const body = (await request.json().catch(() => null)) as {
			name?: string;
			enabled?: boolean;
		} | null;
		const name = body?.name?.trim() ?? '';
		if (!body || !name) {
			return json({ ok: false, error: 'Flag name is required' }, { status: 400 });
		}
		const enabled = body.enabled === true;
		await setFeatureFlag(name, enabled);
		return json({ ok: true, name, enabled, flags: await getFeatureFlags() });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
