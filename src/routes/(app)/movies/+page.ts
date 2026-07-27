import { env } from '$lib/config/env';
const PUBLIC_TMDB_API_KEY = env.PUBLIC_TMDB_API_KEY;
import { formatMovie } from '$lib/utils/tmdb';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function getTmdbEndpoint(category: string) {
	const endpoints: Record<string, string> = {
		all: 'now_playing',
		trending: 'popular',
		popular: 'popular',
		top_rated: 'top_rated',
		upcoming: 'upcoming'
	};
	return endpoints[category] || 'popular';
}

export async function load({ url, fetch }) {
	const category = url.searchParams.get('category') || 'popular';
	const page = parseInt(url.searchParams.get('page') || '1');

	try {
		let data: any;

		if (category === 'trending') {
			const res = await fetch(`${TMDB_BASE}/trending/movie/week?api_key=${PUBLIC_TMDB_API_KEY}&page=${page}`);
			if (!res.ok) throw new Error(`TMDB responded with ${res.status}`);
			data = await res.json();
		} else if (category === 'all') {
			const [npRes, popRes] = await Promise.all([
				fetch(`${TMDB_BASE}/movie/now_playing?api_key=${PUBLIC_TMDB_API_KEY}&page=${page}`),
				fetch(`${TMDB_BASE}/movie/popular?api_key=${PUBLIC_TMDB_API_KEY}&page=1`)
			]);
			const np = await npRes.json();
			const pop = await popRes.json();
			const seen = new Set<number>();
			const combined = [...(np.results || []), ...(pop.results || [])].filter(m => {
				if (seen.has(m.id)) return false;
				seen.add(m.id);
				return true;
			});
			data = { results: combined, page: 1, total_pages: 1 };
		} else {
			const endpoint = getTmdbEndpoint(category);
			const res = await fetch(`${TMDB_BASE}/movie/${endpoint}?api_key=${PUBLIC_TMDB_API_KEY}&page=${page}`);
			if (!res.ok) throw new Error(`TMDB responded with ${res.status}`);
			data = await res.json();
		}

		return {
			movies: (data.results || []).map(formatMovie),
			page: data.page,
			totalPages: data.total_pages,
			category
		};
	} catch (e) {
		return {
			movies: [],
			error: 'Failed to load movies',
			category,
			page: 1,
			totalPages: 0
		};
	}
}
