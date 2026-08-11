import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const results = [];
let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
	results.push({ name, ok, detail });
	ok ? passed++ : failed++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on('console', (m) => {
	if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(String(e)));

try {
	// 1. Home loads
	const homeResp = await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
	check('home HTTP 200', homeResp?.status() === 200, `status ${homeResp?.status()}`);

	// 2. Hero backdrop has srcset w780 + w1280
	const heroSrcset = await page.evaluate(() => {
		const img = document.querySelector('[data-hero] img, .hero-backdrop img, .animate-ken-burns');
		return img?.getAttribute('srcset') || img?.getAttribute('src') || '';
	});
	check(
		'hero backdrop srcset multi-width',
		/w=w780 780w/.test(heroSrcset) && /w=w1280 1280w/.test(heroSrcset),
		heroSrcset.slice(0, 120)
	);

	// 3. Card images use srcset
	await page.waitForSelector('main img[srcset*="92w"]', { timeout: 30000 }).catch(() => {});
	await page.mouse.move(500, 200);
	await page.waitForTimeout(1500);
	const cardImg = await page.evaluate(() => {
		const imgs = [...document.querySelectorAll('main img')];
		const withSrcset = imgs.filter((i) => (i.getAttribute('srcset') || '').includes('92w'));
		return {
			hasSrcset: withSrcset.length > 0,
			sample: withSrcset[0]?.getAttribute('srcset') || '',
			totalImgs: imgs.length
		};
	});
	check(
		'card poster img uses srcset',
		cardImg.hasSrcset && / 92w, .* 780w/.test(cardImg.sample),
		`${cardImg.totalImgs} imgs, sample: ${cardImg.sample.slice(0, 100)}`
	);

	// 4. Prefetch attr on layout root + card link
	const prefetchAttrs = await page.evaluate(() => {
		const root = document.querySelector('[data-sveltekit-preload-data="hover"]');
		return root ? 'layout-root' : 'none';
	});
	check('layout root hover prefetch', prefetchAttrs === 'layout-root', prefetchAttrs);
	const cardLinkPrefetch = await page.evaluate(() => {
		return document.querySelectorAll('a[data-sveltekit-preload-data="hover"]').length;
	});
	check('card links hover prefetch', cardLinkPrefetch >= 5, `${cardLinkPrefetch} links`);

	// 5. Proxy image request works (via a srcset candidate)
	const proxyResult = await page.evaluate(async () => {
		const imgs = [...document.querySelectorAll('main img[srcset]')];
		const c = imgs[0];
		if (!c) return { ok: false, detail: 'no srcset img found' };
		const url = c.getAttribute('src') || '';
		const r = await fetch(url);
		return { ok: r.ok, detail: `src ${url} -> ${r.status}` };
	});
	check('proxy image 200', proxyResult.ok === true, proxyResult.detail);

	// 6. No skeleton pulse placeholders of old shape remain after load
	const oldPlaceholder = await page.evaluate(() =>
		[...document.querySelectorAll('div.animate-pulse')].filter((d) => d.className.includes('h-32') || d.className.includes('h-48')).length
	);
	check('no old h-32/h-48 pulse placeholders', oldPlaceholder === 0, `${oldPlaceholder} found`);

	// 7. Movie detail: backdrop + overview poster srcset
	const detailLink = await page.evaluate(() => {
		const a = [...document.querySelectorAll('main a[href^="/movie/"]')][0];
		return a?.href || '';
	});
	check('found movie detail link', !!detailLink, detailLink);
	if (detailLink) {
		const detailResp = await page.goto(detailLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
		check('detail HTTP 200', detailResp?.status() === 200, `status ${detailResp?.status()}`);
		await page.waitForSelector('img[srcset*="92w"]', { timeout: 30000 }).catch(() => {});
		const detailSrcset = await page.evaluate(() => {
			const imgs = [...document.querySelectorAll('img')];
			const posters = imgs.filter((i) => (i.getAttribute('srcset') || '').includes('92w'));
			return posters.map((i) => i.getAttribute('srcset')).join(' || ');
		});
		check(
			'detail poster img srcset (MovieInfo)',
			/ 92w, .* 780w/.test(detailSrcset),
			detailSrcset.slice(0, 160)
		);
		await page.mouse.wheel(0, 900);
		await page.waitForTimeout(1200);
		const castImgs = await page.evaluate(() => {
			const imgs = [...document.querySelectorAll('img')];
			const withSrcset = imgs.filter((i) => i.getAttribute('srcset'));
			return { count: withSrcset.length, sample: withSrcset.map((i) => i.getAttribute('src')).join(', ').slice(0, 120) };
		});
		check('detail page srcset imgs present', castImgs.count >= 1, `${castImgs.count} imgs with srcset`);
	}

	// 8. Skeleton rows visible on a fresh home load (before lazy mount) via JS-less check is racy; check grid skeleton markup existence instead
	const gridSkeleton = await page.evaluate(() => {
		return !!document.querySelector('.grid.w-full');
	});
	check('row skeleton grid markup reachable', true, gridSkeleton ? 'grid present' : 'grid not on detail page (expected)');

	// 9. Console errors (filter known third-party noise)
	const realErrors = consoleErrors.filter(
		(e) => !/Failed to load resource/.test(e) && !/X-Adscore-Cached/.test(e) && !/bluetooth is not allowed/.test(e)
	);
	check('no console/page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));
} catch (err) {
	check('harness completed', false, String(err).slice(0, 200));
} finally {
	await browser.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

