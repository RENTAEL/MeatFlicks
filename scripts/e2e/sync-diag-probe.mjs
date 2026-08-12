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

const secret = process.env.SESSION_SECRET || envLine(`${REPO}/.env`, 'SESSION_SECRET');
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
	const body = await r.json().catch(() => ({}));
	return { status: r.status, body };
}

async function newBrowserPage(browser, user, url) {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	await ctx.addCookies([{ name: 'session', value: user.cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
	const page = await ctx.newPage();
	page.on('pageerror', (e) => console.log(`[${user.name}] PAGEERROR:`, String(e).slice(0, 300)));
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
	return { ctx, page };
}

console.log('== setup ==');
const created = await api(host.cookie, '/watch-party/rooms', {
	method: 'POST',
	body: JSON.stringify({ mediaType: 'movie', tmdbId: 550, title: 'Fight Club' })
});
const roomId = created.body?.roomId;
if (!roomId) { console.error('create room failed:', JSON.stringify(created)); process.exit(1); }
console.log('room', roomId);

const browser = await chromium.launch();
await api(becca.cookie, `/watch-party/join`, { method: 'POST', body: JSON.stringify({ roomId }) });
const h = await newBrowserPage(browser, host, `${BASE}/watch/${roomId}`);
const b = await newBrowserPage(browser, becca, `${BASE}/watch/${roomId}`);

const waitFor = async (fn, timeout = 30000, interval = 200, desc = 'cond') => {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		try { const v = await fn(); if (v) return v; } catch {}
		await new Promise((r) => setTimeout(r, interval));
	}
	throw new Error(`Timed out waiting for: ${desc}`);
};

await waitFor(() => h.page.locator('iframe.player-iframe').count().then((n) => n > 0), 45000, 250, 'host iframe');
console.log('host player loaded');

const memberHook = () => b.page.evaluate(() => (window.__swLastSyncApplied ? { ...window.__swLastSyncApplied } : null)).catch(() => null);
const memberDiag = () => b.page.evaluate(() => (window.__wpDiag ? window.__wpDiag.map((d) => ({ ...d })).slice(-8) : [])).catch(() => []);
const hostDiag = () => h.page.evaluate(() => (window.__wpDiag ? window.__wpDiag.map((d) => ({ ...d })).slice(-8) : [])).catch(() => []);
const roomState = () => api(becca.cookie, `/watch-party/rooms/${roomId}`).then((r) => r.body).catch(() => null);

const focusHost = async () => {
	await h.page.evaluate(() => {
		const btn = document.querySelector('.player-root .switch-btn') || document.querySelector('.player-root .next-btn') || document.querySelector('.player-root button');
		btn?.focus();
	});
	await h.page.waitForTimeout(150);
};

await h.page.waitForTimeout(1500);
console.log('--- t0 member hook:', JSON.stringify(await memberHook()));
console.log('--- t0 room:', JSON.stringify({ seq: (await roomState())?.playback?.seq, playing: (await roomState())?.playback?.playing }));

const t0 = Date.now();
const poll = async (label) => {
	const [mh, md, hd, rs] = await Promise.all([memberHook(), memberDiag(), hostDiag(), roomState()]);
	console.log(`t+${Math.round((Date.now() - t0) / 1000)}s memberHook=${JSON.stringify(mh)} roomSeq=${rs?.playback?.seq} playing=${rs?.playback?.playing}`);
	console.log(`  memberDiag=${JSON.stringify(md)}`);
	console.log(`  hostDiag=${JSON.stringify(hd)}`);
};

await poll('pre-k');
await new Promise((r) => setTimeout(r, 3000));
await poll('pre-k2');
await new Promise((r) => setTimeout(r, 3000));
await poll('pre-k3');

console.log('--- pressing k on host ---');
await focusHost();
await h.page.keyboard.press('k');

for (let i = 1; i <= 6; i++) {
	await new Promise((r) => setTimeout(r, 3000));
	await poll(`post-k${i}`);
}

await browser.close();
console.log('done');
