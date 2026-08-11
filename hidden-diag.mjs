import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const EP_URL = '/tv/1399/1/1';
const FORCED_RUNTIME = 0.3;

const browser = await chromium.launch({ headless: true });
try {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await ctx.newPage();
	const logs = [];
	page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
	page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 200)}`));
	page.on('framenavigated', (f) => {
		if (f === page.mainFrame()) logs.push(`[nav] ${f.url()}`);
	});

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

	await ctx.addInitScript(() => {
		try {
			localStorage.clear();
		} catch {}
	});

	const sample = () => page.evaluate(() => {
		const el = document.querySelector('.upnext-overlay');
		const num = document.querySelector('.upnext-num')?.textContent?.trim() ?? null;
		return { overlay: !!el, num, url: location.pathname + location.search };
	}).catch(() => ({ overlay: false, num: null, url: 'ERR' }));

	await page.goto(BASE + EP_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });

	const out = { steps: [], ticks: [], logs: [] };
	out.steps.push(['landed', await sample()]);

	await page.waitForFunction(() => !!document.querySelector('iframe.player-iframe'), { timeout: 90000 }).catch(() => {});
	out.steps.push(['iframe', await sample()]);
	await page.waitForTimeout(2000);

	let s = await sample();
	let t0 = Date.now();
	while (!s.overlay && Date.now() - t0 < 90000) {
		await page.waitForTimeout(500);
		s = await sample();
	}
	out.steps.push(['overlay-visible', s]);

	if (s.overlay) {
		// simulate the page becoming hidden (screen-lock / backgrounded tab / mobile fullscreen)
		await page.evaluate(() => {
			Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
		});
		out.steps.push(['hidden-flipped', await sample()]);
	}

	t0 = Date.now();
	while (Date.now() - t0 < 20000) {
		const cur = await sample();
		out.ticks.push({ t: ((Date.now() - t0) / 1000).toFixed(1), ...cur });
		await page.waitForTimeout(1000);
	}
	out.logs = logs.slice(-12);
	console.log(JSON.stringify(out, null, 2));
} finally {
	await browser.close();
}