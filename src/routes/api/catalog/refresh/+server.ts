import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$lib/config/env';
import { logger } from '$lib/server/logger';
import { invalidateCachePrefix } from '$lib/server/cache';
import { updateLastRefreshTime } from '$lib/server/utils';
import { ensureHomeLibraryPrimed } from '$lib/server/services/home-library-optimizer';

export const config = {
	maxDuration: 300
};

export const GET: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('authorization');
	if (env.CRON_SECRET && auth !== `Bearer ${env.CRON_SECRET}`) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	const startedAt = Date.now();
	try {
		await ensureHomeLibraryPrimed({ force: true });
		const invalidated =
			(await invalidateCachePrefix('media:trending')) +
			(await invalidateCachePrefix('media:genre'));
		await updateLastRefreshTime();
		return json({ success: true, invalidated, durationMs: Date.now() - startedAt });
	} catch (error) {
		logger.error({ error }, '[catalog] Scheduled refresh failed');
		return json({ success: false, error: 'Refresh failed' }, { status: 500 });
	}
};
