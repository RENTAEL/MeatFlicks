import { buildCacheKey, withCache, CACHE_TTL_LONG_SECONDS } from '$lib/server/cache';
import { tmdbRateLimiter } from '$lib/server/rate-limiter';
import { TmdbFindResponseSchema } from './tmdb.schemas';
import { api } from './tmdb.client';

export async function lookupTmdbIdByImdbId(imdbId: string): Promise<number | null> {
	const normalized = imdbId.trim().toLowerCase();
	if (!/^tt\d+$/.test(normalized)) {
		return null;
	}

	const cacheKey = buildCacheKey('tmdb', 'lookup', normalized);

	return withCache(cacheKey, CACHE_TTL_LONG_SECONDS, async () => {
		const rawData = await tmdbRateLimiter.schedule('tmdb-imdb-lookup', () =>
			api(`/find/${normalized}`, {
				query: { external_source: 'imdb_id' }
			})
		);

		const data = TmdbFindResponseSchema.parse(rawData);
		return data.movie_results[0]?.id || data.tv_results[0]?.id || null;
	});
}


