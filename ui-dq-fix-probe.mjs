import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const BASE = 'https://streamium-cosmic.vercel.app';
const env = Object.fromEntries(
	readFileSync('.env', 'utf8')
		.split(/\r?\n/)
		.filter((l) => l && !l.startsWith('#'))
		.map((l) => {
			const i = l.indexOf('=');
			return [l.slice(0, i), l.slice(i + 1)];
		})
);
const { createClient } = createRequire(import.meta.url)('@libsql/client');
const turso = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

const browser = await chromium.launch();
const suffix = Date.now().toString(36).slice(-6);
const user = `dqfx${suffix}`;
const pass = [];
const fail = [];

const rect = async (page, sel) =>
	page.evaluate((s) => {
		const el = document.querySelector(s);
		if (!el) return null;
		const r = el.getBoundingClientRect();
		return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), vw: innerWidth, vh: innerHeight };
	}, sel);

const waitFor = async (page, sel, ms = 15000) => {
	try { await page.waitForSelector(sel, { timeout: ms }); return true; } catch { return false; }
};

try {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await ctx.newPage();
	await page.goto(BASE + '/signup', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await waitFor(page, 'input[name="username"]');
	await page.fill('input[name="username"]', user);
	await page.fill('input[name="email"]', `${user}@probe.test`);
	await page.fill('input[name="password"]', 'ProbePass123!');
	await page.click('button[type="submit"]');
	await page.waitForTimeout(3000);

	// Open DQ
	await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await waitFor(page, '.dq-chip');
	await page.click('.dq-chip');
	const opened = await waitFor(page, '.dq-overlay', 15000);
	pass.push(...(opened ? ['DQ modal opened'] : []));
	fail.push(...(!opened ? ['FAIL: DQ modal did not open'] : []));

	// Measure at top of page
	await page.waitForTimeout(1200);
	const overlay1 = await rect(page, '.dq-overlay');
	const card1 = await rect(page, '.dq-card');
	console.log('overlay(top):', JSON.stringify(overlay1));
	console.log('card(top):', JSON.stringify(card1));

	// Scroll down 600px and re-measure
	await page.evaluate(() => window.scrollTo(0, 600));
	await page.waitForTimeout(600);
	const overlay2 = await rect(page, '.dq-overlay');
	const card2 = await rect(page, '.dq-card');
	const scrolled = await page.evaluate(() => window.scrollY);
	console.log('scrollY after scrollTo(600):', scrolled);
	console.log('overlay(after scroll):', JSON.stringify(overlay2));
	console.log('card(after scroll):', JSON.stringify(card2));

	// Overlay must cover the full viewport and stay put (fixed layer)
	const overlayCoversViewport =
		overlay1 && overlay2 && overlay1.x === 0 && overlay1.y === 0 && overlay1.w === overlay1.vw && overlay1.h === overlay1.vh &&
		overlay2.x === 0 && overlay2.y === 0 && overlay2.w === overlay2.vw && overlay2.h === overlay2.vh;
	pass.push(...(overlayCoversViewport ? ['overlay covers full viewport before and after scroll (fixed layer)'] : []));
	fail.push(...(!overlayCoversViewport ? [`FAIL: overlay not viewport-anchored (${JSON.stringify(overlay1)} / ${JSON.stringify(overlay2)})`] : []));

	// Card must be vertically centered in viewport (not pinned to bottom)
	const centered =
		card1 && Math.abs(card1.y + card1.h / 2 - card1.vh / 2) < 60 &&
		card2 && Math.abs(card2.y + card2.h / 2 - card2.vh / 2) < 60;
	pass.push(...(centered ? ['card centered in viewport (not pinned to bottom)'] : []));
	fail.push(...(!centered ? [`FAIL: card not centered (${JSON.stringify(card1)} / ${JSON.stringify(card2)})`] : []));

	// Body scroll must be LOCKED while the modal is open (proper modal layer)
	const scrollLocked = scrolled === 0;
	pass.push(...(scrollLocked ? ['body scroll locked while modal open'] : []));
	fail.push(...(!scrollLocked ? ['FAIL: page scrolls behind the modal (scrollY=' + scrolled + ')'] : []));

	// Save a quote
	await page.waitForSelector('.dq-save', { timeout: 15000 }).catch(() => {});
	const saveBtn = await page.$('.dq-save');
	if (saveBtn) {
		await saveBtn.click();
		const savedText = await waitFor(page, '.dq-save:has-text("Saved")', 10000);
		pass.push(...(savedText ? ['save button reached "Saved" state'] : []));
		fail.push(...(!savedText ? ['FAIL: save button did not reach Saved state'] : []));
	} else {
		fail.push('FAIL: save button not present (user not signed in?)');
	}

	// Profile saved quotes tab
	await page.click('.dq-close');
	const dismissed = await waitFor(page, '.dq-overlay', 3000) === false;
	pass.push(...(dismissed ? ['modal dismissed via close button'] : []));
	fail.push(...(!dismissed ? ['FAIL: modal did not dismiss on close'] : []));

	const clickTab = () =>
		page.evaluate(() => {
			const btns = Array.from(document.querySelectorAll('.tab-btn'));
			const b = btns.find((x) => x.textContent.includes('Saved Quotes'));
			if (b) b.click();
			return !!b;
		});

	await page.goto(BASE + '/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await page.waitForTimeout(1500);
	await clickTab();

	let quoteShown = false;
	let dump = '';
	const startT = Date.now();
	while (Date.now() - startT < 15000) {
		const st = await page.evaluate(() => {
			const quotes = Array.from(document.querySelectorAll('.quote-item'));
			return { count: quotes.length, text: quotes[0]?.textContent ?? '' };
		});
		if (st.count > 0) {
			quoteShown = true;
			dump = st.text;
			break;
		}
		await page.waitForTimeout(500);
	}
	pass.push(...(quoteShown ? [`profile Saved Quotes tab shows the saved quote (${dump.trim().slice(0, 60)})`] : []));
	fail.push(...(!quoteShown ? ['FAIL: profile Saved Quotes tab empty: ' + dump] : []));

	// Persistence: reload and re-check
	await page.reload({ waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(1500);
	await clickTab();
	let persistedShown = false;
	const startP = Date.now();
	while (Date.now() - startP < 15000) {
		const st = await page.evaluate(() => document.querySelectorAll('.quote-item').length);
		if (st > 0) {
			persistedShown = true;
			break;
		}
		await page.waitForTimeout(500);
	}
	pass.push(...(persistedShown ? ['saved quote persists after reload'] : []));
	fail.push(...(!persistedShown ? ['FAIL: saved quote gone after reload'] : []));

	console.log('\n== DQ FIX ASSERTIONS ==');
	for (const p of pass) console.log('  PASS', p);
	for (const f of fail) console.log('  FAIL', f);
	console.log(`RESULT: ${pass.length - fail.filter((f) => f.startsWith('FAIL')).length} pass, ${fail.filter((f) => f.startsWith('FAIL')).length} fail`);
	await ctx.close();
} finally {
	try {
		await turso.execute({ sql: 'DELETE FROM users WHERE username = ?', args: [user] });
		console.log('cleaned');
	} catch {}
	await browser.close();
}