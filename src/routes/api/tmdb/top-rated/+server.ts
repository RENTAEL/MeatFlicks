import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$lib/config/env';
import { isEligibleMedia } from '$lib/utils/mediaFilter';

export const GET: RequestHandler = async ({ fetch }) => {
	event.setHeaders({ 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300' });
	try {
		const res = await fetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=${env.TMDB_API_KEY}`, { signal: AbortSignal.timeout(8000) });
		const data = await res.json();
		return json({ results: (data.results || []).filter(isEligibleMedia).slice(0, 20) });
	} catch (e: any) {
		return json({ results: [], error: e.message }, { status: 500 });
	}
};
