import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
for (const u of [
	"https://streamium-cosmic.vercel.app/afrikaans/api/discover?type=flieks&page=1",
	"https://streamium-cosmic.vercel.app/afrikaans/api/discover?type=alles&page=2&genre=18",
	"https://streamium-cosmic.vercel.app/afrikaans/api/search?q=binnelanders"
]) {
	const r = await page.request.get(u);
	const txt = await r.text();
	console.log(u.split(".app")[1], r.status(), txt.slice(0, 220).replace(/\n/g, " "));
}
await browser.close();