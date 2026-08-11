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

async function sweep(name, path, { authed = true, viewport = null } = {}) {
	const ctx = await browser.newContext(viewport ? { viewport } : {});
	if (authed) await ctx.addCookies([{ name: 'session', value: cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
	const page = await ctx.newPage();
	const bad = [];
	page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
	page.on('requestfailed', (r) => bad.push(`FAILED ${r.url()}`));
	const errs = [];
	page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
	await page.goto(BASE + path, { waitUntil: 'load', timeout: 60000 });
	await page.waitForTimeout(5000);
	const title = await page.title();
	const sw = await page.evaluate(() => navigator.serviceWorker?.getRegistration?.()?.scope ?? null).catch(() => null);
	const vp = page.viewportSize();
	const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1).catch(() => null);
	console.log(`${name}: ${title} | bad=${bad.length ? bad.join('; ') : 'NONE'} | errs=${errs.length ? errs.join('; ') : 'NONE'} | sw=${sw} | vp=${vp.width}x${vp.height} overflowX=${noOverflow}`);
	await ctx.close();
}

await sweep('TV', '/tv');
await sweep('AFRIKAANS', '/afrikaans');
await sweep('MOVIE DETAIL', '/movie/550');
await sweep('TV DETAIL', '/tv/1399');
await sweep('LOGIN', '/login', { authed: false });
await sweep('HOME 375px', '/', { viewport: { width: 375, height: 812 } });
await sweep('MOVIES 375px', '/movies', { viewport: { width: 375, height: 812 } });

await browser.close();
process.exit(0);
