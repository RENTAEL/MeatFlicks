import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleMsgs = [];
page.on('console', (m) => consoleMsgs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => consoleMsgs.push(`[pageerror] ${e.message.slice(0, 300)}`));

await page.goto(`${BASE}/movies`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));

const info = await page.evaluate(() => {
	const grid = document.querySelector('section[aria-label*="Blaai"] .grid, section[aria-label*="Browse"] .grid');
	const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Laai Meer'));
	const sentinel = btn?.parentElement?.querySelector('div[aria-hidden="true"]');
	return {
		cards: grid ? grid.querySelectorAll('a[href^="/movie/"], a[href^="/tv/"]').length : -1,
		hasBtn: !!btn,
		hasSentinel: !!sentinel
	};
});
console.log('before click:', JSON.stringify(info));

if (info.hasBtn) {
	await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Laai Meer'))?.click());
	await new Promise((r) => setTimeout(r, 2500));
	const after = await page.evaluate(() => {
		const grid = document.querySelector('section[aria-label*="Blaai"] .grid, section[aria-label*="Browse"] .grid');
		return grid ? grid.querySelectorAll('a[href^="/movie/"], a[href^="/tv/"]').length : -1;
	});
	console.log('after button click:', after, 'cards');
}

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await new Promise((r) => setTimeout(r, 2500));
const scrolled = await page.evaluate(() => {
	const grid = document.querySelector('section[aria-label*="Blaai"] .grid, section[aria-label*="Browse"] .grid');
	return grid ? grid.querySelectorAll('a[href^="/movie/"], a[href^="/tv/"]').length : -1;
});
console.log('after scroll to bottom:', scrolled, 'cards');
console.log('console messages:', consoleMsgs.slice(0, 8));

await browser.close();
