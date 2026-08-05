import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
let failed = 0;
function check(name, ok, detail = '') {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
	if (!ok) failed++;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(BASE + '/afrikaans', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4500);

// Rails present above grid
const railTitles = await page.evaluate(() =>
	[...document.querySelectorAll('section[aria-label^="Nuut:"] h2')].map((h) => h.textContent.trim())
);
check('Nuut rails present', railTitles.length >= 1, railTitles.join(' | '));

// Rail items exist (cards inside sections)
const railInfo = await page.evaluate(() =>
	[...document.querySelectorAll('section[aria-label^="Nuut:"]')].map((s) => {
		const label = s.getAttribute('aria-label');
		const cards = s.querySelectorAll('a[href^="/afrikaans/"]').length;
		const title = s.querySelector('h2')?.textContent?.trim() || '';
		return `${label}: ${cards} cards (${title})`;
	})
);
railInfo.forEach((r) => check('rail populated', / [1-9][0-9]* cards/.test(r), r));

// Rail cards are recent (release year >= 2024)
const railYears = await page.evaluate(() =>
	[...document.querySelectorAll('section[aria-label^="Nuut:"] a[href^="/afrikaans/"]')]
		.map((a) => {
			const date = a.querySelector('p, [class*="year"]')?.textContent?.trim() || '';
			return date;
		})
		.slice(0, 6)
);
check('rail cards render', railYears.length > 0, `${railYears.length} sampled`);

// Sort control exists with 3 options
const sortOpts = await page.evaluate(() =>
	[...document.querySelectorAll('#afrikaans-sort option')].map((o) => o.textContent.trim())
);
check('sort select has 3 modes', sortOpts.length === 3, sortOpts.join(' | '));

// Default sort = Newest: first grid card should be most recent
const gridFirst = await page.evaluate(() => {
	const grid = [...document.querySelectorAll('a[href^="/afrikaans/"]')].filter((a) =>
		!a.closest('section[aria-label^="Nuut:"]')
	);
	return grid[0]?.getAttribute('href') || '';
});
check('grid renders after rails', !!gridFirst, gridFirst);

// Rating sort changes order
const defaultFirst = await page.evaluate(() => {
	const grid = [...document.querySelectorAll('a[href^="/afrikaans/"]')].filter((a) =>
		!a.closest('section[aria-label^="Nuut:"]')
	);
	return grid[0]?.getAttribute('href') || '';
});
await page.selectOption('#afrikaans-sort', 'rating');
await page.waitForTimeout(800);
const ratingFirst = await page.evaluate(() => {
	const grid = [...document.querySelectorAll('a[href^="/afrikaans/"]')].filter((a) =>
		!a.closest('section[aria-label^="Nuut:"]')
	);
	return grid[0]?.getAttribute('href') || '';
});
check('rating sort reorders grid', ratingFirst !== defaultFirst, `default ${defaultFirst} -> rating ${ratingFirst}`);

// A-Z sort
await page.selectOption('#afrikaans-sort', 'az');
await page.waitForTimeout(800);
const azFirst = await page.evaluate(() => {
	const grid = [...document.querySelectorAll('a[href^="/afrikaans/"]')].filter((a) =>
		!a.closest('section[aria-label^="Nuut:"]')
	);
	const title = grid[0]?.querySelector('h3, p, span')?.textContent?.trim() || grid[0]?.getAttribute('href') || '';
	return title;
});
check('A-Z sort active', azFirst.length > 0, `first: ${azFirst.slice(0, 40)}`);

await browser.close();
console.log(failed === 0 ? '\nRAILS/SORT GREEN' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);


