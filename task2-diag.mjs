import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const mockMovie = {
	id: 999001, tmdbId: 27205, title: 'Task2 Test Movie', mediaType: 'movie',
	posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', canonicalPath: '/movie/999001'
};
const seed = {
	'movie:999001': {
		mediaId: '999001', mediaType: 'movie', progress: 1500, duration: 5400,
		updatedAt: Date.now(), mediaData: mockMovie
	}
};
await ctx.addInitScript((data) => {
	localStorage.setItem('streamium.playback_progress', JSON.stringify(data));
}, seed);
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
const stored = await page.evaluate(() => localStorage.getItem('streamium.playback_progress'));
console.log('stored:', stored?.slice(0, 120));
const before = await page.evaluate(() => ({
	placeholder: document.querySelectorAll('.animate-pulse').length,
	scrollY: window.scrollY,
	scrollHeight: document.documentElement.scrollHeight,
	innerHeight: window.innerHeight
}));
console.log('before scroll:', JSON.stringify(before));
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(2000);
const after = await page.evaluate(() => ({
	placeholder: document.querySelectorAll('.animate-pulse').length,
	scrollY: window.scrollY,
	cw: [...document.querySelectorAll('h2')].map((h) => h.textContent).filter((t) => t && t.includes('ontinue'))
}));
console.log('after scroll:', JSON.stringify(after));
await browser.close();
