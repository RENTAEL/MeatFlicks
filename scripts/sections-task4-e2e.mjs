import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const results = [];
let failures = 0;

function check(name, ok, detail = '') {
	results.push({ name, ok, detail });
	if (!ok) failures++;
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function dismissPopup(page) {
	try {
		const has = await page.$('.popup-backdrop');
		if (has) {
			await page.click('.popup-close', { timeout: 3000 }).catch(() => {});
			await new Promise((r) => setTimeout(r, 300));
		}
	} catch {
		// popup optional
	}
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

try {
	// 1. Movies page renders search + picker
	await page.goto(`${BASE}/movies`, { waitUntil: 'networkidle', timeout: 60000 });
	await dismissPopup(page);
	const html = await page.content();
	check('movies page loads', html.includes('Flieks / Movies'), `${html.length} bytes`);
	check('movies has search input', await page.$('input[type="search"]') !== null);
	check('movies has picker button', await page.$eval('button', (b) => [...document.querySelectorAll('button')].some((x) => x.textContent.includes('Kies vir my'))) !== false);

	// 2. Search: server fallback via /api/search
	await page.type('input[type="search"]', 'avatar');
	try {
		await page.waitForFunction(
			() => {
				const grid = document.querySelector('section[aria-label*="Blaai"] .grid, section[aria-label*="Browse"] .grid');
				return grid ? grid.querySelectorAll('a[href^="/movie/"], a[href^="/tv/"]').length > 0 : false;
			},
			{ timeout: 10000 }
		);
		check('search yields cards', true, `found cards`);
	} catch {
		check('search yields cards', false, 'no cards appeared');
	}

	// 3. Clear, picker opens + re-roll
	await page.click('.search-clear');
	await new Promise((r) => setTimeout(r, 500));
	const pickerBtn = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Kies vir my')));
	await pickerBtn.asElement().click();
	await new Promise((r) => setTimeout(r, 3500));
	const pickVisible = await page.evaluate(() => document.body.textContent.includes('Kies vir my / Pick for me') && document.body.textContent.includes('Nog een'));
	check('picker dialog with Nog een', pickVisible);

	const pickTitle = await page.evaluate(() => {
		const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent.includes('Nog een'));
		return dlg ? dlg.querySelector('h3')?.textContent ?? '' : '';
	});
	check('picker shows a title', pickTitle.length > 0, pickTitle);

	await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Nog een'))?.click());
	await new Promise((r) => setTimeout(r, 2500));
	const pickTitle2 = await page.evaluate(() => {
		const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent.includes('Nog een'));
		return dlg ? dlg.querySelector('h3')?.textContent ?? '' : '';
	});
	check('re-roll yields a title', pickTitle2.length > 0, pickTitle2);

	// 4. TV page same widgets
	await page.goto(`${BASE}/tv`, { waitUntil: 'networkidle', timeout: 60000 });
	check('tv page has search input', await page.$('input[type="search"]') !== null);
	check('tv has picker button', await page.evaluate(() => [...document.querySelectorAll('button')].some((x) => x.textContent.includes('Kies vir my'))) !== false);

	// 5. Search APIs directly
	const movieSearch = await fetch(`${BASE}/movies/api/search?q=avatar`);
	const tvSearch = await fetch(`${BASE}/tv/api/search?q=stranger`);
	const ms = await movieSearch.json();
	const ts = await tvSearch.json();
	check('movies search API', movieSearch.status === 200 && (ms.results ?? []).length > 0, `${(ms.results ?? []).length} results`);
	check('tv search API', tvSearch.status === 200 && (ts.results ?? []).length > 0, `${(ts.results ?? []).length} results`);
} catch (e) {
	check('uncaught error', false, e.message);
} finally {
	await browser.close();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
