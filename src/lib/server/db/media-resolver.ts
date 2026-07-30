import { db } from './client';
import { media } from './schema';
import { eq } from 'drizzle-orm';
import { createId } from '../id';

export async function resolveMediaId(tmdbId: number, mediaType: string = 'movie'): Promise<string | null> {
	try {
		const existing = await db.select({ id: media.id })
			.from(media)
			.where(eq(media.tmdbId, tmdbId))
			.limit(1)
			.get();

		if (existing) return existing.id;

		const newId = createId();
		await db.insert(media).values({
			id: newId,
			tmdbId,
			title: `Media ${tmdbId}`,
			mediaType,
			is4K: false,
			isHD: false
		});

		return newId;
	} catch (error) {
		console.error('[mediaResolver] Failed to resolve media ID:', error);
		return null;
	}
}
