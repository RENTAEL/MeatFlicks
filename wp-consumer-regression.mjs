import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const pages = [
	{ name: 'movie', url: '/movie/550', selector: 'iframe.player-iframe' },
	{ name: 'tv', url: '/tv/1399' },
	{ name: 'tv-ep', url: '/tv/1399/1/1' }
];

const browser = await chromium.launch();
for (const p of pages) {
	const page = await browser.newPage();
	const scans = [];
	page.on('request', (r) => { if (r.url().includes('/scan')) scans.push(r.url().split('?')[1]); });
	await page.goto(BASE + p.url, { waitUntil: 'load', timeout: 60000 });
	await page.waitForTimeout(18000);
	const state = await page.evaluate(() => ({
		overlay: document.querySelector('.overlay')?.textContent?.slice(0, 40) ?? null,
		iframeSrc: document.querySelector('iframe.player-iframe')?.getAttribute('src') ?? null,
		controls: !!document.querySelector('.player-controls')
	}));
	console.log(p.name, JSON.stringify(state), '| scans:', scans.length, scans[0] ?? '');
	await page.close();
}
await browser.close();
process.exit(0);
