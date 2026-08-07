import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => {
	if (m.text().includes('[sec-io]')) console.log('CLIENT:', m.text().slice(0, 100));
});

await page.goto(`${BASE}/movies`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));

const countCards = () => page.evaluate(() => {
	const grid = document.querySelector('section[aria-label*="Blaai"] .grid, section[aria-label*="Browse"] .grid');
	return grid ? grid.querySelectorAll('a[href^="/movie/"], a[href^="/tv/"]').length : -1;
});

const scrollInfo = await page.evaluate(() => {
	const win = document.scrollingElement;
	const prev = win ? win.scrollTop : -1;
	window.scrollTo(0, 99999);
	return { docBefore: prev, docAfter: win ? win.scrollTop : -1 };
});
console.log('window scroll attempt:', JSON.stringify(scrollInfo));

await page.evaluate(() => {
	const doc = document.scrollingElement;
	window.scrollTo(0, doc.scrollHeight);
});
await new Promise((r) => setTimeout(r, 2500));
console.log('after full window scroll:', await countCards(), 'cards');

const res = await page.evaluate(async () => {
	const sentinel = [...document.querySelectorAll('div[aria-hidden="true"]')].find((d) => d.className === 'h-px w-full');
	let scroller = sentinel?.parentElement;
	while (scroller && !(getComputedStyle(scroller).overflowY.includes('auto') || getComputedStyle(scroller).overflowY.includes('scroll'))) {
		scroller = scroller.parentElement;
	}
	if (!scroller) return 'no scroller';
	scroller.scrollTop = scroller.scrollHeight;
	await new Promise((r) => setTimeout(r, 2800));
	return { scrollerTag: scroller.tagName, scrolledTo: scroller.scrollTop, sh: scroller.scrollHeight };
});
console.log('container scroll result:', JSON.stringify(res));
console.log('final cards:', await countCards());

await browser.close();