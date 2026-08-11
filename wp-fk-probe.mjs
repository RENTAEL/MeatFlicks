import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';

function envLine(file, key) {
	const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(key + '='));
	return line ? line.slice(key.length + 1).trim() : '';
}

const url = envLine('.env', 'TURSO_DATABASE_URL');
const token = envLine('.env', 'TURSO_AUTH_TOKEN');

const c = createClient({ url, authToken: token });

const fk = await c.execute('PRAGMA foreign_keys');
console.log('foreign_keys:', JSON.stringify(fk.rows));

const users = await c.execute('SELECT id FROM users WHERE id IN (\'user-a\', \'user-b\', \'user-c\') LIMIT 5');
console.log('forged users present:', JSON.stringify(users.rows));

const anyUser = await c.execute('SELECT id, username FROM users LIMIT 3');
console.log('sample users:', JSON.stringify(anyUser.rows));

const tables = await c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'watch_party%'");
console.log('wp tables:', JSON.stringify(tables.rows));

try {
	await c.execute("INSERT INTO watch_party_rooms (id, host_user_id, host_username, title, media_type, tmdb_id, playing, position, position_at, seq, sound_seq, last_message_id, last_activity_at, closed_at, created_at) VALUES ('TESTROOM', 'user-a', 'Hosty', 'Test', 'movie', 550, 0, 0, 0, 0, 0, 0, 0, NULL, 0)");
	console.log('room insert OK');
} catch (e) {
	console.log('room insert FAILED:', e.message);
}
try {
	await c.execute("INSERT INTO watch_party_members (room_id, user_id, username, last_seen_at, joined_at) VALUES ('TESTROOM', 'user-a', 'Hosty', 0, 0)");
	console.log('member insert OK');
} catch (e) {
	console.log('member insert FAILED:', e.message);
}
await c.execute("DELETE FROM watch_party_rooms WHERE id = 'TESTROOM'");
console.log('cleaned up');
process.exit(0);
