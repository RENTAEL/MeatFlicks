import { type Client } from '@libsql/client';
import { type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';
import { logger } from '../logger';

function createSafeHandler<T extends object>(
	getInstance: () => T,
	name: string
): ProxyHandler<T> {
	return {
		get(_, prop: string | symbol) {
			try {
				const instance = getInstance();
				const value = (instance as any)[prop];
				if (typeof value === 'function') {
					return (...args: any[]) => {
						try {
							const inst = getInstance();
							return (inst as any)[prop](...args);
						} catch (e) {
							logger.error({ error: e, prop: String(prop), module: name }, 'DB operation failed');
							throw e;
						}
					};
				}
				return value;
			} catch (e) {
				logger.error({ error: e, prop: String(prop), module: name }, 'DB access failed (will retry on next call)');
				throw e;
			}
		}
	};
}

export function createDbProxy(
	getClient: () => Client,
	getDB: () => LibSQLDatabase<typeof schema>
) {
	const client = new Proxy<Client>({} as Client, createSafeHandler(getClient, 'client'));
	const db = new Proxy<LibSQLDatabase<typeof schema>>(
		{} as LibSQLDatabase<typeof schema>,
		createSafeHandler(getDB, 'db')
	);
	const sqlite = client;
	return { client, db, sqlite };
}
