import { env } from '$lib/config/env';
const PUBLIC_TMDB_API_KEY = env.PUBLIC_TMDB_API_KEY;
import { formatMedia } from '$lib/utils/tmdb';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function load({ url, fetch }) {
	const category = url.searchParams.get('category') || 'trending';
	const page = parseInt(url.searchParams.get('page') || '1');

	const endpoints: Record<string, string> = {
		trending: 'trending/tv/week',
		popular: 'tv/popular',
		top_rated: 'tv/top_rated',
		airing_today: 'tv/airing_today',
		on_the_air: 'tv/on_the_air'
	};

	const endpoint = endpoints[category] || 'trending/tv/week';

	try {
		const res = await fetch(
			`${TMDB_BASE}/${endpoint}?api_key=${PUBLIC_TMDB_API_KEY}&page=${page}`
		);
		if (!res.ok) throw new Error(`TMDB responded with ${res.status}`);
		const data = await res.json();

		return {
			shows: (data.results || []).map(formatMedia),
			page: data.page,
			totalPages: data.total_pages,
			category
		};
	} catch {
		return {
			shows: [],
			error: 'Failed to load TV shows',
			category,
			page: 1,
			totalPages: 0
		};
	}
}
