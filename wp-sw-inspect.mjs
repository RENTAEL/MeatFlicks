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

for (const u of [
	`${BASE}/watch/${roomId}`,
	`${BASE}/tv/1399/1/1`,
	`${BASE}/movies`,
	`${BASE}/search?q=test`
]) {
	const r = await fetch(u, { headers: { cookie: `session=${cookie}` } });
	const html = await r.text();
	const sw = html.match(/script_url = '([^']*)'/);
	const asset = html.match(/src="([^"]*_app[^"]*start[^"]*\.js)"/) || html.match(/import\("([^"]*_app[^"]*\.js)"\)/);
	console.log(r.status, u.split('.com')[1], '| sw:', sw?.[1], '| entry:', asset?.[1]);
}
process.exit(0);
