import { json } from '@sveltejs/kit';
import { fetchAfrikaansBrowse, type AfrikaansBrowseSort } from '$lib/server/afrikaans';

const GENRES = new Set(['18', '35', '99']);
const DECADES = new Set(['1980', '1990', '2000', '2010', '2020']);
const SORTS = new Set(['newest', 'rating', 'title', 'popularity']);

export async function GET({ url }) {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const type = url.searchParams.get('type') === 'reekse' ? 'tv' : 'movie';
	const genreParam = url.searchParams.get('genre');
	const decadeParam = url.searchParams.get('decade');
	const sortParam = url.searchParams.get('sort');

	const genre = genreParam && GENRES.has(genreParam) ? Number(genreParam) : null;
	const decade = decadeParam && DECADES.has(decadeParam) ? Number(decadeParam) : null;
	const sort = sortParam && SORTS.has(sortParam) ? (sortParam as AfrikaansBrowseSort) : null;

	const data = await fetchAfrikaansBrowse({ type, page, genre, decade, sort });

	return json(data, {
		headers: { 'Cache-Control': 'public, max-age=120, s-maxage=300, stale-while-revalidate=300' }
	});
}
