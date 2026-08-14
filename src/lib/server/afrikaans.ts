import { env } from '$lib/config/env';
import { AFRIKAANS_FILMS } from '$lib/curated/afrikaans-films';
import { formatMovie, toLibraryMovie } from '$lib/utils/tmdb';
import type { LibraryMedia } from '$lib/types/library';
import { withCache, buildCacheKey, CACHE_TTL_MEDIUM_SECONDS } from '$lib/server/cache';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const UA = { 'User-Agent': 'MeatFlicks/1.0' };

const MONTHS_RECENT = 24;

export type AfrikaansRailId =
	| 'featured'
	| 'nuut'
	| 'gewild'
	| 'klassiek'
	| 'top'
	| 'reekse'
	| 'drama'
	| 'komedie'
	| 'dokumenter';

export type AfrikaansRail = {
	id: AfrikaansRailId;
	title: string;
	items: LibraryMedia[];
};

type RailQuery = {
	id: AfrikaansRailId;
	title: string;
	mediaType: 'movie' | 'tv';
	sortBy: string;
	voteGte: number;
	dateGte?: string;
	dateLte?: string;
	genre?: number;
};

export type AfrikaansBrowseSort = 'newest' | 'rating' | 'year' | 'title' | 'popularity';

export type AfrikaansBrowseType = 'movie' | 'tv' | 'alles';

export type AfrikaansBrowseResult = {
	results: ReturnType<typeof formatMovie>[];
	page: number;
	total_pages: number;
	hasMore: boolean;
};

export const AFRIKAANS_GENRES = [18, 35, 99] as const;
export const AFRIKAANS_DECADES = [1980, 1990, 2000, 2010, 2020] as const;

export type AfrikaansBrowseParams = {
	type: AfrikaansBrowseType;
	genre: number | null;
	decade: number | null;
	sort: AfrikaansBrowseSort | null;
};

export function parseAfrikaansBrowseParams(params: {
	get(name: string): string | null;
}): AfrikaansBrowseParams {
	const rawType = params.get('type');
	const rawGenre = params.get('genre');
	const rawDecade = params.get('decade');
	const rawSort = params.get('sort');

	const type: AfrikaansBrowseType =
		rawType === 'reekse' ? 'tv' : rawType === 'alles' ? 'alles' : 'movie';
	const genre =
		rawGenre && AFRIKAANS_GENRES.some((g) => String(g) === rawGenre) ? Number(rawGenre) : null;
	const decade =
		rawDecade && AFRIKAANS_DECADES.some((d) => String(d) === rawDecade) ? Number(rawDecade) : null;
	const sort =
		rawSort && ['newest', 'rating', 'year', 'title', 'popularity'].includes(rawSort)
			? (rawSort as AfrikaansBrowseSort)
			: null;

	return { type, genre, decade, sort };
}

function dateGte(months: number): string {
	const d = new Date();
	d.setUTCMonth(d.getUTCMonth() - months);
	return d.toISOString().slice(0, 10);
}

function todayParam(): string {
	return new Date().toISOString().slice(0, 10);
}

const dateField = (mediaType: 'movie' | 'tv', suffix: 'gte' | 'lte') =>
	`${mediaType === 'movie' ? 'primary_release_date' : 'first_air_date'}.${suffix}`;

function railQueries(): RailQuery[] {
	return [
		{
			id: 'nuut',
			title: 'Nuut',
			mediaType: 'movie',
			sortBy: 'primary_release_date.desc',
			voteGte: 1,
			dateGte: dateGte(MONTHS_RECENT),
			dateLte: todayParam()
		},
		{
			id: 'gewild',
			title: 'Gewild',
			mediaType: 'movie',
			sortBy: 'popularity.desc',
			voteGte: 5
		},
		{
			id: 'klassiek',
			title: 'Klassieke',
			mediaType: 'movie',
			sortBy: 'popularity.desc',
			voteGte: 2,
			dateLte: '2004-12-31'
		},
		{
			id: 'top',
			title: 'Topgewaardeer',
			mediaType: 'movie',
			sortBy: 'vote_average.desc',
			voteGte: 20
		},
		{
			id: 'reekse',
			title: 'Reekse',
			mediaType: 'tv',
			sortBy: 'popularity.desc',
			voteGte: 2
		},
		{
			id: 'drama',
			title: 'Drama',
			mediaType: 'movie',
			sortBy: 'popularity.desc',
			voteGte: 5,
			genre: 18
		},
		{
			id: 'komedie',
			title: 'Komedie',
			mediaType: 'movie',
			sortBy: 'popularity.desc',
			voteGte: 5,
			genre: 35
		},
		{
			id: 'dokumenter',
			title: 'Dokumentêre',
			mediaType: 'movie',
			sortBy: 'popularity.desc',
			voteGte: 1,
			genre: 99
		}
	];
}

async function tmdbDiscover(
	mediaType: 'movie' | 'tv',
	params: URLSearchParams
): Promise<{ results: any[]; total_pages: number }> {
	const qp = new URLSearchParams(params);
	const cacheKey = buildCacheKey('afrikaans-discover', mediaType, qp.toString());
	qp.set('api_key', env.TMDB_API_KEY);
	qp.set('language', 'af');
	qp.set('with_original_language', 'af');
	qp.set('include_adult', 'false');
	qp.set('include_video', 'false');
	return withCache(
		cacheKey,
		CACHE_TTL_MEDIUM_SECONDS,
		async () => {
			try {
				const res = await fetch(`${TMDB_BASE}/discover/${mediaType}?${qp}`, {
					headers: UA,
					signal: AbortSignal.timeout(8000)
				});
				if (!res.ok) return { results: [], total_pages: 0 };
				const data = await res.json();
				return {
					results: Array.isArray(data.results) ? data.results : [],
					total_pages: Number(data.total_pages) || 0
				};
			} catch {
				return { results: [], total_pages: 0 };
			}
		},
		{ swrSeconds: Math.floor(CACHE_TTL_MEDIUM_SECONDS / 2) }
	);
}

