import { readFileSync, existsSync } from 'node:fs';

const BASE = 'https://streamium-cosmic.vercel.app';
const REPO = 'C:/Users/bezui/Downloads/Test site thing';

function envLine(file, key) {
	if (!existsSync(file)) return '';
	const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(key + '='));
	return line ? line.slice(key.length + 1).trim() : '';
}

process.env.SESSION_SECRET = envLine(`${REPO}/.env`, 'SESSION_SECRET');
process.env.TMDB_API_KEY = envLine(`${REPO}/.env`, 'TMDB_API_KEY');
const { encryptSession } = await import(`file:///${REPO.replace(/ /g, '%20')}/src/lib/server/session-crypto.ts`);
const cookie = encryptSession({ userId: 'user-a', username: 'Hosty', role: 'USER', expiresAt: Date.now() + 1000 * 60 * 60 });

const res = await fetch(`${BASE}/api/watch-party/rooms`, {
	method: 'POST',
	headers: { 'content-type': 'application/json', cookie: `session=${cookie}` },
	body: JSON.stringify({ mediaType: 'movie', tmdbId: 550, title: 'Fight Club' })
});
const { roomId } = await res.json();
console.log('room:', roomId);

for (let i = 0; i < 5; i++) {
	const r = await fetch(`${BASE}/watch/${roomId}`, { headers: { cookie: `session=${cookie}` } });
	const t = await r.text();
	console.log('page attempt', i + 1, r.status, t.includes('500') ? 'ERROR PAGE' : 'OK (' + t.length + ' bytes)');
	await new Promise((r) => setTimeout(r, 1200));
}
const r2 = await fetch(`${BASE}/__data.json?x-sveltekit-invalidated=01`, { headers: { cookie: `session=${cookie}` } });
console.log('__data.json:', r2.status, (await r2.text()).slice(0, 150));
process.exit(0);
