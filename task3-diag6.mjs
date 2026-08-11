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

const pre = await page.evaluate(() => ({
	vol: localStorage.getItem('streamium-player-volume'),
	muted: localStorage.getItem('streamium-player-muted'),
	slider: document.querySelector('.player-controls input[type="range"]')?.value,
	sliderStep: document.querySelector('.player-controls input[type="range"]')?.step,
	focusClass: document.activeElement?.className
}));
console.log('PRE-press:', JSON.stringify(pre));

await page.evaluate(() => {
	window.__k = [];
	window.addEventListener('keydown', (e) => {
		window.__k.push(e.key + (e.repeat ? '(r)' : ''));
	}, true);
});
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(250);
const post = await page.evaluate(() => ({
	keys: window.__k,
	vol: localStorage.getItem('streamium-player-volume'),
	muted: localStorage.getItem('streamium-player-muted'),
	slider: document.querySelector('.player-controls input[type="range"]')?.value
}));
console.log('POST-press:', JSON.stringify(post));
await b.close();