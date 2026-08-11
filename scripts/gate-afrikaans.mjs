import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const results = [];
const ok = (l, c) => results.push(`${c ? "PASS" : "FAIL"} ${l}`);
try {
	await page.goto("https://streamium-cosmic.vercel.app/afrikaans", { waitUntil: "domcontentloaded", timeout: 90000 });
	await page.waitForTimeout(5000);
	const rails = ["Kurators se Keuses", "Nuut", "Gewild", "Klassieke", "Topgewaardeer", "Reekse", "Drama", "Komedie", "Dokumentêre"];
	for (const r of rails) ok(`rail '${r}'`, (await page.locator("h2", { hasText: r }).count()) > 0);
	const hero = page.locator("section").first();
	ok("hero rendered", (await hero.count()) > 0);
	ok("grid cards", (await page.locator("a[href^='/movie/'], a[href^='/tv/']").count()) > 0);
	const r = await page.request.get("https://streamium-cosmic.vercel.app/afrikaans/12345", { maxRedirects: 0 }).catch((e) => e.response);
	ok("301 /afrikaans/[id] -> /movie", r.status() === 301 || r.status() === 302);
	const r2 = await page.request.get("https://streamium-cosmic.vercel.app/afrikaans/999999999", { maxRedirects: 0 }).catch((e) => e.response);
	ok("301 nonexistent -> /afrikaans", r2.status() === 301 || r2.status() === 302);
} catch (e) {
	results.push(`FAIL exception: ${e.message}`);
}
await browser.close();
console.log(results.join("\n"));
process.exit(results.some((x) => x.startsWith("FAIL")) ? 1 : 0);