import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("PAGE ERR:", e.message.slice(0, 200)));
try {
	await page.goto("https://streamium-cosmic.vercel.app/afrikaans", { waitUntil: "domcontentloaded", timeout: 90000 });
	await page.waitForTimeout(4000);
	await page.getByRole("button", { name: /Kies vir my|Select for me/i }).first().click().catch((e) => console.log("open err:", e.message));
	await page.waitForTimeout(3000);
	const dialogs = page.locator("[role='dialog']");
	console.log("dialogs:", await dialogs.count());
	const watch = page.getByRole("button", { name: /Kyk Nou|Watch now/i });
	console.log("watch buttons:", await watch.count());
	for (const w of await watch.all()) {
		const t = (await w.innerText()).trim();
		const vis = await w.isVisible();
		console.log(`watch btn: "${t}" visible=${vis}`);
	}
	if (await watch.count()) {
		await watch.first().click().catch((e) => console.log("click err:", e.message));
		await page.waitForTimeout(4000);
		console.log("URL after watch:", page.url());
	}
} catch (e) {
	console.log("exception:", e.message);
}
await browser.close();