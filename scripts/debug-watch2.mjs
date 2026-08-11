import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log("PAGE ERR:", e.message.slice(0, 160)));
try {
	await page.goto("https://streamium-cosmic.vercel.app/afrikaans?type=reekse", { waitUntil: "domcontentloaded", timeout: 90000 });
	await page.waitForTimeout(4000);
	await page.getByRole("button", { name: /Kies vir my/ }).click();
	await page.waitForTimeout(6000);
	const dlg = page.locator('[role="dialog"]');
	console.log("dialog count:", await dlg.count());
	if (await dlg.count()) {
		const h3 = await dlg.locator("h3").innerText();
		console.log("dialog h3:", JSON.stringify(h3));
		const watch = dlg.getByRole("button", { name: /Kyk nou/ });
		console.log("watch:", await watch.count());
		if (await watch.count()) {
			await watch.click();
			await page.waitForTimeout(4000);
			console.log("URL after watch:", page.url());
		} else {
			console.log("h3 text:", await dlg.innerText());
		}
	}
} catch (e) {
	console.log("exception:", e.message);
}
await browser.close();