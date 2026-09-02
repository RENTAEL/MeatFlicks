import { error, isHttpError } from '@sveltejs/kit';
import { htmlCacheControl } from '$lib/server/caching';
import { env } from '$lib/config/env';
import { withCache, buildCacheKey, CACHE_TTL_LONG_SECONDS } from '$lib/server/cache';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function load({ params, fetch, locals, setHeaders }) {
	setHeaders({ 'Cache-Control': htmlCacheControl(locals.user) });
	const { id } = params;

	try {
		const payload = await withCache(
			buildCacheKey('movie-page', id),
			CACHE_TTL_LONG_SECONDS,
			async () => {
				const [movieRes, creditsRes, similarRes] = await Promise.all([
					fetch(`${TMDB_BASE}/movie/${id}?append_to_response=videos&api_key=${env.TMDB_API_KEY}`),
					fetch(`${TMDB_BASE}/movie/${id}/credits?api_key=${env.TMDB_API_KEY}`),
					fetch(`${TMDB_BASE}/movie/${id}/similar?api_key=${env.TMDB_API_KEY}`)
				]);

				// TMDB answers an unknown id with 404 and a body that is still valid
				// JSON, so `.json()` resolves and we would build a movie out of an
				// error payload. Bail out here instead. `withCache` is called without
				// `cacheOnError`, so a throw from this factory is never written to the
				// cache — see src/lib/server/cache.ts.
				if (!movieRes.ok) throw error(404, 'Movie not found');

				// credits/similar stay tolerant: they are non-critical and must never
				// turn the page into a 404.
				const [movie, credits, similar] = await Promise.all([
					movieRes.json(),
					creditsRes.json(),
					similarRes.json()
				]);

				const director = credits.crew?.find((person: any) => person.job === 'Director')?.name;
				const cast = credits.cast?.slice(0, 10).map((person: any) => person.name) || [];

				return {
					movie: {
						id: movie.id,
						title: movie.title,
						tagline: movie.tagline,
						overview: movie.overview,
						release_date: movie.release_date,
						runtime: movie.runtime,
						vote_average: movie.vote_average,
						genres: movie.genres || [],
						poster_path: movie.poster_path,
						backdrop_path: movie.backdrop_path,
						director,
						cast,
						budget: movie.budget,
						revenue: movie.revenue,
						imdb_id: movie.imdb_id
					},
					similarMovies: (similar.results || []).slice(0, 12).map((m: any) => ({
						id: m.id,
						title: m.title,
						poster: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
						rating: m.vote_average,
						year: m.release_date ? new Date(m.release_date).getFullYear() : '—'
					}))
				};
			},
			{ swrSeconds: Math.floor(CACHE_TTL_LONG_SECONDS / 2) }
		);

		return payload;
	} catch (e) {
		// `error()` throws an HttpError; let it through so a bad id renders the
		// real 404 page instead of the generic fallback below.
		if (isHttpError(e)) throw e;
		return {
			movie: null,
			similarMovies: [],
			error: 'Failed to load movie data'
		};
	}
}
