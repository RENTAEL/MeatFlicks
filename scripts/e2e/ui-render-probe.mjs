import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BASE = process.env.PROBE_BASE || 'https://streamium-cosmic.vercel.app';
const COOKIE_DOMAIN = process.env.PROBE_DOMAIN || 'streamium-cosmic.vercel.app';
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
  window.__appHandlerSeen = [];
  window.EventSource = function (url, opts) {
    const es = new Native(url, opts);
    window.__esEvents.push({ t: 'construct', at: Date.now(), url });
    const origAdd = es.addEventListener.bind(es);
    es.addEventListener = (type, fn, ...rest) => {
      if (type === 'state') {
        window.__esEvents.push({ t: 'app-handler-registered', at: Date.now() });
        return origAdd(type, (e) => {
          try {
            const d = JSON.parse(e.data);
            window.__appHandlerSeen.push({ at: Date.now(), seq: d.playback?.seq, playing: d.playback?.playing, pos: d.playback?.position });
          } catch {}
          fn(e);
        }, ...rest);
      }
      return origAdd(type, fn, ...rest);
    };
    return es;
  };
}
`;

const mkPage = async (user, name) => {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	await ctx.addCookies([{ name: 'session', value: user.cookie, domain: COOKIE_DOMAIN, path: '/' }]);
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

const uiSnapshot = (page) => page.evaluate(() => ({
	title: document.title,
	members: Array.from(document.querySelectorAll('.member-name')).map((el) => el.textContent.trim()),
	meTag: document.querySelectorAll('.me-tag').length,
	fxHint: !!document.querySelector('.fx-hint'),
	fxBtns: document.querySelectorAll('.fx-btn').length,
	msgs: Array.from(document.querySelectorAll('.msg-body')).map((el) => el.textContent.trim()),
	syncPill: Array.from(document.querySelectorAll('.sync-row span, .sync-row p')).map((el) => el.textContent.trim()).filter(Boolean),
	diag: (window.__wpDiag || []).slice(-3).map((d) => ({ seq: d.seq, appliedSeq: d.appliedSeq, t: d.t })),
	hook: window.__swLastSyncApplied ? { ...window.__swLastSyncApplied } : null
})).catch((e) => ({ err: String(e) }));

const roomState = () => api(becca.cookie, `/watch-party/rooms/${roomId}`).then((r) => r.body).catch(() => null);

await h.waitForTimeout(3000);
const t0 = Date.now();
const report = async (label) => {
	const [u, rs] = await Promise.all([uiSnapshot(b), roomState()]);
	console.log(`t+${Math.round((Date.now() - t0) / 1000)}s [${label}] roomSeq=${rs?.playback?.seq}`);
	console.log(JSON.stringify(u, null, 1));
	const seen = await b.evaluate(() => (window.__appHandlerSeen || []).slice(-5)).catch(() => []);
	console.log(`  handlerSeen(last5)=${JSON.stringify(seen)}`);
};

await report('initial');

console.log('--- host sends chat message + presses k ---');
await api(host.cookie, `/watch-party/rooms/${roomId}/messages`, {
	method: 'POST',
	body: JSON.stringify({ body: 'hello from host probe' })
});
await h.evaluate(() => document.querySelector('.player-root button')?.focus());
await h.keyboard.press('k');
await new Promise((r) => setTimeout(r, 5000));
await report('post-message-k');

await new Promise((r) => setTimeout(r, 6000));
await report('post-message-k2');

await browser.close();
console.log('done');
