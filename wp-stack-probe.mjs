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

await page.addInitScript(() => {
	const realFetch = window.fetch.bind(window);
	window.__scanStacks = [];
	window.fetch = (input, init) => {
		const url = typeof input === 'string' ? input : input?.url ?? '';
		if (url.includes('/api/providers/scan')) {
			window.__scanStacks.push({ t: Date.now(), stack: new Error().stack?.split('\n').slice(1, 8).join('\n') });
		}
		return realFetch(input, init);
	};
});

await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(16000);
const stacks = await page.evaluate(() => ({ stacks: window.__scanStacks, timeOrigin: window.performance.timeOrigin }));
stacks.stacks.forEach((s, i) => {
	console.log('=== SCAN #' + (i + 1) + ' at T+' + ((s.t - stacks.timeOrigin) / 1000).toFixed(1) + 's ===');
	console.log(s.stack.split('\n').slice(0, 9).join('\n'));
});

await browser.close();
process.exit(0);
