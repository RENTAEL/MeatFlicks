import { db } from '$lib/server/db';
import {
	watchPartyRooms,
	watchPartyMembers,
	watchPartyMessages,
	watchPartyQueue
} from '$lib/server/db/schema';
import { and, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { NotFoundError, ForbiddenError } from '$lib/server';
import type {
	MediaTarget,
	RoomUser,
	RoomState,
	SoundEffect,
	PlaybackCommand,
	RoomQueueItem,
	ActiveSession
} from './types';
import { publishRoom } from './events';

export type { ActiveSession } from './types';

export const ROOM_INACTIVITY_MS = 30 * 60 * 1000;
export const MEMBER_TIMEOUT_MS = 120 * 1000;
export const PURGE_CLOSED_MS = 24 * 60 * 60 * 1000;
export const MAX_MESSAGE_LENGTH = 240;
export const INITIAL_MESSAGES = 50;

export const SOUND_EFFECTS: SoundEffect[] = ['suspense', 'jump', 'applause', 'boo'];

let lastCleanupRun = 0;

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function randomCode(length = CODE_LENGTH): string {
	let out = '';
	const bytes = new Uint8Array(length);
	const crypto = globalThis.crypto ?? (globalThis as { webcrypto?: Crypto }).webcrypto;
	if (crypto) {
		crypto.getRandomValues(bytes);
		for (let i = 0; i < length; i++) {
			out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
		}
	} else {
		for (let i = 0; i < length; i++) {
			out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
		}
	}
	return out;
}

async function generateRoomCode(): Promise<string> {
	for (let attempt = 0; attempt < 12; attempt++) {
		const id = randomCode();
		const existing = await db
			.select({ id: watchPartyRooms.id })
			.from(watchPartyRooms)
			.where(eq(watchPartyRooms.id, id))
			.get();
		if (!existing) return id;
	}
	throw new Error('Unable to allocate a room code');
}

async function cleanupExpired() {
	const now = Date.now();
	try {
		if (now - lastCleanupRun < 30_000) return;
		lastCleanupRun = now;
		const expired = await db
			.select({ id: watchPartyRooms.id })
			.from(watchPartyRooms)
			.where(
				and(
					isNull(watchPartyRooms.closedAt),
					sql`${watchPartyRooms.lastActivityAt} < ${now - ROOM_INACTIVITY_MS}`
				)
			)
			.all();
		for (const room of expired) {
			await closeRoomRows(room.id, now);
		}

		const veryOld = await db
			.select({ id: watchPartyRooms.id })
			.from(watchPartyRooms)
			.where(
				and(
					isNotNull(watchPartyRooms.closedAt),
					sql`${watchPartyRooms.closedAt} < ${now - PURGE_CLOSED_MS}`
				)
			)
			.all();
		for (const room of veryOld) {
			await db.delete(watchPartyMessages).where(eq(watchPartyMessages.roomId, room.id)).run();
			await db.delete(watchPartyQueue).where(eq(watchPartyQueue.roomId, room.id)).run();
			await db.delete(watchPartyRooms).where(eq(watchPartyRooms.id, room.id)).run();
		}
	} catch {
		// cleanup is best-effort
	}
}

async function closeRoomRows(roomId: string, at: number) {
	await db
		.update(watchPartyRooms)
		.set({ closedAt: at, lastActivityAt: at })
		.where(eq(watchPartyRooms.id, roomId))
		.run();
	await db.delete(watchPartyMembers).where(eq(watchPartyMembers.roomId, roomId)).run();
	await db.delete(watchPartyMessages).where(eq(watchPartyMessages.roomId, roomId)).run();
	await db.delete(watchPartyQueue).where(eq(watchPartyQueue.roomId, roomId)).run();
	publishRoom(roomId);
}

/**
 * Admin view over all live sessions — PURE reads, no side effects (unlike
 * getRoomState, which bumps activity and sweeps stale members).
 */
export async function listActiveSessions(): Promise<ActiveSession[]> {
	const now = Date.now();
	const rooms = await db
		.select()
		.from(watchPartyRooms)
		.where(isNull(watchPartyRooms.closedAt))
		.all();
	if (rooms.length === 0) return [];

	const memberCounts = await db
		.select({
			roomId: watchPartyMembers.roomId,
			count: sql<number>`count(*)`
		})
		.from(watchPartyMembers)
		.where(sql`${watchPartyMembers.lastSeenAt} >= ${now - MEMBER_TIMEOUT_MS}`)
		.groupBy(watchPartyMembers.roomId)
		.all();
	const countByRoom = new Map(memberCounts.map((m) => [m.roomId, Number(m.count)]));

	return rooms.map((room) => ({
		roomId: room.id,
		host: { userId: room.hostUserId, username: room.hostUsername },
		media: {
			title: room.title,
			mediaType: room.mediaType,
			tmdbId: room.tmdbId,
			season: room.season,
			episode: room.episode
		},
		provider: room.provider
			? { id: room.provider, name: room.providerName ?? room.provider }
			: null,
		playing: room.playing,
		position: room.position,
		positionAt: room.positionAt,
		seq: room.seq,
		members: countByRoom.get(room.id) ?? 0,
		createdAt: room.createdAt,
		lastActivityAt: room.lastActivityAt
	}));
}

/** Admin action: close/end a session immediately (same cleanup as host leave). */
export async function adminCloseRoom(roomId: string): Promise<boolean> {
	const room = await db
		.select({ id: watchPartyRooms.id })
		.from(watchPartyRooms)
		.where(eq(watchPartyRooms.id, roomId))
		.get();
	if (!room) return false;
	await closeRoomRows(roomId, Date.now());
	return true;
}

async function getRoomOrThrow(roomId: string) {
	await cleanupExpired();
	const room = await db.select().from(watchPartyRooms).where(eq(watchPartyRooms.id, roomId)).get();
	if (!room) {
		throw new NotFoundError('Watch party room not found');
	}
	return room;
}

function touchActivity(roomId: string) {
	return db
		.update(watchPartyRooms)
		.set({ lastActivityAt: Date.now() })
		.where(eq(watchPartyRooms.id, roomId))
		.run();
}

export function touchMemberActivity(roomId: string, userId: string) {
	return db
		.update(watchPartyMembers)
		.set({ lastSeenAt: Date.now() })
		.where(and(eq(watchPartyMembers.roomId, roomId), eq(watchPartyMembers.userId, userId)))
		.run();
}

export async function getQueueItems(roomId: string): Promise<RoomQueueItem[]> {
	const rows = await db
		.select()
		.from(watchPartyQueue)
		.where(eq(watchPartyQueue.roomId, roomId))
		.orderBy(watchPartyQueue.position)
		.all();
	return rows.map((r) => ({
		id: r.id,
		position: r.position,
		title: r.title,
		mediaType: r.mediaType as 'movie' | 'tv',
		tmdbId: r.tmdbId,
		season: r.season ?? undefined,
		episode: r.episode ?? undefined,
		provider: r.provider && r.providerName ? { id: r.provider, name: r.providerName } : null,
		addedBy: r.addedBy,
		addedAt: r.addedAt
	}));
}

async function renumberQueue(roomId: string) {
	const rows = await db
		.select({ id: watchPartyQueue.id, position: watchPartyQueue.position })
		.from(watchPartyQueue)
		.where(eq(watchPartyQueue.roomId, roomId))
		.orderBy(watchPartyQueue.position)
		.all();
	for (let i = 0; i < rows.length; i++) {
		if (rows[i].position !== i + 1) {
			await db
				.update(watchPartyQueue)
				.set({ position: i + 1 })
				.where(eq(watchPartyQueue.id, rows[i].id))
				.run();
		}
	}
}

export async function addToQueue(
	roomId: string,
	host: RoomUser,
	item: {
		mediaType: 'movie' | 'tv';
		tmdbId: number;
		season?: number;
		episode?: number;
		title: string;
		provider?: { id: string; name: string } | null;
	}
): Promise<void> {
	const room = await getRoomOrThrow(roomId);
	if (room.closedAt) return;
	if (room.hostUserId !== host.id) {
		throw new ForbiddenError('Only the host can manage the queue');
	}
	const now = Date.now();
	const maxPos = await db
		.select({ m: sql<number>`coalesce(max(${watchPartyQueue.position}), 0)` })
		.from(watchPartyQueue)
		.where(eq(watchPartyQueue.roomId, roomId))
		.get();
	await db
		.insert(watchPartyQueue)
		.values({
			roomId,
			position: (maxPos?.m ?? 0) + 1,
			title: item.title,
			mediaType: item.mediaType,
			tmdbId: item.tmdbId,
			season: item.season ?? null,
			episode: item.episode ?? null,
			provider: item.provider?.id ?? null,
			providerName: item.provider?.name ?? null,
			addedBy: host.username,
			addedAt: now
		})
		.run();
	await db
		.update(watchPartyRooms)
		.set({ seq: room.seq + 1, lastActivityAt: now })
		.where(eq(watchPartyRooms.id, roomId))
		.run();
	publishRoom(roomId);
}

export async function removeFromQueue(
	roomId: string,
	host: RoomUser,
	itemId: number
): Promise<void> {
	const room = await getRoomOrThrow(roomId);
	if (room.closedAt) return;
	if (room.hostUserId !== host.id) {
		throw new ForbiddenError('Only the host can manage the queue');
	}
	await db
		.delete(watchPartyQueue)
		.where(and(eq(watchPartyQueue.roomId, roomId), eq(watchPartyQueue.id, itemId)))
		.run();
	await renumberQueue(roomId);
	await db
		.update(watchPartyRooms)
		.set({ seq: room.seq + 1, lastActivityAt: Date.now() })
		.where(eq(watchPartyRooms.id, roomId))
		.run();
	publishRoom(roomId);
}

export async function reorderQueue(
	roomId: string,
	host: RoomUser,
	orderedIds: number[]
): Promise<void> {
	const room = await getRoomOrThrow(roomId);
	if (room.closedAt) return;
	if (room.hostUserId !== host.id) {
		throw new ForbiddenError('Only the host can manage the queue');
	}
	const rows = await db
		.select({ id: watchPartyQueue.id, position: watchPartyQueue.position })
		.from(watchPartyQueue)
		.where(eq(watchPartyQueue.roomId, roomId))
		.all();
	const byId = new Map(rows.map((r) => [r.id, r]));
	for (let i = 0; i < orderedIds.length; i++) {
		const row = byId.get(orderedIds[i]);
		if (row && row.position !== i + 1) {
			await db
				.update(watchPartyQueue)
				.set({ position: i + 1 })
				.where(eq(watchPartyQueue.id, row.id))
				.run();
		}
	}
	await db
		.update(watchPartyRooms)
		.set({ seq: room.seq + 1, lastActivityAt: Date.now() })
		.where(eq(watchPartyRooms.id, roomId))
		.run();
	publishRoom(roomId);
}

export async function advanceQueue(roomId: string, host: RoomUser): Promise<RoomQueueItem | null> {
	const room = await getRoomOrThrow(roomId);
	if (room.closedAt) return null;
	if (room.hostUserId !== host.id) {
		throw new ForbiddenError('Only the host can advance the queue');
	}
	const next = await db
		.select()
		.from(watchPartyQueue)
		.where(eq(watchPartyQueue.roomId, roomId))
		.orderBy(watchPartyQueue.position)
		.limit(1)
		.get();
	if (!next) return null;

	const now = Date.now();
	await db
		.delete(watchPartyQueue)
		.where(and(eq(watchPartyQueue.roomId, roomId), eq(watchPartyQueue.id, next.id)))
		.run();
	await renumberQueue(roomId);
	await db
		.update(watchPartyRooms)
		.set({
			title: next.title,
			mediaType: next.mediaType,
			tmdbId: next.tmdbId,
			season: next.season ?? null,
			episode: next.episode ?? null,
			playing: false,
			position: 0,
			positionAt: now,
			seq: room.seq + 1,
			lastActivityAt: now,
			provider: next.provider ?? null,
			providerName: next.providerName ?? null
		})
		.where(eq(watchPartyRooms.id, roomId))
		.run();
	publishRoom(roomId);
	return {
		id: next.id,
		position: next.position,
		title: next.title,
		mediaType: next.mediaType as 'movie' | 'tv',
		tmdbId: next.tmdbId,
		season: next.season ?? undefined,
		episode: next.episode ?? undefined,
		provider:
			next.provider && next.providerName ? { id: next.provider, name: next.providerName } : null,
		addedBy: next.addedBy,
		addedAt: next.addedAt
	};
}

export async function getRoomTick(roomId: string) {
	const row = await db
		.select({
			seq: watchPartyRooms.seq,
			soundSeq: watchPartyRooms.soundSeq,
			closedAt: watchPartyRooms.closedAt,
			lastMessageId: watchPartyRooms.lastMessageId
		})
		.from(watchPartyRooms)
		.where(eq(watchPartyRooms.id, roomId))
		.get();
	return row ?? null;
}

export async function createRoom(
	host: RoomUser,
	target: MediaTarget
): Promise<{ roomId: string; code: string }> {
	await cleanupExpired();
	const roomId = await generateRoomCode();
	const now = Date.now();

	await db
		.insert(watchPartyRooms)
		.values({
			id: roomId,
			hostUserId: host.id,
			hostUsername: host.username,
			title: target.title,
			mediaType: target.mediaType,
			tmdbId: target.tmdbId,
			season: target.season ?? null,
			episode: target.episode ?? null,
			playing: false,
			position: 0,
			positionAt: now,
			lastActivityAt: now,
			closedAt: null
		})
		.run();

	await db
		.insert(watchPartyMembers)
		.values({ roomId, userId: host.id, username: host.username, lastSeenAt: now, joinedAt: now })
		.run();

	return { roomId, code: roomId };
}

export async function joinRoom(roomId: string, user: RoomUser): Promise<void> {
	const room = await getRoomOrThrow(roomId);
	if (room.closedAt) return;

	const now = Date.now();
	const existing = await db
		.select({ userId: watchPartyMembers.userId })
		.from(watchPartyMembers)
		.where(and(eq(watchPartyMembers.roomId, roomId), eq(watchPartyMembers.userId, user.id)))
		.get();

	if (existing) {
		await db
			.update(watchPartyMembers)
			.set({ lastSeenAt: now, username: user.username })
			.where(and(eq(watchPartyMembers.roomId, roomId), eq(watchPartyMembers.userId, user.id)))
			.run();
	} else {
		await db
			.insert(watchPartyMembers)
			.values({ roomId, userId: user.id, username: user.username, lastSeenAt: now, joinedAt: now })
			.run();
	}
	await db
		.update(watchPartyRooms)
		.set({ kickedUserId: null, kickedByUsername: null, kickedAt: null })
		.where(and(eq(watchPartyRooms.id, roomId), eq(watchPartyRooms.kickedUserId, user.id)))
		.run();
	await touchActivity(roomId);
	publishRoom(roomId);
}

export async function getRoomState(
	roomId: string,
	viewer: RoomUser,
	opts?: { sinceMessageId?: number }
): Promise<RoomState> {
	const room = await getRoomOrThrow(roomId);
	const now = Date.now();

	if (room.closedAt || now - room.lastActivityAt > ROOM_INACTIVITY_MS) {
		return {
			closed: true,
			roomId,
			host: { userId: room.hostUserId, username: room.hostUsername },
			isHost: room.hostUserId === viewer.id,
			isMember: false,
			media: null,
			playback: { playing: false, position: 0, positionAt: 0, seq: room.seq, provider: null },
			sound: null,
			participants: [],
			lastMessageId: 0,
			messages: [],
			queue: [],
			kicked: null
		};
	}

	await touchActivity(roomId);

	const membership = await db
		.select()
		.from(watchPartyMembers)
		.where(and(eq(watchPartyMembers.roomId, roomId), eq(watchPartyMembers.userId, viewer.id)))
		.get();

	if (membership) {
		await db
			.update(watchPartyMembers)
			.set({ lastSeenAt: now })
			.where(and(eq(watchPartyMembers.roomId, roomId), eq(watchPartyMembers.userId, viewer.id)))
			.run();
	}

	await db
		.delete(watchPartyMembers)
		.where(
			and(
				eq(watchPartyMembers.roomId, roomId),
				ne(watchPartyMembers.userId, viewer.id),
				sql`${watchPartyMembers.lastSeenAt} < ${now - MEMBER_TIMEOUT_MS}`
			)
		)
		.run();

	const participants = await db
		.select({
			userId: watchPartyMembers.userId,
			username: watchPartyMembers.username,
			lastSeenAt: watchPartyMembers.lastSeenAt,
			joinedAt: watchPartyMembers.joinedAt,
			canControlSounds: watchPartyMembers.canControlSounds
		})
		.from(watchPartyMembers)
		.where(eq(watchPartyMembers.roomId, roomId))
		.orderBy(watchPartyMembers.joinedAt)
		.all();

	const since = opts?.sinceMessageId ?? 0;
	const nowMs = Date.now();
	const messages = await db
		.select({
			id: watchPartyMessages.id,
			userId: watchPartyMessages.userId,
			username: watchPartyMessages.username,
			body: watchPartyMessages.body,
			deleted: watchPartyMessages.deleted,
			createdAt: watchPartyMessages.createdAt
		})
		.from(watchPartyMessages)
		.where(
			and(
				eq(watchPartyMessages.roomId, roomId),
				sql`(${watchPartyMessages.id} > ${since} OR ${watchPartyMessages.deletedAt} > ${nowMs - 60_000})`
			)
		)
		.orderBy(sql`${watchPartyMessages.id} DESC`)
		.limit(200)
		.all();
	messages.reverse();

	return {
		closed: false,
		roomId,
		host: { userId: room.hostUserId, username: room.hostUsername },
		isHost: room.hostUserId === viewer.id,
		isMember: !!membership,
		media: {
			title: room.title,
			mediaType: room.mediaType as 'movie' | 'tv',
			tmdbId: room.tmdbId,
			season: room.season ?? undefined,
			episode: room.episode ?? undefined
		},
		playback: {
			playing: room.playing,
			position: room.position,
			positionAt: room.positionAt,
			seq: room.seq,
			provider:
				room.provider && room.providerName ? { id: room.provider, name: room.providerName } : null
		},
		sound: room.lastSound ? { effect: room.lastSound as SoundEffect, seq: room.soundSeq } : null,
		participants,
		lastMessageId: room.lastMessageId,
		messages,
		queue: await getQueueItems(roomId),
		kicked:
			room.kickedUserId === viewer.id && room.kickedAt
				? { by: room.kickedByUsername ?? 'the host', at: room.kickedAt }
				: null
	};
}

export async function updatePlayback(roomId: string, user: RoomUser, command: PlaybackCommand) {
	const room = await getRoomOrThrow(roomId);
	if (room.closedAt) return;
	if (room.hostUserId !== user.id) {
		throw new ForbiddenError('Only the host can control playback');
	}
	const now = Date.now();
	const position = command.position ?? room.position;
	const playing =
		command.action === 'pause' ? false : command.action === 'play' ? true : room.playing;
	const providerUpdate =
		command.provider !== undefined && command.provider !== null
			? { provider: command.provider.id, providerName: command.provider.name }
			: {};
	await db
		.update(watchPartyRooms)
		.set({
			position,
			positionAt: now,
			playing,
			seq: room.seq + 1,
			lastActivityAt: now,
			...providerUpdate
		})
		.where(eq(watchPartyRooms.id, roomId))
		.run();
	publishRoom(roomId);
}

export async function addMessage(roomId: string, user: RoomUser, input: { body: string }) {
	const room = await getRoomOrThrow(roomId);
	if (room.closedAt) return;
	const membership = await db
		.select({ userId: watchPartyMembers.userId })
		.from(watchPartyMembers)
		.where(and(eq(watchPartyMembers.roomId, roomId), eq(watchPartyMembers.userId, user.id)))
		.get();
	if (!membership) throw new NotFoundError('You must join the room before chatting');

	const body = input.body.trim().slice(0, MAX_MESSAGE_LENGTH);
	if (!body) throw new NotFoundError('Message is empty');

	const inserted = await db
		.insert(watchPartyMessages)
		.values({
			roomId,
			userId: user.id,
			username: user.username,
			body,
			deleted: false,
			createdAt: Date.now()
		})
		.returning({ id: watchPartyMessages.id })
		.get();

	const now = Date.now();
	await db
		.update(watchPartyRooms)
		.set({ lastMessageId: inserted.id, lastActivityAt: now, seq: room.seq + 1 })
		.where(eq(watchPartyRooms.id, roomId))
		.run();
	publishRoom(roomId);
}

export async function deleteMessage(roomId: string, user: RoomUser, messageId: number) {
	const room = await getRoomOrThrow(roomId);
	if (room.hostUserId !== user.id) {
		throw new ForbiddenError('Only the host can delete chat messages');
	}
	await db
		.update(watchPartyMessages)
		.set({ deleted: true, deletedAt: Date.now() })
		.where(and(eq(watchPartyMessages.roomId, roomId), eq(watchPartyMessages.id, messageId)))
		.run();
	await db
		.update(watchPartyRooms)
		.set({ seq: room.seq + 1 })
		.where(eq(watchPartyRooms.id, roomId))
		.run();
	publishRoom(roomId);
}

export async function kickMember(roomId: string, host: RoomUser, targetUserId: string) {
	const room = await getRoomOrThrow(roomId);
	if (room.hostUserId !== host.id) {
		throw new ForbiddenError('Only the host can kick members');
	}
	if (targetUserId === host.id) return;
	const now = Date.now();
	await db
		.delete(watchPartyMembers)
		.where(and(eq(watchPartyMembers.roomId, roomId), eq(watchPartyMembers.userId, targetUserId)))
		.run();
	await db
		.update(watchPartyRooms)
		.set({
			seq: room.seq + 1,
			kickedUserId: targetUserId,
			kickedByUsername: host.username,
			kickedAt: now,
			lastActivityAt: now
		})
		.where(eq(watchPartyRooms.id, roomId))
		.run();
	publishRoom(roomId, { type: 'kick', userId: targetUserId, by: host.username, at: now });
}

export async function leaveRoom(roomId: string, user: RoomUser) {
	const room = await getRoomOrThrow(roomId);
	const now = Date.now();
	await db
		.delete(watchPartyMembers)
		.where(and(eq(watchPartyMembers.roomId, roomId), eq(watchPartyMembers.userId, user.id)))
		.run();

	if (room.hostUserId === user.id) {
		await closeRoomRows(roomId, now);
		return { closedRoom: true };
	}
	await touchActivity(roomId);
	publishRoom(roomId);
	return { closedRoom: false };
}

export async function setSoundControl(
	roomId: string,
	host: RoomUser,
	targetUserId: string,
	granted: boolean
) {
	const room = await getRoomOrThrow(roomId);
	if (room.hostUserId !== host.id) {
		throw new ForbiddenError('Only the host can grant sound control');
	}
	if (targetUserId === host.id) return;
	const target = await db
		.select({ userId: watchPartyMembers.userId })
		.from(watchPartyMembers)
		.where(and(eq(watchPartyMembers.roomId, roomId), eq(watchPartyMembers.userId, targetUserId)))
		.get();
	if (!target) return;
	await db
		.update(watchPartyMembers)
		.set({ canControlSounds: granted })
		.where(and(eq(watchPartyMembers.roomId, roomId), eq(watchPartyMembers.userId, targetUserId)))
		.run();
	await db
		.update(watchPartyRooms)
		.set({ seq: room.seq + 1 })
		.where(eq(watchPartyRooms.id, roomId))
		.run();
	publishRoom(roomId);
}

export async function playSound(roomId: string, user: RoomUser, effect: SoundEffect) {
	const room = await getRoomOrThrow(roomId);
	if (room.closedAt) return;
	if (room.hostUserId !== user.id) {
		const membership = await db
			.select({ canControlSounds: watchPartyMembers.canControlSounds })
			.from(watchPartyMembers)
			.where(and(eq(watchPartyMembers.roomId, roomId), eq(watchPartyMembers.userId, user.id)))
			.get();
		if (!membership?.canControlSounds) {
			throw new ForbiddenError('Only the host or granted members can trigger sound effects');
		}
	}
	await db
		.update(watchPartyRooms)
		.set({ lastSound: effect, soundSeq: room.soundSeq + 1, lastActivityAt: Date.now() })
		.where(eq(watchPartyRooms.id, roomId))
		.run();
	publishRoom(roomId);
}

export async function getLatestSound(
	roomId: string
): Promise<{ effect: string; seq: number } | null> {
	const room = await db
		.select({ lastSound: watchPartyRooms.lastSound, soundSeq: watchPartyRooms.soundSeq })
		.from(watchPartyRooms)
		.where(eq(watchPartyRooms.id, roomId))
		.get();
	if (!room || !room.lastSound) return null;
	return { effect: room.lastSound, seq: room.soundSeq };
}
