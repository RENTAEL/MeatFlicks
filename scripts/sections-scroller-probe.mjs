import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${BASE}/movies`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3500));

const info = await page.evaluate(() => {
	const doc = document.scrollingElement;
	const before = doc ? doc.scrollTop : -1;
	const winBefore = window.scrollY;
	window.scrollTo(0, 99999);
	const after = doc ? doc.scrollTop : -1;
	const winAfter = window.scrollY;

	const walker = (() => {
		const out = [];
		const els = document.querySelectorAll('body *');
		for (const el of els) {
			const s = getComputedStyle(el);
			if (/(auto|scroll)/.test(s.overflowY)) {
				out.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), sh: el.scrollHeight, ch: el.clientHeight, st: el.scrollTop });
			}
		}
		return out;
	})();

	const sentinel = (() => {
		const divs = document.querySelectorAll('div[aria-hidden="true"]');
		for (const d of divs) {
			if (d.className === 'h-px w-full') return d.getBoundingClientRect().top;
		}
		return -1;
	})();

	return { docBefore: before, docAfter: after, winAfter, sentinelTop: sentinel, scrollers: walker.slice(0, 6) };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
