import { chromium } from "playwright";

const URLS = {
  movies: "https://streamium-cosmic.vercel.app/movies",
  tv: "https://streamium-cosmic.vercel.app/tv",
  home: "https://streamium-cosmic.vercel.app/",
  afrikaans: "https://streamium-cosmic.vercel.app/afrikaans",
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

for (const [name, url] of Object.entries(URLS)) {
  await page.goto(url + "?" + Date.now(), { waitUntil: "domcontentloaded", timeout: 90000 });
  const vp = await page.locator('meta[name="viewport"]').getAttribute("content");
  const r = await page.evaluate(() => {
    const toShares = (spec) => {
      const e = document.createElement("span");
      e.style.setProperty("background", `color-mix(in srgb, ${spec} 100%, transparent)`);
      document.body.appendChild(e);
      const c = getComputedStyle(e).backgroundColor.match(/\d+(?:\.\d+)?/g).map(Number).slice(0, 3);
      e.remove();
      return Math.max(...c) > 1.01 ? c.map((v) => v / 255) : c;
    };
    const a = document.querySelector("a[data-slot=button]");
    if (!a) return { ok: false };
    const aBg = getComputedStyle(a).backgroundColor;
    const aFg = getComputedStyle(a).color;
    const bg = aBg === "transparent" ? [0, 0, 0] : toShares(aBg);
    const fg = aFg === "transparent" ? [0, 0, 0] : toShares(aFg);
    const lum = (c) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const [l1, l2] = [lum(bg), lum(fg)];
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return { ok: true, bg, fg, ratio, text: a.textContent.trim().slice(0, 12) };
  });
  console.log(
    name,
    "| viewport ok:", /maximum-scale|user-scalable/.test(vp ?? "") ? "STALE" : "OK",
    "| play CTA:", r.ok ? `bg ${r.bg} fg ${r.fg} = ${r.ratio.toFixed(2)}:1 (${r.text}) ${r.ratio >= 4.5 ? "PASS" : "FAIL"}` : "NO BUTTON FOUND"
  );
}

await browser.close();