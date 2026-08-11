import { chromium } from 'playwright';
const BASE = 'https://streamium-cosmic.vercel.app';
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto(BASE + '/tv/1399/1/1', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('.player-controls', { timeout: 30000 }).catch(() => {});
const r = await p.evaluate(() => ({
	playerRoots: document.querySelectorAll('.player-root').length,
	controlsBars: document.querySelectorAll('.player-controls').length,
	iframeContainers: document.querySelectorAll('.iframe-container').length,
	inlinePlayers: document.querySelectorAll('.inline-player').length,
	volumeSliders: document.querySelectorAll('.player-controls input[type="range"]').length
}));
console.log(JSON.stringify(r));
await b.close();