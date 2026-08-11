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

const r = await fetch(`${BASE}/watch/${roomId}`, { headers: { cookie: `session=${cookie}` } });
const html = await r.text();
const sw = html.match(/script_url = '([^']*)'/);
const entry = html.match(/import\("([^"]*_app[^"]*start[^"]*\.js)"\)/);
console.log('injected script_url:', sw?.[1], '| entry:', entry?.[1]);

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addCookies([{ name: 'session', value: cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && m.text().includes('serviceWorker')) errors.push(m.text().slice(0, 150)); });
page.on('pageerror', (e) => { if (String(e).includes('serviceWorker')) errors.push(String(e).slice(0, 150)); });

await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

const swState = await page.evaluate(async () => {
	const regs = await navigator.serviceWorker.getRegistrations();
	return regs.map((r) => ({ scope: r.scope, active: !!r.active, installing: !!r.installing, waiting: !!r.waiting }));
});
console.log('registrations:', JSON.stringify(swState));
console.log('SW console errors:', errors.length ? errors : 'NONE');

const assetOk = await page.evaluate(() => {
	const css = document.querySelector('link[rel="stylesheet"]');
	return { assetCount: document.querySelectorAll('script[src],link[href]').length, firstCss: css?.getAttribute('href') };
});
console.log('assets:', JSON.stringify(assetOk));

await browser.close();
process.exit(0);
