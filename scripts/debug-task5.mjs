import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
try {
	await page.goto("https://streamium-cosmic.vercel.app/", { waitUntil: "domcontentloaded", timeout: 90000 });
	await page.waitForTimeout(4500);
	for (const a of await page.locator("a", { hasText: "See All" }).all()) {
		console.log("SeeAll href:", await a.getAttribute("href"));
	}
	const railBlock = page.locator("div", { has: page.locator("h2", { hasText: "Afrikaans Flieks" }) }).first();
	const seeAll = railBlock.locator("a", { hasText: "See All" });
	console.log("scoped count:", await seeAll.count(), "href:", await seeAll.first().getAttribute("href").catch(() => "(none)"));
	await seeAll.first().click().catch((e) => console.log("click err", e.message));
	await page.waitForTimeout(4000);
	console.log("URL after click:", page.url());
} catch (e) {
	console.log("exception:", e.message);
}
await browser.close();