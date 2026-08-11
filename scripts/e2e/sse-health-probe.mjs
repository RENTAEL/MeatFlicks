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

const tmdbKey = envLine(`${REPO}/.env`, 'TMDB_API_KEY');
process.env.SESSION_SECRET = process.env.SESSION_SECRET || envLine(`${REPO}/.env`, 'SESSION_SECRET');
process.env.TMDB_API_KEY = tmdbKey;
const { encryptSession } = await import(pathToFileURL(`${REPO}/src/lib/server/session-crypto.ts`).href);

const mk = (id, name) => ({ id, name, cookie: encryptSession({ userId: id, username: name, role: 'USER', expiresAt: Date.now() + 7200000 }) });
const host = mk('user-a', 'Hosty');
const member = mk('user-b', 'Becca');

const api = async (cookie, path, init = {}) => {
	const r = await fetch(`${BASE}/api${path}`, {
		...init,
		headers: { 'content-type': 'application/json', cookie: `session=${cookie}`, ...(init.headers || {}) }
	});
	return { status: r.status, body: await r.json().catch(() => ({})) };
};

const created = await api(host.cookie, '/watch-party/rooms', {
	method: 'POST',
	body: JSON.stringify({ mediaType: 'movie', tmdbId: 550, title: 'Fight Club' })
});
const roomId = created.body.roomId;
console.log('room', roomId, 'status', created.status);

await api(host.cookie, `/watch-party/rooms/${roomId}/sound-control`, {
	method: 'POST',
	body: JSON.stringify({ userId: member.id, canControlSounds: true })
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addCookies([{ name: 'session', value: member.cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
const page = await ctx.newPage();

let streamResponses = 0;
let lastStreamAt = 0;
let streamStatuses = {};
const streamUrls = {};
page.on('response', (r) => {
	if (r.url().endsWith('/stream')) {
		streamResponses++;
		lastStreamAt = Date.now();
		streamStatuses[r.status()] = (streamStatuses[r.status()] || 0) + 1;
		if (streamResponses <= 5) console.log(`[stream response] #${streamResponses} status=${r.status()} url=${r.url().replace(BASE, '')}`);
	}
});
page.on('request', (r) => {
	if (r.url().endsWith('/stream') && streamResponses <= 5) console.log(`[stream request] ${r.url().replace(BASE, '')}`);
});

await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
console.log('page loaded, waiting for player');
await page.waitForFunction(() => !!document.querySelector('.player-root'), null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1000);
await page.keyboard.press('k');
await page.waitForTimeout(500);
console.log('audio unlocked via trusted keydown (parent page); monitoring member SSE + sound for 120s');
let lastStreamCount = 0;
const t0 = Date.now();

let lastSeqSeen = -1;
for (let i = 0; i < 120; i++) {
	await page.waitForTimeout(1000);
	const state = await page.evaluate(() => {
		const sw = window.__swLastSyncApplied;
		const sd = window.__wpLastSound;
		const es = null;
		return {
			seq: sw ? sw.seq : null,
			at: sw ? sw.at : null,
			playing: sw ? sw.playing : null,
			position: sw ? sw.position : null,
			sound: sd ? { kind: sd.kind, at: sd.at, source: sd.source } : null,
			title: document.querySelector('.room-title')?.textContent?.slice(0, 30) ?? null,
			fxDisabled: document.querySelector('button.fx-btn')?.disabled ?? null
		};
	}).catch(() => null);
	const age = state?.at ? Math.round((Date.now() - state.at) / 100) / 10 : null;
		if (state && (state.seq !== lastSeqSeen || i % 10 === 0 || (state.sound && Math.abs(Date.now() - state.sound.at) < 1500))) {
	lastSeqSeen = state.seq;
	console.log(`t=${i}s streamResps=${streamResponses} statuses=${JSON.stringify(streamStatuses)} urls=${JSON.stringify(streamUrls)} lastStreamAt=${lastStreamAt ? Math.round((Date.now() - lastStreamAt) / 100) / 10 + 's ago' : 'never'} seq=${state.seq} hookAge=${age}s playing=${state.playing} pos=${state.position} sound=${JSON.stringify(state.sound)}`);
	}
	if (i > 5 && i % 10 === 0) {
		const r = await api(host.cookie, `/watch-party/rooms/${roomId}/sound`, { method: 'POST', body: JSON.stringify({ effect: 'boo' }) });
		const room = await api(host.cookie, `/watch-party/rooms/${roomId}`);
		console.log(`t=${i}s -> host POSTed sound boo status=${r.status} roomSeq=${room.body?.seq} roomPlaying=${room.body?.playing} roomSound=${JSON.stringify(room.body?.sound)}`);
	}
}
await browser.close();
console.log('done');
