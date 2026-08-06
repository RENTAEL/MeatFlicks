import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchMovieCategory, MOVIE_CATEGORIES } from '$lib/server/tmdb-movies';

export const GET: RequestHandler = async ({ setHeaders, params, url }) => {
	setHeaders({ 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300' });
	const category = MOVIE_CATEGORIES.includes(params.category as any)
		? (params.category as (typeof MOVIE_CATEGORIES)[number])
		: 'popular';
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);

	try {
		const data = await fetchMovieCategory(category, page);
		return json({ results: data.results, page: data.page, total_pages: data.total_pages });
	} catch (e: any) {
		return json({ results: [], error: e.message }, { status: 500 });
	}
};
