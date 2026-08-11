import { chromium } from 'playwright';
const BASE = 'https://streamium-cosmic.vercel.app';
const b = await chromium.launch();
const ctx = await b.newContext();
const page = await ctx.newPage();
await page.addInitScript(() => {
	window.__writes = [];
	const orig = Storage.prototype.setItem;
	Storage.prototype.setItem = function (k, v) {
		window.__writes.push(k + '=' + v + ' @' + new Error().stack.split('\n')[2]?.trim().slice(-80));
		return orig.call(this, k, v);
	};
});
await page.goto(BASE + '/tv/1399/1/1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.player-controls', { timeout: 30000 }).catch(() => {});
const state1 = await page.evaluate(() => ({
	slider: document.querySelector('.player-controls input[type="range"]')?.value,
	muteBtn: document.querySelector('.player-controls [aria-label]') ? null : null,
	muteLabel: [...document.querySelectorAll('.player-controls button')].find((b) => b.getAttribute('aria-label')?.includes('mute'))?.getAttribute('aria-label'),
	writes: window.__writes
}));
console.log('after load:', JSON.stringify(state1, null, 1));
await b.close();