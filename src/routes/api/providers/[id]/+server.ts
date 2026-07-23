import { fetchTmdbWatchProviders } from '$lib/server/services/tmdb.service';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const id = params.id;
	if (!id || !/^\d+$/.test(id)) {
		return json({ flatrate: [], rent: [], buy: [] });
	}
	try {
		const providers = await fetchTmdbWatchProviders(Number(id), 'movie');
		return json(providers);
	} catch {
		return json({ flatrate: [], rent: [], buy: [] });
	}
};
