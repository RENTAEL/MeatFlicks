import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, watchlist, watchHistory, media } from '$lib/server/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const userId = locals.user.id;

	const user = await db.select({
		id: users.id,
		username: users.username,
		email: users.email,
		createdAt: users.createdAt
	}).from(users).where(eq(users.id, userId)).get();

	const watchlistCount = await db.select({
		count: sql<number>`count(*)`
	}).from(watchlist).where(eq(watchlist.userId, userId)).get();

	const historyCount = await db.select({
		count: sql<number>`count(*)`
	}).from(watchHistory).where(eq(watchHistory.userId, userId)).get();

	const recentHistory = await db.select({
		mediaId: media.id,
		title: media.title,
		posterPath: media.posterPath,
		mediaType: media.mediaType,
		watchedAt: watchHistory.watchedAt
	}).from(watchHistory)
		.innerJoin(media, eq(watchHistory.mediaId, media.id))
		.where(eq(watchHistory.userId, userId))
		.orderBy(desc(watchHistory.watchedAt))
		.limit(10).all();

	const watchlistPreview = await db.select({
		mediaId: media.id,
		title: media.title,
		posterPath: media.posterPath,
		mediaType: media.mediaType,
		addedAt: watchlist.addedAt
	}).from(watchlist)
		.innerJoin(media, eq(watchlist.mediaId, media.id))
		.where(eq(watchlist.userId, userId))
		.orderBy(desc(watchlist.addedAt))
		.limit(10).all();

	return {
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
			historyCount: historyCount?.count ?? 0
		},
		recentHistory,
		watchlistPreview
	};
};
