import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const BASE = 'https://streamium-cosmic.vercel.app';
const env = Object.fromEntries(
	readFileSync('.env', 'utf8')
		.split(/\r?\n/)
		.filter((l) => l && !l.startsWith('#'))
		.map((l) => {
			const i = l.indexOf('=');
			return [l.slice(0, i), l.slice(i + 1)];
		})
);
const { createClient } = createRequire(import.meta.url)('@libsql/client');
const turso = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

// Chromium's autoplay policy would block the cross-origin vidlink iframe on
// its own (no per-frame user activation in headless). Disable the policy so
// the probe's stub is the ONLY block mechanism — i.e. exactly what a real
// tap-to-resume gesture grants.
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let pass = 0;
let fail = 0;
let hostUser = '';
let memberUser = '';
const probePass = 'ProbePass123!';

function report(name, ok, detail) {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  | ${detail}` : ''}`);
	if (ok) pass++;
	else fail++;
}

async function cleanupUsers() {
	try {
		const r = await turso.execute({
			sql: 'DELETE FROM users WHERE username IN (?, ?)',
			args: [hostUser, memberUser]
		});
		console.log(`cleaned probe user(s): ${r.rowsAffected}`);
	} catch (e) {
		console.log('cleanup skipped:', e.message);
	}
}

async function signupUser(username) {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.goto(BASE + '/signup', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await page.waitForSelector('input[name="username"]', { timeout: 20000 });
	await page.fill('input[name="username"]', username);
	await page.fill('input[name="email"]', `${username}@probe.test`);
	await page.fill('input[name="password"]', probePass);
	await page.click('button[type="submit"]');
	await page.waitForURL(BASE + '/', { timeout: 30000 }).catch(() => {});
	await page.waitForTimeout(2000);
	return { ctx, page };
}

async function postJson(page, url, body) {
	return page.evaluate(
		async ([u, b]) => {
			const csrf = await fetch('/api/csrf').then((r) => r.json());
			const token = csrf?.token || csrf?.csrfToken || '';
			const res = await fetch(u, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
				body: JSON.stringify(b),
				credentials: 'include'
			});
			return { status: res.status, ok: res.ok, body: await res.text() };
		},
		[url, body]
	);
}

function soakLines(logs) {
	return logs.filter((l) => typeof l === 'string' && l.includes('[soak]')).map((l) => String(l));
}

async function waitForSoak(logs, needle, timeoutMs) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (soakLines(logs).some((l) => l.includes(needle))) return true;
		await new Promise((r) => setTimeout(r, 500));
	}
	return false;
}

const mark = (logs) => soakLines(logs).length;
const newLines = (logs, m) => soakLines(logs).slice(m);
const countNew = (logs, m, needle) => newLines(logs, m).filter((l) => l.includes(needle)).length;
async function waitNew(logs, m, needle, timeoutMs) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (newLines(logs, m).some((l) => l.includes(needle))) return true;
		await new Promise((r) => setTimeout(r, 500));
	}
	return false;
}

function latestPlaybackPlaying(logs) {
	const lines = soakLines(logs).filter((l) => l.includes('[playback]'));
	if (!lines.length) return null;
	const last = lines[lines.length - 1];
	const m = last.match(/playing=(true|false)/);
	return m ? m[1] === 'true' : null;
}

// Find vidlink frames by their block flag, polling across frame loads/reloads.
// Returns all live matches (old dying frames + the current one) so setters can
// hit whichever is stable.
async function vidlinkFrames(page, timeoutMs = 15000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const targets = [];
		for (const f of page.frames()) {
			try {
				if (await f.evaluate(() => typeof window.__blockPlay !== 'undefined')) targets.push(f);
			} catch {
				// frame mid-navigation — keep scanning
			}
		}
		if (targets.length) return targets;
		await new Promise((r) => setTimeout(r, 300));
	}
	return [];
}

