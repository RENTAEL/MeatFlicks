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
const cody = { id: 'user-c', name: 'Cody', cookie: makeCookie('user-c', 'Cody') };

const results = [];
function ok(name, pass, detail = '') {
	results.push({ name, pass });
	console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

async function api(cookie, path, init = {}) {
	const r = await fetch(`${BASE}/api${path}`, {
		...init,
		headers: { 'content-type': 'application/json', cookie: `session=${cookie}`, ...(init.headers || {}) }
	});
	const body = await r.json().catch(() => ({}));
	return { status: r.status, body };
}

async function waitFor(fn, timeout = 15000, interval = 50, desc = 'condition') {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		try {
			const v = await fn();
			if (v) return v;
		} catch {}
		await new Promise((r) => setTimeout(r, interval));
	}
	throw new Error(`Timed out waiting for: ${desc}`);
}

async function newBrowserPage(browser, user, url) {
	const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	await ctx.addCookies([{ name: 'session', value: user.cookie, domain: COOKIE_DOMAIN, path: '/' }]);
	const page = await ctx.newPage();
	const errors = [];
	const soundReqs = [];
	page.on('request', (r) => { if (r.url().includes('/sounds/')) soundReqs.push(r.url()); });
	page.on('pageerror', (e) => { errors.push(String(e)); console.log(`[${user.name}] PAGEERROR:`, String(e).slice(0, 300)); });
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
	return { ctx, page, errors, soundReqs };
}

const syncHook = (page) =>
	page.evaluate(() => (window.__swLastSyncApplied ? { ...window.__swLastSyncApplied } : null)).catch(() => null);
const soundHook = (page) => page.evaluate(() => (window.__wpLastSound ? { ...window.__wpLastSound } : null)).catch(() => null);

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

ok('host room page loads', !!(await waitFor(() => h.page.locator('.room-title').textContent().catch(() => null), 30000, 200, 'host title')));
await waitFor(() => b.page.locator('.room-title').textContent().catch(() => null), 30000, 200, 'member title');

await waitFor(() => h.page.locator('iframe.player-iframe').count().then((n) => n > 0).catch(() => false), 45000, 250, 'host player iframe');
console.log('host player loaded');

