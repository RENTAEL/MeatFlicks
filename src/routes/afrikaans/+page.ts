import { AFRIKAANS_FILMS } from '$lib/curated/afrikaans-films';
import { env } from '$lib/config/env';
import { formatMovie } from '$lib/utils/tmdb';

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function fetchMovie(id: number) {
	try {
		const res = await fetch(
			`${TMDB_BASE}/movie/${id}?api_key=${env.PUBLIC_TMDB_API_KEY}&language=af&append_to_response=credits`
		);
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

export async function load({ url }) {
	const page = Number(url.searchParams.get('page')) || 1;

	if (page === 1) {
		const curatedIds = AFRIKAANS_FILMS.map((f) => f.tmdbId);
		const tmdbResults = await Promise.all(curatedIds.map(fetchMovie));

		const movies = AFRIKAANS_FILMS.map((film, i) => {
			const tmdb = tmdbResults[i];
			if (!tmdb) {
				console.warn(`[afrikaans] TMDB fetch returned null for ${film.title} (ID ${film.tmdbId})`);
			}
			return {
				...formatMovie(tmdb || {}),
				tmdbId: film.tmdbId,
				id: film.tmdbId,
				title: tmdb?.title || film.title,
				poster: tmdb?.poster_path
					? `https://image.tmdb.org/t/p/w342${tmdb.poster_path}`
					: null,
				year: String(film.year),
				titleEn: film.titleEn || null,
				director: film.director || null,
				youtubeId: film.youtubeId || null,
				youtubeTrailerId: film.youtubeTrailerId || null,
				sources: film.sources || [],
			};
		}).filter(Boolean).filter((m) => m.poster);

		return { movies, page: 1, hasMore: movies.length >= 20, source: 'curated' };
	}

	const discoverRes = await fetch(
		`${TMDB_BASE}/discover/movie?api_key=${env.PUBLIC_TMDB_API_KEY}` +
		`&language=af&with_original_language=af&sort_by=popularity.desc&page=${page}&region=ZA`
	);
	const discoverData = await discoverRes.json();

	const curatedIds = new Set(AFRIKAANS_FILMS.map((f) => f.tmdbId));
	const movies = (discoverData.results || [])
		.filter((m: any) => !curatedIds.has(m.id))
		.map(formatMovie);

	return {
		movies,
		page,
		hasMore: page < (discoverData.total_pages || 1),
		source: 'discover',
	};
}
