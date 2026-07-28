import { AFRIKAANS_FILMS } from '$lib/curated/afrikaans-films';
import { getMovieInAfrikaans } from '$lib/tmdb';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const showcase = AFRIKAANS_FILMS.slice(0, 5);

	const enriched = await Promise.all(
		showcase.map(async (film) => {
			const details = await getMovieInAfrikaans(film.tmdbId);
			return { film, details };
		})
	);

	return {
		showcase: enriched,
	};
};
