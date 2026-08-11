import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 400)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${String(e).slice(0, 400)}`));
await page.goto(BASE + '/tv/1399/1/1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.player-controls', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);

const probe = await page.evaluate(() => {
	const out = {};
	const btn = document.querySelector('.player-controls [aria-label="Enter fullscreen"]');
	btn?.focus();
	const hadListener = new Promise((resolve) => {
		const fired = { viaWindow: false, atAll: false };
		const check = (e) => { fired.atAll = true; };
		document.addEventListener('keydown', check);
		btn?.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true }));
		setTimeout(() => { document.removeEventListener('keydown', check); resolve(fired); }, 200);
	});
	return hadListener;
});
console.log('event reached document:', JSON.stringify(await probe));
console.log('shortcuts-panel count:', await page.locator('.shortcuts-panel').count());
console.log('--- console/page errors ---');
console.log(logs.slice(0, 30).join('\n') || '(none)');
await browser.close();