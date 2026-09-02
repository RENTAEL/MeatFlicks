/**
 * Server-side presence registry — who's online right now.
 *
 * Logged-in clients send a heartbeat (POST /api/presence/heartbeat) every
 * ~60s while the app is open and visible, carrying their current page. Entries
 * that go silent past STALE_MS are pruned, so the list reflects live
 * connections — a backgrounded tab drops off and re-registers on return.
 *
 * Heartbeats are persisted to the DB so the list survives serverless
 * instance shuffling — the admin live view reads the same rows regardless
 * of which instance it runs on.
 */

import { db } from './db';
import { presence } from './db/schema';
import { eq, lt, sql, or, and, like, gt } from 'drizzle-orm';

export type PresenceUser = {
	userId: string;
	username: string;
	joinedAt: number;
	lastSeen: number;
	path: string | null;
	title: string | null;
	playing: boolean | null;
};

export type PresenceSnapshotUser = PresenceUser & {
	roomId: string | null;
	roomTitle: string | null;
	roomHost: boolean;
	roomMemberSince: number | null;
};

// Logged-in presence: the client heartbeat is 60s (and pauses on hidden tabs),
// so 150s still tolerates one missed beat before prune.
const STALE_MS = 150_000;
// Guest presence: heartbeat is 120s, so tolerate ~2 missed beats (240s) to
// avoid pruning a still-active guest mid-interval (flickers the admin list and
// can drop a pending kick signal). Guest-kick lag ~4 min max.
const GUEST_STALE_MS = 240_000;
const GUEST_LIKE = 'guest:%';

async function prune() {
	const cutoff = Date.now() - STALE_MS;
	const guestCutoff = Date.now() - GUEST_STALE_MS;
	try {
		await db
			.delete(presence)
			.where(
				or(
					and(like(presence.userId, GUEST_LIKE), lt(presence.lastSeenAt, guestCutoff)),
					lt(presence.lastSeenAt, cutoff)
				)
			)
			.run();
	} catch {
		// pruning is best-effort
	}
}
// No module-level prune interval: an always-on timer keeps every warm
// serverless instance doing DB work forever (Fluid bills that CPU). Pruning
// happens lazily when the admin list is actually read (listPresence).

export async function touchPresence(
	userId: string,
	username: string,
	info: { path?: string | null; title?: string | null; playing?: boolean | null }
): Promise<PresenceUser> {
	const now = Date.now();
	const playing = typeof info.playing === 'boolean' ? (info.playing ? 1 : 0) : null;
	await db
		.insert(presence)
		.values({
			userId,
			username,
			path: info.path ?? null,
			title: info.title ?? null,
			joinedAt: now,
			lastSeenAt: now,
			playing: playing === null ? undefined : playing
		})
		.onConflictDoUpdate({
			target: presence.userId,
			set: {
				username,
				path: info.path ?? undefined,
				title: info.title ?? undefined,
				lastSeenAt: now,
				playing: playing === null ? undefined : playing
			}
		})
		.run();
	return {
		userId,
		username,
		joinedAt: now,
		lastSeen: now,
		path: info.path ?? null,
		title: info.title ?? null,
		playing: playing === null ? null : playing === 1
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
	const guestCutoff = Date.now() - GUEST_STALE_MS;
	const rows = await db
		.select({
			userId: presence.userId,
			username: presence.username,
			path: presence.path,
			title: presence.title,
			joinedAt: presence.joinedAt,
			lastSeen: presence.lastSeenAt,
			playing: presence.playing
		})
		.from(presence)
		.where(
			or(
				and(like(presence.userId, GUEST_LIKE), gt(presence.lastSeenAt, guestCutoff)),
				gt(presence.lastSeenAt, cutoff)
			)
		)
		.all();
	return rows
		.map((r) => ({ ...r, playing: r.playing === null || r.playing === undefined ? null : !!r.playing }))
		.sort((a, b) => a.joinedAt - b.joinedAt);
}

export async function presenceCount(): Promise<number> {
	const rows = await listPresence();
	return rows.length;
}
