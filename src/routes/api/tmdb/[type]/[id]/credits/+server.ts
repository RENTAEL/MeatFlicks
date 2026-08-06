import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$lib/config/env';

export const GET: RequestHandler = async ({ setHeaders, params, fetch }) => {
	setHeaders({ 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300' });
	const { type, id } = params;
	try {
		const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}/credits?api_key=${env.TMDB_API_KEY}&language=en-US`, { signal: AbortSignal.timeout(8000) });
		const data = await res.json();
		return json({ cast: data.cast?.slice(0, 15) || [] });
	} catch (e: any) {
		return json({ cast: [], error: e.message }, { status: 500 });
	}
};
