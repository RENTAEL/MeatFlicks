import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(BASE + '/tv/1399/1/1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.player-controls', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);

const probe = await page.evaluate(() => {
	const out = { listeners: 0, bubbled: false, helpBefore: false };
	const btn = document.querySelector('.player-controls [aria-label="Enter fullscreen"]');
	btn?.focus();
	out.helpBefore = !!document.querySelector('.shortcuts-panel');
	document.addEventListener('keydown', (e) => { out.bubbled = true; }, true);
	btn?.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true }));
	return new Promise((resolve) => setTimeout(() => resolve(out), 300));
});
console.log('dispatch probe:', JSON.stringify(probe));
const afterDispatch = await page.locator('.shortcuts-panel').count();
console.log('shortcuts-panel after dispatched ?:', afterDispatch);

await page.evaluate(() => {
	const btn = document.querySelector('.player-controls [aria-label="Enter fullscreen"]');
	btn?.focus();
});
await page.keyboard.press('?');
await page.waitForTimeout(300);
console.log('shortcuts-panel after page.keyboard ?:', await page.locator('.shortcuts-panel').count());
await browser.close();