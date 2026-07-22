import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$lib/config/env';
import { fetchTrendingMovieIds, fetchTmdbMovieDetails } from '$lib/server/services/tmdb.service';
import { upsertMovieWithGenres } from '$lib/server/db/mutations';
import { db } from '$lib/server/db/client';
import { libraryRepository } from '$lib/server/repositories/library.repository';

export const GET: RequestHandler = async () => {
	const results: Record<string, any> = {};

	try {
		results.envCheck = {
			hasApiKey: !!env.TMDB_API_KEY,
			hasToken: !!env.TMDB_READ_ACCESS_TOKEN,
			tmdbApiKeyLength: env.TMDB_API_KEY?.length,
			dbPath: env.SQLITE_DB_PATH
		};
	} catch (e: any) {
		results.envCheck = { error: e.message };
	}

	try {
		const ids = await fetchTrendingMovieIds(10);
		results.trendingIds = { count: ids.length, ids: ids.slice(0, 3) };
	} catch (e: any) {
		results.trendingIds = { error: e.message, stack: e.stack?.split('\n').slice(0, 5) };
	}

	if (results.trendingIds?.ids?.length) {
		const tmdbId = results.trendingIds.ids[0];
		try {
			const details = await fetchTmdbMovieDetails(tmdbId);
			results.movieDetails = {
				found: details.found,
				title: details.found ? (details as any).title : null,
				hasGenres: details.found ? !!((details as any).genres?.length) : false
			};
		} catch (e: any) {
			results.movieDetails = { error: e.message };
		}
	}

	try {
		const stored = await upsertMovieWithGenres({
			tmdbId: 550,
			title: 'Debug Test Movie',
			overview: 'Test',
			posterPath: null,
			backdropPath: null,
			releaseDate: '1999-10-15',
			rating: 8.4,
			durationMinutes: 139,
			is4K: false,
			isHD: true,
			genreNames: ['Drama', 'Thriller'],
			imdbId: 'tt0137523',
			trailerUrl: null
		});
		results.dbInsert = { success: true, id: stored?.id, title: stored?.title };
	} catch (e: any) {
		results.dbInsert = { error: e.message, stack: e.stack?.split('\n').slice(0, 3) };
	}

	try {
		const [trendingMovies, trendingTv] = await Promise.all([
			libraryRepository.findTrendingMovies(10, 'movie'),
			libraryRepository.findTrendingMovies(10, 'tv')
		]);
		results.dbQuery = {
			trendingMoviesCount: trendingMovies.length,
			trendingTvCount: trendingTv.length
		};
	} catch (e: any) {
		results.dbQuery = { error: e.message };
	}

	return json(results, {
		headers: { 'Cache-Control': 'no-store' }
	});
};
