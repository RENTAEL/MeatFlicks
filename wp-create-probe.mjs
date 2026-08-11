import { readFileSync, existsSync } from 'node:fs';
const BASE = 'https://streamium-cosmic.vercel.app';
const REPO = 'C:/Users/bezui/Downloads/Test site thing';
function envLine(file, key) {
	if (!existsSync(file)) return '';
	const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(key + '='));
	return line ? line.slice(key.length + 1).trim() : '';
}
const secret = envLine(`${REPO}/.env`, 'SESSION_SECRET');
const tmdb = envLine(`${REPO}/.env`, 'TMDB_API_KEY');
process.env.SESSION_SECRET = secret;
process.env.TMDB_API_KEY = tmdb;
const { encryptSession } = await import(`file:///${REPO.replace(/ /g, '%20')}/src/lib/server/session-crypto.ts`);
const cookie = encryptSession({ userId: 'user-a', username: 'Hosty', role: 'USER', expiresAt: Date.now() + 1000 * 60 * 60 });

for (let attempt = 1; attempt <= 10; attempt++) {
	try {
		const r = await fetch(`${BASE}/api/watch-party/rooms`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', cookie: `session=${cookie}` },
			body: JSON.stringify({ mediaType: 'movie', tmdbId: 550, title: 'Fight Club' })
		});
		const body = await r.json();
		console.log(`attempt ${attempt}: ${r.status} ${JSON.stringify(body)}`);
		if (r.status === 200) process.exit(0);
	} catch (e) {
		console.log(`attempt ${attempt}: fetch error ${e.message}`);
	}
	await new Promise((r) => setTimeout(r, 20000));
}
process.exit(1);