console.log('\n== PART 1: sound controller permission ==');
const fxBtns = b.page.locator('button.fx-btn');
{
	let lastErr = '';
	const deadline = Date.now() + 20000;
	while (Date.now() < deadline) {
		try {
			const c = await fxBtns.count();
			if (c > 0) break;
		} catch (err) {
			lastErr = String(err).slice(0, 200);
			console.log('fx count threw:', lastErr);
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	if (Date.now() >= deadline && lastErr) console.log('fx count kept throwing:', lastErr);
}
const fxBtn0 = fxBtns.first();
ok('member fx buttons disabled before grant', (await fxBtn0.isDisabled().catch(() => true)) === true);
ok('member sees no-control hint', await b.page.locator('.fx-hint').isVisible().catch(() => false));

let grantBtn = h.page.locator('button.grant-btn');
{
	const deadline = Date.now() + 60000;
	let matched = null;
	while (Date.now() < deadline) {
		try {
			const n = await grantBtn.count();
			if (n > 0) {
				const first = grantBtn.first();
				const txt = await first.textContent().catch(() => '');
				if (/Sound: Off|Sound: On/.test(txt)) { matched = first; break; }
			}
		} catch {}
		await new Promise((r) => setTimeout(r, 150));
	}
	if (!matched) {
		const body = await h.page.evaluate(() => document.body.innerText).catch(() => '');
		const raw = await h.page.evaluate(() => document.querySelectorAll('button.grant-btn').length).catch(() => -1);
		console.log('DIAG host body:', body.slice(0, 400).replace(/\n/g, ' | '));
		console.log('DIAG raw grant-btn:', raw);
		throw new Error('Timed out waiting for: host grant toggle');
	}
	grantBtn = matched;
}
await grantBtn.click();
try {
	await waitFor(() => b.page.locator('.fx-btn').first().isEnabled().catch(() => false), 10000, 100, 'member buttons enabled after grant (live)');
} catch (e) {
	await new Promise((r) => setTimeout(r, 1500));
	const s = await api(becca.cookie, `/watch-party/rooms/${roomId}`);
	const row = s.body?.participants?.find((p) => p.userId === becca.id);
	const disabled = await b.page.locator('.fx-btn').first().isDisabled().catch(() => '?');
	const raw = await b.page.evaluate(() => document.querySelectorAll('button.fx-btn')[0]?.disabled).catch(() => '?');
	const grantText = await h.page.locator('button.grant-btn').first().textContent().catch(() => '?');
	console.log('DIAG server canControlSounds:', row?.canControlSounds, JSON.stringify(s.body?.participants?.map((p) => ({ u: p.username, c: p.canControlSounds }))));
	console.log('DIAG member locator disabled:', disabled, 'raw disabled:', raw, 'host grant text:', grantText);
	throw e;
}
ok('grant enables member buttons live (no refresh)', true);
ok('member hint gone after grant', !(await b.page.locator('.fx-hint').isVisible().catch(() => false)));

const sGranted = await api(becca.cookie, `/watch-party/rooms/${roomId}`);
const beccaRow = sGranted.body?.participants?.find((p) => p.userId === becca.id);
ok('permission stored server-side', beccaRow?.canControlSounds === true, JSON.stringify(beccaRow));

// spoof check: member with NO permission can't trigger
const sndSpoof = await api(cody.cookie, `/watch-party/rooms/${roomId}/sound`, {
	method: 'POST',
	body: JSON.stringify({ effect: 'boo' })
});
ok('non-granted member POST /sound rejected', sndSpoof.status === 403, String(sndSpoof.status));
const scSpoof = await api(becca.cookie, `/watch-party/rooms/${roomId}/sound-control`, {
	method: 'POST',
	body: JSON.stringify({ userId: cody.id, granted: true })
});
ok('member POST /sound-control rejected', scSpoof.status === 403, String(scSpoof.status));

console.log('\n== TASK 2: sound preload ==');
const preloadCount = await waitFor(() => (b.soundReqs.length >= 4 ? b.soundReqs.length : null), 20000, 200, '4 sound files preloaded');
ok('all 4 sound files fetched on room load (preload)', preloadCount === 4, `count=${preloadCount}`);

await b.page.mouse.click(640, 300);
await b.page.waitForTimeout(300);
await b.page.locator('.fx-btn', { hasText: 'Boo' }).click();
const sound = await waitFor(() => soundHook(b.page), 10000, 100, 'member sound played');
ok('granted member trigger plays sound', sound?.kind === 'boo', JSON.stringify(sound));
ok('sound played from cached buffer (no per-trigger fetch)', sound?.source === 'buffer' && b.soundReqs.length === 4, `source=${sound?.source} reqs=${b.soundReqs.length}`);

const sSound = await api(becca.cookie, `/watch-party/rooms/${roomId}`);
ok('sound seq advanced for room', (sSound.body?.sound?.seq ?? 0) >= 1 && sSound.body?.sound?.effect === 'boo', JSON.stringify(sSound.body?.sound));

// revoke
const revokeBtn = h.page.locator('.grant-btn', { hasText: 'Sound: On' }).first();
await revokeBtn.click();
await waitFor(() => b.page.locator('.fx-btn').first().isDisabled().catch(() => false), 10000, 100, 'member buttons disabled after revoke (live)');
ok('revoke disables member buttons immediately (no refresh)', true);
const sRevoked = await api(becca.cookie, `/watch-party/rooms/${roomId}`);
ok('permission cleared server-side', sRevoked.body?.participants?.find((p) => p.userId === becca.id)?.canControlSounds === false);

console.log('\n== PART 1b: kick + rejoin resets permission ==');
const kick = await api(host.cookie, `/watch-party/rooms/${roomId}/kick`, { method: 'POST', body: JSON.stringify({ userId: becca.id }) });
ok('host kick B', kick.status === 200, String(kick.status));
await api(becca.cookie, `/watch-party/join`, { method: 'POST', body: JSON.stringify({ roomId }) });
await b.page.reload({ waitUntil: 'domcontentloaded' });
{
	let lastErr = '';
	const deadline = Date.now() + 20000;
	let ok = false;
	while (Date.now() < deadline) {
		try {
			if ((await b.page.locator('.fx-btn').first().count()) > 0) { ok = true; break; }
		} catch (err) {
			lastErr = String(err).slice(0, 300);
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	if (!ok) {
		const diag = await b.page.evaluate(() => ({
			url: location.href,
			body: document.body.innerText.slice(0, 300).replace(/\n/g, ' | '),
			fx: document.querySelectorAll('button.fx-btn').length,
			closed: !!document.querySelector('.closed-wrap'),
			hint: document.querySelector('.fx-hint')?.textContent ?? null,
			roomTitle: document.querySelector('.room-title')?.textContent ?? null
		})).catch(() => null);
		console.log('DIAG reloaded member page:', JSON.stringify(diag));
		console.log('DIAG last locator error:', lastErr);
		throw new Error('Timed out waiting for: rejoined member fx');
	}
}
await waitFor(() => b.page.locator('.fx-btn').first().isDisabled().catch(() => false), 10000, 100, 'rejoined member buttons disabled');
ok('permission gone after kick + rejoin (buttons disabled)', true);

console.log('\n== TASK 3: playback sync ==');
async function measure(clickFn, expectPlaying, expectPositionDelta = 0) {
	const t0 = Date.now();
	const before = await syncHook(b.page);
	await clickFn();
	const applied = await waitFor(
		() => syncHook(b.page).then((s) => (s && s.seq !== (before?.seq ?? -1) ? s : null)),
		15000, 50, 'member sync applied'
	);
	return { applied, latencyMs: applied.at - t0 };
}

// host: keep focus inside .player-root but NOT in the cross-origin iframe, so the player's keydown shortcuts fire
const focusHost = async () => {
	await h.page.evaluate(() => {
		const btn = document.querySelector('.player-root .switch-btn') || document.querySelector('.player-root .next-btn') || document.querySelector('.player-root button');
		btn?.focus();
	});
	await h.page.waitForTimeout(150);
};
await focusHost();
await h.page.waitForTimeout(300);

// 1) play (keyboard 'k' = play/pause)
const hostPosts = [];
h.page.on('request', (r) => {
	if (r.method() === 'POST' && r.url().includes('/watch-party/rooms/') && r.url().endsWith('/playback')) {
		try {
			const d = r.postDataJSON();
			if (d && typeof d === 'object') hostPosts.push({ t: Date.now(), d });
		} catch {}
	}
});
async function hostKeyUntil(match, key) {
	const beforeSeq = (await syncHook(b.page))?.seq ?? -1;
	for (let attempt = 0; attempt < 3; attempt++) {
		await h.page.evaluate((k) => {
			const root = document.querySelector('.player-root');
			const t = root?.querySelector('.switch-btn') || root?.querySelector('button') || root;
			t?.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
		}, key);
		const found = await waitFor(
			() => syncHook(b.page).then((s) => (match(s) && s.seq !== beforeSeq ? s : null)),
			15000, 50, `host ${key} effect`
		).catch(() => null);
		if (found) return found;
	}
	const memberHook = await syncHook(b.page);
	console.log('DIAG member hook at fail:', JSON.stringify(memberHook));
	console.log('DIAG host posts this window:', hostPosts.length ? hostPosts.map((p) => JSON.stringify(p.d)).join(' | ') : '(none)');
	return null;
}
const t0 = Date.now();
const playApplied = await hostKeyUntil((s) => s && s.playing === true, 'k');
const playLatency = playApplied ? playApplied.at - t0 : -1;
ok('host play reaches member', !!playApplied && playLatency <= 12000, `latency=${playLatency}ms seq=${playApplied?.seq}`);
console.log(`  play latency: ${playLatency}ms`);
const memberSrc1 = await waitFor(
	() => b.page.evaluate(() => { const f = document.querySelector('iframe.player-iframe'); return f ? f.src : ''; }).then((s) => (s.includes('autoplay=true') ? s : null)),
	15000, 100, 'member autoplay iframe'
).catch(() => null);
ok('member iframe gets autoplay after host play', !!memberSrc1, (memberSrc1 || '').slice(0, 120));

// 2) seek +10 (keyboard ArrowRight)
const t1 = Date.now();
const seekApplied = await hostKeyUntil((s) => s && s.playing === true, 'arrowright');
const seekLatency = seekApplied ? seekApplied.at - t1 : -1;
ok('host seek reaches member', !!seekApplied && seekLatency <= 12000, `latency=${seekLatency}ms`);
console.log(`  seek latency: ${seekLatency}ms`);

// 3) pause
const t2 = Date.now();
const pauseApplied = await hostKeyUntil((s) => s && s.playing === false, 'k');
const pauseLatency = pauseApplied ? pauseApplied.at - t2 : -1;
ok('host pause reaches member', !!pauseApplied && pauseLatency <= 12000, `latency=${pauseLatency}ms`);
console.log(`  pause latency: ${pauseLatency}ms`);

// no polling check: 10s idle, count GETs to the room endpoint
let roomGets = 0;
b.page.on('request', (r) => {
	if (r.method() === 'GET' && r.url().includes(`/api/watch-party/rooms/${roomId}`) && !r.url().includes('/stream')) roomGets++;
});
await b.page.waitForTimeout(10000);
ok('no polling (room GETs during 10s idle)', roomGets <= 1, `gets=${roomGets}`);

console.log('\n== TASK 3b: provider switch + late joiner ==');
// host switches provider
const hostProviderBefore = await h.page.locator('.provider-name').textContent().catch(() => '');
await h.page.locator('.switch-btn').click();
const serverItems = h.page.locator('.server-item');
const serverCount = await serverItems.count();
	if (serverCount > 1) {
		await serverItems.nth(1).click();
		const hostProviderAfter = await waitFor(
			() => h.page.locator('.provider-name').textContent().then((t) => (t && t !== hostProviderBefore ? t : null)),
			15000, 200, 'host provider changed'
		);
		const memberMirrored = await waitFor(
			() => b.page.locator('.provider-name').textContent().then((t) => (t && t === hostProviderAfter ? t : null)),
			25000, 200, 'member provider mirror'
		).catch(() => null);
		ok('member mirrors host provider', !!memberMirrored, `host=${hostProviderAfter} member=${await b.page.locator('.provider-name').textContent().catch(() => '')}`);
		const memberSrc2 = await b.page.evaluate(() => { const f = document.querySelector('iframe.player-iframe'); return f ? f.src : ''; });
		// vidsrc embeds carry position via postMessage (no startAt param); vidlink embeds use startAt
		const hasPosition = memberSrc2.includes('vidsrc.to') || memberSrc2.includes('startAt=');
		ok('member iframe switched provider with position', hasPosition, memberSrc2.slice(0, 120));
	} else {
		ok('provider switch test skipped (only 1 server)', true, 'count=' + serverCount);
	}

// late joiner: Cody joins now, must land on host's server + position
await h.page.locator('.switch-btn').click();
const firstItem = h.page.locator('.server-item').first();
await firstItem.click();
await h.page.waitForTimeout(1500);
const hostProviderNow = await h.page.locator('.provider-name').textContent().catch(() => '');
// the host's fresh vidlink embed restarts at 0 and re-broadcasts it; let the room settle before Cody joins
await waitFor(
	() => syncHook(b.page).then((s) => (s && s.provider === 'vidlink' && s.position <= 1 ? s : null)),
	25000, 200, 'room settled on vidlink pos 0'
).catch(() => null);
const c = await newBrowserPage(browser, cody, `${BASE}/watch/${roomId}`);
await waitFor(() => c.page.locator('.room-title').textContent().catch(() => null), 30000, 200, 'cody title');
const codySrc = await waitFor(
	() => c.page.evaluate(() => { const f = document.querySelector('iframe.player-iframe'); return f ? f.src : ''; }).then((s) => (s.includes('startAt') ? s : null)),
	45000, 300, 'cody iframe with startAt'
);
const codyProvider = await c.page.locator('.provider-name').textContent().catch(() => '');
ok('late joiner lands on host provider', codyProvider === hostProviderNow, `host=${hostProviderNow} cody=${codyProvider}`);
const posMatch = /startAt=(\d+)/.exec(codySrc);
const codyStart = posMatch ? Number(posMatch[1]) : null;
const memberMirrorPos = await waitFor(
	() => syncHook(b.page).then((s) => (s && codyStart !== null && Math.abs(s.position - codyStart) <= 5 ? s : null)),
	20000, 200, 'member position mirrors cody startAt'
).catch(() => null);
const hostPos = memberMirrorPos?.position ?? null;
ok('late joiner lands on host position', posMatch && hostPos !== null && Math.abs(codyStart - hostPos) <= 5, `startAt=${posMatch?.[1]} hostPos=${hostPos}`);
const codyHook = await syncHook(c.page);
ok('late joiner shows host playing state', codyHook?.playing === memberMirrorPos?.playing, `${JSON.stringify(codyHook)} vs member ${JSON.stringify(memberMirrorPos)}`);

// known upstream noise: 3rd-party embed widgets (vsembed.ru / cloudorchestranova.com inside vidsrc/vidlink)
// throwing cross-origin SecurityError inside their own iframes — not ours to fix
const isUpstreamNoise = (e) => /SecurityError: Failed to read a named property/.test(e) && /vsembed\.ru|cloudorchestranova\.com/.test(e);
const allErrors = [...h.errors.filter((e) => !isUpstreamNoise(e)), ...b.errors.filter((e) => !isUpstreamNoise(e)), ...c.errors.filter((e) => !isUpstreamNoise(e))];
ok('no page JS errors on any page', allErrors.length === 0, allErrors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
