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
const mutedCookie = mkCookie('mutedo');

const res = await fetch(`${BASE}/api/watch-party/rooms`, {
	method: 'POST',
	headers: { 'content-type': 'application/json', cookie: `session=${hostCookie}` },
	body: JSON.stringify({ mediaType: 'movie', tmdbId: 550, title: 'Fight Club' })
});
const { roomId } = await res.json();
console.log('room:', roomId);

const browser = await chromium.launch();
const INSTRUMENT = `
window.__aud = { contexts: 0, oscStarts: 0, bufStarts: 0 };
const origAC = window.AudioContext || window.webkitAudioContext;
window.AudioContext = function (...a) { window.__aud.contexts++; const c = new origAC(...a); return c; };
const op = OscillatorNode.prototype.start;
OscillatorNode.prototype.start = function (...a) { window.__aud.oscStarts++; return op.apply(this, a); };
const bp = AudioBufferSourceNode.prototype.start;
AudioBufferSourceNode.prototype.start = function (...a) { window.__aud.bufStarts++; return bp.apply(this, a); };
`;

async function makeSession(cookie) {
	const ctx = await browser.newContext();
	await ctx.addCookies([{ name: 'session', value: cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
	await ctx.addInitScript(INSTRUMENT);
	const page = await ctx.newPage();
	const errs = [];
	page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
	return { page, errs };
}

const host = await makeSession(hostCookie);
const member = await makeSession(memberCookie);
const muted = await makeSession(mutedCookie);

await Promise.all([
	host.page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'load', timeout: 60000 }),
	member.page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'load', timeout: 60000 }),
	muted.page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'load', timeout: 60000 })
]);
await Promise.all([host.page.waitForTimeout(4000), member.page.waitForTimeout(4000), muted.page.waitForTimeout(4000)]);

const snap = (p) => p.evaluate(() => ({
	hint: !!document.querySelector('.sound-hint'),
	aud: window.__aud,
	ac: window.__aud.contexts,
	volume: document.querySelector('.fx-slider')?.value ?? null
}));

const unlock = (p) => p.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));

console.log('fresh member:', JSON.stringify(await snap(member.page)));
console.log('muted member hint:', JSON.stringify(await snap(muted.page)));

await unlock(member.page);
await member.page.waitForTimeout(500);
console.log('after member unlock:', JSON.stringify(await snap(member.page)));

await muted.page.evaluate(() => localStorage.setItem('wp-fx-mute', '1'));
await unlock(muted.page);
await muted.page.waitForTimeout(500);
const mutedState = await muted.page.evaluate(() => ({ muted: localStorage.getItem('wp-fx-mute'), vol: localStorage.getItem('wp-fx-volume'), slider: document.querySelector('.fx-slider')?.value }));

const trigger = async (n) => {
	await fetch(`${BASE}/api/watch-party/rooms/${roomId}/sound`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', cookie: `session=${hostCookie}` },
		body: JSON.stringify({ effect: n % 2 ? 'boo' : 'applause' })
	});
};
await host.page.evaluate(() => localStorage.setItem('wp-fx-volume', '0.3'));
await unlock(host.page);
for (let i = 0; i < 3; i++) { await trigger(i); await host.page.waitForTimeout(2500); }

console.log('host after triggers:', JSON.stringify(await snap(host.page)));
console.log('member after triggers:', JSON.stringify(await snap(member.page)));
console.log('muted member:', JSON.stringify(mutedState), 'aud after triggers:', JSON.stringify((await snap(muted.page)).aud));

for (let i = 3; i < 12; i++) { await trigger(i); await host.page.waitForTimeout(1200); }
await member.page.waitForTimeout(2500);
console.log('member after 12 triggers:', JSON.stringify(await snap(member.page)), 'errs:', member.errs.length);

await browser.close();
process.exit(0);
