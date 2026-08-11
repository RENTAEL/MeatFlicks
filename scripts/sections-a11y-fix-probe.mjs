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
    const to01 = (c) =>
      Math.max(...c) > 1.01
        ? c.map((v) => v / 255)
        : c;
    const toRgb = (spec) => {
      const e = document.createElement("span");
      e.style.setProperty("background", `color-mix(in srgb, ${spec} 100%, transparent)`);
      document.body.appendChild(e);
      const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
      e.remove();
      return to01(m);
    };
    const lum = (c) => {
      const f = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const bg = toRgb(s.backgroundColor);
    const fg = toRgb(s.color);
    const ratio = (Math.max(lum(bg), lum(fg)) + 0.05) / (Math.min(lum(bg), lum(fg)) + 0.05);
    return { bg: s.backgroundColor, fg: s.color, ratio };
  });
  const bgOk = play && play.ratio >= 4.5;
  const vpOk = !/maximum-scale|user-scalable/.test(vp ?? "");
  console.log(
    `${route.padEnd(10)} viewport ${vpOk ? "PASS" : "FAIL"} | play CTA ${play ? play.bg + " / " + play.fg + " = " + play.ratio.toFixed(2) + ":1" : "N/A"} ${
      bgOk ? "PASS" : play === null ? "N/A" : "FAIL"
    }`
  );
}
await browser.close();