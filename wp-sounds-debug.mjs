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
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text().slice(0, 150)); });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));
const resp = await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'load', timeout: 60000 });
console.log('status:', resp.status());
await page.waitForTimeout(6000);
const state = await page.evaluate(() => ({
	url: location.href,
	title: document.title,
	body: document.body.innerText.slice(0, 200),
	hasRoot: !!document.querySelector('.watch-root'),
	hint: !!document.querySelector('.sound-hint'),
	slider: !!document.querySelector('.fx-slider')
}));
console.log(JSON.stringify(state, null, 1));

await browser.close();
process.exit(0);
