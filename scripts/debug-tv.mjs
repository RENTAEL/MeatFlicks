import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
try {
	await page.goto("https://streamium-cosmic.vercel.app/tv", { waitUntil: "domcontentloaded", timeout: 90000 });
	await page.waitForTimeout(6000);
	console.log("h1:", (await page.locator("h1").innerText().catch(() => "(none)")));
	console.log("rails:", (await page.locator("h2").allInnerTexts()).slice(0, 12));
	const btns = await page.locator("button").allInnerTexts();
	console.log("buttons:", btns.filter((t) => t.includes("Reek") || t.includes("Mini") || t.includes("Alles") || t.includes("Kategorie")).slice(0, 8));
	console.log("URL:", page.url());
	console.log("grid cards:", await page.locator("a[href^='/tv/']").count());
} catch (e) {
	console.log("exception:", e.message);
}
await browser.close();