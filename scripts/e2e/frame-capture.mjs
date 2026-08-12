import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BASE = 'https://streamium-cosmic.vercel.app';
const REPO = 'C:/Users/bezui/Downloads/Test site thing';

function envLine(file, key) {
	if (!existsSync(file)) return '';
	const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(key + '='));
	return line ? line.slice(key.length + 1).trim() : '';
}

const secret = envLine(`${REPO}/.env`, 'SESSION_SECRET');
const tmdbKey = envLine(`${REPO}/.env`, 'TMDB_API_KEY');
process.env.SESSION_SECRET = secret;
process.env.TMDB_API_KEY = tmdbKey;
const { encryptSession } = await import(pathToFileURL(`${REPO}/src/lib/server/session-crypto.ts`).href);

const makeCookie = (id, name) => encryptSession({ userId: id, username: name, role: 'USER', expiresAt: Date.now() + 1000 * 60 * 60 * 2 });
const host = { id: 'user-a', name: 'Hosty', cookie: makeCookie('user-a', 'Hosty') };
const becca = { id: 'user-b', name: 'Becca', cookie: makeCookie('user-b', 'Becca') };

async function api(cookie, path, init = {}) {
	const r = await fetch(`${BASE}/api${path}`, {
		...init,
		headers: { 'content-type': 'application/json', cookie: `session=${cookie}`, ...(init.headers || {}) }
	});
	return { status: r.status, body: await r.json().catch(() => ({})) };
}

const created = await api(host.cookie, '/watch-party/rooms', { method: 'POST', body: JSON.stringify({ name: 'frame-capture', mediaType: 'movie', tmdbId: 550 }) });
const roomId = created.body.roomId;
console.log('room:', roomId);

const browser = await chromium.launch();
const mkCtx = async (user) => {
	const ctx = await browser.newContext();
	await ctx.addCookies([{ name: 'session', value: user.cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
	const page = await ctx.newPage();
	await page.addInitScript(() => {
		const Native = window.EventSource;
		const origAdd = Native.prototype.addEventListener;
		Native.prototype.addEventListener = function (type, cb, opts) {
			const wrapped = function (e) {
				console.log(`[ES-FIRE] ${type}`, String(e.data ?? '').slice(0, 100));
				try {
					return cb(e);
				} catch (err) {
					console.log('[ES-CB-ERR]', String(err).slice(0, 300));
					throw err;
				}
			};
			return origAdd.call(this, type, wrapped, opts);
		};
		window.EventSource = function (url, opts) {
			const es = new Native(url, opts);
			console.log('[ES-CONNECT]', String(url).slice(0, 80));
			es.onopen = () => console.log('[ES-OPEN]');
			es.onerror = (e) => console.log('[ES-ERR]', e.type);
			return es;
		};
		window.EventSource.prototype = Native.prototype;
	});
	page.on('console', (m) => {
		const t = m.text();
		if (t.includes('ES-')) console.log(`[${user.name}] ${t}`);
	});
	page.on('pageerror', (e) => console.log(`[${user.name}] PAGEERROR: ${String(e).slice(0, 200)}`));
	await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
	await page.waitForTimeout(4000);
	return { ctx, page };
};

const hostCtx = await mkCtx(host);
const memberCtx = await mkCtx(becca);
await memberCtx.page.waitForTimeout(3000);

const g = await api(host.cookie, `/watch-party/rooms/${roomId}/sound-control`, { method: 'POST', body: JSON.stringify({ userId: 'user-b', granted: true }) });
console.log('grant:', g.status, JSON.stringify(g.body));

await memberCtx.page.waitForTimeout(8000);

const memberBtn = await memberCtx.page.evaluate(() => {
	const btn = document.querySelector('button.fx-btn');
	return btn ? { disabled: btn.disabled, title: btn.getAttribute('title') } : null;
});
console.log('member fx-btn after grant:', JSON.stringify(memberBtn));

const probe1 = await memberCtx.page.evaluate(() => ({
	btns: [...document.querySelectorAll('button.fx-btn')].map((b) => b.disabled),
	hint: document.querySelector('.fx-hint')?.textContent ?? null,
	grantBtn: document.querySelector('.grant-btn')?.textContent ?? null,
	rows: [...document.querySelectorAll('.member-row')].map((r) => ({
		name: r.querySelector('.member-name')?.textContent?.trim() ?? '',
		me: !!r.querySelector('.me-tag'),
		host: !!r.querySelector('svg')
	})),
	bodySnippet: document.body.textContent?.slice(0, 120)
}));
console.log('probe1 (no forced render):', JSON.stringify(probe1, null, 1));

await memberCtx.page.locator('.fx-slider').evaluate((el) => {
	el.value = '42';
	el.dispatchEvent(new Event('input', { bubbles: true }));
});
await memberCtx.page.waitForTimeout(500);
const probe2 = await memberCtx.page.evaluate(() => ({
	btns: [...document.querySelectorAll('button.fx-btn')].map((b) => b.disabled),
	hint: document.querySelector('.fx-hint')?.textContent ?? null
}));
console.log('probe2 (after slider input):', JSON.stringify(probe2));

await browser.close();
process.exit(0);
