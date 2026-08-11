import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';

const BASE = 'https://streamium-cosmic.vercel.app';
const REPO = 'C:/Users/bezui/Downloads/Test site thing';

function envLine(file, key) {
	if (!existsSync(file)) return '';
	const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(key + '='));
	return line ? line.slice(key.length + 1).trim() : '';
}

async function waitForDeploy(maxMs = 6 * 60 * 1000) {
	const deadline = Date.now() + maxMs;
	while (Date.now() < deadline) {
		try {
			const r = await fetch(`${BASE}/`, { redirect: 'manual' });
			if (r.ok) {
				const html = await r.text();
				if (html.includes('wp-strip')) {
					console.log('DEPLOYED: home shows wp-strip (join strip)');
					return html;
				}
			}
		} catch {}
		await new Promise((r) => setTimeout(r, 15000));
	}
	console.log('TIMEOUT waiting for deploy marker');
	process.exit(2);
}

const secret = process.env.SESSION_SECRET || envLine(`${REPO}/.env`, 'SESSION_SECRET');
const tmdb = envLine(`${REPO}/.env`, 'TMDB_API_KEY');
process.env.SESSION_SECRET = secret;
process.env.TMDB_API_KEY = tmdb;

const { encryptSession } = await import(`file:///${REPO.replace(/ /g, '%20')}/src/lib/server/session-crypto.ts`);

const users = ['user-a', 'user-b', 'user-c'].map((id, i) => ({
	id,
	username: id === 'user-a' ? 'Hosty' : id === 'user-b' ? 'Becca' : 'Cody',
	cookie: encryptSession({ userId: id, username: id === 'user-a' ? 'Hosty' : id === 'user-b' ? 'Becca' : 'Cody', role: 'USER', expiresAt: Date.now() + 1000 * 60 * 60 })
}));

const results = [];
function ok(name, pass, detail = '') {
	results.push({ name, pass });
	console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

await waitForDeploy();

// Regression: core pages
for (const p of ['/', '/movies', '/tv', '/afrikaans']) {
	const r = await fetch(`${BASE}${p}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
	ok(`regression ${p}`, r.status === 200, String(r.status));
}
for (const p of ['/movie/550', '/tv/1399/1/1']) {
	const r = await fetch(`${BASE}${p}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
	ok(`regression ${p}`, r.status === 200, String(r.status));
}

// /watch-party hub
const hub = await fetch(`${BASE}/watch-party`, { headers: { 'user-agent': 'Mozilla/5.0' } });
const hubHtml = await hub.text();
ok('hub /watch-party 200', hub.status === 200, String(hub.status));
ok('hub has Start a party', hubHtml.includes('Start a party'));
ok('hub has join code input', hubHtml.includes('Room code'));

// Home strip
ok('home has join strip', (await (await fetch(`${BASE}/`)).text()).includes('wp-strip'));

// Auth gate
const unauth = await fetch(`${BASE}/watch/AB12CD`, { redirect: 'manual' });
ok('GET /watch/<code> unauth -> 404/307 handled', unauth.status === 404, String(unauth.status));
const apiUnauth = await fetch(`${BASE}/api/watch-party/rooms`, {
	method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mediaType: 'movie', tmdbId: 550 })
});
ok('POST rooms unauth -> 401', apiUnauth.status === 401, String(apiUnauth.status));

async function api(cookie, path, init = {}) {
	const r = await fetch(`${BASE}/api${path}`, {
		...init,
		headers: { 'content-type': 'application/json', cookie: `session=${cookie}`, ...(init.headers || {}) }
	});
	const body = await r.json().catch(() => ({}));
	return { status: r.status, body };
}

// 3-participant flow
const host = users[0], b = users[1], c = users[2];
const created = await api(host.cookie, '/watch-party/rooms', {
	method: 'POST', body: JSON.stringify({ mediaType: 'movie', tmdbId: 550, title: 'Fight Club' })
});
ok('create room as host', created.status === 200 && created.body?.roomId, JSON.stringify(created.body));
const roomId = created.body?.roomId;
if (!roomId) { console.error('no roomId, aborting'); process.exit(1); }

ok('join B', (await api(b.cookie, '/watch-party/join', { method: 'POST', body: JSON.stringify({ roomId }) })).status === 200);
ok('join C', (await api(c.cookie, '/watch-party/join', { method: 'POST', body: JSON.stringify({ roomId }) })).status === 200);

