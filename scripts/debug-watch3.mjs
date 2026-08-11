import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
for (let i = 0; i < 3; i++) {
	try {
		await page.goto("https://streamium-cosmic.vercel.app/afrikaans?type=reekse", { waitUntil: "domcontentloaded", timeout: 90000 });
		await page.getByRole("button", { name: /Kies vir my/ }).click();
		await page.locator('[role="dialog"] h3').first().waitFor({ timeout: 15000 });
		const watch = page.locator('[role="dialog"]').getByRole("button", { name: /Kyk nou/ });
		const t0 = Date.now();
		await watch.click({ timeout: 5000 }).catch((e) => console.log(`run${i} click err:`, e.message));
		await page.waitForTimeout(2500);
		console.log(`run${i}: after 2.5s URL=${page.url()} (click took ${Date.now() - t0}ms)`);
		if (!page.url().includes("/tv/") && !page.url().includes("/movie/")) {
			await page.waitForTimeout(3000);
			console.log(`run${i}: after 5.5s URL=${page.url()}`);
		}
	} catch (e) {
		console.log(`run${i} exception:`, e.message);
	}
}
await browser.close();