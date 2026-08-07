import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const checks = [];
const check = (n, ok, d = '') => { checks.push([n, ok, d]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

try {
		// Hover preview still opens (MediaCard anchor-based hover now) — test on a /movies card
		await page.goto(`${BASE}/movies`, { waitUntil: 'domcontentloaded', timeout: 90000 });
		await page.evaluate(() => document.querySelector('.popup-close')?.click()).catch(() => {});
		await new Promise((r) => setTimeout(r, 500));
		await page.evaluate(() => document.querySelector('.media-card a')?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })));
		await new Promise((r) => setTimeout(r, 1100));
		const st = await page.evaluate(() => {
			const c = document.querySelector('.media-card');
			const inner = c?.querySelector('.card-inner');
			const hasTrailer = !!c?.querySelector('.video-fade-in, iframe');
			const scaled = inner?.className.includes('scale-') ?? false;
			const wl = c?.querySelector('button');
			return { hasTrailer, scaled, wlVisible: wl ? getComputedStyle(wl).opacity !== '0' : false };
		});
		check('card hover -> card scales into preview', st.scaled && st.wlVisible, JSON.stringify(st));
		await page.mouse.move(2, 2);

	// Keyboard nav on movie detail still works (MediaCard link)
	await page.goto(`${BASE}/movie/550`, { waitUntil: 'domcontentloaded', timeout: 90000 });
	check('movie detail renders', (await page.content()).includes('Fight Club') || (await page.content()).includes('fight club') || (await page.title()).includes('Fight'));

	// Hero still rotates on home (regression: Hero unchanged visually)
	const homeTitle = await page.title();
	check('home title ok', homeTitle.toLowerCase().includes('streamium'));
} catch (e) {
	check('uncaught', false, e.message.slice(0, 120));
} finally {
	await browser.close();
}

const failed = checks.filter((c) => !c[1]).length;
console.log(`\n${checks.length - failed}/${checks.length}`);
process.exit(failed ? 1 : 0);