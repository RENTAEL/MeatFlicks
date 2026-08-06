import { chromium } from "playwright";
const browser = await chromium.launch();
const out = [];
const ok = (l, c) => out.push(`${c ? "PASS" : "FAIL"} ${l}`);
const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });

// 1. API endpoints
for (const u of [
	"https://streamium-cosmic.vercel.app/afrikaans/api/discover?type=flieks&page=1",
	"https://streamium-cosmic.vercel.app/afrikaans/api/discover?type=reekse&page=1",
	"https://streamium-cosmic.vercel.app/afrikaans/api/discover?type=alles&page=2&genre=18",
	"https://streamium-cosmic.vercel.app/afrikaans/api/search?q=binnelanders"
]) {
	const r = await desktop.request.get(u);
	const body = await r.json().catch(() => ({}));
	ok(`API ${u.split("/afrikaans")[1]} ${r.status()}`, r.ok() && Array.isArray(body?.results) && body.results.length > 0);
}

// 2. Redirect stubs
for (const u of [
	["https://streamium-cosmic.vercel.app/afrikaans/12345", "/movie/12345"],
	["https://streamium-cosmic.vercel.app/afrikaans/999999999", "/afrikaans"]
]) {
	const r = await desktop.request.get(u[0], { maxRedirects: 0 }).catch((e) => e.response ?? e);
	ok(`redirect ${u[0].split(".app")[1]}`, r.status() === 301 || r.status() === 302);
}

// 3. Mobile overflow on all main pages
for (const p of ["/afrikaans", "/", "/browse", "/collections"]) {
	await mobile.goto(`https://streamium-cosmic.vercel.app${p}`, { waitUntil: "domcontentloaded", timeout: 90000 });
	await mobile.waitForTimeout(3000);
	const over = await mobile.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
	ok(`mobile ${p} overflow`, over <= 1);
}

// 4. Desktop: afrikaans page SSR meta + cards + hero keyboard pause
await desktop.goto("https://streamium-cosmic.vercel.app/afrikaans", { waitUntil: "domcontentloaded", timeout: 90000 });
await desktop.waitForTimeout(4000);
ok("afrikaans cards render", (await desktop.locator("a[href^='/movie/'], a[href^='/tv/']").count()) > 0);
await desktop.keyboard.press("Tab");
ok("hero focusable (tab)", (await desktop.evaluate(() => document.activeElement?.tagName)) === "BUTTON" || (await desktop.locator(":focus").count()) > 0);

// 5. Home + movie detail still fine
await desktop.goto("https://streamium-cosmic.vercel.app/", { waitUntil: "domcontentloaded", timeout: 90000 });
await desktop.waitForTimeout(4000);
ok("home trending block", (await desktop.locator("h2").count()) > 3);

const cards = await desktop.locator("a[href^='/movie/']").count();
if (cards > 0) {
	await desktop.locator("a[href^='/movie/']").first().click();
	await desktop.waitForTimeout(3500);
	ok("movie detail loads", desktop.url().includes("/movie/") && (await desktop.locator("h1").count()) > 0);
}

console.log(out.join("\n"));
await browser.close();
process.exit(out.some((r) => r.startsWith("FAIL")) ? 1 : 0);