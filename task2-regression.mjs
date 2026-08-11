import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const EMAIL = process.env.TEST_EMAIL || 'questvrmsd5epa1';
const PASSWORD = process.env.TEST_PASSWORD || 'Testpass123!';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

const browser = await chromium.launch();

// --- local-storage continue watching (anonymous) ---
{
	const ctx = await browser.newContext();
	const mockMovie = {
		id: 999001, tmdbId: 27205, title: 'Task2 Test Movie', mediaType: 'movie',
		posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', canonicalPath: '/movie/999001'
	};
	const mockTv = {
		id: 999002, tmdbId: 1399, title: 'Task2 Test Series', mediaType: 'tv',
		posterPath: '/f79u3QNadl5Zx0mUIv3VqP1q3iZ.jpg', canonicalPath: '/tv/999002'
	};
	const seed = {
		'movie:999001': {
			mediaId: '999001', mediaType: 'movie', progress: 1500, duration: 5400,
			updatedAt: Date.now(), mediaData: mockMovie
		},
		'movie:999000': {
			mediaId: '999000', mediaType: 'movie', progress: 5400, duration: 5400,
			updatedAt: Date.now(), mediaData: { ...mockMovie, id: 999000, title: 'Completed Movie' }
		},
		'movie:998999': {
			mediaId: '998999', mediaType: 'movie', progress: 300, duration: 5400,
			updatedAt: Date.now() - 31 * 24 * 60 * 60 * 1000, mediaData: { ...mockMovie, id: 998999, title: 'Stale Movie' }
		},
		'tv:999002:s1e3': {
			mediaId: '999002', mediaType: 'tv', progress: 2000, duration: 2700,
			seasonNumber: 1, episodeNumber: 3, updatedAt: Date.now(), mediaData: mockTv
		}
	};
	await ctx.addInitScript((data) => {
		localStorage.setItem('streamium.playback_progress', JSON.stringify(data));
	}, seed);

	const page = await ctx.newPage();
	const pageErrors = [];
	page.on('pageerror', (e) => pageErrors.push(String(e)));
	await page.goto(BASE + '/', { waitUntil: 'networkidle' });

	await page.evaluate(() => {
		const candidates = [...document.querySelectorAll('*')]
			.filter((el) => el.scrollHeight > el.clientHeight + 50)
			.sort((a, b) => b.scrollHeight - a.scrollHeight);
		const sc = candidates[0];
		if (!sc) return;
		window.__scroller = sc;
	});
	for (let step = 0; step < 14; step++) {
		await page.evaluate(() => {
			const sc = window.__scroller;
			if (sc) sc.scrollTop += 500;
		});
		await page.waitForTimeout(200);
		const found = await page.locator('text=Continue Watching').count();
		if (found > 0) break;
	}
	await page.waitForTimeout(800);
	const rowCount = await page.locator('text=Continue Watching').count();
	check('home shows Continue Watching row', rowCount > 0);

	const cardTitles = await page.locator('.media-card').evaluateAll((cards) =>
		cards.map((c) => c.getAttribute('aria-label') || '')
	);
	const hasMovie = cardTitles.some((t) => t.includes('Task2 Test Movie'));
	const hasSeries = cardTitles.some((t) => t.includes('Task2 Test Series'));
	const hasCompleted = cardTitles.some((t) => t.includes('Completed Movie'));
	const hasStale = cardTitles.some((t) => t.includes('Stale Movie'));
	check('movie entry present', hasMovie, cardTitles.join(' | '));
	check('tv entry present', hasSeries);
	check('completed (>90%) entry excluded', !hasCompleted);
	check('stale (>30d) entry excluded', !hasStale);

	const progressBars = await page.locator('.media-card .h-1.bg-black\\/40, .media-card div.h-1').count();
	check('progress bar rendered on cards', progressBars > 0, `bars=${progressBars}`);

	const seriesLink = page.locator('a[href="/tv/999002/1/3"]');
	const seriesLinkCount = await seriesLink.count();
	check('tv card links to resume episode /tv/999002/1/3', seriesLinkCount > 0, `count=${seriesLinkCount}`);
	if (seriesLinkCount > 0) {
		await seriesLink.first().click();
		await page.waitForURL('**/tv/999002/1/3', { timeout: 10000 }).catch(() => {});
		check('resume link navigates to player page', page.url().includes('/tv/999002/1/3'), page.url());
	}

	check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
	await ctx.close();
}

// --- server-side continue watching (authenticated) ---
{
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
	await page.fill('input[name="username"], input[type="text"]', EMAIL);
	await page.fill('input[name="password"]', PASSWORD);
	await page.click('button[type="submit"]');
	await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 15000 }).catch(() => {});
	await page.waitForLoadState('networkidle');
	const authed = !page.url().includes('/login');
	check('login succeeds', authed, page.url());

	if (authed) {
		const ts = Date.now();
		const mediaId = `cw-test-${ts}`;
		const active = await ctx.request.post(BASE + '/api/playback/progress', {
			data: { mediaId, mediaType: 'movie', progress: 1800, duration: 5400 }
		});
		check('POST active progress 200', active.status() === 200, `status=${active.status()}`);
		const completed = await ctx.request.post(BASE + '/api/playback/progress', {
			data: { mediaId: `cw-done-${ts}`, mediaType: 'movie', progress: 5300, duration: 5400 }
		});
		check('POST completed progress 200', completed.status() === 200);

		const listRes = await ctx.request.get(BASE + '/api/playback/progress');
		const list = await listRes.json();
		const items = Array.isArray(list.continueWatching) ? list.continueWatching : [];
		check('GET returns continue watching', items.length > 0, `count=${items.length}`);
		check('active item included', items.some((i) => i.tmdbId === mediaId));
		check('completed (>90%) item excluded server-side', !items.some((i) => i.tmdbId === `cw-done-${ts}`));

		await ctx.request.post(BASE + '/api/playback/progress', {
			data: { mediaId, mediaType: 'movie', progress: 1, duration: 5400 }
		});
	}
	await ctx.close();
}

await browser.close();

const passed = results.filter((r) => r.ok).length;
for (const r of results) {
	console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
