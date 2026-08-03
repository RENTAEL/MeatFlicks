import { db } from '$lib/server/db';
import { playbackProgress } from '$lib/server/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';

export interface PlaybackProgressRecord {
	id: number;
	userId: string;
	tmdbId: string;
	mediaType: 'movie' | 'tv';
	progress: number;
	duration: number;
	season: number | null;
	episode: number | null;
	updatedAt: number;
}

export const playbackProgressRepository = {
	async saveProgress(
		userId: string,
		tmdbId: string,
		mediaType: 'movie' | 'tv',
		progress: number,
		duration: number,
		season?: number,
		episode?: number
	): Promise<void> {
		try {
			const conditions = [
				eq(playbackProgress.userId, userId),
				eq(playbackProgress.tmdbId, tmdbId),
				eq(playbackProgress.mediaType, mediaType)
			];

			if (season !== undefined) {
				conditions.push(eq(playbackProgress.season, season));
			} else {
				conditions.push(isNull(playbackProgress.season));
			}

			if (episode !== undefined) {
				conditions.push(eq(playbackProgress.episode, episode));
			} else {
				conditions.push(isNull(playbackProgress.episode));
			}

			const existing = await db
				.select()
				.from(playbackProgress)
				.where(and(...conditions))
				.limit(1);

			if (existing.length > 0) {
				await db
					.update(playbackProgress)
					.set({
						progress,
						duration,
						updatedAt: Date.now()
					})
					.where(eq(playbackProgress.id, existing[0].id));
			} else {
				await db.insert(playbackProgress).values({
					userId,
					tmdbId,
					mediaType,
					progress,
					duration,
					season: season ?? null,
					episode: episode ?? null,
					updatedAt: Date.now()
				});
			}
		} catch (error) {
			console.error('Error saving playback progress:', error);
			throw new Error('Failed to save playback progress');
		}
	},

	async getProgress(
		userId: string,
		tmdbId: string,
		mediaType: 'movie' | 'tv',
		season?: number,
		episode?: number
	): Promise<PlaybackProgressRecord | null> {
		try {
			const conditions = [
				eq(playbackProgress.userId, userId),
				eq(playbackProgress.tmdbId, tmdbId),
				eq(playbackProgress.mediaType, mediaType)
			];

			if (season !== undefined) {
				conditions.push(eq(playbackProgress.season, season));
			} else {
				conditions.push(isNull(playbackProgress.season));
			}

			if (episode !== undefined) {
				conditions.push(eq(playbackProgress.episode, episode));
			} else {
				conditions.push(isNull(playbackProgress.episode));
			}

			const results = await db
				.select()
				.from(playbackProgress)
				.where(and(...conditions))
				.limit(1);

			if (results[0]) {
				const row = results[0];
				return {
					...row,
					progress: row.progress ?? 0,
					duration: row.duration ?? 0,
					mediaType: row.mediaType as 'movie' | 'tv'
				};
			}
			return null;
		} catch (error) {
			console.error('Error fetching playback progress:', error);
			return null;
		}
	},

	async getContinueWatching(userId: string, limit: number = 20): Promise<PlaybackProgressRecord[]> {
		try {
			const results = await db
				.select()
				.from(playbackProgress)
				.where(eq(playbackProgress.userId, userId))
				.orderBy(desc(playbackProgress.updatedAt))
				.limit(limit);

			return results
				.map((record) => ({
					...record,
					progress: record.progress ?? 0,
					duration: record.duration ?? 0,
					mediaType: record.mediaType as 'movie' | 'tv'
				}))
				.filter((record) => {
					if (record.duration <= 0) return false;
					const staleMs = 30 * 24 * 60 * 60 * 1000;
					if (Date.now() - (record.updatedAt ?? 0) > staleMs) return false;
					const progressPercent = (record.progress / record.duration) * 100;
					return progressPercent < 90;
				});
		} catch (error) {
			console.error('Error fetching continue watching:', error);
			return [];
		}
	},

	async deleteProgress(
		userId: string,
		tmdbId: string,
		mediaType: 'movie' | 'tv',
		season?: number,
		episode?: number
	): Promise<void> {
		try {
			const conditions = [
				eq(playbackProgress.userId, userId),
				eq(playbackProgress.tmdbId, tmdbId),
				eq(playbackProgress.mediaType, mediaType)
			];

			if (season !== undefined) {
				conditions.push(eq(playbackProgress.season, season));
			} else {
				conditions.push(isNull(playbackProgress.season));
			}

			if (episode !== undefined) {
				conditions.push(eq(playbackProgress.episode, episode));
			} else {
				conditions.push(isNull(playbackProgress.episode));
			}

			await db.delete(playbackProgress).where(and(...conditions));
		} catch (error) {
			console.error('Error deleting playback progress:', error);
			throw new Error('Failed to delete playback progress');
		}
	}
};

export type PlaybackProgressRepository = typeof playbackProgressRepository;
