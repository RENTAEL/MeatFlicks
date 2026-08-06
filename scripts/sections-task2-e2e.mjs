import { chromium } from "playwright";
const browser = await chromium.launch();
const out = [];
const ok = (l, c) => out.push(`${c ? "PASS" : "FAIL"} ${l}`);
const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Movies page: hero, rails, filters, infinite scroll
await desktop.goto("https://streamium-cosmic.vercel.app/movies", { waitUntil: "domcontentloaded", timeout: 90000 });
await desktop.waitForTimeout(5000);
ok("movies hero", (await desktop.locator("section").first().count()) > 0);
const mRails = ["Neig / Trending", "Gewild / Popular", "Topgewaardeer / Top Rated", "Binnekort / Upcoming", "In Teaters / Now Playing", "Aksie / Action", "Komedie / Comedy", "Drama", "Gruwel / Horror", "Wetenskapfiksie / Sci-Fi", "Dokumentêr / Documentary"];
for (const r of mRails) ok(`movies rail '${r}'`, (await desktop.locator("h2", { hasText: r }).count()) > 0);
ok("movies Alles grid", (await desktop.locator("a[href^='/movie/']").count()) > 10);

// genre chip → URL + results
await desktop.getByRole("button", { name: /Aksie \/ Action/ }).click();
await desktop.waitForTimeout(3000);
ok("movies genre URL", desktop.url().includes("genre=28"));
ok("movies genre results", (await desktop.locator("a[href^='/movie/']").count()) > 0);

// sort select
await desktop.selectOption("#movies-sort", "rating");
await desktop.waitForTimeout(3000);
ok("movies sort URL", desktop.url().includes("sort=rating"));

// category chip
await desktop.getByRole("button", { name: /Binnekort \/ Upcoming/ }).click();
await desktop.waitForTimeout(3000);
ok("movies category URL", desktop.url().includes("category=upcoming"));

// TV page: hero + rails + type toggle
await desktop.goto("https://streamium-cosmic.vercel.app/tv", { waitUntil: "domcontentloaded", timeout: 90000 });
await desktop.waitForTimeout(5000);
ok("tv hero", (await desktop.locator("section").first().count()) > 0);
const tRails = ["Neig / Trending", "Gewild / Popular", "Vandag Op Lug / Airing Today", "Op Die Lug / On The Air", "Misdaad / Crime", "Animasiereeks / Animation"];
for (const r of tRails) ok(`tv rail '${r}'`, (await desktop.locator("h2", { hasText: r }).count()) > 0);
await desktop.getByRole("button", { name: /Minireeks \/ Miniseries/ }).click();
await desktop.waitForTimeout(3000);
ok("tv type URL", desktop.url().includes("type=minireeks"));
ok("tv miniseries results", (await desktop.locator("a[href^='/tv/']").count()) > 0);
await desktop.getByRole("button", { name: /Alles \/ All/ }).click();
await desktop.waitForTimeout(3000);
ok("tv alles URL", desktop.url().includes("type=alles"));

console.log(out.join("\n"));
await browser.close();
process.exit(out.some((r) => r.startsWith("FAIL")) ? 1 : 0);