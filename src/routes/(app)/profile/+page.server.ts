import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, watchlist, watchHistory, media } from '$lib/server/db/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import {
	encryptSession,
	createSessionCookieName,
	getSessionCookieOptions
} from '$lib/server/session-crypto';
import { watchlistRepository } from '$lib/server/repositories/watchlist.repository';
import { getCsrfToken } from '$lib/server/csrf';
import type { PageServerLoad, Actions } from './$types';

const HISTORY_LIMIT = 50;

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const csrfToken = getCsrfToken({ cookies }) ?? '';

	const userId = locals.user.id;

	try {
		const user = await db
			.select({
				id: users.id,
				username: users.username,
				email: users.email,
				createdAt: users.createdAt
			})
			.from(users)
			.where(eq(users.id, userId))
			.get();

		const watchlistCount = await db
			.select({ count: sql<number>`count(*)` })
			.from(watchlist)
			.where(eq(watchlist.userId, userId))
			.get();

		const watchedRows = await db
			.select({
				tmdbId: watchHistory.tmdbId,
				mediaType: watchHistory.mediaType,
				watchedAt: sql<number>`max(${watchHistory.watchedAt})`.as('watchedAt'),
				duration: sql<number>`max(${watchHistory.duration})`.as('duration')
			})
			.from(watchHistory)
			.where(eq(watchHistory.userId, userId))
			.groupBy(watchHistory.tmdbId, watchHistory.mediaType)
			.orderBy(desc(sql`max(${watchHistory.watchedAt})`))
			.limit(HISTORY_LIMIT)
			.all();

		const tmdbIds = watchedRows.map((row) => row.tmdbId);
		let mediaRows: {
			tmdbId: number | null;
			mediaType: string | null;
			title: string;
			posterPath: string | null;
		}[] = [];
		if (tmdbIds.length > 0) {
			mediaRows = await db
				.select({
					tmdbId: media.tmdbId,
					mediaType: media.mediaType,
					title: media.title,
					posterPath: media.posterPath
				})
				.from(media)
				.where(inArray(media.tmdbId, tmdbIds.map(Number)))
				.all();
		}
		const mediaMap = new Map(mediaRows.map((row) => [`${row.tmdbId}:${row.mediaType}`, row]));

		const history = watchedRows.map((row) => {
			const meta = mediaMap.get(`${row.tmdbId}:${row.mediaType}`);
			return {
				tmdbId: row.tmdbId,
				mediaType: row.mediaType,
				watchedAt: row.watchedAt,
				duration: row.duration ?? 0,
				title: meta?.title ?? null,
				posterPath: meta?.posterPath ?? null
			};
		});

		const moviesWatched = watchedRows.filter((row) => row.mediaType === 'movie').length;
		const tvWatched = watchedRows.filter((row) => row.mediaType === 'tv').length;
		const totalSeconds = watchedRows.reduce((sum, row) => sum + (row.duration ?? 0), 0);

		const watchlistItems = await watchlistRepository.getWatchlist(userId);

		return {
			csrfToken,
			profile: {
				id: user?.id,
				username: user?.username ?? locals.user.username,
				email: user?.email ?? '',
				memberSince: user?.createdAt
					? new Date(user.createdAt).toLocaleDateString('en-ZA', {
							year: 'numeric',
							month: 'long'
						})
					: 'Unknown'
			},
			stats: {
				watchlistCount: watchlistCount?.count ?? 0,
				watchedCount: moviesWatched + tvWatched,
				moviesWatched,
				tvWatched,
				totalHours: Math.round((totalSeconds / 3600) * 10) / 10
			},
			history,
			watchlist: watchlistItems
		};
	} catch (e) {
		console.error('Profile load failed:', e);
		return {
			csrfToken,
			profile: {
				id: userId,
				username: locals.user.username,
				email: '',
				memberSince: 'Unknown'
			},
			stats: { watchlistCount: 0, watchedCount: 0, moviesWatched: 0, tvWatched: 0, totalHours: 0 },
			history: [],
			watchlist: []
		};
	}
};

export const actions: Actions = {
	saveProfile: async ({ request, locals, cookies }) => {
		if (!locals.user) throw redirect(302, '/login');

		const data = await request.formData();
		const username = data.get('username')?.toString().trim() ?? '';

		const errors: Record<string, string> = {};

		if (username.length < 3 || username.length > 31) {
			errors.username = 'Display name must be 3–31 characters';
		} else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
			errors.username = 'Only letters, numbers, hyphens, and underscores';
		}

		if (!errors.username) {
			const existing = await db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.username, username.toLowerCase()))
				.get();
			if (existing && existing.id !== locals.user.id) {
				errors.username = 'That display name is already taken';
			}
		}

		if (errors.username) {
			return fail(400, { errors, username });
		}

		try {
			const newUsername = username.toLowerCase();
			await db.update(users).set({ username: newUsername }).where(eq(users.id, locals.user.id));

			cookies.set(
				createSessionCookieName(),
				encryptSession({
					userId: locals.user.id,
					username: newUsername,
					role: locals.user.role,
					expiresAt: Date.now() + 86400 * 1000 * 30
				}),
				getSessionCookieOptions()
			);

			return { success: true, username: newUsername };
		} catch (e) {
			console.error('Profile save failed:', e);
			return fail(500, { errors: { username: 'Save failed — please try again' }, username });
		}
	}
};
