import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';

const BASE = 'https://streamium-cosmic.vercel.app';
const REPO = 'C:/Users/bezui/Downloads/Test site thing';

function envLine(file, key) {
	if (!existsSync(file)) return '';
	const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(key + '='));
	return line ? line.slice(key.length + 1).trim() : '';
}

process.env.SESSION_SECRET = envLine(`${REPO}/.env`, 'SESSION_SECRET');
process.env.TMDB_API_KEY = envLine(`${REPO}/.env`, 'TMDB_API_KEY');
const { encryptSession } = await import(`file:///${REPO.replace(/ /g, '%20')}/src/lib/server/session-crypto.ts`);
const mkCookie = (name) => encryptSession({ userId: 'user-' + name, username: name, role: 'USER', expiresAt: Date.now() + 1000 * 60 * 60 });

const hostCookie = mkCookie('hosty');
const memberCookie = mkCookie('memba');
const mobCookie = mkCookie('mobmo');

const res = await fetch(`${BASE}/api/watch-party/rooms`, {
	method: 'POST',
	headers: { 'content-type': 'application/json', cookie: `session=${hostCookie}` },
	body: JSON.stringify({ mediaType: 'movie', tmdbId: 550, title: 'Fight Club' })
});
const { roomId } = await res.json();
console.log('room:', roomId);

const browser = await chromium.launch();

const COLLECT = `
window.__vl = [];
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://vidlink.pro') return;
  const d = e.data;
  if (d && d.type === 'PLAYER_EVENT' && d.data) window.__vl.push({ ev: d.data.event, t: d.data.currentTime, at: Date.now() });
});
`;

async function makeSession(cookie, opts = {}) {
	const ctx = await browser.newContext(opts);
	await ctx.addCookies([{ name: 'session', value: cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
	await ctx.addInitScript(COLLECT);
	const page = await ctx.newPage();
	const errs = [];
	page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
	return { page, errs };
}

const host = await makeSession(hostCookie);
const member = await makeSession(memberCookie);

await Promise.all([
	host.page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'load', timeout: 60000 }),
	member.page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'load', timeout: 60000 })
]);

await host.page.waitForSelector('iframe.player-iframe', { timeout: 30000 });
await member.page.waitForSelector('iframe.player-iframe', { timeout: 30000 });
await host.page.waitForTimeout(6000);

console.log('initial roomState:', await roomState());

const lastEvent = (p) => p.evaluate(() => {
	const v = window.__vl;
	return v.length ? v[v.length - 1] : null;
});
const iframeSrc = (p) => p.evaluate(() => document.querySelector('iframe.player-iframe')?.src ?? null);
const syncStatus = (p) => p.evaluate(() => document.querySelector('.sync-status')?.textContent?.trim() ?? null);
const hasTapOverlay = (p) => p.evaluate(() => !!document.querySelector('.tap-overlay'));

const hostPos = async () => (await lastEvent(host.page))?.t ?? -1;
const memberPos = async () => (await lastEvent(member.page))?.t ?? -1;
const roomState = async () => {
	const r = await fetch(`${BASE}/api/watch-party/rooms/${roomId}?since=0`, {
		headers: { cookie: `session=${memberCookie}` }
	});
	const j = await r.json();
	return j.playback ? `${j.playback.playing ? 'PLAY' : 'PAUSE'} pos=${Math.round(j.playback.position)} seq=${j.playback.seq}` : 'n/a';
};
const memberInternals = () => member.page.evaluate(() => {
	const f = document.querySelector('iframe.player-iframe');
	return { src: f?.src?.split('_=')[0] ?? null, events: (window.__vl ?? []).slice(-3) };
});

console.log('host src:', await iframeSrc(host.page));
console.log('member src after settle:', await iframeSrc(member.page));
console.log('member first sync:', (await iframeSrc(member.page))?.includes('startAt') ? 'OK (startAt present)' : 'FAIL (no startAt)');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await member.page.waitForTimeout(8000);
const before = { host: await hostPos(), member: await memberPos() };
console.log('positions after settle:', JSON.stringify(before), '| drift:', (before.host - before.member).toFixed(1), 's | member status:', await syncStatus(member.page));

const hostClick = async (label) => {
	const el = host.page.locator(`.ctrl-btn[aria-label="${label}"]`);
	const before = await host.page.evaluate(() => {
		const f = document.querySelector('iframe.player-iframe');
		const evs = window.__vl ?? [];
		return { src: f?.src ?? null, lastEv: evs.length ? evs[evs.length - 1] : null };
	});
	console.log(`  [before ${label}] host src=${before.src?.split('?')[1]} lastEv=${JSON.stringify(before.lastEv)}`);
	await el.click({ timeout: 10000 });
	await wait(4000);
	console.log(`  [mid ${label}] roomState: ${await roomState()}`);
	await wait(6000);
};

await hostClick('Pause');
const srcPaused = await iframeSrc(member.page);
console.log('host Pause -> member src:', srcPaused);
console.log('  pause propagated:', srcPaused?.includes('autoplay=false') ? 'OK' : 'FAIL');
console.log('  member status:', await syncStatus(member.page));

await hostClick('Play');
const srcPlayed = await iframeSrc(member.page);
console.log('host Play -> member src:', srcPlayed);
console.log('  play propagated:', srcPlayed?.includes('autoplay=true') ? 'OK' : 'FAIL');

await hostClick('Forward 10 seconds');
const srcSeek = await iframeSrc(member.page);
const seekMatch = srcSeek?.match(/startAt=(\d+)/);
console.log('host +10s -> member startAt:', seekMatch ? seekMatch[1] : 'none');

await member.page.waitForTimeout(10000);
const after = { host: await hostPos(), member: await memberPos() };
console.log('positions after seek settle:', JSON.stringify(after), '| drift:', (after.host - after.member).toFixed(1), 's');
console.log('member status:', await syncStatus(member.page));
console.log('host errs:', host.errs.length, '| member errs:', member.errs.length);

const mob = await makeSession(mobCookie, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
await mob.page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'load', timeout: 60000 });
await mob.page.waitForSelector('iframe.player-iframe', { timeout: 30000 });
await mob.page.waitForTimeout(16000);
const tapShown = await hasTapOverlay(mob.page);
console.log('mobile tap overlay:', tapShown ? 'SHOWN' : 'not shown yet');
if (tapShown) {
	await mob.page.tap('.tap-overlay');
	await wait(9000);
	console.log('after tap -> src:', await iframeSrc(mob.page));
	console.log('after tap overlay gone:', !(await hasTapOverlay(mob.page)) ? 'OK' : 'FAIL');
	console.log('mob errs:', mob.errs.length);
}

await browser.close();
process.exit(0);
