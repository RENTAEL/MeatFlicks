import { chromium } from 'playwright';
const BASE = 'https://streamium-cosmic.vercel.app';
const b = await chromium.launch();
const ctx = await b.newContext();
const page = await ctx.newPage();
await page.goto(BASE + '/tv/1399/1/1', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
	localStorage.removeItem('streamium-player-volume');
	localStorage.removeItem('streamium-player-muted');
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.player-controls', { timeout: 30000 }).catch(() => {});
await page.click('.player-controls [aria-label="Enter fullscreen"]').catch(() => {});
await page.waitForTimeout(150);

const cdp = await ctx.newCDPSession(page);
const lr = await cdp.send('Runtime.evaluate', {
	expression: 'getEventListeners(window).keydown ? getEventListeners(window).keydown.length : -1',
	includeCommandLineAPI: true
});
console.log('window keydown listeners:', JSON.stringify(lr.result?.result?.value));

const snap = () => page.evaluate(() => ({
	vol: localStorage.getItem('streamium-player-volume'),
	muted: localStorage.getItem('streamium-player-muted'),
	slider: document.querySelector('.player-controls input[type="range"]')?.value
}));

await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
console.log('after 1 ArrowDown:', JSON.stringify(await snap()));

await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
console.log('after 2 ArrowDown:', JSON.stringify(await snap()));

await page.keyboard.press('ArrowDown');
await page.waitForTimeout(150);
console.log('after 3 ArrowDown:', JSON.stringify(await snap()));

await page.keyboard.press('m');
await page.waitForTimeout(150);
console.log('after 1 m:', JSON.stringify(await snap()));

await page.keyboard.press('m');
await page.waitForTimeout(150);
console.log('after 2 m:', JSON.stringify(await snap()));
await b.close();