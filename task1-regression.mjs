import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const results = {};

async function withBrowser(fn) {
	const browser = await chromium.launch({ headless: true });
	try {
		return await fn(browser);
	} finally {
		await browser.close();
	}
}

async function run(label, fn) {
	try {
		results[label] = await withBrowser(fn);
	} catch (e) {
		results[label] = { error: String(e).slice(0, 300) };
	}
}

async function collectErrors(page) {
	const errs = [];
	page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
	return errs;
}

const cardCount = (page) => page.locator('.media-card, .media-scroll-card, .rec-card').count();

// 1. root layout change -> home renders fully
await run('T1-home-render', async (browser) => {
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	const errs = await collectErrors(page);
	await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
	await page.waitForTimeout(3000);
	const html = await page.content();
	return {
		entry: /_app\/immutable\/entry\/app\.BlF8ksyS\.js/i.test(html) ? 'BlF8ksyS' : 'MISSING',
		cards: await cardCount(page),
		pageErrors: errs
	};
});

// 2. list pages (mediaFilter change) + detail pages render
for (const [name, url] of [
	['movies-list', '/movies'],
	['tv-list', '/tv'],
	['afrikaans-list', '/afrikaans'],
	['movie-detail', '/movie/603692'],
	['tv-detail', '/tv/1396']
]) {
	await run(name, async (browser) => {
		const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
		const errs = await collectErrors(page);
		await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 90000 });
		await page.waitForTimeout(2500);
		const overFlow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
		return {
			title: (await page.title()).slice(0, 60),
			cards: await cardCount(page),
			overFlow,
			pageErrors: errs
		};
	});
}

// 3. episode picker: season tabs + arrows + episode cards + play
await run('episode-picker', async (browser) => {
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	const errs = await collectErrors(page);
	await page.goto(BASE + '/tv/1399', { waitUntil: 'domcontentloaded', timeout: 90000 });
	await page.waitForSelector('.season-tabs', { timeout: 90000 }).catch(() => {});
	await page.waitForTimeout(2500);
	const tabs = await page.locator('.season-tab').count();
	const rightArrow = await page.locator('.tabs-arrow-right').count();
	if (tabs > 1) await page.locator('.season-tab').nth(Math.min(1, tabs - 1)).click();
	await page.waitForTimeout(2000);
	const episodes = await page.locator('.episode-card').count();
	await page.locator('.episode-play-overlay').first().click().catch(() => {});
	await page.waitForTimeout(4000);
	const iframe = await page.locator('iframe.player-iframe, iframe[src*="embed"]').count();
	return { tabs, rightArrow, episodes, iframe, pageErrors: errs.slice(0, 5) };
});

// 4. up-next overlay + cancel (runtime forced short)
await run('upnext-overlay', async (browser) => {
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	const errs = await collectErrors(page);
	await page.route('**/api/tmdb/tv/*/season/*', async (route) => {
		const res = await route.fetch();
		let body;
		try { body = await res.json(); } catch { return route.continue(); }
		if (Array.isArray(body?.episodes)) body.episodes = body.episodes.map((e) => ({ ...e, runtime: 0.4 }));
		await route.fulfill({ response: res, json: body });
	});
	await page.addInitScript(() => localStorage.clear());
	await page.goto(BASE + '/tv/1399/1/1', { waitUntil: 'domcontentloaded', timeout: 90000 });
	const seen = await page.waitForSelector('.upnext-overlay', { state: 'attached', timeout: 120000 }).catch(() => null);
	const info = seen
		? await page.evaluate(() => ({
				overlay: !!document.querySelector('.upnext-overlay'),
				autoBtn: !!document.querySelector('.auto-btn'),
				cancel: !!document.querySelector('.upnext-cancel')
			}))
		: { overlay: false, autoBtn: false, cancel: false };
	if (seen) await page.locator('.upnext-cancel').click().catch(() => {});
	return { ...info, pageErrors: errs.slice(0, 5) };
});

// 5. VR hint on settings + PWA manifest
await run('vr-hint-settings', async (browser) => {
	const page = await browser.newPage();
	await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 90000 });
	await page.waitForTimeout(2000);
	return { vrHint: await page.locator('.vr-hint').count(), bodyHasVR: (await page.locator('body').innerText()).includes('VR') };
});

try {
	const res = await fetch(BASE + '/manifest.webmanifest');
	const j = await res.json();
	results['pwa-manifest'] = { status: res.status, name: j.name ?? null, icons: (j.icons || []).length };
} catch (e) {
	results['pwa-manifest'] = { error: String(e).slice(0, 120) };
}

// 6. mobile 375px: no horizontal overflow, bottom nav, search overlay
await run('mobile-375', async (browser) => {
	const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
	const page = await ctx.newPage();
	const errs = await collectErrors(page);
	await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
	await page.waitForTimeout(3000);
	const layout = await page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		innerWidth: window.innerWidth,
		navVisible: !!document.querySelector('.bottom-nav .bottom-nav-item')
	}));
	await page.click('[aria-label="Search"]').catch(() => {});
	await page.waitForTimeout(800);
	const overlayOpen = await page.locator('.search-input').count();
	let searchResults = 0;
	if (overlayOpen) {
		await page.locator('.search-input').fill('batman');
		await page.waitForTimeout(3500);
		searchResults = await page.locator('.search-result-item').count();
	}
	return {
		cards: await cardCount(page),
		noOverflow: layout.scrollWidth <= layout.innerWidth + 2,
		scrollWidth: layout.scrollWidth,
		innerWidth: layout.innerWidth,
		navVisible: layout.navVisible,
		searchOverlayOpen: !!overlayOpen,
		searchResults,
		pageErrors: errs.slice(0, 5)
	};
});

// 7. hover trailer dwell (MediaCard) -> iframe appears, no page errors
await run('hover-trailer', async (browser) => {
	const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
	const errs = await collectErrors(page);
	await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
	await page.waitForSelector('.media-card', { timeout: 90000 }).catch(() => {});
	await page.waitForTimeout(2000);
	const card = page.locator('.media-card').first();
	if (await card.count()) await card.hover({ force: true }).catch(() => {});
	await page.waitForTimeout(1800);
	return { hoveredTrailerFrames: await page.locator('iframe[src*="youtube.com/embed"]').count(), pageErrors: errs.slice(0, 5) };
});

console.log(JSON.stringify(results, null, 2));