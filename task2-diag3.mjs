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
const chunkReqs = [];
page.on('request', (r) => {
	if (r.url().includes('ContinueWatching') || r.url().includes('_app/immutable')) chunkReqs.push(r.url());
});
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const state1 = await page.evaluate(() => {
	const pulses = [...document.querySelectorAll('.animate-pulse')].map((el) => el.className.slice(0, 60));
	return {
		pulses,
		cwText: [...document.querySelectorAll('h2, h3')].map((h) => h.textContent).filter((t) => t && t.includes('ontinue')),
		ls: (localStorage.getItem('streamium.playback_progress') || '').slice(0, 80)
	};
});
console.log('t+3s:', JSON.stringify(state1));
await page.evaluate(() => {
	const candidates = [...document.querySelectorAll('*')]
		.filter((el) => el.scrollHeight > el.clientHeight + 50)
		.sort((a, b) => b.scrollHeight - a.scrollHeight);
	const sc = candidates[0];
	console.log('SCROLLER:', sc ? `${sc.tagName}.${String(sc.className).slice(0, 50)} sh=${sc.scrollHeight} ch=${sc.clientHeight}` : 'none');
	if (sc) sc.scrollTop = sc.scrollHeight;
});
await page.waitForTimeout(4000);
const state2 = await page.evaluate(() => ({
	pulses: document.querySelectorAll('.animate-pulse').length,
	cwText: [...document.querySelectorAll('h2, h3')].map((h) => h.textContent).filter((t) => t && t.includes('ontinue')),
	scrollTop: (() => {
		const candidates = [...document.querySelectorAll('*')]
			.filter((el) => el.scrollHeight > el.clientHeight + 50)
			.sort((a, b) => b.scrollHeight - a.scrollHeight);
		return candidates[0] ? candidates[0].scrollTop : null;
	})()
}));
console.log('t+7s:', JSON.stringify(state2));
console.log('chunk reqs sample:', chunkReqs.filter((u) => u.includes('ContinueWatching')).slice(0, 3));
await browser.close();