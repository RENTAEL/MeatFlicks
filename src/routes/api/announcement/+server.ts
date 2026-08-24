import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAnnouncement } from '$lib/server/admin/service';
import { errorHandler } from '$lib/server';
import { memCached } from '$lib/server/memCache';

export const GET: RequestHandler = async () => {
	try {
		const announcement = await memCached('api:announcement', 60_000, () => getAnnouncement());
		return json(
			{ announcement },
			{
				headers: {
					'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120'
				}
			}
		);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
