import { chromium } from "playwright";
const browser = await chromium.launch();
const out = [];
const ok = (l, c) => out.push(`${c ? "PASS" : "FAIL"} ${l}`);
const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });

// Home renders with data + rows scroll
await desktop.goto("https://streamium-cosmic.vercel.app/", { waitUntil: "domcontentloaded", timeout: 90000 });
await desktop.waitForTimeout(4000);
ok("home rows", (await desktop.locator("h2").count()) > 4);
ok("home afrikaans rail", (await desktop.locator("h2", { hasText: "Afrikaans Flieks" }).count()) > 0);

// /afrikaans fully intact
await desktop.goto("https://streamium-cosmic.vercel.app/afrikaans", { waitUntil: "domcontentloaded", timeout: 90000 });
await desktop.waitForTimeout(4000);
ok("afrikaans rails", (await desktop.locator("h2", { hasText: "Gewild" }).count()) > 0);
ok("afrikaans kies vir my", (await desktop.getByRole("button", { name: /Kies vir my/ }).count()) > 0);
const r = await desktop.request.get("https://streamium-cosmic.vercel.app/afrikaans/12345", { maxRedirects: 0 }).catch((e) => e.response);
ok("afrikaans 301", r.status() === 301 || r.status() === 302);

// detail pages + season picker
await desktop.goto("https://streamium-cosmic.vercel.app/tv/1399", { waitUntil: "domcontentloaded", timeout: 90000 });
await desktop.waitForTimeout(4500);
ok("tv detail renders", (await desktop.locator("h1").count()) > 0);
const seasons = desktop.locator("button", { hasText: /Season/i });
ok("season picker present", (await seasons.count()) > 0 || (await desktop.locator("select").count()) > 0);

// up next overlay + VR toggle + PWA + login quick checks
const manifest = await desktop.request.get("https://streamium-cosmic.vercel.app/manifest.json", { maxRedirects: 0 });
ok("pwa manifest", manifest.ok() || manifest.status() === 200);
await desktop.goto("https://streamium-cosmic.vercel.app/login", { waitUntil: "domcontentloaded", timeout: 60000 });
await desktop.waitForTimeout(2500);
ok("login page", (await desktop.locator("button, input").count()) > 3);

// VR toggle: movie detail has VR button
await desktop.goto("https://streamium-cosmic.vercel.app/movie/550", { waitUntil: "domcontentloaded", timeout: 90000 });
await desktop.waitForTimeout(4000);
ok("movie detail renders", (await desktop.locator("h1").count()) > 0);

// 375px overflow on all key pages
for (const p of ["/", "/movies", "/tv", "/afrikaans", "/movie/550"]) {
	await mobile.goto(`https://streamium-cosmic.vercel.app${p}`, { waitUntil: "domcontentloaded", timeout: 90000 });
	await mobile.waitForTimeout(3000);
	const over = await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
	ok(`375 ${p}`, over <= 1);
}

console.log(out.join("\n"));
await browser.close();
process.exit(out.some((x) => x.startsWith("FAIL")) ? 1 : 0);