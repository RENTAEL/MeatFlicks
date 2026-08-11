import { chromium } from 'playwright';

const routes = {
	home: '/',
	movies: '/movies',
	'movie-detail': '/movie/969681',
	tv: '/tv',
	'tv-detail': '/tv/94997',
	afrikaans: '/afrikaans'
};

const browser = await chromium.launch();
for (const [name, path] of Object.entries(routes)) {
	const page = await browser.newPage();
	let jsBytes = 0;
	const files = new Set();
	page.on('response', async (r) => {
		const url = r.url();
		if (url.includes('/_app/immutable/') && r.request().resourceType() === 'script') {
			files.add(url.split('/').pop());
			try { jsBytes += (await r.body()).length; } catch {}
		}
	});
	await page.goto('https://streamium-cosmic.vercel.app' + path, { waitUntil: 'load', timeout: 60000 });
	await page.waitForTimeout(1200);
	console.log(`${name}: ${(jsBytes / 1024).toFixed(1)} kB across ${files.size} files`);
	await page.close();
}
await browser.close();