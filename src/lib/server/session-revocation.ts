/**
 * Server-side session revocation — admin "end session" forces a real logout.
 *
 * Sessions are stateless encrypted cookies, so to revoke one we record the
 * user + timestamp here. Any session issued *before* the revocation is
 * treated as logged out, and a fresh login clears the revocation. Sessions
 * issued *after* a revocation (which requires a new login) stay valid.
 */

import { db } from './db';
import { sessionRevocations } from './db/schema';
import { eq } from 'drizzle-orm';

export async function revokeUserSessions(userId: string): Promise<void> {
	const now = Date.now();
	await db
		.insert(sessionRevocations)
		.values({ userId, revokedAt: now, createdAt: now })
		.onConflictDoUpdate({
			target: sessionRevocations.userId,
			set: { revokedAt: now }
		})
		.run();
}

export async function isUserSessionRevoked(userId: string, issuedAt: number): Promise<boolean> {
	const row = await db
		.select({ revokedAt: sessionRevocations.revokedAt })
		.from(sessionRevocations)
		.where(eq(sessionRevocations.userId, userId))
		.get();
	if (!row) return false;
	return issuedAt < row.revokedAt;
}

export async function clearUserRevocation(userId: string): Promise<void> {
	await db.delete(sessionRevocations).where(eq(sessionRevocations.userId, userId)).run();
}
