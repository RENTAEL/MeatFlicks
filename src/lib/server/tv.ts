import { env } from '$lib/config/env';
import { formatMovie, toLibraryMovie } from '$lib/utils/tmdb';
import type { LibraryMedia } from '$lib/types/library';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const UA = { 'User-Agent': 'MeatFlicks/1.0' };

const RAIL_FRESH_MS = 60 * 60 * 1000;
const RAIL_STALE_MS = 24 * 60 * 60 * 1000;

export type TvRailId =
	| 'trending'
	| 'popular'
	| 'top'
	| 'airing'
	| 'onair'
	| 'drama'
	| 'komedie'
	| 'misdaad'
	| 'wetenskapfiksie'
	| 'animasie';

export type TvRail = {
	id: TvRailId;
	title: string;
	items: LibraryMedia[];
};

export type TvBrowseSort = 'newest' | 'rating' | 'year' | 'title' | 'popularity';
export type TvBrowseType = 'series' | 'miniseries' | 'all';

export type TvBrowseResult = {
	results: ReturnType<typeof formatMovie>[];
	page: number;
	total_pages: number;
	hasMore: boolean;
};

export type TvBrowseParams = {
	type: TvBrowseType;
	genre: number | null;
	decade: number | null;
	sort: TvBrowseSort | null;
};

export const TV_GENRES = [18, 35, 80, 10765, 16] as const;
export const TV_DECADES = [1980, 1990, 2000, 2010, 2020] as const;

