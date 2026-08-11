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

const t0 = Date.now();
page.on('request', (r) => {
	const u = r.url();
	if (u.includes('/scan') || u.includes('/rooms/')) console.log('REQ', ((Date.now() - t0) / 1000).toFixed(1) + 's', u.split('vercel.app')[1].split('?')[0]);
});
page.on('response', (r) => {
	const u = r.url();
	if (u.includes('/scan') || u.includes('/rooms/')) console.log('RES', ((Date.now() - t0) / 1000).toFixed(1) + 's', r.status(), u.split('vercel.app')[1].split('?')[0]);
});

await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'load', timeout: 60000 });

for (let i = 0; i < 5; i++) {
	await page.waitForTimeout(4000);
	const s = await page.evaluate(() => {
		const f = document.querySelector('iframe.player-iframe');
		const overlay = document.querySelector('.overlay');
		const frameWrap = document.querySelector('.frame-wrap, .player-frame, [class*="frame"]');
		return {
			t: ((Date.now() - window.performance.now()) / 1000).toFixed(0),
			overlay: overlay?.textContent?.slice(0, 40) ?? null,
			iframeSrc: f?.getAttribute('src') ?? null,
			iframeIdentity: f ? (typeof f.dataset.uid !== 'undefined' ? f.dataset.uid : (f.id || 'no-id')) : null,
			iframeCount: document.querySelectorAll('iframe.player-iframe').length
		};
	});
	console.log('SNAP', JSON.stringify(s));
}

await browser.close();
process.exit(0);
