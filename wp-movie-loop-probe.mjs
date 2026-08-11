import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';

const browser = await chromium.launch();
const page = await browser.newPage();
const t0 = Date.now();
page.on('request', (r) => {
	if (r.url().includes('/scan')) console.log('SCAN REQ', ((Date.now() - t0) / 1000).toFixed(1) + 's');
});
page.on('console', (m) => {
	if (m.type() === 'error') console.log('CONSOLE ERR', m.text().slice(0, 120));
});

await page.goto(`${BASE}/movie/550`, { waitUntil: 'load', timeout: 60000 });
for (let i = 0; i < 8; i++) {
	await page.waitForTimeout(4000);
	const s = await page.evaluate(() => ({
		overlay: document.querySelector('.overlay')?.textContent?.slice(0, 40) ?? null,
		iframeSrc: document.querySelector('iframe.player-iframe')?.getAttribute('src') ?? null
	}));
	console.log('SNAP T+' + (4 * (i + 1)) + 's', JSON.stringify(s));
}

await browser.close();
process.exit(0);
