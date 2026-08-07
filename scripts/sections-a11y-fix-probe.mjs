import { chromium } from "playwright";

const BASE = "https://streamium-cosmic.vercel.app";
const EXPECTED_PRIMARY = "oklch(47% .15 310)";
const ROUTES = ["/movies", "/tv", "/", "/afrikaans"];

const cssAsset = await (await fetch(`${BASE}/tv`, { cache: "no-store" })).text();
const m = [...cssAsset.matchAll(/assets\/app\.([\w-]+)\.css/g)][0];
const css = await (await fetch(`${BASE}/_app/immutable/assets/app.${m[1]}.css`, { cache: "no-store" })).text();
const flat = css.replace(/\s+/g, " ");

const decls = [...flat.matchAll(/--primary:([^;}]+);/g)].map((x) => x[1]);
const hasDark = flat.includes(`.dark{`);
const darkPrimary = decls.filter((v) => v === EXPECTED_PRIMARY).length;
const viewportLine = await (await fetch(`${BASE}/movies`, { cache: "no-store" })).text();
const viewportMeta = viewportLine.match(/<meta name="viewport"[^>]*>/)?.[0] ?? "MISSING";
const zoomBlocked = /maximum-scale|user-scalable/.test(viewportMeta);
console.log(`CSS asset app.${m[1]}.css`);
console.log(`--primary decls in css:`, decls.join(" | "));
console.log(`--primary === ${EXPECTED_PRIMARY} (${darkPrimary}/2 decls):`, darkPrimary === 2 ? "PASS" : "FAIL");
console.log(`has .dark{} block:`, hasDark ? "PASS" : "FAIL");
console.log(`viewport meta:`, viewportMeta);
console.log(`zoom allowed (no user-scalable/maximum-scale):`, zoomBlocked ? "FAIL" : "PASS");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}?${Date.now()}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const vp = await page.locator('meta[name="viewport"]').getAttribute("content");
  const play = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[data-slot="button"]')].find((x) => x.textContent.trim().startsWith("Play")) ?? null;
    if (!a) return null;
    const s = getComputedStyle(a);
    return { bg: s.backgroundColor, fg: s.color };
  });
  const bgOk = play && String(play.bg).includes("oklch(0.47 0.15 310)");
  const vpOk = !/maximum-scale|user-scalable/.test(vp ?? "");
  console.log(
    `${route.padEnd(10)} viewport ${vpOk ? "PASS" : "FAIL"} | play CTA bg ${play ? play.bg : "N/A"} ${
      bgOk ? "PASS (oklch 0.47 .15 310)" : "FAIL"
    }`
  );
}
await browser.close();