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
const user = `dq${suffix}`;
const pass = [];

try {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.goto(BASE + '/signup', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await page.waitForSelector('input[name="username"]', { timeout: 20000 });
	await page.fill('input[name="username"]', user);
	await page.fill('input[name="email"]', `${user}@probe.test`);
	await page.fill('input[name="password"]', 'ProbePass123!');
	await page.click('button[type="submit"]');
	await page.waitForTimeout(3000);

	const api = async (method, url, body) =>
		page.evaluate(
			async ([m, u, b]) => {
				const csrf = await fetch('/api/csrf').then((r) => r.json());
				const token = csrf?.token || csrf?.csrfToken || '';
				const res = await fetch(u, {
					method: m,
					headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
					body: b ? JSON.stringify(b) : undefined,
					credentials: 'include'
				});
				return { status: res.status, body: await res.text() };
			},
			[method, url, body]
		);

	const daily = await page.evaluate(async () => {
		const res = await fetch('/api/quotes/daily');
		return { status: res.status, body: await res.json() };
	});
	pass.push(...(daily.status === 200 && daily.body.quote ? ['daily quote endpoint returns a quote'] : []));

	const save = await api('POST', '/api/quotes', {
		quoteText: 'Test quote probe',
		quoteAuthor: 'Probe',
		category: 'general'
	});
	const saved = JSON.parse(save.body);
	pass.push(...(save.status === 200 && saved.quote?.id ? [`save quote -> ${save.status} (id ${saved.quote.id})`] : []));
	pass.push(...(save.status !== 200 ? [`FAIL save -> ${save.status} ${save.body.slice(0,120)}`] : []));
	const savedId = saved.quote?.id;

	const list = await api('GET', '/api/quotes');
	const listed = JSON.parse(list.body);
	const found = Array.isArray(listed.quotes) && listed.quotes.some((q) => q.id === savedId);
	pass.push(...(list.status === 200 && found ? ['saved quote appears in my quotes list'] : []));
	pass.push(...(!found ? ['FAIL: saved quote missing from list'] : []));

	const del = await api('DELETE', `/api/quotes/${savedId}`);
	pass.push(...(del.status === 200 ? [`delete quote -> ${del.status}`] : []));
	pass.push(...(del.status !== 200 ? [`FAIL delete -> ${del.status} ${del.body.slice(0,120)}`] : []));

	const list2 = await api('GET', '/api/quotes');
	const gone = !JSON.parse(list2.body).quotes.some((q) => q.id === savedId);
	pass.push(...(gone ? ['deleted quote gone from list'] : []));
	pass.push(...(!gone ? ['FAIL: deleted quote still in list'] : []));

	console.log('== DQ ASSERTIONS ==');
	for (const p of pass) console.log('  PASS', p);
	const fails = pass.filter((p) => p.startsWith('FAIL'));
	console.log(`RESULT: ${pass.length - fails.length} pass, ${fails.length} fail`);
	await ctx.close();
} finally {
	try {
		await turso.execute({ sql: 'DELETE FROM users WHERE username = ?', args: [user] });
		console.log('cleaned');
	} catch {}
	await browser.close();
}