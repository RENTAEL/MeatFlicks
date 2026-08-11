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

const poll1 = await (await fetch(`${BASE}/api/watch-party/rooms/${roomId}?since=0`, { headers: { cookie: `session=${cookie}` } })).json();
const poll2 = await (await fetch(`${BASE}/api/watch-party/rooms/${roomId}?since=0`, { headers: { cookie: `session=${cookie}` } })).json();

for (const [name, s] of [['poll1', poll1], ['poll2', poll2]]) {
	const m = s.media;
	console.log(name, 'media keys:', Object.keys(m ?? {}));
	console.log(name, 'tmdbId:', JSON.stringify(m?.tmdbId), typeof m?.tmdbId);
	console.log(name, 'mediaType:', JSON.stringify(m?.mediaType));
	console.log(name, 'season:', JSON.stringify(m?.season));
	console.log(name, 'episode:', JSON.stringify(m?.episode));
	console.log(name, 'title:', JSON.stringify(m?.title));
}

process.exit(0);
