import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
try {
	await page.goto("https://streamium-cosmic.vercel.app/afrikaans", { waitUntil: "domcontentloaded", timeout: 90000 });
	await page.waitForTimeout(5000);
	const before = await page.locator(".afrikaans-more, [class*='afrikaans'] a[href^='/movie/'], a[href^='/tv/']").count().catch(() => -1);
	console.log("cards pre:", before);
	const sentinel = page.locator(".afrikaans-more");
	console.log("sentinel count:", await sentinel.count());
	if (await sentinel.count()) {
		await sentinel.scrollIntoViewIfNeeded();
		await page.waitForTimeout(5000);
	}
	const after = await page.locator(".afrikaans-more").count();
	console.log("sentinel post:", after);
	console.log("URL:", page.url());
	await page.waitForTimeout(3000);
	const total = await page.locator("a[href^='/movie/'], a[href^='/tv/']").count();
	console.log("cards post:", total);
} catch (e) {
	console.log("exception:", e.message);
}
await browser.close();