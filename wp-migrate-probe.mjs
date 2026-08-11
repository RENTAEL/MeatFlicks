import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';

function envLine(file, key) {
	const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(key + '='));
	return line ? line.slice(key.length + 1).trim() : '';
}

const c = createClient({ url: envLine('.env', 'TURSO_DATABASE_URL'), authToken: envLine('.env', 'TURSO_AUTH_TOKEN') });

await c.execute(`CREATE TABLE IF NOT EXISTS watch_party_members_v2 (
	"room_id" TEXT NOT NULL REFERENCES watch_party_rooms("id") ON DELETE CASCADE,
	"user_id" TEXT NOT NULL,
	"username" TEXT NOT NULL,
	"last_seen_at" INTEGER NOT NULL DEFAULT ${Date.now()},
	"joined_at" INTEGER NOT NULL DEFAULT ${Date.now()},
	PRIMARY KEY ("room_id", "user_id")
)`);
await c.execute(
	`INSERT OR IGNORE INTO watch_party_members_v2 ("room_id","user_id","username","last_seen_at","joined_at")
	SELECT "room_id","user_id","username","last_seen_at","joined_at" FROM watch_party_members`
);
const oldName = (await c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='watch_party_members'")).rows.length;
if (oldName) {
	await c.execute(`ALTER TABLE watch_party_members RENAME TO watch_party_members_old`);
	await c.execute(`ALTER TABLE watch_party_members_v2 RENAME TO watch_party_members`);
	await c.execute('DROP TABLE IF EXISTS watch_party_members_old');
	await c.execute('CREATE INDEX IF NOT EXISTS idx_wp_members_user ON watch_party_members("user_id")');
	await c.execute('CREATE INDEX IF NOT EXISTS idx_wp_members_seen ON watch_party_members("last_seen_at")');
	console.log('migration applied');
} else {
	console.log('already migrated (members gone)');
}

const cols = await c.execute('PRAGMA table_info(watch_party_members)');
console.log('members columns:', cols.rows.map((r) => r.name).join(','));
const fks = await c.execute('PRAGMA foreign_key_list(watch_party_members)');
console.log('members FKs:', JSON.stringify(fks.rows));
process.exit(0);
