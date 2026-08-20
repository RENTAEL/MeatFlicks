import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const BASE = 'https://streamium-cosmic.vercel.app';
const env = Object.fromEntries(
	readFileSync('.env', 'utf8')
		.split(/\r?\n/)
		.filter((l) => l && !l.startsWith('#'))
		.map((l) => {
			const i = l.indexOf('=');
			return [l.slice(0, i), l.slice(i + 1)];
		})
);
const { createClient } = createRequire(import.meta.url)('@libsql/client');
const turso = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

const browser = await chromium.launch();
const suffix = Date.now().toString(36).slice(-5);
const userA = `syncA${suffix}`;
const userD = `recoD${suffix}`;
const userF = `recoF${suffix}`;
const pass = 'ProbePass123!';
const results = [];
const pass1 = (ok, name) => results.push({ name, ok });
const fail1 = (name, detail) => results.push({ name, ok: false, detail });
const waitFor = async (page, sel, ms = 20000) => {
	try {
		await page.waitForSelector(sel, { timeout: ms });
		return true;
	} catch {
		return false;
	}
};

const signup = async (ctx, username) => {
	const page = await ctx.newPage();
	await page.goto(BASE + '/signup', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await waitFor(page, 'input[name="username"]');
	await page.fill('input[name="username"]', username);
	await page.fill('input[name="email"]', `${username}@probe.test`);
	await page.fill('input[name="password"]', pass);
	await page.click('button[type="submit"]');
	await page.waitForTimeout(3500);
	return page;
};

const login = async (ctx, username) => {
	const page = await ctx.newPage();
	await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await waitFor(page, 'input[name="username"]');
	await page.fill('input[name="username"]', username);
	await page.fill('input[name="password"]', pass);
	await page.click('button[type="submit"]');
	await page.waitForTimeout(3500);
	return page;
};

const api = async (page, path, opts = {}) =>
	page.evaluate(
		async ({ path, opts }) => {
			const res = await fetch(path, { ...opts, credentials: 'include' });
			let body = null;
			try {
				body = await res.json();
			} catch {}
			return { status: res.status, body };
		},
		{ path, opts }
	);

const csrf = async (page) => {
	const r = await api(page, '/api/csrf');
	return r.body?.token ?? null;
};

const addWatchlist = async (page, tmdbId, mediaType) => {
	const token = await csrf(page);
	return api(page, '/api/watchlist', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
		body: JSON.stringify({ tmdbId, mediaType })
	});
};

const delWatchlist = async (page, tmdbId, mediaType) => {
	const token = await csrf(page);
	return api(page, '/api/watchlist', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
		body: JSON.stringify({ tmdbId, mediaType })
	});
};

const addHistory = async (page, tmdb_id, media_type) => {
	const token = await csrf(page);
	return api(page, '/api/history', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
		body: JSON.stringify({ tmdb_id, media_type, progress: 100, duration: 7200 })
	});
};

const getWatchlist = async (page) => (await api(page, '/api/watchlist')).body;
const getHistory = async (page) => (await api(page, '/api/history')).body;
const getRecs = async (page) => (await api(page, '/api/recommendations')).body?.media ?? [];

const cleanupUsers = async () => {
	for (const u of [userA, userD, userF]) {
		try {
			const us = await turso.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [u] });
			if (us.rows.length) {
				const uid = us.rows[0].id;
				await turso.execute({ sql: 'DELETE FROM watchlist WHERE userId = ?', args: [uid] });
				await turso.execute({ sql: 'DELETE FROM watch_history WHERE userId = ?', args: [uid] });
				await turso.execute({ sql: 'DELETE FROM saved_quotes WHERE userId = ?', args: [uid] });
				await turso.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [uid] });
			}
		} catch (e) {
			console.log('cleanup warn', u, String(e).slice(0, 80));
		}
	}
};

