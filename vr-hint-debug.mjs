import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(45000);

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.fill('input[name="username"]', 'questvrmsd5epa1');
await page.fill('input[name="password"]', 'Testpass123!');
await page.click('button[type="submit"]', { timeout: 15000 });
await page.waitForTimeout(4000);
await page.goto(BASE + '/settings', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(4000);

const snapshot = async (label) => {
	const info = await page.evaluate(() => ({
		stored: localStorage.getItem('streamium-display-mode'),
		modes: [...document.querySelectorAll('.mode-btn')].map((x) => ({ txt: x.textContent.trim(), cls: x.className })),
		hasHint: !!document.querySelector('.vr-hint'),
		hintText: document.querySelector('.vr-hint')?.textContent?.trim() ?? null,
	}));
	console.log(label, JSON.stringify(info, null, 1));
	return info;
};

const before = await snapshot('before');
await page.locator('.mode-btn', { hasText: 'VR Mode' }).click();
await page.waitForTimeout(1200);
const during = await snapshot('during(+1.2s)');
await page.waitForTimeout(5000);
const after = await snapshot('after(+5s)');
await page.screenshot({ path: 'C:\\Users\\bezui\\AppData\\Local\\Temp\\opencode\\settings-vr3.png', fullPage: true });

console.log(JSON.stringify({ before, during, after }, null, 2));
await b.close();