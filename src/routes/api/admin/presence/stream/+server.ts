import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { listActiveSessions, type ActiveSession } from '$lib/server/watch-party/service';
import { listPresence, type PresenceUser, type PresenceSnapshotUser } from '$lib/server/presence';
import { db } from '$lib/server/db';
import { watchPartyMembers, watchPartyRooms } from '$lib/server/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { subscribeAllRooms } from '$lib/server/watch-party/events';
import { errorHandler } from '$lib/server';

const REFRESH_MS = 15000;
const HEARTBEAT_MS = 15000;
// Admin-only stream, so volume is low, but each open connection still holds a
// 2GB Fluid instance for its whole lifetime. Half the hold, half the GB-Hrs.
const MAX_LIFETIME_MS = 25000;

export const config = { maxDuration: 30, memory: 256 };

type Snapshot = {
	users: PresenceSnapshotUser[];
	sessions: ActiveSession[];
	counts: { users: number; sessions: number };
	at: number;
};

const sessionSignature = (sessions: ActiveSession[]) =>
	sessions
		.map((s) => `${s.roomId}:${s.seq}:${s.playing}:${s.position}:${s.lastActivityAt}:${s.members}`)
		.join(',');
const userSignature = (users: PresenceUser[]) =>
	users.map((u) => `${u.userId}:${u.lastSeen}:${u.path ?? ''}:${u.title ?? ''}`).join(',');

async function buildSnapshot(): Promise<Snapshot> {
	const [sessions, users, members] = await Promise.all([
		listActiveSessions(),
		listPresence(),
		db
			.select({
				roomId: watchPartyMembers.roomId,
				userId: watchPartyMembers.userId,
				joinedAt: watchPartyMembers.joinedAt
			})
			.from(watchPartyMembers)
			.innerJoin(
				watchPartyRooms,
				and(eq(watchPartyMembers.roomId, watchPartyRooms.id), isNull(watchPartyRooms.closedAt))
			)
			.all()
	]);

	const roomById = new Map(sessions.map((s) => [s.roomId, s]));
	const membersByUser = new Map<string, { roomId: string; joinedAt: number }>();
	for (const m of members) {
		const existing = membersByUser.get(m.userId);
		if (!existing || existing.joinedAt > m.joinedAt) {
			membersByUser.set(m.userId, { roomId: m.roomId, joinedAt: m.joinedAt });
		}
	}

	const snapshotUsers: PresenceSnapshotUser[] = users.map((u) => {
		const membership = membersByUser.get(u.userId);
		const room = membership ? roomById.get(membership.roomId) : undefined;
		return {
			...u,
			roomId: membership?.roomId ?? null,
			roomTitle: room?.media.title ?? null,
			roomHost: room?.host.userId === u.userId,
			roomMemberSince: membership?.joinedAt ?? null
		};
	});

	return {
		users: snapshotUsers,
		sessions,
		counts: { users: users.length, sessions: sessions.length },
		at: Date.now()
	};
}

export const GET: RequestHandler = async ({ locals, request }) => {
	try {
		requireAdmin(locals);

		const encoder = new TextEncoder();
		let lastSignature = '';
		let pushInFlight = false;
		let settled = false;

		const stream = new ReadableStream({
			start(controller) {
				const send = (data: string) => {
					if (settled) return;
					try {
						controller.enqueue(encoder.encode(data));
					} catch {
						// stream closed
					}
				};

				const push = async () => {
					if (settled || pushInFlight) return;
					pushInFlight = true;
					try {
						const snapshot = await buildSnapshot();
						const signature = `${snapshot.counts.users}|${userSignature(snapshot.users)}|${snapshot.counts.sessions}|${sessionSignature(snapshot.sessions)}`;
						if (signature === lastSignature) return;
						lastSignature = signature;
						send(`event: presence\ndata: ${JSON.stringify(snapshot)}\n\n`);
					} catch {
						// keep the stream alive on transient errors
					} finally {
						pushInFlight = false;
					}
				};

				const unsubscribe = subscribeAllRooms(() => void push());

				// Presence + session heartbeats change without room events, so
				// poll on a short refresh and dedupe by signature.
				const refreshTimer = setInterval(() => void push(), REFRESH_MS);
				const heartbeatTimer = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
				// Route the lifetime cap through cleanup so the intervals are
				// cleared and the room subscription is released. Closing the
				// controller on its own left both timers armed and the global
				// listener registered, keeping the instance alive after the
				// stream had already ended.
				const timeout = setTimeout(() => cleanup(), MAX_LIFETIME_MS);

				const cleanup = () => {
					clearInterval(refreshTimer);
					clearInterval(heartbeatTimer);
					clearTimeout(timeout);
					unsubscribe();
					if (!settled) {
						settled = true;
						try {
							controller.close();
						} catch {
							// already closed
						}
					}
				};

				request.signal.addEventListener('abort', cleanup);

				void push();
			}
		});

		return new Response(stream, {
			headers: {
				'content-type': 'text/event-stream',
				'cache-control': 'no-cache, no-transform',
				connection: 'keep-alive'
			}
		});
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
