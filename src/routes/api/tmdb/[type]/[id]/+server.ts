import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$lib/config/env';

export const GET: RequestHandler = async ({ params, fetch }) => {
	const { type, id } = params;
	try {
		const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${env.TMDB_API_KEY}&language=en-US&append_to_response=videos,images`, { signal: AbortSignal.timeout(8000) });
		const data = await res.json();
		return json(data);
	} catch (e: any) {
		return json({ error: e.message }, { status: 500 });
	}
};
