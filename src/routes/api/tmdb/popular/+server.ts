import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$lib/config/env';

export const GET: RequestHandler = async ({ fetch }) => {
	try {
		const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${env.TMDB_API_KEY}`, { signal: AbortSignal.timeout(8000) });
		const data = await res.json();
		return json({ results: data.results?.slice(0, 20) || [] });
	} catch (e: any) {
		return json({ results: [], error: e.message }, { status: 500 });
	}
};
