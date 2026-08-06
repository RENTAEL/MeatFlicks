import { redirect } from '@sveltejs/kit';
import { env } from '$lib/config/env';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const UA = { 'User-Agent': 'MeatFlicks/1.0' };

export async function load({ params }) {
	const { id } = params;
	if (!/^\d+$/.test(id)) throw redirect(301, '/afrikaans');

	try {
		const movieRes = await fetch(`${TMDB_BASE}/movie/${id}?api_key=${env.TMDB_API_KEY}`, {
			headers: UA,
			signal: AbortSignal.timeout(6000)
		});
		if (movieRes.ok) throw redirect(301, `/movie/${id}`);
	} catch (e: any) {
		if (e?.status) throw e;
	}

	try {
		const tvRes = await fetch(`${TMDB_BASE}/tv/${id}?api_key=${env.TMDB_API_KEY}`, {
			headers: UA,
			signal: AbortSignal.timeout(6000)
		});
		if (tvRes.ok) throw redirect(301, `/tv/${id}`);
	} catch (e: any) {
		if (e?.status) throw e;
	}

	throw redirect(301, '/afrikaans');
}
