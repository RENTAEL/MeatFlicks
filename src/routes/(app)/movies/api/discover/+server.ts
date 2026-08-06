import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchMoviesBrowse, parseMoviesBrowseParams } from '$lib/server/movies';

export const GET: RequestHandler = async ({ url }) => {
	const browseParams = parseMoviesBrowseParams(url.searchParams);
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const result = await fetchMoviesBrowse({
		category: browseParams.category,
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
