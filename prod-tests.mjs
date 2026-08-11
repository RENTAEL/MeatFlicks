import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const EP_URL = '/tv/1399/1/1';
const FORCED_RUNTIME = 0.3;

const results = {};

async function run(label, fn) {
	const browser = await chromium.launch({ headless: true });
	try {
		results[label] = await fn(browser);
	} catch (e) {
		results[label] = { error: String(e).slice(0, 300) };
	} finally {
		await browser.close();
	}
}

async function setup(browser, { presetAutoplay } = {}) {
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

	await ctx.addInitScript((preset) => {
		try {
			localStorage.clear();
			if (preset) localStorage.setItem('streamium-autoplay-next', preset);
		} catch {}
	}, presetAutoplay ?? null);

	await page.goto(BASE + EP_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
	await page.waitForFunction(() => !!document.querySelector('iframe.player-iframe'), { timeout: 90000 }).catch(() => {});
	await page.waitForTimeout(2000);
	return { page, ctx, logs };
}

const sample = (page) => page.evaluate(() => {
	const overlay = document.querySelector('.upnext-overlay');
	const num = document.querySelector('.upnext-num')?.textContent?.trim() ?? null;
	const autoPill = document.querySelector('.auto-pill')?.textContent?.trim() ?? null;
	return { overlay: !!overlay, num, url: location.pathname + location.search, autoPill };
}).catch(() => ({ overlay: false, num: null, url: 'ERR', autoPill: null }));

async function waitFor(page, pred, ms) {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		const s = await sample(page);
		if (pred(s)) return s;
		await page.waitForTimeout(400);
	}
	return await sample(page);
}

// A: fresh default -> countdown completes -> auto-advance -> URL sync
await run('A-fresh-default-advance', async (browser) => {
	const { page } = await setup(browser);
	const s = await waitFor(page, (x) => x.overlay, 90000);
	if (!s.overlay) return { fail: 'overlay never appeared', steps: [s] };
	const t0 = Date.now();
	let adv = null;
	while (Date.now() - t0 < 20000) {
		const cur = await sample(page);
		if (cur.url !== EP_URL) { adv = cur; break; }
		await page.waitForTimeout(500);
	}
	return { overlaySeen: s, advanced: adv ?? (await sample(page)) };
});

// B: hidden during countdown -> must STILL advance (the fix)
await run('B-hidden-still-advances', async (browser) => {
	const { page } = await setup(browser);
	const s = await waitFor(page, (x) => x.overlay, 90000);
	if (!s.overlay) return { fail: 'overlay never appeared', steps: [s] };
	await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
	const t0 = Date.now();
	const nums = [];
	let adv = null;
	while (Date.now() - t0 < 25000) {
		const cur = await sample(page);
		nums.push(cur.num);
		if (cur.url !== EP_URL) { adv = cur; break; }
		await page.waitForTimeout(500);
	}
	return { countdownSequence: nums.slice(0, 25), advanced: adv ?? (await sample(page)) };
});

// C1: toggle Auto-next OFF mid-overlay -> overlay hides, no advance; manual Next still works
await run('C1-toggle-off-cancels', async (browser) => {
	const { page } = await setup(browser);
	const s = await waitFor(page, (x) => x.overlay, 90000);
	if (!s.overlay) return { fail: 'overlay never appeared' };
	const before = await sample(page);
	await page.locator('.auto-btn').click();
	await page.waitForTimeout(1500);
	const after = await sample(page);
	await page.waitForTimeout(8000);
	const later = await sample(page);
	await page.locator('.next-btn').click();
	let adv = await waitFor(page, (x) => x.url !== EP_URL, 15000);
	return { before, afterToggleOff: after, eightSecLater: later, afterManualNext: adv };
});

// C2: preset OFF -> overlay never opens; manual Next still works
await run('C2-preset-off-no-overlay', async (browser) => {
	const { page } = await setup(browser, { presetAutoplay: '0' });
	const s = await waitFor(page, (x) => x.overlay || (Date.now() - start > 30000), 40000);
	async function start() { return 0; }
	const autoPill = await sample(page);
	await page.locator('.next-btn').click();
	let adv = await waitFor(page, (x) => x.url !== EP_URL, 15000);
	return { autoPill, noOverlay: !s.overlay, afterManualNext: adv };
});

// D: Cancel -> timer cleared, no advance, no re-appear this episode
await run('D-cancel-suppresses', async (browser) => {
	const { page } = await setup(browser);
	const s = await waitFor(page, (x) => x.overlay, 90000);
	if (!s.overlay) return { fail: 'overlay never appeared' };
	await page.locator('.upnext-cancel').click();
	await page.waitForTimeout(1500);
	const afterCancel = await sample(page);
	await page.waitForTimeout(18000);
	const later = await sample(page);
	return { afterCancel, eighteenSecLater: later, reAppeared: later.overlay, advanced: later.url !== EP_URL };
});

console.log(JSON.stringify(results, null, 2));
