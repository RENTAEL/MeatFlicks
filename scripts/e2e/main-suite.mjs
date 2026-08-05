import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
let failed = 0;
function check(name, ok, detail = '') {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
	if (!ok) failed++;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// Task 1: Load More appends
await page.goto(BASE + '/afrikaans', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('a[href^="/afrikaans/"]', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(2500);

// Dismiss the intermittent full-screen popup if shown (its backdrop intercepts clicks)
await page.locator('.popup-close').click({ timeout: 1500 }).catch(() => {});

const before = await page.evaluate(() => document.querySelectorAll('a[href^="/afrikaans/"]').length);
check('grid has cards before Load More', before >= 10, `${before} cards`);
const loadMoreBtn = page.locator('button:has-text("Laai Meer")');
const btnVisible = await loadMoreBtn.isVisible().catch(() => false);
check('Laai Meer button visible', btnVisible);
if (btnVisible) {
	await loadMoreBtn.click();
	await page.waitForTimeout(4000);
	const after = await page.evaluate(() => document.querySelectorAll('a[href^="/afrikaans/"]').length);
	check('Load More appends cards', after > before, `${before} -> ${after} cards`);
} else {
	const hasMore = await page.evaluate(() => !!document.querySelector('a[href^="/afrikaans/"]'));
	check('grid still rendered', hasMore);
}

// Regression: detail page renders + player
const detailResp = await page.goto(BASE + '/afrikaans/103853', { waitUntil: 'domcontentloaded', timeout: 60000 });
check('afrikaans detail 200', detailResp?.status() === 200, `status ${detailResp?.status()}`);
await page.waitForTimeout(6000);
const playerVisible = await page
	.locator('iframe[src*="youtube"], iframe[src*="youtu"], video, .player-overlay, [class*="player"]')
	.first()
	.isVisible()
	.catch(() => false);
check('detail player renders', playerVisible);

// Regression: home unchanged
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
const heroOk = await page.evaluate(() => !!document.querySelector('main') && document.querySelectorAll('main img').length > 5);
check('home renders (hero + cards)', heroOk);

// Regression: movies grid
await page.goto(BASE + '/movies', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
const moviesOk = await page.evaluate(() => document.querySelectorAll('a[href^="/movie/"]').length > 5);
check('movies grid renders', moviesOk);

// Regression: tv grid
await page.goto(BASE + '/tv', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
const tvOk = await page.evaluate(() => document.querySelectorAll('a[href^="/tv/"]').length > 5);
check('tv grid renders', tvOk);

// Regression: 375px mobile layout on afrikaans
await page.setViewportSize({ width: 375, height: 812 });
await page.goto(BASE + '/afrikaans', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= 375 + 4);
check('375px no horizontal overflow', noHScroll);

check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
console.log(failed === 0 ? '\nALL GREEN' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
