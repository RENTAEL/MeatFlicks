import { type Client, createClient } from '@libsql/client';
import { type LibSQLDatabase, drizzle } from 'drizzle-orm/libsql';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import * as schema from './schema';
import { logger } from '../logger';
import { env } from '../../config/env';
import { sql } from 'drizzle-orm';

let clientInstance: Client | null = null;
let dbInstance: LibSQLDatabase<typeof schema> | null = null;
let connectionAttempts = 0;
let initFailed = false;
const MAX_CONNECTION_ATTEMPTS = 1;

const isTurso = () => !!(process.env.TURSO_DATABASE_URL || env.TURSO_DATABASE_URL);

// Production hosts (Vercel/Netlify) MUST use Turso — the local file fallback
// would silently fork user data per host, breaking the shared-database
// guarantee between deployments. Local dev keeps the file fallback.
const isProductionHost = () =>
	process.env.NODE_ENV === 'production' ||
	process.env.VERCEL === '1' ||
	process.env.NETLIFY === 'true' ||
	process.env.CONTEXT === 'production';

const resolveDatabaseUrl = () => {
	if (isTurso()) {
		return process.env.TURSO_DATABASE_URL || env.TURSO_DATABASE_URL || '';
	}
	if (isProductionHost()) {
		throw new Error(
			'TURSO_DATABASE_URL is required in production — refusing to fall back to a local database (it would fork data per host).'
		);
	}
	let target = env.SQLITE_DB_PATH;
	if (process.env.VERCEL === '1') {
		target = '/tmp/streamium.db';
	}
	const absPath = isAbsolute(target) ? target : resolve(process.cwd(), target);
	return `file:${absPath}`;
};

const getAuthToken = () => {
	return process.env.TURSO_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || undefined;
};

const ensureDirectory = (dbPath: string) => {
	if (isTurso()) return;
	try {
		const folder = dirname(dbPath.replace(/^file:/, ''));
		mkdirSync(folder, { recursive: true });
	} catch {}
};

