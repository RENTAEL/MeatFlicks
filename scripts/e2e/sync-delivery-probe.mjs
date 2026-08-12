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

const waitFor = async (fn, timeout = 30000, interval = 200, desc = 'cond') => {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		try { const v = await fn(); if (v) return v; } catch {}
		await new Promise((r) => setTimeout(r, interval));
	}
	throw new Error(`Timed out waiting for: ${desc}`);
};

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

const esWrap = `
{
  const Native = window.EventSource;
  window.__esEvents = [];
  window.__esStates = [];
  window.__esOpens = 0;
  window.EventSource = function (url, opts) {
    const es = new Native(url, opts);
    window.__esEvents.push({ t: 'construct', at: Date.now(), url });
    es.addEventListener('open', () => { window.__esOpens++; window.__esEvents.push({ t: 'open', at: Date.now() }); });
    es.addEventListener('error', () => window.__esEvents.push({ t: 'error', at: Date.now() }));
    es.addEventListener('state', (e) => {
      try {
        const d = JSON.parse(e.data);
        window.__esEvents.push({ t: 'state', at: Date.now(), seq: d.playback?.seq, playing: d.playback?.playing, pos: d.playback?.position, sound: d.sound?.seq ?? null, closed: d.closed ?? false });
        window.__esStates.push({ seq: d.playback?.seq, at: Date.now() });
      } catch {}
    });
    return es;
  };
}
`;

const mkPage = async (user, name) => {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	await ctx.addCookies([{ name: 'session', value: user.cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
	const page = await ctx.newPage();
	page.on('pageerror', (e) => console.log(`[${name}] PAGEERROR:`, String(e).slice(0, 300)));
	if (name === 'member') await page.addInitScript(esWrap);
	await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
	return page;
};

const h = await mkPage(host, 'host');
const b = await mkPage(becca, 'member');

await waitFor(() => h.locator('iframe.player-iframe').count().then((n) => n > 0), 45000, 250, 'host iframe');
console.log('host player loaded');
await waitFor(() => b.locator('iframe.player-iframe').count().then((n) => n > 0), 45000, 250, 'member iframe');
console.log('member player loaded');

const memberHook = () => b.evaluate(() => (window.__swLastSyncApplied ? { ...window.__swLastSyncApplied } : null)).catch(() => null);
const memberDiag = () => b.evaluate(() => (window.__wpDiag ? window.__wpDiag.map((d) => ({ ...d })).slice(-10) : [])).catch(() => []);
const esInfo = () => b.evaluate(() => ({
	opens: window.__esOpens,
	events: (window.__esEvents || []).slice(-15),
	states: (window.__esStates || []).slice(-15)
})).catch(() => null);
const roomState = () => api(becca.cookie, `/watch-party/rooms/${roomId}`).then((r) => r.body).catch(() => null);

const focusHost = async () => {
	await h.evaluate(() => {
		const btn = document.querySelector('.player-root .switch-btn') || document.querySelector('.player-root .next-btn') || document.querySelector('.player-root button');
		btn?.focus();
	});
	await h.waitForTimeout(150);
};

await h.waitForTimeout(2500);
const t0 = Date.now();
const poll = async (label) => {
	const [mh, md, es, rs] = await Promise.all([memberHook(), memberDiag(), esInfo(), roomState()]);
	console.log(`t+${Math.round((Date.now() - t0) / 1000)}s roomSeq=${rs?.playback?.seq} playing=${rs?.playback?.playing} | memberHook=${JSON.stringify(mh)}`);
	console.log(`  es={opens:${es?.opens} last:${JSON.stringify(es?.events)}}`);
	console.log(`  memberDiag=${JSON.stringify(md)}`);
};

await poll('initial');
await new Promise((r) => setTimeout(r, 5000));
await poll('t5');

console.log('--- pressing k x3 on host ---');
for (let i = 0; i < 3; i++) {
	await focusHost();
	await h.keyboard.press('k');
	await new Promise((r) => setTimeout(r, 1200));
}

for (let i = 1; i <= 4; i++) {
	await new Promise((r) => setTimeout(r, 4000));
	await poll(`post-k${i}`);
}

await browser.close();
console.log('done');