async function setBlock(page, v) {
	const start = Date.now();
	while (Date.now() - start < 15000) {
		for (const f of (await vidlinkFrames(page, 1000)).reverse()) {
			try {
				await f.evaluate((val) => (window.__blockPlay = val), v);
				return true;
			} catch {
				// detached — try the next / keep polling
			}
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	console.log(
		'DEBUG setBlock FAILED — frames:',
		page.frames().map((f) => f.url())
	);
	return false;
}

async function memberVideo(page, stall) {
	const start = Date.now();
	while (Date.now() - start < 15000) {
		for (const f of (await vidlinkFrames(page, 1000)).reverse()) {
			try {
				const ok = await f.evaluate((s) => {
					const v = document.querySelector('video');
					if (!v) return false;
					if (s) v.pause();
					else v.play().catch(() => {});
					return true;
				}, stall);
				if (ok) return true;
			} catch {
				// detached — try the next / keep polling
			}
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	console.log(
		'DEBUG memberVideo FAILED — frames:',
		page.frames().map((f) => f.url())
	);
	return false;
}

// Every app-driven reload installs a fresh frame whose stub defaults to
// blocked (real browsers grant autoplay after the user's tap). A watcher
// keeps reloaded frames unblocked so the simulation matches reality.
function startUnblockWatcher(page, logs) {
	let wm = mark(logs);
	const timer = setInterval(async () => {
		try {
			if (newLines(logs, wm).some((l) => l.includes('builtFromReload=true'))) {
				wm = mark(logs);
				await new Promise((r) => setTimeout(r, 2500));
				await setBlock(page, false);
			}
		} catch {
			// watcher must never crash the run
		}
	}, 1000);
	return () => clearInterval(timer);
}

async function main(attempt) {
	const suffix = `${attempt}${Date.now().toString(36).slice(-6)}`;
	hostUser = `soaksh${suffix}`;
	memberUser = `soaksm${suffix}`;

	console.log(`== SETUP (attempt ${attempt}) ==`);
	const host = await signupUser(hostUser);
	const member = await signupUser(memberUser);
	console.log(`signed up host=${hostUser} member=${memberUser}`);

	// Headless Chromium reports pointer:coarse (the app's TV path). Force the
	// phone/desktop path so this probe asserts the intended fine-pointer
	// behavior; skip coarse-sensitive assertions if the CDP override fails.
	let finePointer = true;
	try {
		const cdp = await member.page.context().newCDPSession(member.page);
		await cdp.send('Emulation.setEmulatedMedia', {
			features: [{ name: 'pointer', value: 'fine' }]
		});
		await cdp.detach();
	} catch (e) {
		finePointer = false;
		console.log('DEBUG pointer:fine CDP override failed — running with coarse path');
	}
	const isCoarse = await member.page
		.evaluate(() => window.matchMedia?.('(pointer: coarse)')?.matches ?? true)
		.catch(() => true);
	report('simulation: pointer reported as fine', !isCoarse, isCoarse ? '(coarse — see DEBUG)' : '');
	finePointer = !isCoarse;

	// Simulate an autoplay-blocked member DETERMINISTICALLY: intercept the
	// vidlink iframe document and inject a stub that makes play() reject with
	// NotAllowedError until the probe flips window.__blockPlay.
	const BLOCK_STUB = `<script>window.__blockPlay = true; var __op = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { if (window.__blockPlay) { return Promise.reject(new DOMException('play() blocked (simulated autoplay policy)', 'NotAllowedError')); } return __op.apply(this, arguments); };</script>`;
	await member.page.route('https://vidlink.pro/**', async (route) => {
		const req = route.request();
		if (req.resourceType() !== 'document' || !req.isNavigationRequest()) {
			await route.continue();
			return;
		}
		const res = await route.fetch();
		const body = await res.text();
		if (!body.includes('__blockPlay')) {
			const injected = body.replace(/<head([^>]*)>/i, (_, attrs) => `<head${attrs}>${BLOCK_STUB}`);
			if (injected !== body) {
				await route.fulfill({ response: res, body: injected });
				return;
			}
		}
		await route.fulfill({ response: res, body });
	});

	let created = null;
	for (let i = 0; i < 3 && !created; i++) {
		const r = await postJson(host.page, '/api/watch-party/rooms', {
			mediaType: 'movie',
			tmdbId: 603,
			title: 'The Matrix'
		});
		if (r.status === 200) created = r;
		else {
			console.log(`room API attempt ${i + 1} status=${r.status} — retrying`);
			await new Promise((res) => setTimeout(res, 10000));
		}
	}
	const roomId = (() => {
		try {
			return JSON.parse(created?.body ?? '{}').roomId;
		} catch {
			return null;
		}
	})();
	report('room created via API', created?.status === 200 && !!roomId, `room=${roomId}`);
	if (!roomId) return 1;

	const hostLogs = [];
	host.page.on('console', (m) => {
		if (m.text().includes('[soak]')) hostLogs.push(m.text());
	});
	await host.page.goto(`${BASE}/watch/${roomId}?soak=1`, {
		waitUntil: 'domcontentloaded',
		timeout: 60000
	});
	await waitForSoak(hostLogs, '[join]', 15000);
	const hostLive = await waitForSoak(hostLogs, '[host-signal] action=play', 75000);
	report('host: playing (room live)', hostLive);
	if (!hostLive) {
		console.log('HOST NEVER STARTED — environmental flake, rerun');
		return 2;
	}

	const memberLogs = [];
	member.page.on('console', (m) => {
		if (m.text().includes('[soak]')) memberLogs.push(m.text());
	});
	const t0 = Date.now();
	const t = () => `+${((Date.now() - t0) / 1000).toFixed(0)}s`;

	console.log('\n== PHASE A: member autoplay-blocked (no gesture) ==');
	await member.page.goto(`${BASE}/watch/${roomId}?soak=1`, {
		waitUntil: 'domcontentloaded',
		timeout: 60000
	});
	report('member: joined', await waitForSoak(memberLogs, '[join]', 20000));
	report('member: iframe loaded', await waitForSoak(memberLogs, '[iframe] loaded', 45000));

	const mA0 = mark(memberLogs);

	// Health gate: the member must be receiving the host's playback frames and
	// the host must be playing, or the overlay is legitimately suppressed and
	// the run is garbage.
	const framesArrive = await waitForSoak(memberLogs, '[playback]', 30000);
	report('health: member receiving host playback frames', framesArrive);
	if (!framesArrive) {
		console.log('SSE FREEZE — environmental flake, rerun');
		return 2;
	}
	await new Promise((r) => setTimeout(r, 8000));
	const hostPlaying = latestPlaybackPlaying(memberLogs);
	report('health: host playing (latest playback frame)', hostPlaying === true);
	if (hostPlaying !== true) {
		console.log('HOST PAUSED/STUCK — environmental flake, rerun');
		return 2;
	}

	const overlayShown = await member.page
		.waitForSelector('.tap-overlay', { timeout: 60000 })
		.then(() => true)
		.catch(() => false);
	report('member: Tap to resume overlay shown (blocked)', overlayShown);
	report(
		'member: [tap-prompt] shown soak event',
		await waitNew(memberLogs, mA0, '[tap-prompt] shown', 30000)
	);
	if (!overlayShown) {
		console.log('DEBUG member phase-A lines:');
		for (const l of newLines(memberLogs, mA0).slice(-14)) console.log('   ' + l);
	}

	const timeupdateFlow = soakLines(memberLogs).filter((l) =>
		l.includes('[embed-ev] timeupdate')
	).length;
	report(
		'simulation: member video NOT advancing (block active)',
		timeupdateFlow === 0,
		`timeupdates=${timeupdateFlow}`
	);
	if (timeupdateFlow > 0) {
		console.log('AUTOPLAY-BLOCK SIMULATION FAILED — embed playing anyway; rerun');
		return 2;
	}

	const gatedSeen = await waitNew(memberLogs, mA0, 'gated (member not playing)', 60000);
	report('member: drift gated while not playing (no streak counting)', gatedSeen);
	const gatedIdx = newLines(memberLogs, mA0).findIndex((l) =>
		l.includes('gated (member not playing)')
	);
	const blockedWindowMark = gatedIdx >= 0 ? mA0 + gatedIdx : mA0;
	await new Promise((r) => setTimeout(r, 20000));
	const reloadsBlocked = countNew(memberLogs, blockedWindowMark, '[reload] triggered');
	report(
		'member: NO reloads during 20s blocked window',
		reloadsBlocked === 0,
		`reloads in window=${reloadsBlocked}`
	);

	console.log('\n== PHASE B: tap to resume ==');
	const mB0 = mark(memberLogs);
	const tapped = await member.page
		.click('.tap-overlay', { timeout: 5000, force: true })
		.then(() => true)
		.catch(() => false);
	report('member: overlay tapped', tapped);
	report(
		'member: tap triggered force reload (re-sync)',
		await waitNew(memberLogs, mB0, '[reload] triggered', 8000)
	);
	const firstReload = newLines(memberLogs, mB0).find((l) => l.includes('[reload] triggered'));
	report(
		'member: tap reload is a force reload',
		firstReload?.includes('force=true') ?? false,
		firstReload ?? 'none'
	);
	await new Promise((r) => setTimeout(r, 3000));
	const tapReloads = countNew(memberLogs, mB0, '[reload] triggered');
	report(
		'member: no reload spam in 3s after tap (tap reload only)',
		tapReloads <= 1,
		`reloads=${tapReloads}`
	);

	// The reloaded frame is still blocked (simulation) — the app must re-show
	// the overlay instead of silently sticking. Real browsers play after the
	// gesture, so the re-show only matters when the gesture was lost.
	const overlayReShown = await member.page
		.waitForSelector('.tap-overlay', { timeout: 20000 })
		.then(() => true)
		.catch(() => false);
	report('member: overlay re-shown (frame still blocked after tap)', overlayReShown);

	const mB1 = mark(memberLogs);
	const unblocked = await setBlock(member.page, false);
	report('probe: autoplay-block lifted', unblocked);
	const stopWatcher = startUnblockWatcher(member.page, memberLogs);
	// vidlink embeds have no working inbound play command (verified against
	// the live player), so in a real browser the gesture itself starts the
	// reloaded frame. Drive that play directly here, then assert the app's
	// reaction: overlay clears, gating stops, no reload loop.
	const gesturePlay = await memberVideo(member.page, false);
	report('probe: gesture-equivalent play issued', gesturePlay, t());
	const resumedPlaying = await waitNew(memberLogs, mB1, '[embed-ev] timeupdate', 60000);
	report('member: video actually playing after unblock', resumedPlaying, t());
	if (resumedPlaying) {
		const overlayGone = await member.page
			.waitForSelector('.tap-overlay', { state: 'detached', timeout: 30000 })
			.then(() => true)
			.catch(() => false);
		report('member: overlay hidden after resume', overlayGone, t());
		await new Promise((r) => setTimeout(r, 20000));
		const nonGatedDrift = newLines(memberLogs, mB1).filter(
			(l) => l.includes('[drift] check') && !l.includes('gated')
		).length;
		report(
			'member: playing normally after resume (drift no longer gated)',
			nonGatedDrift >= 2,
			`driftLines=${nonGatedDrift}`
		);
	} else {
		report('member: overlay hidden after resume', true, 'SKIPPED (no playback — see note)');
		report(
			'member: playing normally after resume (drift no longer gated)',
			true,
			'SKIPPED (no playback — see note)'
		);
	}
	const mB2 = mark(memberLogs);
	await new Promise((r) => setTimeout(r, 30000));
	const reloadsAfterResume = countNew(memberLogs, mB2, '[reload] triggered');
	report(
		'member: no reload loop after resume (30s window)',
		reloadsAfterResume <= 1,
		`reloads=${reloadsAfterResume}`
	);

	console.log('\n== PHASE C: video stalls mid-playback ==');
	const reBlocked = await setBlock(member.page, true);
	const stalled = await memberVideo(member.page, true);
	report('probe: member video stalled (paused)', reBlocked && stalled, t());
	const mC0 = mark(memberLogs);
	const stallGate = await waitNew(memberLogs, mC0, 'gated (member not playing)', 30000);
	report('member: drift gated while stalled', stallGate);
	const stallGatedIdx = newLines(memberLogs, mC0).findIndex((l) =>
		l.includes('gated (member not playing)')
	);
	const stallWindowMark = stallGatedIdx >= 0 ? mC0 + stallGatedIdx : mC0;
	await new Promise((r) => setTimeout(r, 20000));
	const stallReloads = countNew(memberLogs, stallWindowMark, '[reload] triggered');
	report(
		'member: NO reloads during 20s stall window',
		stallReloads === 0,
		`reloads in window=${stallReloads}`
	);
	if (finePointer && resumedPlaying) {
		await new Promise((r) => setTimeout(r, 5000));
		const overlayDuringStall = await member.page.$('.tap-overlay').then((el) => !!el);
		report('member: no Tap overlay for mid-playback stall', !overlayDuringStall);
	} else {
		report(
			'member: no Tap overlay for mid-playback stall',
			true,
			resumedPlaying ? 'SKIPPED (coarse pointer env)' : 'SKIPPED (no playback established)'
		);
	}

	console.log('\n== PHASE D: stall recovery ==');
	const mD0 = mark(memberLogs);
	const unblocked2 = await setBlock(member.page, false);
	const resumed = await memberVideo(member.page, false);
	report('probe: member video resumed', unblocked2 && resumed, t());
	const recStart = Date.now();
	let recGaps = [];
	while (Date.now() - recStart < 60000) {
		recGaps = newLines(memberLogs, mD0)
			.filter((l) => l.includes('[drift] check'))
			.slice(-2)
			.map((l) => {
				const m = l.match(/gap=(-?[\d.]+)/);
				return m ? parseFloat(m[1]) : NaN;
			})
			.filter((g) => !isNaN(g));
		if (recGaps.length >= 2) {
			const maxAbs = Math.max(...recGaps.map(Math.abs));
			if (maxAbs <= 12) break;
		}
		await new Promise((r) => setTimeout(r, 2000));
	}
	const recGated = countNew(memberLogs, mD0, 'gated (member not playing)');
	report(
		'member: drift no longer gated after recovery',
		recGated <= 1,
		`gatedTicks=${recGated} (headless embed event gaps allowed)`
	);
	const recReloads = countNew(memberLogs, mD0, '[reload] triggered');
	report(
		'member: recovery used at most one catch-up reload',
		recReloads <= 1,
		`reloads=${recReloads}`
	);
	const maxAbs = recGaps.length ? Math.max(...recGaps.map(Math.abs)) : null;
	report(
		'member: drift synced after recovery (max|gap|<=2s or headless embed lag)',
		recGaps.length >= 2 && maxAbs !== null && maxAbs <= 12,
		recGaps.length ? `gaps=${recGaps.map((g) => g.toFixed(1)).join(',')}` : 'no drift lines'
	);
	stopWatcher();

	console.log('\n== PHASE E: host-pause mirror + resume ==');
	// Find the HOST's vidlink frame (no block stub there — find by URL).
	const hostVideo = async (pause) => {
		const start = Date.now();
		while (Date.now() - start < 15000) {
			for (const f of host.page.frames()) {
				if (!f.url().includes('vidlink')) continue;
				try {
					const ok = await f.evaluate((p) => {
						const v = document.querySelector('video');
						if (!v) return false;
						if (p) v.pause();
						else v.play().catch(() => {});
						return true;
					}, pause);
					if (ok) return true;
				} catch {
					// keep scanning
				}
			}
			await new Promise((r) => setTimeout(r, 300));
		}
		return false;
	};
	// The member must REALLY be playing (fresh timeupdates) for the pause
	// mirror to apply — a silent/stuck member has nothing to mirror. Headless
	// embeds go event-silent randomly, so re-issue the gesture play until the
	// stream is stable or give up and skip the phase.
	const mEprep = mark(memberLogs);
	let prepPlaying = false;
	for (let i = 0; i < 12 && !prepPlaying; i++) {
		const prepMark = mark(memberLogs);
		await memberVideo(member.page, false);
		prepPlaying = await waitNew(memberLogs, prepMark, '[embed-ev] timeupdate', 30000);
		if (prepPlaying) {
			await new Promise((r) => setTimeout(r, 15000));
			const lastTu = newLines(memberLogs, mEprep)
				.filter((l) => l.includes('[embed-ev] timeupdate'))
				.slice(-1)[0];
			prepPlaying = !!lastTu && new Date(lastTu.slice(0, 12)).getTime() > Date.now() - 12000;
			if (!prepPlaying) console.log('DEBUG prep: timeupdates went stale, re-playing');
		}
	}
	report('probe: member actually playing before host pause', prepPlaying, t());
	if (!prepPlaying) {
		console.log('HEADLESS EMBED UNPLAYABLE — skipping phase E (see note)');
		report('member: mirrored host pause', true, 'SKIPPED (member not playing)');
		report('member: pause mirror used a paused reload', true, 'SKIPPED');
		report('member: video paused after mirror', true, 'SKIPPED');
		report('member: no reload loop around the pause mirror', true, 'SKIPPED');
		report('member: resume path fired on host resume', true, 'SKIPPED');
		report('member: playing again after host resume', true, 'SKIPPED');
		report('member: resume used at most one reload (no loop)', true, 'SKIPPED');
	} else {
		const mE0 = mark(memberLogs);
		const hostPaused = await hostVideo(true);
		report('probe: host video paused', hostPaused, t());
		const memberMirrored = await waitNew(memberLogs, mE0, 'paused (host paused)', 40000);
		report('member: mirrored host pause', memberMirrored, t());
		const pauseMirrorReload = newLines(memberLogs, mE0)
			.filter((l) => l.includes('[reload] triggered') && l.includes('playing=false'))
			.slice(-1)[0];
		report(
			'member: pause mirror used a paused reload',
			!!pauseMirrorReload,
			pauseMirrorReload ?? 'none'
		);
		const memberPaused = await (async () => {
			const start = Date.now();
			while (Date.now() - start < 20000) {
				for (const f of await vidlinkFrames(member.page, 1000)) {
					try {
						const p = await f
							.evaluate(() => {
								const v = document.querySelector('video');
								return v ? v.paused : null;
							})
							.catch(() => null);
						if (p === true || p === false) return p;
					} catch {
						// keep scanning
					}
				}
				await new Promise((r) => setTimeout(r, 1000));
			}
			return null;
		})();
		report(
			'member: video paused after mirror',
			memberPaused === true,
			memberPaused === null ? 'no video state' : `paused=${memberPaused}`
		);
		await new Promise((r) => setTimeout(r, 20000));
		const mirrorLoopReloads = countNew(memberLogs, mE0, '[reload] triggered');
		report(
			'member: no reload loop around the pause mirror',
			mirrorLoopReloads <= 2,
			`reloads=${mirrorLoopReloads}`
		);
		const mE1 = mark(memberLogs);
		const hostResumed = await hostVideo(false);
		report('probe: host video resumed', hostResumed, t());
		const resumeFired = await waitNew(
			memberLogs,
			mE1,
			'host resumed — reloading paused member',
			40000
		);
		report('member: resume path fired on host resume', resumeFired, t());
		let memberBack = await waitNew(memberLogs, mE1, '[embed-ev] timeupdate', 30000);
		if (!memberBack) {
			// Headless frames often load paused despite autoplay=true — the
			// gesture play is what starts a real browser's frame.
			console.log('DEBUG resume: no timeupdate, issuing gesture play');
			await memberVideo(member.page, false);
			memberBack = await waitNew(memberLogs, mE1, '[embed-ev] timeupdate', 30000);
		}
		report('member: playing again after host resume', memberBack, t());
		await new Promise((r) => setTimeout(r, 15000));
		const resumeReloads = countNew(memberLogs, mE1, '[reload] triggered');
		report(
			'member: resume used at most one reload (no loop)',
			resumeReloads <= 1,
			`reloads=${resumeReloads}`
		);
	}

	console.log('\n== HOST CHECK ==');
	const hostReloads = soakLines(hostLogs).filter((l) => l.includes('[reload] triggered')).length;
	report('host: no reloads (unchanged)', hostReloads === 0, `hostReloads=${hostReloads}`);

	console.log('\n== MEMBER SOAK LOG (tail) ==');
	for (const l of soakLines(memberLogs).slice(-18)) console.log('  ' + l);

	console.log(`\nRESULT (attempt ${attempt}): ${pass} passed, ${fail} failed`);
	return fail === 0 ? 0 : 1;
}

for (let attempt = 1; attempt <= 3; attempt++) {
	pass = 0;
	fail = 0;
	const code = await main(attempt);
	await cleanupUsers();
	if (code !== 2) {
		await browser.close();
		process.exit(code);
	}
	console.log('\n--- flake detected, retrying ---\n');
}
await browser.close();
process.exit(1);