const runInitSql = async (client: Client) => {
	try {
		if (!isTurso()) {
			await client.execute('PRAGMA journal_mode = WAL');
			await client.execute('PRAGMA synchronous = NORMAL');
			await client.execute('PRAGMA cache_size = -64000');
			await client.execute('PRAGMA foreign_keys = ON');
		}

		await client.execute(`CREATE TABLE IF NOT EXISTS media (
			"numericId" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"id" TEXT NOT NULL,
			"tmdbId" INTEGER NOT NULL,
			"imdbId" TEXT, "title" TEXT NOT NULL,
			"overview" TEXT, "posterPath" TEXT, "backdropPath" TEXT,
			"releaseDate" TEXT, "rating" REAL, "durationMinutes" INTEGER,
			"is4K" INTEGER NOT NULL DEFAULT 0, "isHD" INTEGER NOT NULL DEFAULT 0,
			"language" TEXT, "popularity" REAL, "collectionId" INTEGER,
			"trailerUrl" TEXT, "canonicalPath" TEXT, "addedAt" INTEGER,
			"mediaType" TEXT NOT NULL DEFAULT 'movie',
			"streamingProviders" TEXT, "status" TEXT,
			"numberOfSeasons" INTEGER, "numberOfEpisodes" INTEGER,
			"productionCompanies" TEXT,
			"createdAt" INTEGER NOT NULL, "updatedAt" INTEGER NOT NULL
		)`);
		try {
			await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_media_id ON media("id")');
		} catch {}
		try {
			await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_media_tmdbId ON media("tmdbId")');
		} catch {}
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_presence_seen ON presence("lastSeenAt")'
			);
		} catch {}
		try {
			await client.execute('ALTER TABLE presence ADD COLUMN "disconnectedAt" INTEGER');
		} catch {}
		try {
			await client.execute('CREATE INDEX IF NOT EXISTS idx_media_mediaType ON media("mediaType")');
		} catch {}
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_media_popularity ON media("popularity")'
			);
		} catch {}
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_media_releaseDate ON media("releaseDate")'
			);
		} catch {}

		await client.execute(`CREATE TABLE IF NOT EXISTS genres (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"name" TEXT NOT NULL UNIQUE
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS collections (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"name" TEXT NOT NULL UNIQUE,
			"slug" TEXT NOT NULL UNIQUE,
			"description" TEXT
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS media_genres (
			"mediaId" TEXT NOT NULL REFERENCES media("id") ON DELETE CASCADE,
			"genreId" INTEGER NOT NULL REFERENCES genres("id") ON DELETE CASCADE,
			PRIMARY KEY ("mediaId", "genreId")
		)`);
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_media_genres_media ON media_genres("mediaId")'
			);
		} catch {}
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_media_genres_genre ON media_genres("genreId")'
			);
		} catch {}

		await client.execute(`CREATE TABLE IF NOT EXISTS people (
			"id" TEXT PRIMARY KEY NOT NULL,
			"tmdbId" INTEGER NOT NULL UNIQUE,
			"name" TEXT NOT NULL,
			"biography" TEXT,
			"birthday" TEXT,
			"deathday" TEXT,
			"placeOfBirth" TEXT,
			"profilePath" TEXT,
			"popularity" REAL,
			"knownForDepartment" TEXT,
			"createdAt" INTEGER NOT NULL,
			"updatedAt" INTEGER NOT NULL
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS media_people (
			"mediaId" TEXT NOT NULL REFERENCES media("id") ON DELETE CASCADE,
			"personId" TEXT NOT NULL REFERENCES people("id") ON DELETE CASCADE,
			"role" TEXT NOT NULL,
			"character" TEXT,
			"job" TEXT,
			"order" INTEGER,
			"createdAt" INTEGER NOT NULL,
			PRIMARY KEY ("mediaId", "personId", "role")
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS cache (
			"key" TEXT PRIMARY KEY NOT NULL,
			"data" TEXT NOT NULL,
			"expiresAt" INTEGER NOT NULL
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS schema_info (
			"key" TEXT PRIMARY KEY NOT NULL,
			"value" TEXT NOT NULL
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS presence (
			"userId" TEXT PRIMARY KEY NOT NULL,
			"username" TEXT NOT NULL,
			"path" TEXT,
			"title" TEXT,
			"joinedAt" INTEGER NOT NULL,
			"lastSeenAt" INTEGER NOT NULL
		)`);
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_presence_seen ON presence("lastSeenAt")'
			);
		} catch {}
		try {
			await client.execute('ALTER TABLE presence ADD COLUMN "playing" INTEGER');
		} catch {}

		await client.execute(`CREATE VIRTUAL TABLE IF NOT EXISTS movie_fts USING fts5(
			title, overview, content='media', content_rowid='numericId',
			tokenize='porter unicode61'
		)`);

		try {
			await client.execute('CREATE INDEX IF NOT EXISTS idx_media_numericId ON media("numericId")');
		} catch {}

		try {
			await client.execute("INSERT INTO movie_fts(movie_fts) VALUES('rebuild')");
		} catch (e) {
			logger.warn({ err: e }, 'FTS rebuild warning');
		}

		await client.execute(`CREATE TABLE IF NOT EXISTS users (
			"id" TEXT PRIMARY KEY NOT NULL,
			"username" TEXT NOT NULL UNIQUE,
			"password_hash" TEXT NOT NULL,
			"role" TEXT NOT NULL DEFAULT 'USER'
		)`);

		try {
			await client.execute(`ALTER TABLE users ADD COLUMN "email" TEXT`);
		} catch {}
		try {
			await client.execute(
				`ALTER TABLE users ADD COLUMN "created_at" INTEGER NOT NULL DEFAULT ${Date.now()}`
			);
		} catch {}

		await client.execute(`CREATE TABLE IF NOT EXISTS sessions (
			"id" TEXT PRIMARY KEY NOT NULL,
			"user_id" TEXT NOT NULL REFERENCES users("id"),
			"expires_at" INTEGER NOT NULL
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS session_revocations (
			"userId" TEXT PRIMARY KEY NOT NULL,
			"revokedAt" INTEGER NOT NULL,
			"createdAt" INTEGER NOT NULL
		)`);
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_session_revocations_revoked ON session_revocations("revokedAt")'
			);
		} catch {}

		await client.execute(`CREATE TABLE IF NOT EXISTS site_commands (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT,
			"type" TEXT NOT NULL,
			"target" TEXT NOT NULL DEFAULT 'all',
			"payload" TEXT,
			"createdAt" INTEGER NOT NULL
		)`);
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_site_commands_created ON site_commands("created_at")'
			);
		} catch {}

		await client.execute(`CREATE TABLE IF NOT EXISTS watchlist (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"userId" TEXT NOT NULL REFERENCES users("id") ON DELETE CASCADE,
			"mediaId" TEXT NOT NULL,
			"tmdbId" INTEGER,
			"mediaType" TEXT NOT NULL DEFAULT 'movie',
			"title" TEXT,
			"posterPath" TEXT,
			"year" TEXT,
			"addedAt" INTEGER NOT NULL,
			"folderId" INTEGER
		)`);
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_watchlist_userId ON watchlist("userId")'
			);
		} catch {}

		await client.execute(`CREATE TABLE IF NOT EXISTS watch_history (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"userId" TEXT NOT NULL REFERENCES users("id") ON DELETE CASCADE,
			"mediaId" TEXT NOT NULL,
			"tmdbId" INTEGER,
			"mediaType" TEXT NOT NULL DEFAULT 'movie',
			"season" INTEGER,
			"episode" INTEGER,
			"title" TEXT,
			"posterPath" TEXT,
			"progress" REAL DEFAULT 0,
			"duration" INTEGER DEFAULT 0,
			"watchedAt" INTEGER NOT NULL,
			"completed" INTEGER NOT NULL DEFAULT 0
		)`);
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_watch_history_userId ON watch_history("userId")'
			);
		} catch {}
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_watch_history_mediaId ON watch_history("mediaId")'
			);
		} catch {}

		await client.execute(`CREATE TABLE IF NOT EXISTS playback_progress (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"userId" TEXT NOT NULL REFERENCES users("id") ON DELETE CASCADE,
			"tmdbId" TEXT NOT NULL,
			"mediaType" TEXT NOT NULL,
			"progress" REAL DEFAULT 0,
			"duration" INTEGER DEFAULT 0,
			"season" INTEGER,
			"episode" INTEGER,
			"updatedAt" INTEGER NOT NULL
		)`);
		try {
			await client.execute(
				'CREATE UNIQUE INDEX IF NOT EXISTS idx_playback_progress_unique ON playback_progress("userId", "tmdbId", "mediaType")'
			);
		} catch {}

		await client.execute(`CREATE TABLE IF NOT EXISTS search_history (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"userId" TEXT NOT NULL REFERENCES users("id") ON DELETE CASCADE,
			"query" TEXT NOT NULL,
			"searchedAt" INTEGER NOT NULL
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS watchlist_folders (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"userId" TEXT NOT NULL REFERENCES users("id") ON DELETE CASCADE,
			"name" TEXT NOT NULL,
			"createdAt" INTEGER NOT NULL
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS watchlist_tags (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"userId" TEXT NOT NULL REFERENCES users("id") ON DELETE CASCADE,
			"name" TEXT NOT NULL,
			"createdAt" INTEGER NOT NULL
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS watchlist_item_tags (
			"watchlistId" INTEGER NOT NULL REFERENCES watchlist("id") ON DELETE CASCADE,
			"tagId" INTEGER NOT NULL REFERENCES watchlist_tags("id") ON DELETE CASCADE,
			PRIMARY KEY ("watchlistId", "tagId")
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS watch_party_rooms (
			"id" TEXT PRIMARY KEY NOT NULL,
			"host_user_id" TEXT NOT NULL,
			"host_username" TEXT NOT NULL,
			"title" TEXT NOT NULL,
			"media_type" TEXT NOT NULL,
			"tmdb_id" INTEGER NOT NULL,
			"season" INTEGER,
			"episode" INTEGER,
			"playing" INTEGER NOT NULL DEFAULT 0,
			"position" REAL NOT NULL DEFAULT 0,
			"position_at" INTEGER NOT NULL DEFAULT ${Date.now()},
			"seq" INTEGER NOT NULL DEFAULT 0,
			"last_sound" TEXT,
			"sound_seq" INTEGER NOT NULL DEFAULT 0,
			"last_message_id" INTEGER NOT NULL DEFAULT 0,
			"last_activity_at" INTEGER NOT NULL DEFAULT ${Date.now()},
			"closed_at" INTEGER,
			"created_at" INTEGER NOT NULL DEFAULT ${Date.now()},
			"provider" TEXT,
			"provider_name" TEXT
		)`);
		try {
			await client.execute('ALTER TABLE watch_party_rooms ADD COLUMN "provider" TEXT');
		} catch {}
		try {
			await client.execute('ALTER TABLE watch_party_rooms ADD COLUMN "provider_name" TEXT');
		} catch {}
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_wp_rooms_host ON watch_party_rooms("host_user_id")'
			);
		} catch {}
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_wp_rooms_activity ON watch_party_rooms("last_activity_at")'
			);
		} catch {}
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_wp_rooms_closed ON watch_party_rooms("closed_at")'
			);
		} catch {}

		await client.execute(`CREATE TABLE IF NOT EXISTS watch_party_members (
			"room_id" TEXT NOT NULL REFERENCES watch_party_rooms("id") ON DELETE CASCADE,
			"user_id" TEXT NOT NULL,
			"username" TEXT NOT NULL,
			"last_seen_at" INTEGER NOT NULL DEFAULT ${Date.now()},
			"joined_at" INTEGER NOT NULL DEFAULT ${Date.now()},
			"can_control_sounds" INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY ("room_id", "user_id")
		)`);
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_wp_members_user ON watch_party_members("user_id")'
			);
		} catch {}
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_wp_members_seen ON watch_party_members("last_seen_at")'
			);
		} catch {}
		try {
			const memberTable = await client.execute(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='watch_party_members'"
			);
			if (memberTable.rows.length > 0) {
				const memberFks = await client.execute('PRAGMA foreign_key_list(watch_party_members)');
				const hasUsersFk = memberFks.rows.some((r) => String(r.table) === 'users');
				if (hasUsersFk) {
					await client.execute(`CREATE TABLE IF NOT EXISTS watch_party_members_v2 (
						"room_id" TEXT NOT NULL REFERENCES watch_party_rooms("id") ON DELETE CASCADE,
						"user_id" TEXT NOT NULL,
						"username" TEXT NOT NULL,
						"last_seen_at" INTEGER NOT NULL DEFAULT ${Date.now()},
						"joined_at" INTEGER NOT NULL DEFAULT ${Date.now()},
						PRIMARY KEY ("room_id", "user_id")
					)`);
					await client.execute(
						`INSERT OR IGNORE INTO watch_party_members_v2 ("room_id","user_id","username","last_seen_at","joined_at")
						SELECT "room_id","user_id","username","last_seen_at","joined_at" FROM watch_party_members`
					);
					try {
						await client.execute(
							`INSERT OR IGNORE INTO watch_party_members_v2 ("room_id","user_id","username","last_seen_at","joined_at")
							SELECT "room_id","user_id","username","last_seen_at","joined_at" FROM watch_party_members_old`
						);
					} catch {}
					await client.execute('DROP TABLE watch_party_members');
					await client.execute('ALTER TABLE watch_party_members_v2 RENAME TO watch_party_members');
					await client.execute('DROP TABLE IF EXISTS watch_party_members_old');
					await client.execute(
						'CREATE INDEX IF NOT EXISTS idx_wp_members_user ON watch_party_members("user_id")'
					);
					await client.execute(
						'CREATE INDEX IF NOT EXISTS idx_wp_members_seen ON watch_party_members("last_seen_at")'
					);
				} else {
					await client.execute('DROP TABLE IF EXISTS watch_party_members_old');
					await client.execute('DROP TABLE IF EXISTS watch_party_members_v2');
				}
			}
		} catch {}

		try {
			await client.execute(
				'ALTER TABLE watch_party_members ADD COLUMN "can_control_sounds" INTEGER NOT NULL DEFAULT 0'
			);
		} catch {}

		await client.execute(`CREATE TABLE IF NOT EXISTS watch_party_messages (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"room_id" TEXT NOT NULL REFERENCES watch_party_rooms("id") ON DELETE CASCADE,
			"user_id" TEXT NOT NULL,
			"username" TEXT NOT NULL,
			"body" TEXT NOT NULL,
			"deleted" INTEGER NOT NULL DEFAULT 0,
			"deleted_at" INTEGER,
			"created_at" INTEGER NOT NULL DEFAULT ${Date.now()}
		)`);
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_wp_messages_room ON watch_party_messages("room_id", "created_at")'
			);
		} catch {}
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_wp_messages_user ON watch_party_messages("user_id")'
			);
		} catch {}
		try {
			await client.execute('ALTER TABLE watch_party_messages ADD COLUMN "deleted_at" INTEGER');
		} catch {}

		await client.execute(`CREATE TABLE IF NOT EXISTS watch_party_queue (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"room_id" TEXT NOT NULL REFERENCES watch_party_rooms("id") ON DELETE CASCADE,
			"position" INTEGER NOT NULL,
			"title" TEXT NOT NULL,
			"media_type" TEXT NOT NULL,
			"tmdb_id" INTEGER NOT NULL,
			"season" INTEGER,
			"episode" INTEGER,
			"provider" TEXT,
			"provider_name" TEXT,
			"added_by" TEXT NOT NULL,
			"added_at" INTEGER NOT NULL DEFAULT ${Date.now()}
		)`);
		try {
			await client.execute(
				'CREATE INDEX IF NOT EXISTS idx_wp_queue_room ON watch_party_queue("room_id")'
			);
		} catch {}

		await client.execute(`CREATE TABLE IF NOT EXISTS seasons (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"tmdbId" INTEGER NOT NULL,
			"showTmdbId" INTEGER NOT NULL,
			"seasonNumber" INTEGER NOT NULL,
			"name" TEXT,
			"overview" TEXT,
			"posterPath" TEXT,
			"airDate" TEXT,
			"episodeCount" INTEGER DEFAULT 0
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS episodes (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"tmdbId" INTEGER NOT NULL,
			"showTmdbId" INTEGER NOT NULL,
			"seasonNumber" INTEGER NOT NULL,
			"episodeNumber" INTEGER NOT NULL,
			"name" TEXT,
			"overview" TEXT,
			"stillPath" TEXT,
			"airDate" TEXT,
			"runtime" INTEGER
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS episode_watch_status (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"userId" TEXT NOT NULL REFERENCES users("id") ON DELETE CASCADE,
			"tmdbId" INTEGER NOT NULL,
			"seasonNumber" INTEGER NOT NULL,
			"episodeNumber" INTEGER NOT NULL,
			"completed" INTEGER NOT NULL DEFAULT 0,
			"updatedAt" INTEGER NOT NULL
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS season_watch_status (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"userId" TEXT NOT NULL REFERENCES users("id") ON DELETE CASCADE,
			"tmdbId" INTEGER NOT NULL,
			"seasonNumber" INTEGER NOT NULL,
			"episodesWatched" INTEGER DEFAULT 0,
			"totalEpisodes" INTEGER DEFAULT 0,
			"updatedAt" INTEGER NOT NULL
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS tv_show_watch_status (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			"userId" TEXT NOT NULL REFERENCES users("id") ON DELETE CASCADE,
			"tmdbId" INTEGER NOT NULL,
			"seasonsWatched" INTEGER DEFAULT 0,
			"totalSeasons" INTEGER DEFAULT 0,
			"updatedAt" INTEGER NOT NULL
		)`);

		await client.execute(`CREATE TABLE IF NOT EXISTS saved_quotes (
			"id" TEXT PRIMARY KEY,
			"userId" TEXT NOT NULL REFERENCES users("id") ON DELETE CASCADE,
			"quoteText" TEXT NOT NULL,
			"quoteAuthor" TEXT NOT NULL DEFAULT 'Unknown',
			"category" TEXT NOT NULL DEFAULT 'general',
			"createdAt" INTEGER NOT NULL
		)`);
		await client.execute(
			`CREATE INDEX IF NOT EXISTS "idx_saved_quotes_user" ON saved_quotes ("userId")`
		);
		await client.execute(
			`CREATE INDEX IF NOT EXISTS "idx_saved_quotes_created" ON saved_quotes ("createdAt")`
		);

		if (!isTurso()) {
			await client.execute('PRAGMA optimize');
		}

		logger.info('Database initialization completed successfully');
	} catch (err) {
		logger.warn({ err }, 'Database init SQL warning (non-fatal)');
	}
};

