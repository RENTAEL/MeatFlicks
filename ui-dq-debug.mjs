import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

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
const user = `dqdbg${suffix}`;
const waitFor = async (page, sel, ms = 15000) => {
	try { await page.waitForSelector(sel, { timeout: ms }); return true; } catch { return false; }
};

try {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	const errors = [];
	page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
	page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
	const jsRequests = [];
	page.on('request', (r) => {
		if (r.url().includes('.js') && r.resourceType() === 'script') jsRequests.push(r.url());
	});

	await page.goto(BASE + '/signup', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await waitFor(page, 'input[name="username"]');
	await page.fill('input[name="username"]', user);
	await page.fill('input[name="email"]', `${user}@probe.test`);
	await page.fill('input[name="password"]', 'ProbePass123!');
	await page.click('button[type="submit"]');
	await page.waitForTimeout(3000);

	await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await waitFor(page, '.dq-chip');
	await page.click('.dq-chip');
	await waitFor(page, '.dq-overlay', 15000);
	await page.waitForSelector('.dq-save', { timeout: 15000 }).catch(() => {});
	const userState = await page.evaluate(async () => {
		const res = await fetch('/api/quotes');
		return { status: res.status, body: await res.text() };
	});
	console.log('GET /api/quotes before save:', JSON.stringify(userState));

	await page.click('.dq-save');
	await waitFor(page, '.dq-save:has-text("Saved")', 10000).catch(() => {});
	const saveStateText = await page.evaluate(() => document.querySelector('.dq-save')?.textContent.trim() ?? null);
	console.log('save button text:', JSON.stringify(saveStateText));

	const dbRows = await turso.execute({ sql: "SELECT * FROM saved_quotes WHERE userId = (SELECT id FROM users WHERE username = ?) ORDER BY createdAt DESC LIMIT 3", args: [user] });
	console.log('saved_quotes rows:', JSON.stringify(dbRows.rows));

	await page.click('.dq-close').catch(() => {});
	await page.goto(BASE + '/profile', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await page.waitForSelector('.tab-btn', { timeout: 20000 }).catch(() => {});
	const tabInfo = await page.evaluate(() => {
		const btns = Array.from(document.querySelectorAll('.tab-btn'));
		return btns.map((b) => ({ text: b.textContent.trim(), active: b.classList.contains('active') }));
	});
	console.log('tab buttons before click:', JSON.stringify(tabInfo));

	await page.locator('.tab-btn', { hasText: 'Saved Quotes' }).first().click().catch(() => {});
	await page.waitForTimeout(2000);
	const afterClick = await page.evaluate(() => {
		const tabsEl = document.querySelector('.tabs');
		const next = tabsEl?.nextElementSibling?.outerHTML ?? 'NO-NEXT';
		const nextText = tabsEl?.nextElementSibling?.innerText ?? '';
		return { next: next.slice(0, 1200), nextText: nextText.slice(0, 300) };
	});
	console.log('after click, element after .tabs:', afterClick.next);
	console.log('after click, its text:', JSON.stringify(afterClick.nextText));
	await page.waitForTimeout(3000);
	const state = await page.evaluate(() => {
		const quotes = document.querySelectorAll('.quote-item').length;
		const loading = document.body.innerText.includes('Loading your saved quotes');
		const empty = document.body.innerText.includes('No saved quotes yet');
		const section = document.querySelector('section.section');
		return {
			quotes,
			loading,
			empty,
			section: section ? section.innerText.slice(0, 400) : 'NO SECTION'
		};
	});
	console.log('tab state:', JSON.stringify(state, null, 1));
	const uniqueJs = [...new Set(jsRequests)];
	const insp = await page.evaluate(async (urls) => {
		const out = [];
		for (const url of urls) {
			try {
				const res = await fetch(url);
				const src = await res.text();
				const isQuote = src.includes('quote-item') || src.includes('Saved Quotes');
				const hasComp = /function\s+\w+\(/ .test(src);
				out.push({
					url: url.split('/').pop(),
					len: src.length,
					isQuote: isQuote && src.includes('quote-item'),
					snippet: isQuote ? src.slice(0, 600) : null
				});
			} catch (e) {
				out.push({ url: url.split('/').pop(), err: String(e).slice(0, 80) });
			}
		}
		return out;
	}, uniqueJs);
	const quoteChunks = uniqueJs.filter((u) => u.endsWith('/CGSYuNvY.js') || u.includes('CGSYuNvY'));
	console.log('quote chunk full urls:', JSON.stringify(quoteChunks));
	for (const c of uniqueJs) {
		const src = await page.evaluate(async (url) => {
			const res = await fetch(url);
			if (!res.ok) return null;
			return await res.text();
		}, c);
		if (src && (src.includes('savedQuotesComp') || src.includes('SavedQuotes') || src.includes('quote-item'))) {
			writeFileSync('C:/Users/bezui/AppData/Local/Temp/opencode/chunk-' + c.split('/').pop(), src);
			console.log('SAVED relevant chunk:', c.split('/').pop(), 'len', src.length, JSON.stringify(c));
		}
	}
	console.log('--- console errors ---');
	for (const e of errors.slice(-15)) console.log('  ', e.slice(0, 300));

	await ctx.close();
} finally {
	try {
		await turso.execute({ sql: 'DELETE FROM users WHERE username = ?', args: [user] });
		console.log('cleaned');
	} catch {}
	await browser.close();
}