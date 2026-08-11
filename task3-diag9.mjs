import { chromium } from 'playwright';
const BASE = 'https://streamium-cosmic.vercel.app';
const b = await chromium.launch();
const ctx = await b.newContext();
const page = await ctx.newPage();
await page.addInitScript(() => {
	window.__log = [];
	const g = Storage.prototype.getItem;
	const s = Storage.prototype.setItem;
	Storage.prototype.getItem = function (k) {
		if (k === 'streamium-player-volume') { window.__log.push('GET volume AT=' + Date.now()); }
		return g.call(this, k);
	};
	Storage.prototype.setItem = function (k, v) {
		window.__log.push(`SET ${k}=${v} AT=${Date.now()}`);
		return s.call(this, k, v);
	};
});
await page.goto(BASE + '/tv/1399/1/1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.player-controls', { timeout: 30000 }).catch(() => {});
const sliderHistory = [];
for (let i = 0; i < 10; i++) {
	await page.waitForTimeout(600);
	sliderHistory.push(await page.evaluate(() => document.querySelector('.player-controls input[type="range"]')?.value));
}
const r = await page.evaluate(() => ({ log: window.__log, sliderHistory: null }));
r.sliderHistory = sliderHistory;
console.log(JSON.stringify(r, null, 1));
await b.close();