import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));

await page.goto(`${BASE}/movies`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));

const btnState = await page.evaluate(() => {
	const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Laai Meer'));
	const sib = btn?.parentElement?.nextElementSibling;
	return {
		found: !!btn,
		disabled: btn?.disabled ?? null,
		aria: btn?.getAttribute('aria-disabled'),
		sentinelTag: sib ? `${sib.tagName} class="${sib.className}"` : 'none',
		sentinelBox: sib ? `${sib.getBoundingClientRect().width}x${sib.getBoundingClientRect().height} top=${Math.round(sib.getBoundingClientRect().top)}` : ''
	};
});
console.log('btn state:', JSON.stringify(btnState));

const fetchTest = await page.evaluate(async () => {
	try {
		const res = await fetch('/movies/api/discover?page=2&sort=newest');
		const j = await res.json();
		return `status=${res.status} results=${j.results?.length} page=${j.page} hasMore=${j.hasMore}`;
	} catch (e) {
		return 'FETCH ERROR: ' + e.message;
	}
});
console.log('in-page fetch:', fetchTest);

const result = await page.evaluate(async () => {
	const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Laai Meer'));
	btn?.click();
	await new Promise((r) => setTimeout(r, 3000));
	const grid = document.querySelector('section[aria-label*="Blaai"] .grid, section[aria-label*="Browse"] .grid');
	return grid ? grid.querySelectorAll('a[href^="/movie/"], a[href^="/tv/"]').length : -1;
});
console.log('cards after click:', result);

await browser.close();
