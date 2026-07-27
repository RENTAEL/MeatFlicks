import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$lib/config/env';

export const GET: RequestHandler = async ({ params, fetch }) => {
	const { type, id } = params;
	try {
		const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}/similar?api_key=${env.TMDB_API_KEY}&language=en-US&page=1`, { signal: AbortSignal.timeout(8000) });
		const data = await res.json();
		return json({ results: data.results?.slice(0, 12) || [] });
	} catch (e: any) {
		return json({ results: [], error: e.message }, { status: 500 });
	}
};
