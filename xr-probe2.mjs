import { chromium } from 'playwright';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto('https://streamium-cosmic.vercel.app/settings', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2500);
const r = await page.evaluate(async () => {
	const nav = navigator;
	const hasXr = 'xr' in nav;
	const xrType = hasXr ? typeof nav.xr : null;
	let sessionResult = null;
	if (hasXr && typeof nav.xr.isSessionSupported === 'function') {
		try { sessionResult = await nav.xr.isSessionSupported('immersive-vr'); } catch (e) { sessionResult = 'threw:' + e.message; }
	}
	return { hasXr, xrType, sessionResult, ua: nav.userAgent.slice(0, 80) };
});
console.log(JSON.stringify(r, null, 2));
await b.close();