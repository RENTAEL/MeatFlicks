import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const out = {};

const b = await chromium.launch();

{
	const ctx = await b.newContext({ viewport: { width: 950, height: 540 } });
	const page = await ctx.newPage();
	page.setDefaultTimeout(60000);
	await page.goto(BASE + '/tv', { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('.media-card', { timeout: 60000 });
	out.layout950 = await page.evaluate(() => {
		const g = document.querySelector('.show-grid');
		return { pageHOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, gridOver: g ? g.scrollWidth - g.clientWidth : null };
	});
	await ctx.close();
}

{
	const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
	const page = await ctx.newPage();
	page.setDefaultTimeout(45000);
	await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
	await page.fill('input[name="username"]', 'questvrmsd5epa1');
	await page.fill('input[name="password"]', 'Testpass123!');
	await page.click('button[type="submit"]', { timeout: 15000 });
	await page.waitForTimeout(2000);
	await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('.mode-btn', { timeout: 30000 });
	await page.locator('.mode-btn', { hasText: 'VR Mode' }).click();
	await page.waitForTimeout(2500);
	out.hint = await page.evaluate(() => ({
		stored: localStorage.getItem('streamium-display-mode'),
		hint: document.querySelector('.vr-hint')?.textContent?.trim() ?? null,
	}));
	await ctx.close();
}

await b.close();
console.log(JSON.stringify(out, null, 2));