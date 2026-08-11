import { chromium } from 'playwright';
const BASE = 'https://streamium-cosmic.vercel.app';
const b = await chromium.launch();
const ctx = await b.newContext();
const page = await ctx.newPage();
await page.goto(BASE + '/movie/550', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
const r = await page.evaluate(() =>
	[...document.querySelectorAll('button')].map((x, i) => ({
		i,
		text: (x.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
		aria: x.getAttribute('aria-label'),
		cls: (x.className || '').slice(0, 50),
		inHeader: !!x.closest('[class*="header"], [class*="hero"], main')
	}))
);
console.log(JSON.stringify(r, null, 1));
await b.close();