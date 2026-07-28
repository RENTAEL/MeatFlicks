import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { env } from '$lib/config/env';
import { AFRIKAANS_FILM_MAP } from '$lib/curated/afrikaans-films';

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function getSubtitles(tmdbId: number) {
	try {
		const res = await fetch(
			`https://api.opensubtitles.com/api/v1/subtitles?tmdb_id=${tmdbId}&languages=af&order_by=download_count`,
			{ headers: { 'Api-Key': env.TMDB_API_KEY, 'Content-Type': 'application/json' } }
		);
		const data = await res.json();
		const fileId = data.data?.[0]?.attributes?.files?.[0]?.file_id;
		if (!fileId) return null;
		return {
			url: `https://api.opensubtitles.com/api/v1/download?file_id=${fileId}&sub_format=webvtt`,
			label: 'Afrikaans',
		};
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const id = Number(params.id);
	if (!id || isNaN(id)) throw error(400, 'Invalid movie ID');

	const tmdbRes = await fetch(
		`${TMDB_BASE}/movie/${id}?api_key=${env.PUBLIC_TMDB_API_KEY}&language=af&append_to_response=credits,videos,similar`
	);

	if (!tmdbRes.ok) {
		if (tmdbRes.status === 404) throw error(404, 'Movie not found');
		throw error(502, 'Failed to fetch movie data');
	}

	const movie = await tmdbRes.json();
	const curated = AFRIKAANS_FILM_MAP.get(id);

	const subtitlesPromise = getSubtitles(id);

	const trailer = movie.videos?.results?.find(
		(v: any) => v.type === 'Trailer' && v.site === 'YouTube'
	);

	const subtitles = await subtitlesPromise;

	return {
		movie: {
			id: movie.id,
			tmdbId: movie.id,
			title: curated?.title || movie.title,
			titleEn: curated?.titleEn || null,
			overview: movie.overview,
			tagline: movie.tagline,
			poster_path: movie.poster_path,
			backdrop_path: movie.backdrop_path,
			release_date: movie.release_date,
			runtime: movie.runtime,
			vote_average: movie.vote_average,
			genres: movie.genres || [],
			year: curated?.year || movie.release_date?.slice(0, 4),
			director:
				curated?.director ||
				movie.credits?.crew?.find((c: any) => c.job === 'Director')?.name,
			cast: (movie.credits?.cast || []).slice(0, 15).map((c: any) => ({
				id: c.id, name: c.name, character: c.character,
			})),
			similar: (movie.similar?.results || []).slice(0, 10),
			youtubeId: curated?.youtubeId || null,
			youtubeTrailerId: curated?.youtubeTrailerId || null,
			sources: curated?.sources || [],
		},
		trailer: trailer ? { key: trailer.key, name: trailer.name } : null,
		subtitles,
	};
};
