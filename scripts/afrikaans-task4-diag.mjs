import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(`${BASE}/afrikaans`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(2500);

await page.getByRole('button', { name: /Kies vir my/ }).click();
await page.waitForTimeout(4000);
const dialog = page.locator('[role="dialog"]');
console.log('dialog count:', await dialog.count());
if (await dialog.count()) {
	console.log('dialog text:', JSON.stringify((await dialog.innerText()).slice(0, 400)));
}
const resp = await page.evaluate(async () => {
	const r = await fetch('/afrikaans/api/discover?page=1');
	return { status: r.status, body: (await r.json()).results?.length };
});
console.log('direct API fetch from page:', JSON.stringify(resp));

await page.getByLabel('Soek / Search').fill('zzzzzqqqqx');
await page.waitForTimeout(4000);
const bodyText = await page.locator('body').innerText();
console.log('contains Geen resultate:', bodyText.includes('Geen resultate'));
console.log('contains Soek…:', bodyText.includes('Soek…'));
console.log('contains Searching:', bodyText.includes('Searching'));
console.log('empty states:', await page.locator('text=Geen').count());

await browser.close();
