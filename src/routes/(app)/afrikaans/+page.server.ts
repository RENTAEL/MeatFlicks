import { htmlCacheControl } from '$lib/server/caching';
import { AFRIKAANS_FILMS } from '$lib/curated/afrikaans-films';
import { env } from '$lib/config/env';
import { formatMovie } from '$lib/utils/tmdb';
import { isEligibleMedia } from '$lib/utils/mediaFilter';
import {
	curatedRailItems,
	fetchAfrikaansBrowse,
	loadAfrikaansRails,
	type AfrikaansRail
} from '$lib/server/afrikaans';

const TMDB_BASE = 'https://api.themoviedb.org/3';

const CURATED_CACHE_TTL = 30 * 60 * 1000;

type LandingPayload = {
	movies: any[];
	recentAfrikaans: any[];
	recentSA: any[];
	rails: AfrikaansRail[];
	page: number;
	hasMore: boolean;
	source: string;
};

let curatedCache: { data: LandingPayload; at: number } | null = null;

function sinceDate(months: number): string {
	const d = new Date();
	d.setUTCMonth(d.getUTCMonth() - months);
	return d.toISOString().slice(0, 10);
}

function todayParam(): string {
	return new Date().toISOString().slice(0, 10);
}

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

async function fetchDiscover(params: string) {
	try {
		const res = await fetch(`${TMDB_BASE}/discover/movie?api_key=${env.TMDB_API_KEY}&${params}`);
		if (!res.ok) return { results: [] };
		return await res.json();
	} catch {
		return { results: [] };
	}
}

function eligible(results: any[], excluded: Set<number>): any[] {
	const seen = new Set<number>();
	const out: any[] = [];
	for (const m of results || []) {
		if (excluded.has(m.id) || seen.has(m.id)) continue;
		if (!isEligibleMedia(m, 0) || !m.poster_path) continue;
		seen.add(m.id);
		out.push(formatMovie(m));
	}
	return out;
}

export async function load({ url, locals, setHeaders }) {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });
	const page = Number(url.searchParams.get('page')) || 1;

	try {
		if (page === 1) {

			if (curatedCache && Date.now() - curatedCache.at < CURATED_CACHE_TTL) {
				return curatedCache.data;
			}

			const curatedIds = AFRIKAANS_FILMS.map((f) => f.tmdbId);
			const since = sinceDate(24);

			const [tmdbResults, recentAfrikaansData, recentSAData, rails] = await Promise.all([
				Promise.all(curatedIds.map(fetchMovie)),
				fetchDiscover(
					`language=af&with_original_language=af&sort_by=primary_release_date.desc` +
					`&primary_release_date.gte=${since}&primary_release_date.lte=${todayParam()}&page=1`
				),
				fetchDiscover(
					`language=en-US&with_origin_country=ZA&with_original_language=af|en` +
					`&sort_by=primary_release_date.desc` +
					`&primary_release_date.gte=${since}&primary_release_date.lte=${todayParam()}&page=1`
				),
				loadAfrikaansRails()
			]);

			const movies = AFRIKAANS_FILMS.map((film, i) => {
				const tmdb = tmdbResults[i];
				if (!tmdb) {
					console.warn(`[afrikaans] TMDB fetch returned null for ${film.title} (ID ${film.tmdbId})`);
				}
				return {
					...formatMovie(tmdb || {}),
					id: film.tmdbId,
					title: tmdb?.title || film.title,
					poster: tmdb?.poster_path
						? `https://image.tmdb.org/t/p/w342${tmdb.poster_path}`
						: null,
					year: String(film.year),
					titleEn: film.titleEn || null,
					director: film.director || null,
				};
			}).filter(Boolean).filter((m: any) => m.poster);

			const excluded = new Set(curatedIds);
			const recentAfrikaans = eligible(recentAfrikaansData.results, excluded);
			const recentSA = eligible(recentSAData.results, excluded);

			const featured: AfrikaansRail = {
				id: 'featured',
				title: 'Kurators se Keuses',
				items: curatedRailItems(tmdbResults, AFRIKAANS_FILMS)
			};

			const payload: LandingPayload = {
				movies,
				recentAfrikaans,
				recentSA,
				rails: [featured, ...rails],
				page: 1,
				hasMore: movies.length >= 20,
				source: 'curated',
			};
			curatedCache = { data: payload, at: Date.now() };
			return payload;
		}

		const browse = await fetchAfrikaansBrowse({ type: 'movie', page });
		return {
			movies: browse.results,
			recentAfrikaans: [],
			recentSA: [],
			rails: [],
			page,
			hasMore: browse.hasMore,
			source: 'discover',
		};
	} catch (e) {
		return {
			movies: [],
			recentAfrikaans: [],
			recentSA: [],
			rails: [],
			error: 'Failed to load films',
			page: 1,
			hasMore: false,
			source: 'error',
		};
	}
}
