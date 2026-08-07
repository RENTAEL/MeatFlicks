import { z } from 'zod';
import { UnauthorizedError, NotFoundError } from '$lib/server';
import type { RoomUser } from './types';

export const roomIdSchema = z
	.string()
	.regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/, 'Invalid room code');

export function requireUser(locals: App.Locals): RoomUser {
	const user = locals.user;
	if (!user) throw new UnauthorizedError('You must be signed in');
	return { id: user.id, username: user.username };
}

export function roomIdFromParams(params: Record<string, string | undefined>): string {
	const parsed = roomIdSchema.safeParse(params.roomId);
	if (!parsed.success) throw new NotFoundError('Room not found');
	return parsed.data;
}

export function optionalUser(locals: App.Locals): RoomUser | null {
	return locals.user ? { id: locals.user.id, username: locals.user.username } : null;
}