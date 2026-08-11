import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => {
	if (m.text().includes('[sec-io]')) console.log('CLIENT:', m.text());
});

await page.goto(`${BASE}/movies`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));

const countCards = () => page.evaluate(() => {
	const grid = document.querySelector('section[aria-label*="Blaai"] .grid, section[aria-label*="Browse"] .grid');
	return grid ? grid.querySelectorAll('a[href^="/movie/"], a[href^="/tv/"]').length : -1;
});

console.log('baseline:', await countCards());
for (const y of [3000, 5000, 7000, 8200, 9000, 10000]) {
	await page.evaluate((s) => window.scrollTo(0, s), y);
	await new Promise((r) => setTimeout(r, 1200));
	console.log(`scroll@${y}px -> ${await countCards()} cards`);
}

await browser.close();
