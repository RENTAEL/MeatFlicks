import { json } from '@sveltejs/kit';
import { env } from '$lib/config/env';
import { AFRIKAANS_FILMS } from '$lib/curated/afrikaans-films';
import { formatMovie } from '$lib/utils/tmdb';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const UA = { 'User-Agent': 'MeatFlicks/1.0' };

async function searchType(type: 'movie' | 'tv', q: string) {
	try {
		const res = await fetch(
			`${TMDB_BASE}/search/${type}?api_key=${env.TMDB_API_KEY}&language=af&query=${encodeURIComponent(q)}`,
			{ headers: UA, signal: AbortSignal.timeout(8000) }
		);
		if (!res.ok) return [];
		const data = await res.json();
		return (data.results || []).filter(
			(m: any) => m.original_language === 'af' && m.poster_path
		);
	} catch {
		return [];
	}
}

export async function GET({ url }) {
	const q = (url.searchParams.get('q') ?? '').trim();
	if (!q || q.length < 2) return json({ results: [], q });

	const [movies, series] = await Promise.all([searchType('movie', q), searchType('tv', q)]);

	const curatedIds = new Set(AFRIKAANS_FILMS.map((f) => f.tmdbId));
	const results = [
		...movies.map((m: any) => formatMovie({ ...m, media_type: 'movie' })),
		...series.map((m: any) => formatMovie({ ...m, media_type: 'tv' }))
	].filter((m: any) => !curatedIds.has(Number(m.id)));

	return json(
		{ results, q },
		{
			headers: {
				'Cache-Control': 'public, max-age=120, s-maxage=300, stale-while-revalidate=300'
			}
		}
	);
}
