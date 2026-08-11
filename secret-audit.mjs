import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const SECRET = '5aa00ca6320d13f8d492d7806e012f9b';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(60000);

const leakFiles = new Set();
page.on('response', async (res) => {
	const u = res.url();
	if (!u.includes('/_app/immutable/')) return;
	try {
		const body = await res.text();
		if (body.includes(SECRET)) leakFiles.add(u.replace(BASE, ''));
	} catch {}
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 150)));

const checks = {};

async function checkPage(name, path) {
	try {
		await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
		await page.waitForTimeout(3500);
		const info = await page.evaluate(() => ({
			url: location.pathname,
			hasError: document.body.innerText.includes('Failed to load') || document.body.innerText.includes('Error'),
			text: document.body.innerText.slice(0, 120).replace(/\s+/g, ' '),
		}));
		checks[name] = info;
	} catch (e) {
		checks[name] = { error: e.message.slice(0, 120) };
	}
}

await checkPage('movies', '/movies');
await checkPage('movie-detail', '/movie/603692');
await checkPage('tv-detail', '/tv/1396');
await checkPage('afrikaans', '/afrikaans');
await checkPage('afrikaans-detail', '/afrikaans/103853');
await checkPage('home', '/');

const api = {};
for (const [name, url] of [
	['movies-api', '/api/tmdb/movies/popular?page=2'],
	['movies-api-trending', '/api/tmdb/movies/trending?page=1'],
	['movies-api-all', '/api/tmdb/movies/all?page=1'],
	['upcoming', '/api/tmdb/upcoming'],
]) {
	try {
		const r = await ctx.request.get(BASE + url);
		const j = await r.json();
		api[name] = { status: r.status(), results: (j.results || []).length, err: j.error || null };
	} catch (e) {
		api[name] = { error: e.message.slice(0, 100) };
	}
}

console.log(JSON.stringify({ checks, api, bundleLeaks: [...leakFiles] }, null, 2));
await b.close();