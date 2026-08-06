import { htmlCacheControl } from '$lib/server/caching';
import type { PageServerLoad } from './$types';
import { fetchTvBrowse, fetchTvHero, loadTvRails, parseTvBrowseParams } from '$lib/server/tv';

export const load: PageServerLoad = async ({ url, locals, setHeaders }) => {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });
	const browseParams = parseTvBrowseParams(url.searchParams);
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	try {
		const [rails, hero, browse] = await Promise.all([
			loadTvRails(),
			fetchTvHero(),
			fetchTvBrowse({
				type: browseParams.type,
				page,
				genre: browseParams.genre,
				decade: browseParams.decade,
				sort: browseParams.sort
			})
		]);
		return { section: 'tv', rails, hero, browse, browseParams, error: null };
	} catch {
		return {
			section: 'tv',
			rails: [],
			hero: [],
			browse: { results: [], page: 1, total_pages: 0, hasMore: false },
			browseParams,
			error: 'Failed to load TV series'
		};
	}
};
