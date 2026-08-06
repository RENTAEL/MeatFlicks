import { htmlCacheControl } from '$lib/server/caching';
import { formatMovie } from '$lib/utils/tmdb';
import { isEligibleMedia } from '$lib/utils/mediaFilter';
import { fetchMovieCategory, MOVIE_CATEGORIES } from '$lib/server/tmdb-movies';

function parseCategory(raw: string | null): (typeof MOVIE_CATEGORIES)[number] {
	return MOVIE_CATEGORIES.includes(raw as any) ? (raw as any) : 'popular';
}

function parsePage(raw: string | null): number {
	const page = parseInt(raw || '1');
	return Number.isFinite(page) && page > 0 ? page : 1;
}

export async function load({ url, locals, setHeaders }) {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });
	const category = parseCategory(url.searchParams.get('category'));
	const page = parsePage(url.searchParams.get('page'));

	try {
		const data = await fetchMovieCategory(category, page);

		return {
			movies: (data.results || [])
				.filter((m: any) => category === 'upcoming' || isEligibleMedia(m))
				.map(formatMovie),
			page: data.page,
			totalPages: data.total_pages,
			category
		};
	} catch {
		return {
			movies: [],
			error: 'Failed to load movies',
			category,
			page: 1,
			totalPages: 0
		};
	}
}
