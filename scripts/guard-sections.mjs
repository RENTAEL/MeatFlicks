import { chromium } from "playwright";
const browser = await chromium.launch();
const out = [];
const ok = (l, c) => out.push(`${c ? "PASS" : "FAIL"} ${l}`);
const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });

// Home renders with data + rows scroll
await desktop.goto("https://streamium-cosmic.vercel.app/", { waitUntil: "domcontentloaded", timeout: 90000 });
await desktop.waitForTimeout(4000);
ok("home renders rows", (await desktop.locator("h2").count()) > 4);
ok("home rows scroll", (await desktop.locator("a[href^='/movie/']").count()) > 3);

// /afrikaans intact
await desktop.goto("https://streamium-cosmic.vercel.app/afrikaans", { waitUntil: "domcontentloaded", timeout: 90000 });
await desktop.waitForTimeout(4000);
ok("afrikaans hero", (await desktop.locator("section").first().count()) > 0);
ok("afrikaans rails", (await desktop.locator("h2", { hasText: "Gewild" }).count()) > 0);

// movie + tv detail render
await desktop.goto("https://streamium-cosmic.vercel.app/movie/550", { waitUntil: "domcontentloaded", timeout: 90000 });
await desktop.waitForTimeout(4000);
ok("movie detail 550", (await desktop.locator("h1").count()) > 0);
await desktop.goto("https://streamium-cosmic.vercel.app/tv/1399", { waitUntil: "domcontentloaded", timeout: 90000 });
await desktop.waitForTimeout(4000);
ok("tv detail 1399", (await desktop.locator("h1").count()) > 0);

// mobile overflow on affected pages
for (const p of ["/movies", "/tv", "/"]) {
	await mobile.goto(`https://streamium-cosmic.vercel.app${p}`, { waitUntil: "domcontentloaded", timeout: 90000 });
	await mobile.waitForTimeout(3000);
	const over = await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
	ok(`mobile ${p} no overflow`, over <= 1);
}

console.log(out.join("\n"));
await browser.close();
process.exit(out.some((r) => r.startsWith("FAIL")) ? 1 : 0);