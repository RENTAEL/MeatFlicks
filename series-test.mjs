import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const FORCED_RUNTIME = 0.3;

const browser = await chromium.launch({ headless: true });
try {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await ctx.newPage();
	const logs = [];
	page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 120)}`));
	page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 120)}`));

	await page.route('**/api/tmdb/tv/*/season/*', async (route) => {
		const res = await route.fetch();
		let body;
		try {
			body = await res.json();
			if (Array.isArray(body?.episodes)) {
				body.episodes = body.episodes.map((ep) => ({ ...ep, runtime: FORCED_RUNTIME }));
			}
		} catch {
			return route.continue();
		}
		await route.fulfill({ response: res, json: body });
	});
	await ctx.addInitScript(() => { try { localStorage.clear(); } catch {} });

	const out = { steps: [] };
	const t0 = Date.now();

	await page.goto(BASE + '/tv/1399', { waitUntil: 'domcontentloaded', timeout: 90000 });
	await page.waitForSelector('.episode-play-overlay', { timeout: 60000 });
	await page.locator('.episode-play-overlay').first().click();

	await page.waitForFunction(() => !!document.querySelector('iframe.player-iframe'), { timeout: 90000 }).catch(() => {});
	out.steps.push({ at: 'player-mounted', tSec: ((Date.now() - t0) / 1000).toFixed(1), title: await page.locator('#player-section .section-title').textContent().catch(() => null) });

	// wait for overlay; record when it appears (timing should be ~ FORCED_RUNTIME*60 + scan overhead)
	let s = await page.evaluate(() => ({ overlay: !!document.querySelector('.upnext-overlay'), num: document.querySelector('.upnext-num')?.textContent?.trim() ?? null }));
	while (!s.overlay && Date.now() - t0 < 90000) {
		await page.waitForTimeout(400);
		s = await page.evaluate(() => ({ overlay: !!document.querySelector('.upnext-overlay'), num: document.querySelector('.upnext-num')?.textContent?.trim() ?? null }));
	}
	out.steps.push({ at: 'overlay-appeared', tSec: ((Date.now() - t0) / 1000).toFixed(1), num: s.num });

	// wait for auto-advance: Now Playing title flips to S1:E2 without URL change
	let title = await page.locator('#player-section .section-title').textContent().catch(() => null);
	let adv = null;
	while (Date.now() - t0 < 25000) {
		const cur = await page.locator('#player-section .section-title').textContent().catch(() => null);
		if (cur && /S1:E2/.test(cur)) { adv = { tSec: ((Date.now() - t0) / 1000).toFixed(1), title: cur }; break; }
		title = cur;
		await page.waitForTimeout(500);
	}
	out.steps.push({ at: 'advanced', ...(adv ?? { title }) });

	// picker sync: Now Playing badge should sit on episode 2 card
	out.picker = await page.evaluate(() => {
		const cards = [...document.querySelectorAll('.episode-card')];
		const active = cards.findIndex((c) => c.classList.contains('episode-active'));
		const badge = document.querySelector('.now-playing-badge')?.closest('.episode-card');
		return { activeCardIndex: active, url: location.pathname + location.search };
	});
	console.log(JSON.stringify(out, null, 2));
} finally {
	await browser.close();
}