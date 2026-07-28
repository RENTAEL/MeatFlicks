import { error } from '@sveltejs/kit';
import { AFRIKAANS_FILM_MAP } from '$lib/curated/afrikaans-films';
import { getMovieInAfrikaans } from '$lib/tmdb';
import { getAfrikaansSubtitles } from '$lib/subtitles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const slug = params.slug;

	const tmdbId = Number(slug);
	if (isNaN(tmdbId)) error(404, 'Invalid film ID');

	const film = AFRIKAANS_FILM_MAP.get(tmdbId);
	if (!film) error(404, 'Film not found');

	const details = await getMovieInAfrikaans(tmdbId);

	let subtitleUrl: string | null = null;
	if (details) {
		const sub = await getAfrikaansSubtitles(tmdbId);
		subtitleUrl = sub?.url ?? null;
	}

	return { film, details, subtitleUrl };
};
