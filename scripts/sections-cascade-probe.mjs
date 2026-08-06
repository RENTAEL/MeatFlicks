import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const countCards = () => page.evaluate(() => {
	const grid = document.querySelector('section[aria-label*="Blaai"] .grid, section[aria-label*="Browse"] .grid');
	if (!grid) return -1;
	return grid.querySelectorAll('a[href^="/movie/"], a[href^="/tv/"]').length;
});

await page.goto(`${BASE}/movies`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));
const baseline = await countCards();
console.log('baseline cards (no scroll):', baseline);

for (const y of [1500, 3500, 6000, 9000, 12000, 15000]) {
	await page.evaluate((s) => window.scrollTo(0, s), y);
	await new Promise((r) => setTimeout(r, 1800));
	const c = await countCards();
	console.log(`scroll@${y}px -> ${c} cards`);
}

const h = await page.evaluate(() => document.body.scrollHeight);
console.log('final page height:', h, 'px');
await browser.close();
