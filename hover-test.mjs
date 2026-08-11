import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const BASE = 'https://streamium-cosmic.vercel.app';
const OUT = 'C:\\Users\\bezui\\AppData\\Local\\Temp\\opencode\\hover-shots';

const browser = await chromium.launch({ headless: true });
const results = {};
try {
	for (const [name, path] of [['movies', '/movies'], ['tv', '/tv'], ['home', '/']]) {
		const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
		const page = await ctx.newPage();
		await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 });
		await page.waitForSelector('.media-card', { timeout: 60000 });
		await page.waitForTimeout(1200);

		const card = page.locator('.media-card').first();
		await card.scrollIntoViewIfNeeded();
		await page.waitForTimeout(600);
		const before = await card.locator('.card-inner').boundingBox();
		const rowProbe = await page.evaluate(() => {
			const sc = document.querySelector('.scroll-content');
			return sc ? { ch: sc.clientHeight, sh: sc.scrollHeight, cw: sc.clientWidth, sw: sc.scrollWidth } : null;
		});

		const b = await card.boundingBox();
		await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
		await page.waitForTimeout(1100); // 600ms hover timer + buffer

		const after = await card.locator('.card-inner').boundingBox();
		const preview = await page.evaluate(() => {
			const inner = document.querySelector('.card-inner');
			const info = document.querySelector('.card-inner .animate-slide-up-fade');
			const trailer = document.querySelector('.card-inner iframe[src*="youtube"]');
			return {
				visible: info ? info.getBoundingClientRect().width > 0 && info.getBoundingClientRect().height > 20 : false,
				trailer,
				innerRect: inner ? { w: inner.getBoundingClientRect().width, h: inner.getBoundingClientRect().height } : null,
				transform: inner ? getComputedStyle(inner).transform : null,
			};
		});
		const rowAfter = await page.evaluate(() => {
			const sc = document.querySelector('.scroll-content');
			const firstMediaCard = document.querySelector('.media-card');
			let rowScrollHeight = null;
			if (sc) {
				const cards = [...sc.querySelectorAll('.media-card')];
				const last = cards[cards.length - 1];
				rowScrollHeight = last ? last.getBoundingClientRect().bottom - sc.getBoundingClientRect().top : sc.scrollHeight;
			}
			return sc ? { clientH: sc.clientHeight, scrollH: sc.scrollHeight, cardsBottomOverflow: rowScrollHeight } : null;
		});

		await page.screenshot({ path: `${OUT}\\${name}-hover.png`, fullPage: false });
		await ctx.close();

		results[name] = {
			beforeBox: { w: Math.round(after?.width ?? before?.width ?? 0), h: Math.round(before?.height ?? 0) },
			afterBox: after ? { w: Math.round(after.width), h: Math.round(after.height) } : null,
			heightPreserved: !!after && after.height >= (before?.height ?? 0) * 0.97,
			preview: preview.visible,
			trailer: preview.trailer,
			transform: preview.transform,
			rowBefore: rowProbe,
			rowAfter,
		};
	}
} finally {
	await browser.close();
}
writeFile('C:\\Users\\bezui\\AppData\\Local\\Temp\\opencode\\hover-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));