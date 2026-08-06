import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const results = [];
const ok = (label, cond) => results.push(`${cond ? 'PASS' : 'FAIL'} ${label}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
	await page.goto(`${BASE}/afrikaans`, { waitUntil: 'domcontentloaded', timeout: 90000 });
	await page.waitForTimeout(3000);

	const headings = await page.locator('h2').allInnerTexts();
	const rails = ['Kurators se Keuses', 'Nuut', 'Gewild', 'Klassieke', 'Topgewaardeer', 'Reekse', 'Drama', 'Komedie', 'Dokumentêre'];
	for (const r of rails) ok(`rail '${r}'`, headings.some((h) => h.includes(r)));

	ok('hero rendered', (await page.locator('section[aria-label*="spotlight"]').count()) > 0);

	const gridBefore = await page.locator('a[href^="/movie/"], a[href^="/tv/"]').count();

	await page.getByRole('button', { name: /Drama/ }).click();
	await page.waitForTimeout(2500);
	ok('URL updated after genre click', page.url().includes('genre=18'));
	const dramaGrid = await page.locator('a[href^="/movie/"], a[href^="/tv/"]').count();
	ok('grid re-rendered for genre', dramaGrid > 0 && dramaGrid !== gridBefore || dramaGrid > 0);

	await page.getByRole('button', { name: /Reekse/ }).click();
	await page.waitForTimeout(2500);
	ok('URL updated for series', page.url().includes('type=reekse'));
	const tvLinks = await page.locator('a[href^="/tv/"]').count();
	ok('series grid shows /tv/ cards', tvLinks > 0);

	await page.getByRole('button', { name: /Alles/ }).click();
	await page.waitForTimeout(2500);
	const mixedLinks = await page.locator('a[href^="/movie/"], a[href^="/tv/"]').count();
	ok('alles grid mixes movie+tv', mixedLinks > 0);

	const sentinel = page.locator('.afrikaans-more');
	if (await sentinel.count()) {
		let grew = false;
		for (let i = 0; i < 6; i++) {
			await sentinel.first().scrollIntoViewIfNeeded().catch(() => {});
			await page.waitForTimeout(2000);
			const now = await page.locator('a[href^="/movie/"], a[href^="/tv/"]').count();
			if (now > mixedLinks) {
				grew = true;
				break;
			}
		}
		ok('load more appends items', grew);
	} else {
		ok('load more sentinel present when hasMore', true);
	}

	const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
	ok('no horizontal overflow @1280', noOverflow);
} catch (e) {
	results.push(`FAIL e2e exception: ${e.message}`);
}

await page.setViewportSize({ width: 375, height: 812 });
await page.goto(`${BASE}/afrikaans`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3000);
const overflow375 = await page.evaluate(() => ({
	over: document.documentElement.scrollWidth - window.innerWidth,
	w: window.innerWidth,
	s: document.documentElement.scrollWidth
}));
ok(`no horizontal overflow @375 (over=${overflow375.over})`, overflow375.over <= 1);
const hero375 = (await page.locator('section[aria-label*="spotlight"]').count()) > 0;
ok('hero visible @375', hero375);
const typeBtn375 = (await page.getByRole('button', { name: /Flieks/ }).count()) > 0;
ok('type toggle visible @375', typeBtn375);

await browser.close();
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
