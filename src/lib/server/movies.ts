import { env } from '$lib/config/env';
import { formatMovie, toLibraryMovie } from '$lib/utils/tmdb';
import type { LibraryMedia } from '$lib/types/library';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const UA = { 'User-Agent': 'MeatFlicks/1.0' };

const RAIL_FRESH_MS = 60 * 60 * 1000;
const RAIL_STALE_MS = 24 * 60 * 60 * 1000;

export type MoviesRailId =
	| 'trending'
	| 'popular'
	| 'top'
	| 'upcoming'
	| 'now'
	| 'aksie'
	| 'komedie'
	| 'drama'
	| 'gruwel'
	| 'wetenskapfiksie'
	| 'dokumenter';

export type MoviesRail = {
	id: MoviesRailId;
	titleAf: string;
	titleEn: string;
	items: LibraryMedia[];
};

export type MoviesBrowseSort = 'newest' | 'rating' | 'year' | 'title' | 'popularity';
export type MoviesCategory = 'all' | 'trending' | 'popular' | 'top_rated' | 'upcoming';

export type MoviesBrowseResult = {
	results: ReturnType<typeof formatMovie>[];
	page: number;
	total_pages: number;
	hasMore: boolean;
};

export type MoviesBrowseParams = {
	category: MoviesCategory;
	genre: number | null;
	decade: number | null;
	sort: MoviesBrowseSort | null;
};

export const MOVIES_GENRES = [28, 35, 18, 27, 878, 99] as const;
export const MOVIES_DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020] as const;
export const MOVIES_CATEGORIES: MoviesCategory[] = ['all', 'trending', 'popular', 'top_rated', 'upcoming'];

export function parseMoviesBrowseParams(
	params: { get(name: string): string | null }
): MoviesBrowseParams {
	const rawCategory = params.get('category');
	const rawGenre = params.get('genre');
	const rawDecade = params.get('decade');
	const rawSort = params.get('sort');

	const category: MoviesCategory =
		rawCategory && (MOVIES_CATEGORIES as string[]).includes(rawCategory)
			? (rawCategory as MoviesCategory)
			: 'all';
	const genre =
		rawGenre && MOVIES_GENRES.some((g) => String(g) === rawGenre) ? Number(rawGenre) : null;
	const decade =
		rawDecade && MOVIES_DECADES.some((d) => String(d) === rawDecade)
			? Number(rawDecade)
			: null;
	const sort =
		rawSort && ['newest', 'rating', 'year', 'title', 'popularity'].includes(rawSort)
			? (rawSort as MoviesBrowseSort)
			: null;

	return { category, genre, decade, sort };
}

function dateGte(months: number): string {
	const d = new Date();
	d.setUTCMonth(d.getUTCMonth() - months);
	return d.toISOString().slice(0, 10);
}

function todayParam(): string {
	return new Date().toISOString().slice(0, 10);
}

const dateField = (suffix: 'gte' | 'lte') => `primary_release_date.${suffix}`;

type RailQuery = {
	id: MoviesRailId;
	titleAf: string;
	titleEn: string;
	endpoint: 'discover' | 'trending' | 'popular' | 'top_rated' | 'upcoming' | 'now_playing';
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
			titleAf: 'Neig',
			titleEn: 'Trending',
			endpoint: 'trending',
			sortBy: 'popularity.desc',
			voteGte: 1
		},
		{
			id: 'popular',
			titleAf: 'Gewild',
			titleEn: 'Popular',
			endpoint: 'popular',
			sortBy: 'popularity.desc',
			voteGte: 1
		},
		{
			id: 'top',
			titleAf: 'Topgewaardeer',
			titleEn: 'Top Rated',
			endpoint: 'discover',
			sortBy: 'vote_average.desc',
			voteGte: 100
		},
		{
			id: 'upcoming',
			titleAf: 'Binnekort',
			titleEn: 'Upcoming',
			endpoint: 'upcoming',
			sortBy: 'primary_release_date.asc',
			voteGte: 0,
			dateGte: todayParam()
		},
		{
			id: 'now',
			titleAf: 'In Teaters',
			titleEn: 'Now Playing',
			endpoint: 'now_playing',
			sortBy: 'popularity.desc',
			voteGte: 1
		},
		{
			id: 'aksie',
			titleAf: 'Aksie',
			titleEn: 'Action',
			endpoint: 'discover',
			sortBy: 'popularity.desc',
			voteGte: 3,
			genre: 28
		},
		{
			id: 'komedie',
			titleAf: 'Komedie',
			titleEn: 'Comedy',
			endpoint: 'discover',
			sortBy: 'popularity.desc',
			voteGte: 3,
			genre: 35
		},
		{
			id: 'drama',
			titleAf: 'Drama',
			titleEn: 'Drama',
			endpoint: 'discover',
			sortBy: 'popularity.desc',
			voteGte: 5,
			genre: 18
		},
		{
			id: 'gruwel',
			titleAf: 'Gruwel',
			titleEn: 'Horror',
			endpoint: 'discover',
			sortBy: 'popularity.desc',
			voteGte: 3,
			genre: 27
		},
		{
			id: 'wetenskapfiksie',
			titleAf: 'Wetenskapfiksie',
			titleEn: 'Sci-Fi',
			endpoint: 'discover',
			sortBy: 'popularity.desc',
			voteGte: 3,
			genre: 878
		},
		{
			id: 'dokumenter',
			titleAf: 'Dokumentêr',
			titleEn: 'Documentary',
			endpoint: 'discover',
			sortBy: 'popularity.desc',
			voteGte: 1,
			genre: 99
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
	const item = toLibraryMovie({ ...m, mediaType: 'movie' });
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
		({ results } = await tmdbFetch('/trending/movie/week', new URLSearchParams({ page: '1' })));
	} else if (query.endpoint === 'discover') {
		const qp = new URLSearchParams();
		qp.set('sort_by', query.sortBy);
		qp.set('vote_count.gte', String(query.voteGte));
		if (query.dateGte) qp.set(dateField('gte'), query.dateGte);
		if (query.dateLte) qp.set(dateField('lte'), query.dateLte);
		if (query.genre) qp.set('with_genres', String(query.genre));
		qp.set('page', '1');
		({ results } = await tmdbFetch('/discover/movie', qp));
	} else {
		({ results } = await tmdbFetch(`/movie/${query.endpoint}`, new URLSearchParams({ page: '1' })));
	}

	const filtered =
		query.endpoint === 'upcoming'
			? results
			: results.filter((m: any) => (m.vote_count ?? 0) >= query.voteGte);

	return filtered
		.map(toRailItem)
		.filter((m): m is LibraryMedia => m !== null)
		.slice(0, 20);
}

