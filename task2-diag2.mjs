import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${String(e).slice(0, 300)}`));
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
const state = await page.evaluate(() => ({
	scrollHeight: document.documentElement.scrollHeight,
	clientHeight: document.documentElement.clientHeight,
	placeholders: document.querySelectorAll('.animate-pulse').length,
	cards: document.querySelectorAll('.media-card').length,
	h2: [...document.querySelectorAll('h2')].map((h) => h?.textContent).slice(0, 12),
	mainScroll: (() => { const m = document.querySelector('main'); if (!m) return null; return { sh: m.scrollHeight, ch: m.clientHeight, oy: getComputedStyle(m).overflowY }; })()
}));
console.log(JSON.stringify(state, null, 1));
console.log('--- console/page errors ---');
console.log(logs.slice(0, 20).join('\n') || '(none)');
await browser.close();