import { htmlCacheControl } from '$lib/server/caching';
import { fetchTmdbPersonDetails } from '$lib/server/services/tmdb.service';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });
	const personId = Number(params.id);

	if (!personId || isNaN(personId)) {
		error(404, 'Invalid Person ID');
	}

	try {
		const person = await fetchTmdbPersonDetails(personId);
		return { person };
	} catch (e) {
		console.error(e);
		error(404, 'Person not found');
	}
};
