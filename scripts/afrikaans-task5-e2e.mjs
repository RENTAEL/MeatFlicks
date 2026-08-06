import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const results = [];
const ok = (l, c) => results.push(`${c ? "PASS" : "FAIL"} ${l}`);
try {
	await page.goto("https://streamium-cosmic.vercel.app/", { waitUntil: "domcontentloaded", timeout: 90000 });
	await page.waitForTimeout(4500);
	ok("home afrikaans rail appears", (await page.locator("h2", { hasText: "Afrikaans Flieks" }).count()) > 0);
	const seeAll = page.locator("a[href='/afrikaans']", { hasText: "See All" });
	ok("rail See All link", (await seeAll.count()) > 0);
	if (await seeAll.count()) {
		await seeAll.first().click();
		await page.waitForURL("**/afrikaans", { timeout: 15000 }).catch(() => {});
		await page.waitForTimeout(1500);
		ok("See All navigates to /afrikaans", page.url().includes("/afrikaans"));
	}
	ok("afrikaans page loaded", (await page.locator("h1").count()) > 0);
} catch (e) {
	results.push(`FAIL exception: ${e.message}`);
}
await browser.close();
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);