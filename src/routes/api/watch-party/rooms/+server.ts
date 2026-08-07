import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { env } from '$lib/config/env';
import { validateRequestBody } from '$lib/server';
import { errorHandler } from '$lib/server';
import { createRoom } from '$lib/server/watch-party/service';
import { requireUser } from '$lib/server/watch-party/handlers';

const createSchema = z.object({
	mediaType: z.enum(['movie', 'tv']),
	tmdbId: z.coerce.number().int().positive(),
	season: z.coerce.number().int().positive().optional(),
	episode: z.coerce.number().int().positive().optional(),
	title: z.string().trim().max(200).optional()
});

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function resolveTitle(mediaType: 'movie' | 'tv', tmdbId: number, fallback?: string) {
	try {
		const res = await fetch(
			`${TMDB_BASE}/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${env.TMDB_API_KEY}`,
			{ headers: { accept: 'application/json' } }
		);
		if (res.ok) {
			const data = await res.json();
			const name = mediaType === 'tv' ? (data.name as string) : (data.title as string);
			return name || fallback || 'Watch Party';
		}
	} catch {
		// fall back to the client-supplied title
	}
	return (fallback ?? 'Watch Party').slice(0, 200);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const user = requireUser(locals);
		const body = await request.json();
		const input = validateRequestBody(createSchema, body);

		const title = await resolveTitle(input.mediaType, input.tmdbId, input.title);
		const { roomId } = await createRoom(user, {
			title,
			mediaType: input.mediaType,
			tmdbId: input.tmdbId,
			season: input.season,
			episode: input.episode
		});

		return json({ roomId });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};