try {
	await cleanupUsers();

	// --- PART 1: cross-device sync ---
	const ctxA = await browser.newContext();
	const pageA = await signup(ctxA, userA);

	const w1 = await addWatchlist(pageA, 980431, 'movie');
	const w2 = await addWatchlist(pageA, 121513, 'tv');
	const h1 = await addHistory(pageA, 1632181, 'movie');
	const wlA1 = await getWatchlist(pageA);
	const histA1 = await getHistory(pageA);
	const s1ok = w1.status === 200 && w2.status === 200 && h1.status === 200;
	pass1(s1ok, 'watchlist+history seeded via API on device A');

	// Device B: fresh context, same account
	const ctxB = await browser.newContext();
	const pageB = await login(ctxB, userA);
	await pageB.waitForTimeout(2500);
	const wlB = await getWatchlist(pageB);
	const histB = await getHistory(pageB);
	pass1(
		wlB.length === 2 && histB.length === 1,
		`device B (fresh) sees A's data (watchlist=${wlB.length}, history=${histB.length})`
	);
	await pageB.goto(BASE + '/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await waitFor(pageB, '.tab-btn');
	const wlLabel = await pageB.evaluate(() =>
		Array.from(document.querySelectorAll('.tab-btn'))
			.map((b) => b.textContent.trim())
			.find((t) => t.startsWith('Watchlist'))
	);
	pass1(wlLabel === 'Watchlist (2)', `device B UI shows Watchlist (2), got ${wlLabel}`);

	// Deletion propagation: B removes one item, A must see it gone
	const del = await delWatchlist(pageB, 980431, 'movie');
	const wlB2 = await getWatchlist(pageB);
	await pageA.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await pageA.waitForTimeout(3000);
	const wlA2 = await getWatchlist(pageA);
	pass1(
		del.status === 200 && wlB2.length === 1 && wlA2.length === 1,
		`deletion propagated (B server=${wlB2.length}, A after reload=${wlA2.length})`
	);

	// Guest backfill: device C guest adds an item, then logs in -> uploaded
	const ctxC = await browser.newContext();
	await ctxC.addInitScript(
		([key, state]) => localStorage.setItem(key, JSON.stringify(state)),
		[
			'streamium.watchlist',
			{
				items: [
					{
						id: '93120',
						title: 'Guest pick',
						posterPath: null,
						backdropPath: null,
						overview: null,
						releaseDate: null,
						rating: 0,
						genres: ['News'],
						mediaType: 'tv',
						tmdbId: 93120,
						canonicalPath: '/tv/93120',
						addedAt: new Date().toISOString()
					}
				],
				dirty: true
			}
		]
	);
	const pageC = await login(ctxC, userA);
	await pageC.waitForTimeout(4000);
	const wlC = await getWatchlist(pageC);
	pass1(wlC.length === 2, `guest item backfilled on login (server has ${wlC.length}, expected 2)`);

	// --- PART 2: recommendations ---
	const ctxG = await browser.newContext();
	const pageG = await ctxG.newPage();
	await pageG.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await pageG.waitForTimeout(1500);
	const guestRecs = await getRecs(pageG);
	pass1(guestRecs.length === 0, `guest gets empty recommendations (${guestRecs.length})`);

	const ctxD = await browser.newContext();
	const ctxF = await browser.newContext();
	const pageD = await signup(ctxD, userD);
	await addHistory(pageD, 121513, 'tv');
	const pageF = await signup(ctxF, userF);
	await addHistory(pageF, 93120, 'tv');
	await pageD.waitForTimeout(1500);
	await pageF.waitForTimeout(1500);
	const recsD = await getRecs(pageD);
	const recsF = await getRecs(pageF);
	const dIds = new Set(recsD.map((m) => m.tmdbId ?? m.id));
	const fIds = new Set(recsF.map((m) => m.tmdbId ?? m.id));
	pass1(
		recsD.length > 0 && recsF.length > 0,
		`logged-in users get non-empty recommendations (D=${recsD.length}, F=${recsF.length})`
	);
	const differ =
		[...dIds].some((id) => !fIds.has(id)) || [...fIds].some((id) => !dIds.has(id));
	pass1(differ, `recommendations differ between users with different tastes (D:${[...dIds].join(',')} vs F:${[...fIds].join(',')})`);

	await ctxA.close();
	await ctxB.close();
	await ctxC.close();
	await ctxG.close();
	await ctxD.close();
	await ctxF.close();
} finally {
	await cleanupUsers();
	await browser.close();
}

console.log('\n== SYNC + RECO ASSERTIONS ==');
let failed = 0;
for (const r of results) {
	if (r.ok) {
		console.log('  PASS ' + r.name);
	} else {
		failed++;
		console.log('  FAIL ' + r.name + (r.detail ? ': ' + r.detail : ''));
	}
}
console.log(`RESULT: ${results.length - failed} pass, ${failed} fail`);
process.exit(failed ? 1 : 0);