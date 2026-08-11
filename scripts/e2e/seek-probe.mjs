import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BASE = 'https://streamium-cosmic.vercel.app';
const REPO = 'C:/Users/bezui/Downloads/Test site thing';

function envLine(file, key) {
	if (!existsSync(file)) return '';
	const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(key + '='));
	return line ? line.slice(key.length + 1).trim() : '';
}

const secret = envLine(`${REPO}/.env`, 'SESSION_SECRET');
const tmdbKey = envLine(`${REPO}/.env`, 'TMDB_API_KEY');
process.env.SESSION_SECRET = secret;
process.env.TMDB_API_KEY = tmdbKey;
const { encryptSession } = await import(pathToFileURL(`${REPO}/src/lib/server/session-crypto.ts`).href);
const host = { id: 'user-a', name: 'Hosty', cookie: encryptSession({ userId: 'user-a', username: 'Hosty', role: 'USER', expiresAt: Date.now() + 1000 * 60 * 60 * 2 }) };

async function api(cookie, path, init = {}) {
	const r = await fetch(`${BASE}/api${path}`, {
		...init,
		headers: { 'content-type': 'application/json', cookie: `session=${cookie}`, ...(init.headers || {}) }
	});
	return { status: r.status, body: await r.json().catch(() => ({})) };
}

const created = await api(host.cookie, '/watch-party/rooms', { method: 'POST', body: JSON.stringify({ name: 'seek-probe', mediaType: 'movie', tmdbId: 550 }) });
const roomId = created.body.roomId;
console.log('room:', roomId);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addCookies([{ name: 'session', value: host.cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
const page = await ctx.newPage();
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 200)));
page.on('pageerror', (e) => console.log('[PAGEERROR]', String(e).slice(0, 300)));
page.on('request', (r) => { if (r.url().includes('/playback')) console.log('[REQ]', r.method(), r.url(), r.postData()?.slice(0, 120)); });
page.on('response', (r) => { if (r.url().includes('/playback')) console.log('[RES]', r.status(), r.url()); });

await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('iframe.player-iframe', { timeout: 90000 });
console.log('iframe loaded (native controls are inside the embed)');
await page.waitForTimeout(2000);

console.log('--- pressing k (play/pause) ---');
await page.keyboard.press('k');
await page.waitForTimeout(4000);

console.log('--- pressing ArrowRight (+10s seek) ---');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(4000);

const sync = await page.evaluate(() => (window.__swLastSyncApplied ? { ...window.__swLastSyncApplied } : null)).catch(() => null);
console.log('host lastSyncApplied (host is sync leader, may be null):', JSON.stringify(sync));
const iframeSrc = await page.evaluate(() => document.querySelector('iframe.player-iframe')?.src ?? null);
console.log('iframe src:', iframeSrc?.slice(0, 140));

await browser.close();
process.exit(0);
