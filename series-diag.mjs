import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const EP_URL = '/tv/1399/1/1';
const FORCED_RUNTIME = 0.3; // minutes -> autoTarget ~18s

async function makePage(browser, label, opts = {}) {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await ctx.newPage();
	const logs = [];
	page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
	page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

	// Force episode runtime tiny so the overlay trigger is reachable quickly.
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

	if (opts.clearStorage !== false) {
		await ctx.addInitScript(() => {
			try { localStorage.clear(); } catch {}
		});
	}

	await page.goto(BASE + EP_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
	return { page, ctx, logs };
}

function sample(p) { return p.page.evaluate(() => {
	const el = document.querySelector('.upnext-overlay');
	const num = document.querySelector('.upnext-num')?.textContent?.trim() ?? null;
	const url = location.pathname + location.search;
	return { overlay: !!el, num, url };
}); }

async function waitFor(p, what, ms) {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		const s = await sample(p);
		if (what(s)) return s;
		await p.page.waitForTimeout(500);
	}
	return await sample(p);
}

async function scenario(label, opts, watchMs, assert) {
	const browser = await chromium.launch({ headless: true });
	try {
		const p = await makePage(browser, label, opts);
		const summary = { label, steps: [] };
		summary.steps.push(['landed', await sample(p)]);

		// wait for provider iframe to load (or scan failure)
		await p.page.waitForFunction(() => {
			const f = document.querySelector('iframe.player-iframe');
			return !!f;
		}, { timeout: 90000 }).catch(() => {});
		summary.steps.push(['iframe', await sample(p)]);
		await p.page.waitForTimeout(2000);

		// wait for up-next overlay (autoTarget = FORCED_RUNTIME*60s + scan time)
		const s = await waitFor(p, (x) => x.overlay, 90000);
		summary.steps.push(['overlay-wait', s]);

		if (s.overlay) {
			// watch the countdown for watchMs seconds
			const ticks = [];
			const t0 = Date.now();
			while (Date.now() - t0 < watchMs) {
				const cur = await sample(p);
				ticks.push({ t: Date.now() - t0, num: cur.num, url: cur.url, overlay: cur.overlay });
				await p.page.waitForTimeout(700);
			}
			summary.ticks = ticks;
		}

		summary.logs = p.logs.slice(-20);
		return summary;
	} finally {
		await browser.close();
	}
}

const out = {
	defaultOn: await scenario('A fresh-default', {}, 25000, null),
};
console.log(JSON.stringify(out, null, 2));
