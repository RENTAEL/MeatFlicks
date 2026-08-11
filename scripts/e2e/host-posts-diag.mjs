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

const secret = process.env.SESSION_SECRET || envLine(`${REPO}/.env`, 'SESSION_SECRET');
const tmdbKey = envLine(`${REPO}/.env`, 'TMDB_API_KEY');
process.env.SESSION_SECRET = secret;
process.env.TMDB_API_KEY = tmdbKey;
console.log('session secret:', secret ? 'set' : 'unset', '| tmdb key:', tmdbKey ? 'set' : 'unset');
const { encryptSession } = await import(pathToFileURL(`${REPO}/src/lib/server/session-crypto.ts`).href);
const cookie = encryptSession({ userId: 'user-diag', username: 'Diag', role: 'USER', expiresAt: Date.now() + 3600000 });

const createdRes = await fetch(`${BASE}/api/watch-party/rooms`, {
	method: 'POST',
	headers: { 'content-type': 'application/json', cookie: `session=${cookie}` },
	body: JSON.stringify({ mediaType: 'movie', tmdbId: 550, title: 'Fight Club' })
});
console.log('create status', createdRes.status);
const created = await createdRes.json().catch(() => ({}));
console.log('create body', JSON.stringify(created).slice(0, 200));
const roomId = created.roomId;
console.log('room', roomId);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addCookies([{ name: 'session', value: cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
const page = await ctx.newPage();
const posts = [];
page.on('request', (r) => {
	if (r.method() !== 'POST') return;
	const url = r.url();
	let body = null;
	try { body = r.postDataJSON(); } catch {}
	posts.push({ t: Date.now(), url: url.replace(BASE, ''), body });
});
page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', String(m.text()).slice(0, 200)); });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));

await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('iframe.player-iframe', { timeout: 60000 }).catch(() => {});
console.log('player loaded; pressing k (play)');
await page.waitForTimeout(1000);
const iframeBefore = await page.evaluate(() => document.querySelector('iframe.player-iframe')?.src ?? '');
console.log('iframe before play:', iframeBefore.slice(0, 100));
await page.keyboard.press('k');
console.log('k pressed at', Date.now());
await page.waitForTimeout(25000);
const iframeAfter = await page.evaluate(() => document.querySelector('iframe.player-iframe')?.src ?? '');
console.log('iframe after play:', iframeAfter.slice(0, 100));
console.log('--- POSTs seen ---');
for (const p of posts) console.log(new Date(p.t).toISOString(), p.url, JSON.stringify(p.body));
await browser.close();
