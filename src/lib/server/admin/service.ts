import { db } from '$lib/server/db';
import {
	schemaInfo,
	users,
	media,
	watchHistory,
	savedQuotes,
	watchPartyRooms
} from '$lib/server/db/schema';
import { sql, eq, isNull } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { invalidateCachePrefix } from '$lib/server/cache';
import { updateLastRefreshTime } from '$lib/server/utils';
import { ensureHomeLibraryPrimed } from '$lib/server/services/home-library-optimizer';
import { listActiveSessions } from '$lib/server/watch-party/service';

const FLAG_PREFIX = 'flag:';
const ANNOUNCEMENT_KEY = 'announcement';

export type FeatureFlagName = 'dqEnabled' | 'watchPartyEnabled';

const FLAG_DEFAULTS: Record<string, boolean> = {
	dqEnabled: true,
	watchPartyEnabled: true
};

export type AdminStats = {
	activeSessions: number;
	totalUsers: number;
	totalMedia: number;
	totalWatchHistory: number;
	totalSavedQuotes: number;
	openRooms: number;
	lastCatalogRefresh: number | null;
	uptimeSeconds: number;
	recentErrors: { at: number; message: string }[];
};

// In-memory ring of the most recent server errors, filled by the hooks
// handleError hook. Serverless instances are short-lived, so this is a
// "last little while on this instance" view — honest, zero-infra health info.
const recentErrors: { at: number; message: string }[] = [];
const MAX_RECENT_ERRORS = 20;

export function recordServerError(error: unknown) {
	try {
		const message = error instanceof Error ? error.message : String(error);
		recentErrors.unshift({ at: Date.now(), message: message.slice(0, 300) });
		if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.length = MAX_RECENT_ERRORS;
	} catch {
		// never let error tracking itself throw
	}
}

async function getSchemaValue(key: string): Promise<string | null> {
	const row = await db
		.select({ value: schemaInfo.value })
		.from(schemaInfo)
		.where(eq(schemaInfo.key, key))
		.get();
	return row?.value ?? null;
}

async function setSchemaValue(key: string, value: string) {
	await db
		.insert(schemaInfo)
		.values({ key, value })
		.onConflictDoUpdate({ target: schemaInfo.key, set: { value } })
		.run();
}

export async function refreshCatalog(): Promise<{ invalidated: number; durationMs: number }> {
	const startedAt = Date.now();
	await ensureHomeLibraryPrimed({ force: true });
	const invalidated =
		(await invalidateCachePrefix('media:trending')) + (await invalidateCachePrefix('media:genre'));
	await updateLastRefreshTime();
	return { invalidated, durationMs: Date.now() - startedAt };
}

export async function getSystemStats(): Promise<AdminStats> {
	const [userCount, mediaCount, historyCount, quoteCount, openRooms] = await Promise.all([
		db
			.select({ n: sql<number>`count(*)` })
			.from(users)
			.get(),
		db
			.select({ n: sql<number>`count(*)` })
			.from(media)
			.get(),
		db
			.select({ n: sql<number>`count(*)` })
			.from(watchHistory)
			.get(),
		db
			.select({ n: sql<number>`count(*)` })
			.from(savedQuotes)
			.get(),
		db
			.select({ n: sql<number>`count(*)` })
			.from(watchPartyRooms)
			.where(isNull(watchPartyRooms.closedAt))
			.get()
	]);

	let lastCatalogRefresh: number | null = null;
	try {
		const raw = await readFile('data/last-refresh.txt', 'utf8');
		const parsed = Number(raw.trim());
		if (Number.isFinite(parsed)) lastCatalogRefresh = parsed;
	} catch {
		// file may not exist (fresh deploy) — treat as unknown
	}

	return {
		activeSessions: (await listActiveSessions()).length,
		totalUsers: Number(userCount?.n ?? 0),
		totalMedia: Number(mediaCount?.n ?? 0),
		totalWatchHistory: Number(historyCount?.n ?? 0),
		totalSavedQuotes: Number(quoteCount?.n ?? 0),
		openRooms: Number(openRooms?.n ?? 0),
		lastCatalogRefresh,
		uptimeSeconds: Math.floor(process.uptime()),
		recentErrors: [...recentErrors]
	};
}

export type AnnouncementTarget = 'all' | 'auth' | string; // 'all' | 'auth' | 'user:<id>' | 'guest:<sessionId>'
export type Announcement = {
	text: string;
	at: number;
	by: string;
	target: AnnouncementTarget;
} | null;

export async function getAnnouncement(): Promise<Announcement> {
	const raw = await getSchemaValue(ANNOUNCEMENT_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as { text?: string; at?: number; by?: string; target?: string };
		if (!parsed.text) return null;
		return {
			text: parsed.text,
			at: parsed.at ?? Date.now(),
			by: parsed.by ?? 'unknown',
			target: parsed.target ?? 'all'
		};
	} catch {
		return null;
	}
}

export async function setAnnouncement(
	text: string,
	by: string,
	target: AnnouncementTarget = 'all'
): Promise<Announcement> {
	const clean = text.trim().slice(0, 280);
	if (!clean) throw new Error('Announcement text is required');
	const validTarget =
		target === 'all' || target === 'auth' || /^(user|guest):[\w-]+$/.test(target) ? target : 'all';
	const announcement: NonNullable<Announcement> = {
		text: clean,
		at: Date.now(),
		by,
		target: validTarget
	};
	await setSchemaValue(ANNOUNCEMENT_KEY, JSON.stringify(announcement));
	return announcement;
}

export async function clearAnnouncement(): Promise<void> {
	await db.delete(schemaInfo).where(eq(schemaInfo.key, ANNOUNCEMENT_KEY)).run();
}

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
	const rows = await db
		.select({ key: schemaInfo.key, value: schemaInfo.value })
		.from(schemaInfo)
		.where(sql`${schemaInfo.key} LIKE ${FLAG_PREFIX + '%'}`)
		.all();
	const flags: Record<string, boolean> = { ...FLAG_DEFAULTS };
	for (const row of rows) {
		const name = row.key.slice(FLAG_PREFIX.length);
		flags[name] = row.value === '1' || row.value === 'true';
	}
	return flags;
}

export async function setFeatureFlag(name: string, enabled: boolean): Promise<boolean> {
	if (name.startsWith(FLAG_PREFIX)) {
		throw new Error('Invalid flag name');
	}
	await setSchemaValue(FLAG_PREFIX + name, enabled ? '1' : '0');
	return enabled;
}
