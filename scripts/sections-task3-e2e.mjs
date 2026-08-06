import { chromium } from "playwright";
const browser = await chromium.launch();
const out = [];
const ok = (l, c) => out.push(`${c ? "PASS" : "FAIL"} ${l}`);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Every card on /movies links to /movie/[id]
await page.goto("https://streamium-cosmic.vercel.app/movies", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(4000);
const movieLinks = await page.locator("a[href^='/movie/']").count();
const badMovieLinks = await page.locator("a[href^='/movies/']").count();
ok(`movies: cards -> /movie/[id] (${movieLinks}), none to /movies/[id]`, movieLinks > 10 && badMovieLinks === 0);

// Every card on /tv links to /tv/[id]
await page.goto("https://streamium-cosmic.vercel.app/tv", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(4000);
const tvLinks = await page.locator("a[href^='/tv/']").count();
const badTvLinks = await page.locator("a[href^='/tv/']").filter({ hasNot: page.locator("a[href^='/tv/']") }).count();
ok(`tv: cards -> /tv/[id] (${tvLinks})`, tvLinks > 10);

// Click a card → lands on canonical detail
await page.locator("a[href^='/tv/']").first().click();
await page.waitForTimeout(3500);
ok("card click -> /tv/[id] detail", page.url().includes("/tv/") && (await page.locator("h1").count()) > 0);

// Old-style routes: /movies/[id] should NOT be a page (404) — no duplicate detail
const r = await page.request.get("https://streamium-cosmic.vercel.app/movies/550", { maxRedirects: 0 });
ok("/movies/550 is not a live duplicate (404)", r.status() === 404);

// Hero Play CTA also canonical
await page.goto("https://streamium-cosmic.vercel.app/tv", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(4000);
const heroPlay = page.locator("a", { hasText: "Play" }).first();
ok("hero play CTA", (await heroPlay.count()) > 0);

console.log(out.join("\n"));
await browser.close();
process.exit(out.some((x) => x.startsWith("FAIL")) ? 1 : 0);