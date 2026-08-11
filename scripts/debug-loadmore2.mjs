import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
try {
	await page.goto("https://streamium-cosmic.vercel.app/afrikaans", { waitUntil: "domcontentloaded", timeout: 90000 });
	await page.waitForTimeout(4000);
	await page.getByRole("button", { name: /Drama/ }).click();
	await page.waitForTimeout(2000);
	await page.getByRole("button", { name: /Reekse/ }).click();
	await page.waitForTimeout(2000);
	await page.getByRole("button", { name: /Alles/ }).click();
	await page.waitForTimeout(2500);
	console.log("mixed after Alles:", await page.locator("a[href^='/movie/'], a[href^='/tv/']").count());
	const sentinel = page.locator(".afrikaans-more");
	console.log("sentinel:", await sentinel.count());
	console.log("sentinel visible:", await sentinel.first().isVisible().catch(() => false));
	await sentinel.first().scrollIntoViewIfNeeded().catch(() => {});
	await page.waitForTimeout(5000);
	console.log("after scroll:", await page.locator("a[href^='/movie/'], a[href^='/tv/']").count());
} catch (e) {
	console.log("exception:", e.message);
}
await browser.close();