import { htmlCacheControl } from '$lib/server/caching';
import type { PageServerLoad } from './$types';
import {
	fetchMoviesBrowse,
	fetchMoviesHero,
	loadMoviesRails,
	parseMoviesBrowseParams
} from '$lib/server/movies';

export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });
	const browseParams = parseMoviesBrowseParams(url.searchParams);
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	try {
		const [rails, hero, browse] = await Promise.all([
			loadMoviesRails(),
			fetchMoviesHero(),
			fetchMoviesBrowse({
				category: browseParams.category,
				page,
				genre: browseParams.genre,
				decade: browseParams.decade,
				sort: browseParams.sort
			})
		]);
		return { section: 'movies', rails, hero, browse, browseParams, error: null };
	} catch {
		return {
			section: 'movies',
			rails: [],
			hero: [],
			browse: { results: [], page: 1, total_pages: 0, hasMore: false },
			browseParams,
			error: 'Failed to load movies'
		};
	}
};
