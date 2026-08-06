import { htmlCacheControl } from '$lib/server/caching';
import { AFRIKAANS_FILMS } from '$lib/curated/afrikaans-films';
import { env } from '$lib/config/env';
import {
	curatedRailItems,
	fetchAfrikaansBrowse,
	loadAfrikaansRails,
	parseAfrikaansBrowseParams,
	type AfrikaansBrowseParams,
	type AfrikaansBrowseResult,
	type AfrikaansRail
} from '$lib/server/afrikaans';

const TMDB_BASE = 'https://api.themoviedb.org/3';

const CURATED_CACHE_TTL = 30 * 60 * 1000;

type LandingPayload = {
	rails: AfrikaansRail[];
	browse: AfrikaansBrowseResult;
	browseParams: AfrikaansBrowseParams;
	source: string;
	error?: string;
};

let curatedCache: { data: LandingPayload; at: number } | null = null;

async function fetchMovie(id: number) {
	try {
		const res = await fetch(
			`${TMDB_BASE}/movie/${id}?api_key=${env.TMDB_API_KEY}&language=af`
		);
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

export async function load({ url, locals, setHeaders }) {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });
	const browseParams = parseAfrikaansBrowseParams(url.searchParams);
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const cacheKey = `${browseParams.type}|${browseParams.genre}|${browseParams.decade}|${browseParams.sort}|${page}`;

	try {
		if (page === 1) {
			if (curatedCache && Date.now() - curatedCache.at < CURATED_CACHE_TTL) {
				const cached = curatedCache.data;
				if (cacheKey === `${browseParams.type}|${browseParams.genre}|${browseParams.decade}|${browseParams.sort}|1`) {
					return cached;
				}
			}
		}

		const curatedIds = AFRIKAANS_FILMS.map((f) => f.tmdbId);

		const [tmdbResults, rails, browse] = await Promise.all([
			Promise.all(curatedIds.map(fetchMovie)),
			loadAfrikaansRails(),
			fetchAfrikaansBrowse({ ...browseParams, page })
		]);

		const featured: AfrikaansRail = {
			id: 'featured',
			title: 'Kurators se Keuses',
			items: curatedRailItems(tmdbResults, AFRIKAANS_FILMS)
		};

		const payload: LandingPayload = {
			rails: [featured, ...rails],
			browse,
			browseParams,
			source: 'curated'
		};

		if (page === 1) {
			curatedCache = { data: payload, at: Date.now() };
		}

		return payload;
	} catch (e) {
		return {
			rails: [],
			browse: { results: [], page: 1, total_pages: 0, hasMore: false },
			browseParams,
			error: 'Failed to load films',
			source: 'error'
		};
	}
}
