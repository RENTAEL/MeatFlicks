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

let pollsBlocked = false;
const t0 = Date.now();
page.on('request', (r) => {
	const u = r.url();
	if (u.includes('/scan')) console.log('SCAN REQ', ((Date.now() - t0) / 1000).toFixed(1) + 's');
	if (u.includes('/rooms/')) console.log('POLL REQ', ((Date.now() - t0) / 1000).toFixed(1) + 's');
});
await page.route('**/api/watch-party/rooms/**', (route) => {
	if (pollsBlocked) return route.abort();
	return route.continue();
});

await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
console.log('--- blocking polls now ---');
pollsBlocked = true;
await page.waitForTimeout(16000);
const state = await page.evaluate(() => ({
	overlay: document.querySelector('.overlay')?.textContent?.slice(0, 40) ?? null,
	iframeSrc: document.querySelector('iframe.player-iframe')?.getAttribute('src') ?? null
}));
console.log('FINAL', JSON.stringify(state));

await browser.close();
process.exit(0);
