import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFeatureFlags } from '$lib/server/admin/service';
import { errorHandler } from '$lib/server';
import { memCached } from '$lib/server/memCache';

export const GET: RequestHandler = async () => {
	try {
		const flags = await memCached('api:feature-flags', 3600_000, () => getFeatureFlags());
		return json(
			{ flags },
			{
				headers: {
					'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
				}
			}
		);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
