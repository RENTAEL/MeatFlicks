import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/watch-party/handlers';
import { db } from '$lib/server/db';
import { siteCommands } from '$lib/server/db/schema';
import { lt, sql } from 'drizzle-orm';
import { errorHandler } from '$lib/server';

const VALID_TYPES = new Set(['jumpscare', 'peekaboo', 'banana', 'surprise', 'ghosttyping']);
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
 * Fire an admin effect (jumpscare / prank) at a target.
 * Body: { type, targets: ('all' | 'auth' | 'user:<id>' | 'guest:<sessionId>')[] }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const admin = requireAdmin(locals);
		const body = (await request.json().catch(() => null)) as {
			type?: string;
			targets?: string[];
			seconds?: number;
		} | null;

		const type = body?.type ?? '';
		if (!VALID_TYPES.has(type)) {
			return json({ ok: false, error: 'Unknown effect type' }, { status: 400 });
		}

		const rawTargets = Array.isArray(body?.targets) ? body!.targets! : [];
		// Accept 'all' | 'auth' | 'user:<id>' | 'guest:<sid>' and bare presence
		// ids (raw user id or guest sid) as sent by the live session list.
		const targets = rawTargets
			.map((t): string | null => {
				if (typeof t !== 'string') return null;
				if (t === 'all' || t === 'auth') return t;
				if (/^(user|guest):[\w-]+$/.test(t)) return t;
				if (/^[\w-]+$/.test(t)) return `user:${t}`;
				return null;
			})
			.filter((t): t is string => t !== null)
			.slice(0, 50);
		if (targets.length === 0) {
			return json({ ok: false, error: 'No valid targets' }, { status: 400 });
		}

		// Optional per-effect payload — currently only ghost typing duration.
		const payload =
			type === 'ghosttyping'
				? JSON.stringify({
						seconds: Math.min(15, Math.max(3, Math.round(Number(body?.seconds) || 8)))
					})
				: null;

		const now = Date.now();
		await ensureTable();
		await db
			.delete(siteCommands)
			.where(lt(siteCommands.createdAt, now - COMMAND_TTL_MS))
			.run();

		await db
			.insert(siteCommands)
			.values(targets.map((target) => ({ type, target, payload, createdAt: now })))
			.run();

		return json({ ok: true, sent: targets.length, by: admin.username });
	} catch (error) {
		const { status, body } = errorHandler.handleError(error);
		return json(body, { status });
	}
};
