import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { libraryRepository } from '$lib/server/repositories/library.repository';
import { playbackProgressRepository } from '$lib/server/repositories/playback-progress.repository';
import { resolveMediaId } from '$lib/server/db/media-resolver';
import { z } from 'zod';
import { errorHandler, UnauthorizedError, ValidationError } from '$lib/server';
import { validateRequestBody, validateQueryParams } from '$lib/server/validation';

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json([]);
		}

		const tmdbId = url.searchParams.get('tmdb_id');
		const mediaType = url.searchParams.get('media_type') as 'movie' | 'tv' | null;
		const season = url.searchParams.get('season');
		const episode = url.searchParams.get('episode');

		if (tmdbId && mediaType) {
			const progress = await playbackProgressRepository.getProgress(
				user.id,
				tmdbId,
				mediaType,
				season ? parseInt(season) : undefined,
				episode ? parseInt(episode) : undefined
			);
			return json({ history: progress });
		}

		const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50;
		const history = await libraryRepository.getWatchHistory(user.id, limit);

		return json(history);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ success: false });
		}

		const body = await request.json();

		if (body.tmdb_id && body.media_type) {
			await playbackProgressRepository.saveProgress(
				user.id,
				String(body.tmdb_id),
				body.media_type as 'movie' | 'tv',
				body.progress ?? 0,
				body.duration ?? 0,
				body.season,
				body.episode
			);

			const mediaId = await resolveMediaId(Number(body.tmdb_id), body.media_type as 'movie' | 'tv');
			if (mediaId) {
				await libraryRepository.addToWatchHistory(user.id, mediaId);
			}

			return json({ success: true });
		}

		const validatedBody = validateRequestBody(z.object({ mediaId: z.string() }), body);
		await libraryRepository.addToWatchHistory(user.id, validatedBody.mediaId);

		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			throw new UnauthorizedError('User must be logged in to clear watch history');
		}

		await libraryRepository.clearWatchHistory(user.id);

		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
