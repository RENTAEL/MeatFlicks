import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BASE = process.env.PROBE_BASE || 'https://streamium-cosmic.vercel.app';
const DOMAIN = process.env.PROBE_DOMAIN || 'streamium-cosmic.vercel.app';
const REPO = 'C:/Users/bezui/Downloads/Test site thing';
const envLine = (k) => { const l = readFileSync(`${REPO}/.env`, 'utf8').split(/\r?\n/).find((x) => x.startsWith(k + '=')) || ''; return l ? l.slice(k.length + 1).trim() : ''; };
process.env.SESSION_SECRET = envLine('SESSION_SECRET');
process.env.TMDB_API_KEY = envLine('TMDB_API_KEY');
const { encryptSession } = await import(pathToFileURL(`${REPO}/src/lib/server/session-crypto.ts`).href);
const makeCookie = (id, name) => encryptSession({ userId: id, username: name, role: 'USER', expiresAt: Date.now() + 1000 * 60 * 60 * 2 });
const host = makeCookie('user-h', 'Hosty');
const member = makeCookie('user-m', 'Memba');
const h = (c) => ({ 'content-type': 'application/json', cookie: `session=${c}` });

const created = await (await fetch(`${BASE}/api/watch-party/rooms`, { method: 'POST', headers: h(host), body: JSON.stringify({ mediaType: 'movie', tmdbId: 550, title: 'Fight Club' }) })).json();
const roomId = created.roomId;
await fetch(`${BASE}/api/watch-party/join`, { method: 'POST', headers: h(member), body: JSON.stringify({ roomId }) });
console.log('room', roomId);

const browser = await chromium.launch();
async function open(cookie) {
	const p = await browser.newPage();
	await p.context().addCookies([{ name: 'session', value: cookie, domain: DOMAIN, path: '/' }]);
	await p.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
	await p.waitForFunction(() => !!document.querySelector('.player-root'), null, { timeout: 60000 }).catch(() => {});
	return p;
}
const hp = await open(host);
const mp = await open(member);
await mp.waitForFunction(() => !!document.querySelector('iframe.player-iframe'), null, { timeout: 60000 }).catch(() => {});
const waitSync = () => mp.waitForFunction(() => !!window.__swLastSyncApplied && window.__swLastSyncApplied.position >= 0, null, { timeout: 60000 }).catch(() => {});
await waitSync();
const snap = async (label) => {
	const s = await mp.evaluate(() => ({
		src: document.querySelector('iframe.player-iframe')?.src ?? null,
		hook: window.__swLastSyncApplied ?? null,
		pill: document.querySelector('.sync-status')?.textContent?.trim() ?? null
	}));
	console.log(label, JSON.stringify(s));
};
const hostKey = (k) => hp.evaluate((key) => {
	const root = document.querySelector('.player-root');
	const t = root?.querySelector('.switch-btn') || root?.querySelector('button') || root;
	t?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}, k);

await snap('init');
await hostKey('arrowright');
await mp.waitForTimeout(2500);
await snap('after host seek (auto-apply window)');
const beforeClickSrc = await mp.evaluate(() => document.querySelector('iframe.player-iframe')?.src ?? null);
await mp.click('.sync-btn');
await mp.waitForTimeout(2000);
const afterClickSrc = await mp.evaluate(() => document.querySelector('iframe.player-iframe')?.src ?? null);
const hook2 = await mp.evaluate(() => window.__swLastSyncApplied ?? null);
console.log('click reloaded iframe:', beforeClickSrc !== afterClickSrc, beforeClickSrc.slice(0, 90), '->', afterClickSrc.slice(0, 90));
console.log('hook after click:', JSON.stringify(hook2));
await snap('final');
await browser.close();
