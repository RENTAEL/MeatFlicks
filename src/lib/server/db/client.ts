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

const resolveDatabasePath = () => {
	let target = env.SQLITE_DB_PATH;
	if (process.env.VERCEL === '1') {
		target = '/tmp/streamium.db';
	}
	const absPath = isAbsolute(target) ? target : resolve(process.cwd(), target);
	return `file:${absPath}`;
};

const ensureDirectory = (dbPath: string) => {
	try {
		const folder = dirname(dbPath.replace(/^file:/, ''));
		mkdirSync(folder, { recursive: true });
	} catch {
	}
};

const runInitSql = async (client: Client) => {
	try {
		await client.execute('PRAGMA journal_mode = WAL');
		await client.execute('PRAGMA synchronous = NORMAL');
		await client.execute('PRAGMA cache_size = -64000');
		await client.execute('PRAGMA foreign_keys = ON');

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
		try { await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_media_id ON media("id")'); } catch {}
		try { await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_media_tmdbId ON media("tmdbId")'); } catch {}
		try { await client.execute('CREATE INDEX IF NOT EXISTS idx_media_rating ON media("rating")'); } catch {}
		try { await client.execute('CREATE INDEX IF NOT EXISTS idx_media_mediaType ON media("mediaType")'); } catch {}
		try { await client.execute('CREATE INDEX IF NOT EXISTS idx_media_popularity ON media("popularity")'); } catch {}
		try { await client.execute('CREATE INDEX IF NOT EXISTS idx_media_releaseDate ON media("releaseDate")'); } catch {}

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
		try { await client.execute('CREATE INDEX IF NOT EXISTS idx_media_genres_media ON media_genres("mediaId")'); } catch {}
		try { await client.execute('CREATE INDEX IF NOT EXISTS idx_media_genres_genre ON media_genres("genreId")'); } catch {}

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

		await client.execute('PRAGMA optimize');

		logger.info('Database initialization completed successfully');
	} catch (err) {
		logger.warn({ err }, 'Database init SQL warning (non-fatal)');
	}
};

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
	const url = resolveDatabasePath();
	ensureDirectory(url);
	const client = createClient({ url });
	client.execute('PRAGMA busy_timeout = 30000');
	runInitSql(client).catch((e) => logger.warn({ error: e }, 'Init SQL warning'));
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