const railCache = new Map<string, { data: MoviesRail[]; at: number }>();
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

export async function loadMoviesRails(): Promise<MoviesRail[]> {
	const cached = readCache(railCache, 'movies');
	if (cached) return cached;

	const settled = await Promise.allSettled(
		railQueries().map(async (query) => ({
			id: query.id,
			titleAf: query.titleAf,
			titleEn: query.titleEn,
			items: await fetchRail(query)
		}))
	);
	const rails = settled
		.filter((r): r is PromiseFulfilledResult<MoviesRail> => r.status === 'fulfilled')
		.map((r) => r.value)
		.filter((r) => r.items.length >= 4);

	writeCache(railCache, 'movies', rails);
	return rails;
}

function pickTrailer(videos: any[]): string | null {
	const v = Array.isArray(videos) ? videos : [];
	const youtube = v.find(
		(video: any) => video.site === 'YouTube' && video.type === 'Trailer'
	) ?? v.find((video: any) => video.site === 'YouTube' && video.type === 'Teaser');
	return youtube?.key ? `https://www.youtube.com/watch?v=${youtube.key}` : null;
}

export async function fetchMoviesHero(): Promise<LibraryMedia[]> {
	const cached = readCache(heroCache, 'movies');
	if (cached) return cached;

	const { results } = await tmdbFetch('/trending/movie/week', new URLSearchParams({ page: '1' }));
	const top = results.slice(0, 5);

	const items = await Promise.all(
		top.map(async (m: any) => {
			const item = toRailItem(m);
			if (!item) return null;
			const { results: videos } = await tmdbFetch(`/movie/${m.id}/videos`, new URLSearchParams());
			item.trailerUrl = pickTrailer(videos);
			return item;
		})
	);

	const hero = items.filter((m): m is LibraryMedia => m !== null);
	writeCache(heroCache, 'movies', hero);
	return hero;
}

export async function fetchMoviesRail(id: MoviesRailId): Promise<LibraryMedia[]> {
	const query = railQueries().find((q) => q.id === id);
	return query ? fetchRail(query) : [];
}

const SORTS: Record<MoviesBrowseSort, string> = {
	newest: 'primary_release_date.desc',
	year: 'primary_release_date.desc',
	rating: 'vote_average.desc',
	title: 'original_title.asc',
	popularity: 'popularity.desc'
};

const CATEGORY_SORTS: Record<Exclude<MoviesCategory, 'all'>, string> = {
	trending: 'popularity.desc',
	popular: 'popularity.desc',
	top_rated: 'vote_average.desc',
	upcoming: 'primary_release_date.asc'
};

const CATEGORY_VOTE: Record<Exclude<MoviesCategory, 'all'>, number> = {
	trending: 1,
	popular: 1,
	top_rated: 100,
	upcoming: 0
};

export async function fetchMoviesBrowse(opts: {
	category?: MoviesCategory;
	page: number;
	genre?: number | null;
	decade?: number | null;
	sort?: MoviesBrowseSort | null;
}): Promise<MoviesBrowseResult> {
	const category = opts.category ?? 'all';
	const qp = new URLSearchParams();
	qp.set('page', String(opts.page));

	if (category !== 'all') {
		qp.set('sort_by', CATEGORY_SORTS[category]);
		qp.set('vote_count.gte', String(CATEGORY_VOTE[category]));
		if (category === 'upcoming') qp.set('primary_release_date.gte', todayParam());
	} else {
		const sort = opts.sort ?? 'newest';
		qp.set('sort_by', SORTS[sort]);
		qp.set('vote_count.gte', '1');
		qp.set('primary_release_date.lte', todayParam());
	}

	if (opts.genre) qp.set('with_genres', String(opts.genre));
	if (opts.decade) {
		qp.set(dateField('gte'), `${opts.decade}-01-01`);
		qp.set(dateField('lte'), `${opts.decade + 9}-12-31`);
	}

	const { results, total_pages } = await tmdbFetch('/discover/movie', qp);
	const eligible = results
		.filter((m: any) => m.poster_path && (category !== 'top_rated' || (m.vote_count ?? 0) >= 100))
		.map((m: any) => formatMovie({ ...m, media_type: 'movie' }));

	return {
		results: eligible,
		page: opts.page,
		total_pages,
		hasMore: eligible.length > 0 && opts.page < total_pages
	};
}
