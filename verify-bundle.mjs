import { chromium } from 'playwright';
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

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addCookies([{ name: 'session', value: cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
const page = await ctx.newPage();

await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

const chunks = await page.evaluate(() => {
	const out = [];
	document.querySelectorAll('script').forEach((s) => out.push(s.src || '(inline)'));
	document.querySelectorAll('link[rel="modulepreload"]').forEach((l) => out.push(l.href));
	return [...new Set(out.filter((u) => u.includes('/_app/immutable/') && !u.startsWith('blob')))];
});
console.log('chunks:', chunks.length);

let wpDiagHits = [];
let playerChunks = [];
for (const url of chunks) {
	try {
		const text = await (await ctx.request.get(url)).text();
		if (text.includes('__wpDiag')) wpDiagHits.push(url.split('/').pop());
		if (text.includes('reloadSync')) {
			playerChunks.push({
				file: url.split('/').pop(),
				hasReloadSync: text.includes('reloadSync'),
				hasEmbedEvent: text.includes('embedEvent'),
				hasWpDiag: text.includes('__wpDiag')
			});
		}
	} catch {}
}
console.log('__wpDiag hits:', JSON.stringify(wpDiagHits));
console.log('player chunks:', JSON.stringify(playerChunks));

const dom = await page.evaluate(() => ({
	playerRoot: !!document.querySelector('.player-root'),
	iframeSrc: document.querySelector('iframe')?.getAttribute('src') ?? null,
	syncPill: document.querySelector('body')?.textContent?.match(/Out of sync[\s\S]{0,30}/)?.[0] ?? null
}));
console.log('DOM:', JSON.stringify(dom));

await browser.close();
process.exit(0);