const s1 = await api(b.cookie, `/watch-party/rooms/${roomId}`);
const parts = s1.body?.participants ?? [];
ok('3 participants visible', parts.length === 3, JSON.stringify(parts.map((p) => p.username)));
ok('B sees isHost=false', s1.body?.isHost === false);
ok('media resolved Fight Club', s1.body?.media?.title === 'Fight Club', String(s1.body?.media?.title));

// playback: host play + seek
const p1 = await api(host.cookie, `/watch-party/rooms/${roomId}/playback`, { method: 'POST', body: JSON.stringify({ action: 'play', position: 0 }) });
const p2 = await api(host.cookie, `/watch-party/rooms/${roomId}/playback`, { method: 'POST', body: JSON.stringify({ action: 'seek', position: 95 }) });
const s2 = await api(b.cookie, `/watch-party/rooms/${roomId}`);
ok('playback seq advances', (s2.body?.playback?.seq ?? 0) >= 2 && s2.body?.playback?.position === 95, JSON.stringify(s2.body?.playback));
const pUnauth = await api(b.cookie, `/watch-party/rooms/${roomId}/playback`, { method: 'POST', body: JSON.stringify({ action: 'pause', position: 0 }) });
ok('member playback POST rejected', pUnauth.status === 403, String(pUnauth.status));

// chat
await api(b.cookie, `/watch-party/rooms/${roomId}/messages`, { method: 'POST', body: JSON.stringify({ body: 'hello from B' }) });
const s3 = await api(host.cookie, `/watch-party/rooms/${roomId}`);
const msg = s3.body?.messages?.find((m) => m.body === 'hello from B');
ok('chat message propagated', !!msg, JSON.stringify(msg));
if (msg) {
	const del = await api(host.cookie, `/watch-party/rooms/${roomId}/messages/${msg.id}/delete`, { method: 'POST' });
	ok('host delete accepted', del.status === 200);
	const s4 = await api(b.cookie, `/watch-party/rooms/${roomId}?since=${s3.body.lastMessageId}`);
	ok('deletion visible to B', s4.body?.messages?.some((m) => m.id === msg.id && m.deleted === true));
}

// sound
const snd = await api(host.cookie, `/watch-party/rooms/${roomId}/sound`, { method: 'POST', body: JSON.stringify({ effect: 'applause' }) });
ok('sound accepted', snd.status === 200);
const s5 = await api(c.cookie, `/watch-party/rooms/${roomId}`);
ok('sound seq visible to C', (s5.body?.sound?.seq ?? 0) >= 1 && s5.body?.sound?.effect === 'applause', JSON.stringify(s5.body?.sound));

// kick + leave
const kick = await api(host.cookie, `/watch-party/rooms/${roomId}/kick`, { method: 'POST', body: JSON.stringify({ userId: c.id }) });
ok('kick C', kick.status === 200);
const s6 = await api(host.cookie, `/watch-party/rooms/${roomId}`);
ok('participants 2 after kick', (s6.body?.participants ?? []).length === 2);
const leave = await api(b.cookie, '/watch-party/leave', { method: 'POST', body: JSON.stringify({ roomId }) });
ok('B leave', leave.status === 200);
const s7 = await api(host.cookie, `/watch-party/rooms/${roomId}`);
ok('participants 1 after leave', (s7.body?.participants ?? []).length === 1);

// Browser: mobile home strip + room page renders with session cookie
const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 390, height: 844 } });
await ctx.addCookies([{ name: 'session', value: host.cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
ok('mobile home strip visible', await page.locator('.wp-strip').isVisible().catch(() => false));
await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'load', timeout: 45000 });
const pageHtml = await page.content();
ok('room page renders (title)', pageHtml.includes('Watch Party') || pageHtml.includes('Fight Club'));
ok('mobile chat FAB present', (await page.locator('.chat-fab').count()) > 0);
const fxRow = await page.locator('.fx-ctrl-row').count();
ok('fx volume row present (all users)', fxRow > 0);
const syncBtn = await page.locator('.sync-btn').count();
ok('sync-to-host button hidden for host', syncBtn === 0);
ok('no page JS errors on room', errs.length === 0, errs.slice(0, 3).join(' | '));
await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
