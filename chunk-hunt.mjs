import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(45000);

const chunks = new Set();
page.on('response', (res) => {
	const u = res.url();
	if (u.includes('/_app/immutable/nodes/') || u.includes('/_app/immutable/chunks/')) {
		chunks.add(u);
	}
});

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.fill('input[name="username"]', 'questvrmsd5epa1');
await page.fill('input[name="password"]', 'Testpass123!');
await page.click('button[type="submit"]', { timeout: 15000 });
await page.waitForTimeout(4000);
await page.goto(BASE + '/settings', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(3000);

const hits = [];
for (const u of chunks) {
	try {
		const body = await (await ctx.request.get(u)).text();
		if (body.includes('vr-hint')) hits.push({ url: u, hasTemplate: body.includes("displayMode.mode === 'vr'"), hasVrHintVar: body.includes('vrHint'), length: body.length });
	} catch {}
}
console.log(JSON.stringify({ totalChunks: chunks.size, hits }, null, 2));
await b.close();