// Initialize database eagerly before any module imports complete
const initUrl = resolveDatabaseUrl();
ensureDirectory(initUrl);
const initClient = createClient({
	url: initUrl,
	authToken: isTurso() ? getAuthToken() : undefined
});
await runInitSql(initClient);
await initClient.close();

export const runMaintenance = async () => {
	if (!clientInstance) return;
	try {
		logger.info('Starting database maintenance...');
		await clientInstance.execute('PRAGMA optimize');
		await clientInstance.execute('PRAGMA wal_checkpoint(TRUNCATE)');
		logger.info('Database maintenance completed.');
	} catch (error) {
		logger.error({ error }, 'Database maintenance failed');
	}
};

const createDatabaseClient = (): Client => {
	if (initFailed) throw new Error('Previous DB init failed');
	const url = resolveDatabaseUrl();
	ensureDirectory(url);
	const client = createClient({ url, authToken: isTurso() ? getAuthToken() : undefined });
	if (!isTurso()) {
		client.execute('PRAGMA busy_timeout = 30000');
		client.execute('PRAGMA journal_mode = WAL');
		client.execute('PRAGMA synchronous = NORMAL');
		client.execute('PRAGMA cache_size = -64000');
		client.execute('PRAGMA foreign_keys = ON');
	}
	return client;
};

