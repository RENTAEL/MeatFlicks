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
 * Public poll endpoint for admin-triggered effects (jumpscare / pranks).
 * Callers identify themselves with either their session (logged-in) or a
 * `sid` query param (anonymous guest presence id). Only commands addressed
 * to this viewer — or to everyone — are returned.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const since = Number(url.searchParams.get('since') ?? '0') || 0;
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
		// it actually received, so targeted commands are never skipped.
		const latestId = matched.length > 0 ? matched[matched.length - 1].id : since;

		return json({ commands: matched, latestId });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
