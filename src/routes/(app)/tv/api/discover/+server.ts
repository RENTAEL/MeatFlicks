import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchTvBrowse, parseTvBrowseParams } from '$lib/server/tv';

export const GET: RequestHandler = async ({ url }) => {
	const browseParams = parseTvBrowseParams(url.searchParams);
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const result = await fetchTvBrowse({
		type: browseParams.type,
		page,
		genre: browseParams.genre,
		decade: browseParams.decade,
		sort: browseParams.sort
	});

	return json(result, {
		headers: {
			'Cache-Control': 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400'
		}
	});
};