export function getClient(): Client {
	if (clientInstance) return clientInstance;
	if (initFailed) throw new Error('DB unavailable');

	while (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
		try {
			connectionAttempts++;
			clientInstance = createDatabaseClient();
			connectionAttempts = 0;
			return clientInstance;
		} catch (error) {
			initFailed = true;
			logger.error({ error }, 'DB init failed, will be unavailable');
			throw error;
		}
	}
	throw new Error('DB unavailable');
}

export function getDB(): LibSQLDatabase<typeof schema> {
	if (dbInstance) return dbInstance;
	const c = getClient();
	dbInstance = drizzle(c, { schema });
	return dbInstance;
}

export const executeWithRetry = async <T>(
	operation: () => Promise<T>,
	maxAttempts: number = 1,
	delay: number = 1000
): Promise<T> => {
	return await operation();
};

export const checkDatabaseHealth = async (): Promise<boolean> => {
	try {
		const db = getDB();
		await db.all(sql`SELECT 1`);
		return true;
	} catch {
		return false;
	}
};

export function isDbReady(): boolean {
	return clientInstance !== null && !initFailed;
}

import { createDbProxy } from './db-proxy';

const { client, db, sqlite } = createDbProxy(getClient, getDB);
export { client, db, sqlite };
export default db;