function toRailItem(m: any, mediaType: 'movie' | 'tv'): LibraryMedia | null {
	if (!m?.poster_path) return null;
	const item = toLibraryMovie({ ...m, mediaType });
	if (!item) return null;
	item.posterPath = `https://image.tmdb.org/t/p/w342${m.poster_path}`;
	item.backdropPath = m.backdrop_path
		? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}`
		: item.backdropPath;
	return item;
}

async function fetchRail(query: RailQuery): Promise<LibraryMedia[]> {
	const qp = new URLSearchParams();
	qp.set('sort_by', query.sortBy);
	qp.set('vote_count.gte', String(query.voteGte));
	if (query.dateGte) qp.set(dateField(query.mediaType, 'gte'), query.dateGte);
	if (query.dateLte) qp.set(dateField(query.mediaType, 'lte'), query.dateLte);
	if (query.genre) qp.set('with_genres', String(query.genre));
	qp.set('page', '1');
	const { results } = await tmdbDiscover(query.mediaType, qp);
	return (results as any[])
		.map((m: any) => toRailItem(m, query.mediaType))
		.filter((m): m is LibraryMedia => m !== null)
		.slice(0, 20);
}

export function curatedRailItems(
	tmdbResults: (any | null)[],
	fallback: { tmdbId: number; title: string; titleEn?: string | null; year: number }[]
): LibraryMedia[] {
	const items: LibraryMedia[] = [];
	fallback.forEach((film, i) => {
		const tmdb = tmdbResults[i];
		if (!tmdb) return;
		const item = toRailItem(tmdb, 'movie');
		if (!item) return;
		item.id = String(film.tmdbId);
		item.tmdbId = film.tmdbId;
		item.title = tmdb.title || film.title;
		item.releaseDate = tmdb.release_date || `${film.year}-01-01`;
		items.push(item);
	});
	return items;
}

export async function loadAfrikaansRails(): Promise<AfrikaansRail[]> {
	const settled = await Promise.allSettled(
		railQueries().map(async (query) => ({
			id: query.id,
			title: query.title,
			items: await fetchRail(query)
		}))
	);
	return settled
		.filter((r): r is PromiseFulfilledResult<AfrikaansRail> => r.status === 'fulfilled')
		.map((r) => r.value);
}

export async function fetchAfrikaansRail(id: AfrikaansRailId): Promise<LibraryMedia[]> {
	const query = railQueries().find((r) => r.id === id);
	return query ? fetchRail(query) : [];
}

const SORTS: Record<AfrikaansBrowseSort, { movie: string; tv: string }> = {
	newest: { movie: 'primary_release_date.desc', tv: 'first_air_date.desc' },
	year: { movie: 'primary_release_date.desc', tv: 'first_air_date.desc' },
	rating: { movie: 'vote_average.desc', tv: 'vote_average.desc' },
	title: { movie: 'original_title.asc', tv: 'original_name.asc' },
	popularity: { movie: 'popularity.desc', tv: 'popularity.desc' }
};

type TaggedResult = { _tag: 'movie' | 'tv' } & any;

async function discoverTagged(
	type: 'movie' | 'tv',
	opts: { sort: AfrikaansBrowseSort; genre?: number | null; decade?: number | null; page: number }
): Promise<{ results: TaggedResult[]; total_pages: number }> {
	const qp = new URLSearchParams();
	qp.set('sort_by', SORTS[opts.sort][type]);
	qp.set('vote_count.gte', '1');
	qp.set(dateField(type, 'lte'), todayParam());
	if (opts.genre) qp.set('with_genres', String(opts.genre));
	if (opts.decade) {
		qp.set(dateField(type, 'gte'), `${opts.decade}-01-01`);
		qp.set(dateField(type, 'lte'), `${opts.decade + 9}-12-31`);
	}
	qp.set('page', String(opts.page));

	const { results, total_pages } = await tmdbDiscover(type, qp);
	return {
		results: results.map((m) => ({ ...m, _tag: type })),
		total_pages
	};
}

export async function fetchAfrikaansBrowse(opts: {
	type: AfrikaansBrowseType;
	page: number;
	genre?: number | null;
	decade?: number | null;
	sort?: AfrikaansBrowseSort | null;
}): Promise<AfrikaansBrowseResult> {
	const sort = opts.sort ?? 'newest';

	let raw: TaggedResult[];
	let totalPages = 0;
	if (opts.type === 'alles') {
		const [movies, series] = await Promise.all([
			discoverTagged('movie', { sort, genre: opts.genre, decade: opts.decade, page: opts.page }),
			discoverTagged('tv', { sort, genre: opts.genre, decade: opts.decade, page: opts.page })
		]);
		raw = [...movies.results, ...series.results];
		totalPages = Math.max(movies.total_pages, series.total_pages);
	} else {
		const single = await discoverTagged(opts.type, {
			sort,
			genre: opts.genre,
			decade: opts.decade,
			page: opts.page
		});
		raw = single.results;
		totalPages = single.total_pages;
	}

	const curatedIds = new Set(AFRIKAANS_FILMS.map((f) => f.tmdbId));
	const eligible = raw
		.filter((m) => m.poster_path && !curatedIds.has(m.id))
		.map((m) => formatMovie({ ...m, media_type: m._tag }));

	return {
		results: eligible,
		page: opts.page,
		total_pages: totalPages,
		hasMore: eligible.length > 0 && opts.page < totalPages
	};
}
