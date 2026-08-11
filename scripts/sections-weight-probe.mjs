import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const reqs = new Map();
page.on('request', (r) => {
	const u = r.url();
	if (u.includes('/api/images')) reqs.set('img:' + u.split('?')[0].split('/').pop(), (reqs.get('img:' + u.split('?')[0].split('/').pop()) ?? 0) + 1);
	else if (u.includes('/api/')) reqs.set(u.split('/').slice(-2).join('/'), (reqs.get(u.split('/').slice(-2).join('/')) ?? 0) + 1);
});

const marks = [];
const t0 = Date.now();
await page.goto(`${BASE}/movies`, { waitUntil: 'domcontentloaded', timeout: 90000 });
marks.push(['domcontentloaded', Date.now() - t0]);
await new Promise((r) => setTimeout(r, 6000));
marks.push(['+6s', Date.now() - t0]);

const info = await page.evaluate(() => {
	const walk = (root) => {
		let n = 0;
		const stack = [root];
		while (stack.length) {
			const el = stack.pop();
			n++;
			stack.push(...el.children);
		}
		return n;
	};
	return {
		nodes: walk(document.body),
		images: document.images.length,
		cardLinks: document.querySelectorAll('a[href^="/movie/"], a[href^="/tv/"]').length,
		scrollY: window.scrollY,
		bodyScrollHeight: document.body.scrollHeight
	};
});
console.log('marks:', JSON.stringify(marks));
console.log('page:', JSON.stringify(info));
console.log('requests:', JSON.stringify(Object.fromEntries(reqs), null, 0));

const long = await page.evaluate(async () => {
	const start = performance.now();
	let longs = [];
	const obs = new PerformanceObserver((list) => {
		for (const e of list.getEntries()) longs.push(Math.round(e.duration));
	});
	obs.observe({ entryTypes: ['longtask'] });
	await new Promise((r) => setTimeout(r, 4000));
	return { elapsed: Math.round(performance.now() - start), longs };
});
console.log('long tasks in 4s window:', JSON.stringify(long));

await browser.close();
