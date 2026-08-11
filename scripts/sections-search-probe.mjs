import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('console', (m) => { if (/error|warn/i.test(m.type()) || m.text().includes('sec-io')) logs.push(`[${m.type()}] ${m.text().slice(0, 160)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 200)}`));

await page.goto(`${BASE}/movies`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));

const hasPopup = await page.evaluate(() => !!document.querySelector('.popup-backdrop'));
console.log('popup visible:', hasPopup);
if (hasPopup) {
	await page.evaluate(() => document.querySelector('.popup-close')?.click());
	await new Promise((r) => setTimeout(r, 300));
}

await page.type('input[type="search"]', 'avatar');
await new Promise((r) => setTimeout(r, 1800));
const state = await page.evaluate(async () => {
	const grid = document.querySelector('section[aria-label*="Blaai"] .grid, section[aria-label*="Browse"] .grid');
	const input = document.querySelector('input[type="search"]');
	const cards = grid ? grid.querySelectorAll('a[href^="/movie/"], a[href^="/tv/"]').length : -1;
	const firstTitle = grid?.querySelector('a')?.getAttribute('title') ?? '';
	return { cards, q: input?.value, firstTitle };
});
console.log('after search:', JSON.stringify(state));
console.log('logs:', logs.slice(0, 10));
await browser.close();