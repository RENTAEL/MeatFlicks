import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { watchlistRepository } from '$lib/server/repositories/watchlist.repository';
import { z } from 'zod';
import { errorHandler, ValidationError } from '$lib/server';
import { validateRequestBody } from '$lib/server/validation';
import { resolveMediaId } from '$lib/server/db/media-resolver';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const user = locals.user;

		if (user) {
			const media = await watchlistRepository.getWatchlist(user.id);
			return json(media);
		}

		return json([]);
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = locals.user;

		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const schema = z.object({
			mediaId: z.string().optional(),
			tmdbId: z.number().optional(),
			mediaType: z.string().optional()
		});
		const validatedBody = validateRequestBody(schema, body);

		let mediaId = validatedBody.mediaId;

		if (!mediaId && validatedBody.tmdbId) {
			const resolved = await resolveMediaId(validatedBody.tmdbId, validatedBody.mediaType ?? 'movie');
			if (!resolved) {
				return json({ error: 'Failed to resolve media' }, { status: 500 });
			}
			mediaId = resolved;
		}

		if (!mediaId) {
			throw new ValidationError('Either mediaId or tmdbId is required');
		}

		await watchlistRepository.addToWatchlist(user.id, mediaId);

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
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const validatedBody = validateRequestBody(
			z.object({
				mediaId: z.string().optional(),
				tmdbId: z.number().optional(),
				mediaType: z.string().optional(),
				clearAll: z.boolean().optional()
			}),
			body
		);

		if (validatedBody.clearAll) {
			await watchlistRepository.clearWatchlist(user.id);
			return json({ success: true });
		}

		let mediaId = validatedBody.mediaId;

		if (!mediaId && validatedBody.tmdbId) {
			const resolved = await resolveMediaId(validatedBody.tmdbId, validatedBody.mediaType ?? 'movie');
			if (!resolved) {
				return json({ error: 'Failed to resolve media' }, { status: 500 });
			}
			mediaId = resolved;
		}

		if (!mediaId) {
			throw new ValidationError('Media ID is required');
		}

		await watchlistRepository.removeFromWatchlist(user.id, mediaId);

		return json({ success: true });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
