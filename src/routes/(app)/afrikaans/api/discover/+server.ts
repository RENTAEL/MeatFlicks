import { json } from '@sveltejs/kit';
import { env } from '$lib/config/env';
import { AFRIKAANS_FILMS } from '$lib/curated/afrikaans-films';
import { formatMovie } from '$lib/utils/tmdb';
import { isEligibleMedia } from '$lib/utils/mediaFilter';

export async function GET({ url }) {
	const page = Number(url.searchParams.get('page')) || 1;

	const res = await fetch(
		`https://api.themoviedb.org/3/discover/movie?api_key=${env.TMDB_API_KEY}` +
		`&language=af&with_original_language=af&sort_by=primary_release_date.desc` +
		`&page=${page}&region=ZA`
	);

	const data = await res.json();

	const curatedIds = new Set(AFRIKAANS_FILMS.map((f) => f.tmdbId));
	const results = (data.results || [])
		.filter((m: any) => !curatedIds.has(m.id) && isEligibleMedia(m, 0))
		.filter((m: any) => m.poster_path);

	return json(
		{
			results: results.map(formatMovie),
			page,
			total_pages: data.total_pages,
			hasMore: page < (data.total_pages || 1),
		},
		{ headers: { 'Cache-Control': 'public, max-age=120, s-maxage=600' } }
	);
}
