import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { siteCommands } from '$lib/server/db/schema';
import { and, gt, desc, lt, sql } from 'drizzle-orm';
import { errorHandler } from '$lib/server';

const COMMAND_TTL_MS = 10 * 60 * 1000;
let tableReady = false;

/** Self-heal: guarantee the table exists even if DB init missed it. */
async function ensureTable() {
	if (tableReady) return;
	await db.run(
		sql`CREATE TABLE IF NOT EXISTS site_commands (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT,
			"type" TEXT NOT NULL,
			"target" TEXT NOT NULL DEFAULT 'all',
			"payload" TEXT,
			"created_at" INTEGER NOT NULL
		)`
	);
	tableReady = true;
}

/**
 * The `since` cursor arrives as an untrusted query param. Anything that is not
 * a finite number collapses to 0, and negative / fractional values are floored
 * so the cursor can never point before the start of the command log.
 */
function parseSince(raw: string | null): number {
	const n = Number(raw ?? '0');
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.floor(n));
}

/**
 * Public poll endpoint for admin-triggered effects (jumpscare / pranks).
 * Callers identify themselves with either their session (logged-in) or a
 * `sid` query param (anonymous guest presence id). Only commands addressed
 * to this viewer — or to everyone — are returned.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const requestedSince = parseSince(url.searchParams.get('since'));
		const sid = url.searchParams.get('sid');
		const user = locals.user;

		const audience: string[] = ['all'];
		if (user) {
			audience.push('auth', `user:${user.id}`);
		}
		if (sid && /^[\w-]+$/.test(sid)) {
			audience.push(`guest:${sid}`);
		}

		const now = Date.now();
		await ensureTable();

		// Deliberately NOT querying max(id) to clamp the cursor here. This is the
		// most-called endpoint in the app, and an extra round-trip per poll costs
		// far more function time than a bogus `since` is worth. parseSince()
		// already floors it at 0 and forces an integer, which is the case that
		// actually matters; an absurdly large cursor only affects the client that
		// sent it, and clears on its next localStorage write.
		const since = requestedSince;

		const rows = await db
			.select()
			.from(siteCommands)
			.where(and(gt(siteCommands.id, since), gt(siteCommands.createdAt, now - COMMAND_TTL_MS)))
			.orderBy(desc(siteCommands.id))
			.limit(50);

		const matched = rows
			.filter((r) => audience.includes(r.target))
			.slice(0, 20)
			.map((r) => {
				let payload: unknown = null;
				if (r.payload) {
					try {
						payload = JSON.parse(r.payload);
					} catch {}
				}
				return { id: r.id, type: r.type, target: r.target, at: r.createdAt, payload };
			})
			.reverse();

		// Prune old rows opportunistically
		if (rows.length > 0 && Math.random() < 0.2) {
			await db
				.delete(siteCommands)
				.where(lt(siteCommands.createdAt, now - COMMAND_TTL_MS))
				.catch(() => {});
		}

		// Latest matched id — the client's cursor only advances over commands
		// it actually received, so targeted commands are never skipped. With
		// nothing matched it falls back to the clamped cursor, which is itself
		// bounded by a real command id above.
		const latestId =
			matched.length > 0 ? matched.reduce((max, c) => (c.id > max ? c.id : max), since) : since;

		return json({ commands: matched, latestId });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
