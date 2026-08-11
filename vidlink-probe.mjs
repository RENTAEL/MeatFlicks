import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');

await page.evaluate(() => {
	window.__msgs = [];
	window.addEventListener('message', (e) => {
		if (e.origin !== 'https://vidlink.pro') return;
		window.__msgs.push({ t: e.data?.type ?? '?', data: e.data });
	});
	const f = document.createElement('iframe');
	f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:none';
	f.src = 'https://vidlink.pro/movie/550?autoplay=true&startAt=90';
	document.body.appendChild(f);
});

await page.waitForTimeout(14000);
const msgs = await page.evaluate(() => window.__msgs);
console.log('messages captured:', msgs.length);
msgs.slice(0, 12).forEach((m) => console.log(JSON.stringify(m).slice(0, 280)));

await browser.close();
process.exit(0);
