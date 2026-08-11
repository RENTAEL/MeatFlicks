import { chromium } from 'playwright';
const b = await chromium.launch();
const page = await b.newPage();
const r = await page.evaluate(async () => {
	const nav = navigator;
	let xrExists = 'xr' in nav;
	let hasFn = typeof nav.xr?.isSessionSupported === 'function';
	let result = null;
	if (hasFn) {
		try { result = await nav.xr.isSessionSupported('immersive-vr'); } catch (e) { result = 'ERR:' + e.message; }
	}
	return { xrExists, hasSessionFn: hasFn, immersiveVr: result, userAgent: nav.userAgent.slice(0, 60) };
});
console.log(JSON.stringify(r, null, 2));
await b.close();