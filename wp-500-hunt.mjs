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

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addCookies([{ name: 'session', value: cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
const page = await ctx.newPage();

page.on('response', async (r) => {
	if (r.status() >= 500) {
		const body = await r.text().catch(() => '');
		console.log(`500 on ${page.url().replace(BASE, '')} <- ${r.url().replace(BASE, '')} | body: ${body.slice(0, 300)}`);
	}
});

const paths = ['/', '/movies', '/tv', '/afrikaans', '/movie/550', '/tv/1399', '/search?q=test'];
for (const p of paths) {
	await page.goto(BASE + p, { waitUntil: 'load', timeout: 60000 });
	await page.waitForTimeout(4500);
}
console.log('--- done sweep ---');

await browser.close();
process.exit(0);
