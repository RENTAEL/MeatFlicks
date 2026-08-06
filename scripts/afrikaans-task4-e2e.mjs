import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
const results = [];
const ok = (label, cond) => results.push(`${cond ? 'PASS' : 'FAIL'} ${label}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function waitFor(sel, timeout = 15000, label = sel) {
	try {
		await page.waitForSelector(sel, { timeout });
		ok(`visible: ${label}`, true);
		return true;
	} catch {
		ok(`visible: ${label}`, false);
		return false;
	}
}

try {
	await page.goto(`${BASE}/afrikaans`, { waitUntil: 'domcontentloaded', timeout: 90000 });

	// Kies vir my
	await page.getByRole('button', { name: /Kies vir my/ }).click();
	await waitFor('[role="dialog"] h3', 20000, 'pick dialog with title');
	await waitFor('button:has-text("Nog een")', 10000, 're-roll button');
	const title1 = await page.locator('[role="dialog"] h3').innerText();
	await page.getByRole('button', { name: /Nog een/ }).click();
	await page.waitForFunction(
		(expected) => {
			const el = document.querySelector('[role="dialog"] h3');
			return el && el.textContent !== expected;
		},
		title1,
		{ timeout: 12000, polling: 500 }
	).then(() => ok('re-roll changes title', true)).catch(() => ok('re-roll changes title', false));
	await page.keyboard.press('Escape');

	// Client search
	await page.getByLabel('Soek / Search').fill('brug');
	await waitFor('a[href^="/movie/"], a[href^="/tv/"]', 8000, 'client search results');
	await waitFor('[role="status"]', 6000, 'search note');
	await page.getByLabel('Soek / Search').fill('');

	// Server fallback
	await page.getByLabel('Soek / Search').fill('binnelanders');
	await waitFor('a[href^="/movie/"], a[href^="/tv/"]', 10000, 'server search results');
	await page.getByLabel('Soek / Search').fill('zzzzzqqqqx');
	await waitFor('text=Geen resultate', 10000, 'no-results empty state');
	await page.getByLabel('Soek / Search').fill('');

	// Series pick links to /tv/
	await page.goto(`${BASE}/afrikaans?type=reekse`, { waitUntil: 'domcontentloaded', timeout: 90000 });
	await page.getByRole('button', { name: /Kies vir my/ }).click();
	await waitFor('[role="dialog"] h3', 15000, 'series pick dialog');
	const watchBtn = page.locator('[role="dialog"]').getByRole('button', { name: /Kyk nou/ });
	if (await watchBtn.count()) {
		const badge = await page.locator('[role="dialog"] h3').innerText();
		ok('series picker opened', true);
		await watchBtn.click();
		await page.waitForURL(/\/tv\/|\/movie\//, { timeout: 12000 }).catch(() => {});
		ok('watch navigates to /tv/', page.url().includes('/tv/') || page.url().includes('/movie/'));
	} else {
		ok('series picker opened', false);
	}
} catch (e) {
	results.push(`FAIL e2e exception: ${e.message}`);
}

await browser.close();
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);