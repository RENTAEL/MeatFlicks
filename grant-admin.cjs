const { createClient } = require('@libsql/client');
const fs = require('fs');
const env = Object.fromEntries(
	fs
		.readFileSync('.env', 'utf8')
		.split(/\r?\n/)
		.filter((l) => l && !l.startsWith('#'))
		.map((l) => {
			const i = l.indexOf('=');
			return [l.slice(0, i), l.slice(i + 1)];
		})
);
const t = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

(async () => {
	const r = await t.execute(
		"SELECT id, username, role FROM users WHERE username IN ('user','streamium') OR role = 'ADMIN'"
	);
	console.log('found:', JSON.stringify(r.rows));

	const u = await t.execute("UPDATE users SET role = 'ADMIN' WHERE username = 'user'");
	console.log('update rows:', u.rowsAffected);

	const check = await t.execute(
		"SELECT id, username, role FROM users WHERE username = 'user'"
	);
	console.log('after:', JSON.stringify(check.rows));
})().catch((e) => console.error(e.message));