export function parseTvBrowseParams(
	params: { get(name: string): string | null }
): TvBrowseParams {
	const rawType = params.get('type');
	const rawGenre = params.get('genre');
	const rawDecade = params.get('decade');
	const rawSort = params.get('sort');

	const type: TvBrowseType =
		rawType === 'miniseries' ? 'miniseries' : rawType === 'all' ? 'all' : 'series';
	const genre =
		rawGenre && TV_GENRES.some((g) => String(g) === rawGenre) ? Number(rawGenre) : null;
	const decade =
		rawDecade && TV_DECADES.some((d) => String(d) === rawDecade) ? Number(rawDecade) : null;
	const sort =
		rawSort && ['newest', 'rating', 'year', 'title', 'popularity'].includes(rawSort)
			? (rawSort as TvBrowseSort)
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

const dateField = (suffix: 'gte' | 'lte') => `first_air_date.${suffix}`;

type RailQuery = {
	id: TvRailId;
	title: string;
	endpoint: 'discover' | 'trending' | 'popular' | 'top_rated' | 'airing_today' | 'on_the_air';
	sortBy: string;
	voteGte: number;
	dateGte?: string;
	dateLte?: string;
	genre?: number;
};

function railQueries(): RailQuery[] {
	return [
		{
			id: 'trending',
			title: 'Trending',
			endpoint: 'trending',
			sortBy: 'popularity.desc',
			voteGte: 1
		},
		{
			id: 'popular',
			title: 'Popular',
			endpoint: 'popular',
			sortBy: 'popularity.desc',
			voteGte: 1
		},
		{
			id: 'top',
			title: 'Top Rated',
			endpoint: 'discover',
			sortBy: 'vote_average.desc',
			voteGte: 100
		},
		{
			id: 'airing',
			title: 'Airing Today',
			endpoint: 'airing_today',
			sortBy: 'popularity.desc',
			voteGte: 1
		},
		{
			id: 'onair',
			title: 'On The Air',
			endpoint: 'on_the_air',
			sortBy: 'popularity.desc',
			voteGte: 1
		},
		{
			id: 'drama',
			title: 'Drama',
			endpoint: 'discover',
			sortBy: 'popularity.desc',
			voteGte: 5,
			genre: 18
		},
		{
			id: 'komedie',
			title: 'Comedy',
			endpoint: 'discover',
			sortBy: 'popularity.desc',
			voteGte: 3,
			genre: 35
		},
		{
			id: 'misdaad',
			title: 'Crime',
			endpoint: 'discover',
			sortBy: 'popularity.desc',
			voteGte: 3,
			genre: 80
		},
		{
			id: 'wetenskapfiksie',
			title: 'Sci-Fi & Fantasy',
			endpoint: 'discover',
			sortBy: 'popularity.desc',
			voteGte: 3,
			genre: 10765
		},
		{
			id: 'animasie',
			title: 'Animation',
			endpoint: 'discover',
			sortBy: 'popularity.desc',
			voteGte: 3,
			genre: 16
		}
	];
}

async function tmdbFetch(
	path: string,
	params: URLSearchParams
): Promise<{ results: any[]; total_pages: number }> {
	const qp = new URLSearchParams(params);
	qp.set('api_key', env.TMDB_API_KEY);
	try {
		const res = await fetch(`${TMDB_BASE}${path}?${qp}`, {
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
}

function toRailItem(m: any): LibraryMedia | null {
	if (!m?.poster_path) return null;
	const item = toLibraryMovie({ ...m, mediaType: 'tv' });
	if (!item) return null;
	item.posterPath = `https://image.tmdb.org/t/p/w342${m.poster_path}`;
	item.backdropPath = m.backdrop_path
		? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}`
		: item.backdropPath;
	return item;
}

async function fetchRail(query: RailQuery): Promise<LibraryMedia[]> {
	let results: any[] = [];
	if (query.endpoint === 'trending') {
		({ results } = await tmdbFetch('/trending/tv/week', new URLSearchParams({ page: '1' })));
	} else if (query.endpoint === 'discover') {
		const qp = new URLSearchParams();
		qp.set('sort_by', query.sortBy);
		qp.set('vote_count.gte', String(query.voteGte));
		if (query.dateGte) qp.set(dateField('gte'), query.dateGte);
		if (query.dateLte) qp.set(dateField('lte'), query.dateLte);
		if (query.genre) qp.set('with_genres', String(query.genre));
		qp.set('page', '1');
		({ results } = await tmdbFetch('/discover/tv', qp));
	} else {
		({ results } = await tmdbFetch(`/tv/${query.endpoint}`, new URLSearchParams({ page: '1' })));
	}

	const filtered = results.filter((m: any) => (m.vote_count ?? 0) >= query.voteGte);

	return filtered
		.map(toRailItem)
		.filter((m): m is LibraryMedia => m !== null)
		.slice(0, 20);
}

const railCache = new Map<string, { data: TvRail[]; at: number }>();
const heroCache = new Map<string, { data: LibraryMedia[]; at: number }>();

function readCache<T>(cache: Map<string, { data: T; at: number }>, key: string): T | null {
	const hit = cache.get(key);
	if (!hit) return null;
	if (Date.now() - hit.at < RAIL_STALE_MS) return hit.data;
	return null;
}

function writeCache<T>(cache: Map<string, { data: T; at: number }>, key: string, data: T) {
	cache.set(key, { data, at: Date.now() });
}

export async function loadTvRails(): Promise<TvRail[]> {
	const cached = readCache(railCache, 'tv');
	if (cached) return cached;

	const settled = await Promise.allSettled(
		railQueries().map(async (query) => ({
			id: query.id,
			title: query.title,
			items: await fetchRail(query)
		}))
	);
	const rails = settled
		.filter((r): r is PromiseFulfilledResult<TvRail> => r.status === 'fulfilled')
		.map((r) => r.value)
		.filter((r) => r.items.length >= 4);

	writeCache(railCache, 'tv', rails);
	return rails;
}

function pickTrailer(videos: any[]): string | null {
	const v = Array.isArray(videos) ? videos : [];
	const youtube = v.find(
		(video: any) => video.site === 'YouTube' && video.type === 'Trailer'
	) ?? v.find((video: any) => video.site === 'YouTube' && video.type === 'Teaser');
	return youtube?.key ? `https://www.youtube.com/watch?v=${youtube.key}` : null;
}

export async function fetchTvHero(): Promise<LibraryMedia[]> {
	const cached = readCache(heroCache, 'tv');
	if (cached) return cached;

	const { results } = await tmdbFetch('/trending/tv/week', new URLSearchParams({ page: '1' }));
	const top = results.slice(0, 5);

	const items = await Promise.all(
		top.map(async (m: any) => {
			const item = toRailItem(m);
			if (!item) return null;
			const { results: videos } = await tmdbFetch(`/tv/${m.id}/videos`, new URLSearchParams());
			item.trailerUrl = pickTrailer(videos);
			return item;
		})
	);

	const hero = items.filter((m): m is LibraryMedia => m !== null);
	writeCache(heroCache, 'tv', hero);
	return hero;
}

export async function fetchTvRail(id: TvRailId): Promise<LibraryMedia[]> {
	const query = railQueries().find((q) => q.id === id);
	return query ? fetchRail(query) : [];
}

const SORTS: Record<TvBrowseSort, string> = {
	newest: 'first_air_date.desc',
	year: 'first_air_date.desc',
	rating: 'vote_average.desc',
	title: 'original_name.asc',
	popularity: 'popularity.desc'
};

export async function fetchTvBrowse(opts: {
	type?: TvBrowseType;
	page: number;
	genre?: number | null;
	decade?: number | null;
	sort?: TvBrowseSort | null;
}): Promise<TvBrowseResult> {
	const type = opts.type ?? 'series';
	const sort = opts.sort ?? 'newest';
	const qp = new URLSearchParams();
	qp.set('sort_by', SORTS[sort]);
	qp.set('vote_count.gte', '1');
	qp.set(dateField('lte'), todayParam());
	if (type === 'series') qp.set('with_type', '4');
	if (type === 'miniseries') qp.set('with_type', '2');
	if (opts.genre) qp.set('with_genres', String(opts.genre));
	if (opts.decade) {
		qp.set(dateField('gte'), `${opts.decade}-01-01`);
		qp.set(dateField('lte'), `${opts.decade + 9}-12-31`);
	}
	qp.set('page', String(opts.page));

	const { results, total_pages } = await tmdbFetch('/discover/tv', qp);
	const eligible = results
		.filter((m: any) => m.poster_path)
		.map((m: any) => formatMovie({ ...m, media_type: 'tv' }));

	return {
		results: eligible,
		page: opts.page,
		total_pages,
		hasMore: eligible.length > 0 && opts.page < total_pages
	};
}
