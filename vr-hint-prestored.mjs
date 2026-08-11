import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => { localStorage.setItem('streamium-display-mode', 'vr'); });
const page = await ctx.newPage();
page.setDefaultTimeout(45000);

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.fill('input[name="username"]', 'questvrmsd5epa1');
await page.fill('input[name="password"]', 'Testpass123!');
await page.click('button[type="submit"]', { timeout: 15000 });
await page.waitForTimeout(4000);
await page.goto(BASE + '/settings', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(4000);

const snap = await page.evaluate(() => ({
	stored: localStorage.getItem('streamium-display-mode'),
	modes: [...document.querySelectorAll('.mode-btn')].map((x) => ({ txt: x.textContent.trim(), cls: x.className })),
	hasHint: !!document.querySelector('.vr-hint'),
	hintText: document.querySelector('.vr-hint')?.textContent?.trim() ?? null,
}));
console.log(JSON.stringify(snap, null, 1));
await b.close();