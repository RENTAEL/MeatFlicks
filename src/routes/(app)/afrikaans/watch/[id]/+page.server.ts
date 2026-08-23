import { redirect } from '@sveltejs/kit';
import { env } from '$lib/config/env';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const UA = { 'User-Agent': 'MeatFlicks/1.0' };

type AfrikaansWatchDetails = {
	tmdbId: number;
	mediaType: 'movie' | 'tv';
	title: string;
	year: string | null;
	overview: string | null;
	backdropPath: string | null;
	posterPath: string | null;
	trailerKey: string | null;
};

async function fetchJson(url: string): Promise<any | null> {
	try {
		const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(6000) });
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

function pickTrailer(videos: any): string | null {
	const results = Array.isArray(videos?.results) ? videos.results : [];
	const youtube = results.filter((v: any) => v.site === 'YouTube');
	return (
		youtube.find((v: any) => v.type === 'Trailer' && v.official)?.key ??
		youtube.find((v: any) => v.type === 'Trailer')?.key ??
		youtube[0]?.key ??
		null
	);
}

/**
 * Dedicated watch page for the Afrikaans section. Completely separate from
 * the main /movie and /tv players — this route resolves its own details and
 * hands them to the isolated AfrikaansPlayer with multi-source fallback.
 */
export async function load({ params, url }) {
	const { id } = params;
	if (!/^\d+$/.test(id)) throw redirect(301, '/afrikaans');

	let mediaType: 'movie' | 'tv' = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
	let details: AfrikaansWatchDetails = {
		tmdbId: Number(id),
		mediaType,
		title: 'Afrikaans Film',
		year: null,
		overview: null,
		backdropPath: null,
		posterPath: null,
		trailerKey: null
	};

	const apiKey = env.TMDB_API_KEY;

	if (url.searchParams.get('type') !== 'tv') {
		const movie = await fetchJson(`${TMDB_BASE}/movie/${id}?api_key=${apiKey}`);
		if (movie?.title) {
			details = {
				...details,
				mediaType: 'movie',
				title: movie.title ?? details.title,
				year: (movie.release_date ?? '').slice(0, 4) || null,
				overview: movie.overview ?? null,
				backdropPath: movie.backdrop_path ?? null,
				posterPath: movie.poster_path ?? null
			};
			const videos = await fetchJson(
				`${TMDB_BASE}/movie/${id}/videos?api_key=${apiKey}&language=en`
			);
			details.trailerKey = pickTrailer(videos);
			return { details };
		}
	}

	const tv = await fetchJson(`${TMDB_BASE}/tv/${id}?api_key=${apiKey}`);
	if (tv?.name) {
		details = {
			...details,
			mediaType: 'tv',
			title: tv.name ?? details.title,
			year: (tv.first_air_date ?? '').slice(0, 4) || null,
			overview: tv.overview ?? null,
			backdropPath: tv.backdrop_path ?? null,
			posterPath: tv.poster_path ?? null
		};
		const videos = await fetchJson(`${TMDB_BASE}/tv/${id}/videos?api_key=${apiKey}&language=en`);
		details.trailerKey = pickTrailer(videos);
		return { details };
	}

	return { details };
}
