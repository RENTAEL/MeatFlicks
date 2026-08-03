import { env } from '$lib/config/env';

const TMDB_BASE = 'https://api.themoviedb.org/3';

const ENDPOINTS: Record<string, string> = {
	all: 'now_playing',
	popular: 'popular',
	top_rated: 'top_rated',
	upcoming: 'upcoming'
};

export const MOVIE_CATEGORIES = ['all', 'trending', 'popular', 'top_rated', 'upcoming'] as const;
export type MovieCategory = (typeof MOVIE_CATEGORIES)[number];

export interface MovieCategoryPage {
	results: any[];
	page: number;
	total_pages: number;
}

export async function fetchMovieCategory(
	category: MovieCategory,
	page: number
): Promise<MovieCategoryPage> {
	if (category === 'trending') {
		const res = await fetch(`${TMDB_BASE}/trending/movie/week?api_key=${env.TMDB_API_KEY}&page=${page}`);
		if (!res.ok) throw new Error(`TMDB responded with ${res.status}`);
		return res.json();
	}

	if (category === 'all') {
		const [npRes, popRes] = await Promise.all([
			fetch(`${TMDB_BASE}/movie/now_playing?api_key=${env.TMDB_API_KEY}&page=${page}`),
			fetch(`${TMDB_BASE}/movie/popular?api_key=${env.TMDB_API_KEY}&page=1`)
		]);
		const [np, pop] = await Promise.all([npRes.json(), popRes.json()]);
		const seen = new Set<number>();
		const results = [...(np.results || []), ...(pop.results || [])].filter((m: any) => {
			if (seen.has(m.id)) return false;
			seen.add(m.id);
			return true;
		});
		return { results, page: 1, total_pages: 1 };
	}

	const endpoint = ENDPOINTS[category] || 'popular';
	const res = await fetch(`${TMDB_BASE}/movie/${endpoint}?api_key=${env.TMDB_API_KEY}&page=${page}`);
	if (!res.ok) throw new Error(`TMDB responded with ${res.status}`);
	return res.json();
}
