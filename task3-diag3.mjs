import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.addInitScript(() => {
	window.__probeKeys = [];
	window.__probePhase = {};
	window.addEventListener('keydown', (e) => {
		window.__probeKeys.push(e.key + ':' + (e.target?.tagName || '?'));
	}, true);
});

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });

await page.goto(BASE + '/tv/1399/1/1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.player-controls', { timeout: 30000 }).catch(() => {});

await page.click('.player-controls [aria-label="Enter fullscreen"]').catch(() => {});
await page.waitForTimeout(200);

const focusInfo = await page.evaluate(() => {
	const el = document.activeElement;
	return { hasFocus: document.hasFocus(), tag: el?.tagName, cls: el?.className, label: el?.getAttribute('aria-label'), inRoot: !!el?.closest?.('.player-root') };
});
console.log('focus after click:', JSON.stringify(focusInfo));

await page.keyboard.press('?');
await page.waitForTimeout(400);

const afterRealKey = await page.evaluate(() => ({
	keys: window.__probeKeys,
	panel: document.querySelectorAll('.shortcuts-panel').length,
	muted: localStorage.getItem('streamium-player-muted'),
	vol: localStorage.getItem('streamium-player-volume')
}));
console.log('after REAL keydown ?:', JSON.stringify(afterRealKey));

const afterSynthetic = await page.evaluate(() => {
	window.__probeKeys.length = 0;
	const el = document.activeElement;
	let reached = false;
	const wl = window.addEventListener('keydown', () => { reached = true; }, false);
	try { el?.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true })); } catch {}
	setTimeout(() => window.removeEventListener('keydown', wl), 50);
	return new Promise((r) => setTimeout(() => r({ reached, tag: el?.tagName, cls: el?.className }), 100));
});
console.log('synthetic on activeElement:', JSON.stringify(afterSynthetic));
console.log('pageerrors:', JSON.stringify(pageErrors));
console.log('console errors:', JSON.stringify(consoleErrors.slice(0, 5)));
await browser.close();