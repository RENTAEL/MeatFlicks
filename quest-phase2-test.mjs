import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const log = (...a) => console.log('[p2]', ...a);
const results = {};

async function withTimeout(promise, ms, label) {
	return await Promise.race([
		promise,
		new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: ' + label)), ms)),
	]);
}

async function section(name, fn) {
	try {
		log('start', name);
		const r = await withTimeout(fn(), 180000, name);
		results[name] = r;
		log('done', name, JSON.stringify(r).slice(0, 300));
	} catch (e) {
		log('FAIL', name, String(e).slice(0, 300));
		results[name] = { error: String(e).slice(0, 300) };
	}
}

// 1) Touch: hover-trailer must be INERT (no preview on tap)
await section('touchInert', async () => {
	const b = await chromium.launch();
	const ctx = await b.newContext({
		viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
	});
	const page = await ctx.newPage();
	page.setDefaultTimeout(60000);
	await page.goto(BASE + '/movies', { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('.media-card', { timeout: 60000 });
	const card = page.locator('.media-card').first();
	await card.scrollIntoViewIfNeeded();
	const box = await card.boundingBox();
	const previewSamples = [];
	await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
	for (let i = 0; i < 4; i++) {
		await page.waitForTimeout(400);
		previewSamples.push(await page.evaluate(() => {
			const el = document.querySelector('.card-inner .animate-slide-up-fade');
			return el ? Math.round(el.getBoundingClientRect().height) : 0;
		}));
	}
	const mq = await page.evaluate(() => matchMedia('(hover: hover)').matches);
	await b.close();
	return { hoverMq: mq, previewHeights: previewSamples, inert: previewSamples.every((h) => h === 0) };
});

// 2) Pointer control: hover preview works on desktop
await section('pointerControl', async () => {
	const b = await chromium.launch();
	const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
	const page = await ctx.newPage();
	page.setDefaultTimeout(60000);
	await page.goto(BASE + '/movies', { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('.media-card', { timeout: 60000 });
	const card = page.locator('.media-card').first();
	await card.scrollIntoViewIfNeeded();
	const box = await card.boundingBox();
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.waitForTimeout(1200);
	const shown = await page.evaluate(() => !!document.querySelector('.card-inner .animate-slide-up-fade'));
	const mq = await page.evaluate(() => matchMedia('(hover: hover)').matches);
	await b.close();
	return { hoverMq: mq, previewShown: shown };
});

// 3) Quest window sizes: no horizontal overflow
for (const [w, h] of [[1280, 720], [950, 540]]) {
	await section(`layout-${w}x${h}`, async () => {
		const b = await chromium.launch();
		const ctx = await b.newContext({ viewport: { width: w, height: h } });
		const page = await ctx.newPage();
		page.setDefaultTimeout(60000);
		await page.goto(BASE + '/tv', { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('.media-card', { timeout: 60000 });
		const r = await page.evaluate(() => {
			const grids = [...document.querySelectorAll('.show-grid, .media-grid, .episode-list')];
			const over = grids.map((g) => ({ cls: g.className.slice(0, 50), over: g.scrollWidth - g.clientWidth })).filter((x) => x.over > 2);
			return { pageHOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, overflowing: over };
		});
		await b.close();
		return r;
	});
}

// 4) Settings persistence via real signup
await section('settingsPersistence', async () => {
	const b = await chromium.launch();
	const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
	const page = await ctx.newPage();
	page.setDefaultTimeout(45000);
	const uname = 'questvr' + Date.now().toString(36);
	await page.goto(BASE + '/signup', { waitUntil: 'domcontentloaded' });
	await page.fill('input[name="username"]', uname);
	await page.fill('input[name="password"]', 'Testpass123!');
	await page.click('button[type="submit"]', { timeout: 15000 });
	await page.waitForTimeout(2000);

	await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(1000);
	const p = page.url();
	if (p.includes('login') || p.includes('signup')) {
		await b.close();
		return { fail: 'not logged in', url: p };
	}
	await page.locator('.mode-btn', { hasText: 'VR Mode' }).click();
	await page.waitForTimeout(400);
	const afterVr = await page.evaluate(() => ({
		stored: localStorage.getItem('streamium-display-mode'),
		activeLabels: [...document.querySelectorAll('.mode-btn.mode-btn-active')].map((x) => x.textContent.trim()),
		hint: document.querySelector('.vr-hint')?.textContent?.trim() ?? null,
	}));
	await page.reload({ waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(1000);
	const afterReload = await page.evaluate(() => ({
		stored: localStorage.getItem('streamium-display-mode'),
		activeLabels: [...document.querySelectorAll('.mode-btn.mode-btn-active')].map((x) => x.textContent.trim()),
		hint: document.querySelector('.vr-hint')?.textContent?.trim() ?? null,
	}));
	await page.locator('.mode-btn', { hasText: 'Desktop Mode' }).click();
	await page.waitForTimeout(400);
	const afterDesktop = await page.evaluate(() => ({
		stored: localStorage.getItem('streamium-display-mode'),
		hint: document.querySelector('.vr-hint')?.textContent?.trim() ?? null,
	}));
	await b.close();
	return { user: uname, afterVr, afterReload, afterDesktop };
});

console.log('FINAL', JSON.stringify(results, null, 2));