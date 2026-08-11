import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(BASE + '/tv/1399/1/1', { waitUntil: 'domcontentloaded' });

const urls = await page.evaluate(() => {
	const out = [];
	document.querySelectorAll('script').forEach((s) => out.push(s.src || '(inline)'));
	document.querySelectorAll('link[rel="modulepreload"]').forEach((l) => out.push(l.href));
	return [...new Set(out.filter((u) => u.includes('/_app/immutable/') && !u.startsWith('blob')))];
});

const hits = [];
for (const url of urls) {
	try {
		const res = await ctx.request.get(url);
		const text = await res.text();
		if (text.includes('player-root') || text.includes('player-controls') || (text.includes('keydown') && text.includes('closest'))) {
			hits.push({
				file: url.split('/').pop(),
				root: text.includes('player-root'),
				controls: text.includes('player-controls'),
				keydown: text.includes('keydown'),
				closest: text.includes('closest')
			});
		}
	} catch {}
}
console.log(JSON.stringify(hits, null, 1));
console.log('total chunks scanned:', urls.length);
await browser.close();