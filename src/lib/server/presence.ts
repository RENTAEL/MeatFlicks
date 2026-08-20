/**
 * Server-side presence registry — who's online right now.
 *
 * Logged-in clients send a heartbeat (POST /api/presence/heartbeat) every
 * ~25s while the app is open, carrying their current page. Entries that go
 * silent past STALE_MS are pruned, so the list reflects live connections.
 *
 * Heartbeats are persisted to the DB so the list survives serverless
 * instance shuffling — the admin live view reads the same rows regardless
 * of which instance it runs on.
 */

import { db } from './db';
import { presence } from './db/schema';
import { eq, lt, sql } from 'drizzle-orm';

export type PresenceUser = {
	userId: string;
	username: string;
	joinedAt: number;
	lastSeen: number;
	path: string | null;
	title: string | null;
};

export type PresenceSnapshotUser = PresenceUser & {
	roomId: string | null;
	roomTitle: string | null;
	roomHost: boolean;
	roomMemberSince: number | null;
};

const STALE_MS = 70_000;
const PRUNE_INTERVAL_MS = 20_000;

const globalTimerKey = '__presencePruner';
const globalTimers = globalThis as typeof globalThis & { [globalTimerKey]?: NodeJS.Timeout };

async function prune() {
	const cutoff = Date.now() - STALE_MS;
	try {
		await db.delete(presence).where(lt(presence.lastSeenAt, cutoff)).run();
	} catch {
		// pruning is best-effort
	}
}

if (!globalTimers[globalTimerKey]) {
	globalTimers[globalTimerKey] = setInterval(() => void prune(), PRUNE_INTERVAL_MS);
}

export async function touchPresence(
	userId: string,
	username: string,
	info: { path?: string | null; title?: string | null }
): Promise<PresenceUser> {
	const now = Date.now();
	await db
		.insert(presence)
		.values({
			userId,
			username,
			path: info.path ?? null,
			title: info.title ?? null,
			joinedAt: now,
			lastSeenAt: now
		})
		.onConflictDoUpdate({
			target: presence.userId,
			set: {
				username,
				path: info.path ?? undefined,
				title: info.title ?? undefined,
				lastSeenAt: now
			}
		})
		.run();
	return {
		userId,
		username,
		joinedAt: now,
		lastSeen: now,
		path: info.path ?? null,
		title: info.title ?? null
	};
}

export async function leavePresence(userId: string): Promise<boolean> {
	const rows = await db.delete(presence).where(eq(presence.userId, userId)).run();
	return rows.rowsAffected > 0;
}

/** Admin kicked this user — write the signal their live stream polls for. */
export async function signalDisconnect(userId: string): Promise<void> {
	await db
		.update(presence)
		.set({ disconnectedAt: Date.now() })
		.where(eq(presence.userId, userId))
		.run();
}

/** Read (and consume) the disconnect signal for a live presence stream. */
export async function readDisconnectSignal(userId: string): Promise<number | null> {
	const row = await db
		.select({ disconnectedAt: presence.disconnectedAt })
		.from(presence)
		.where(eq(presence.userId, userId))
		.get();
	if (!row?.disconnectedAt) return null;
	return row.disconnectedAt;
}

export async function listPresence(): Promise<PresenceUser[]> {
	await prune();
	const cutoff = Date.now() - STALE_MS;
	const rows = await db
		.select({
			userId: presence.userId,
			username: presence.username,
			path: presence.path,
			title: presence.title,
			joinedAt: presence.joinedAt,
			lastSeen: presence.lastSeenAt
		})
		.from(presence)
		.where(sql`${presence.lastSeenAt} > ${cutoff}`)
		.all();
	return rows.sort((a, b) => a.joinedAt - b.joinedAt);
}

export async function presenceCount(): Promise<number> {
	const rows = await listPresence();
	return rows.length;
}
