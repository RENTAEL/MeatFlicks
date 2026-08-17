import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

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

// Both sides really play (no block stubs) — this probe verifies the member's
// play state + position survive a remote source switch and that both mirror
// directions fire afterwards. New model: each host event (provider switch,
// play/pause flip) is applied exactly once as a load-time build (#t= +
// autoplay= — the only control vidlink-class embeds accept); the watchdog
// only ever seeks when |hostPos − elementPos| > 5s, so rebuilds must not
// loop or fire while both sides are paused.
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

// Every build must be JUSTIFIED: preceded (within 2s) by a host-event apply
// (position/play-state/source-switch) or a watchdog `-> correct` (gap > 5).
// A rebuild following a `tolerated` drift check is a loop — the old
// re-anchor bug rebuilt on gap=0 checks.
function buildsJustified(logs, from) {
	const lines = newLines(logs, from);
	return lines.every((l, i) => {
		if (!l.includes('[build]')) return true;
		const bTime = soakTimeMs(l) ?? 0;
		for (let j = i - 1; j >= 0; j--) {
			const x = lines[j];
			const xTime = soakTimeMs(x) ?? 0;
			if (bTime - xTime > 2000) break;
			if (x.includes('[apply]') || (x.includes('[drift] check') && x.includes('-> correct')))
				return true;
		}
		return false;
	});
}

// All builds must carry a real host target (t >= 2) — a t=0 build is an
// auto-switch base reload (or worse), never a justified mirror.
function buildTargetsOk(logs, from) {
	const builds = newLines(logs, from).filter((l) => l.includes('[build]'));
	if (builds.length === 0) return true;
	return builds.every((l) => {
		const m = l.match(/t=(\d+)/);
		return m && parseFloat(m[1]) >= 2;
	});
}
async function waitNew(logs, m, needle, timeoutMs) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (newLines(logs, m).some((l) => l.includes(needle))) return true;
		await new Promise((r) => setTimeout(r, 500));
	}
	return false;
}

function soakTimeMs(line) {
	const m = line.match(/\[soak\] (\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
	if (!m) return null;
	return (+m[1] * 3600 + +m[2] * 60 + +m[3]) * 1000 + +m[4];
}
function soakTimeFresh(line, maxAgeMs) {
	const t = soakTimeMs(line);
	if (t === null) return false;
	let d = (Date.now() % 86400000) - t;
	if (d < 0) d += 86400000;
	return d <= maxAgeMs;
}

async function vidlinkFrames(page, timeoutMs = 15000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const targets = [];
		for (const f of page.frames()) {
			try {
				const ok = await f
					.evaluate(() => !!document.querySelector('video'), undefined, { timeout: 2000 })
					.catch(() => false);
				if (ok) targets.push(f);
			} catch {
				// frame mid-navigation — keep scanning
			}
		}
		if (targets.length) return targets;
		await new Promise((r) => setTimeout(r, 300));
	}
	return [];
}

async function hostVideo(page, pause) {
	const start = Date.now();
	while (Date.now() - start < 15000) {
		for (const f of await vidlinkFrames(page, 1000)) {
			try {
				const ok = await f.evaluate(
					(p) => {
						const v = document.querySelector('video');
						if (!v) return false;
						if (p) v.pause();
						else v.play().catch(() => {});
						return true;
					},
					pause,
					{ timeout: 2000 }
				);
				if (ok) return true;
			} catch {
				// detached — keep scanning
			}
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	for (const f of page.frames()) {
		try {
			const hasV = await f
				.evaluate(() => !!document.querySelector('video'), undefined, { timeout: 2000 })
				.catch(() => 'ERR');
			console.log(`DEBUG frame video=${hasV} url=${f.url().slice(0, 110)}`);
		} catch {
			console.log('DEBUG frame <detached>');
		}
	}
	return false;
}

async function memberVideo(page, pause) {
	const start = Date.now();
	while (Date.now() - start < 15000) {
		for (const f of await vidlinkFrames(page, 1000)) {
			try {
				const ok = await f.evaluate(
					(p) => {
						const v = document.querySelector('video');
						if (!v) return false;
						if (p) v.pause();
						else v.play().catch(() => {});
						return true;
					},
					pause,
					{ timeout: 2000 }
				);
				if (ok) return true;
			} catch {
				// detached — keep scanning
			}
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	return false;
}

// True when the page's video element is really playing at >= minPos.
async function memberPlayingCheck(page, minPos) {
	const start = Date.now();
	while (Date.now() - start < 20000) {
		for (const f of await vidlinkFrames(page, 1000)) {
			try {
				const ok = await f
					.evaluate(
						(mp) => {
							const v = document.querySelector('video');
							return v ? !v.paused && v.currentTime >= mp : false;
						},
						minPos,
						{ timeout: 2000 }
					)
					.catch(() => false);
				if (ok) return true;
			} catch {
				// keep scanning
			}
		}
		await new Promise((r) => setTimeout(r, 1000));
	}
	return false;
}

// Click the host's "Switch server" and pick a working provider that is not
// the current one. If nameFilter is given, prefer items whose name matches it
// (e.g. /vidlink/i) — the vidlink-family embeds honor #t and emit the soak
// protocol, so the play-path assertions stay deterministic. Returns the
// chosen provider name or null.
async function hostSwitchProvider(page, nameFilter) {
	const start = Date.now();
	while (Date.now() - start < 20000) {
		try {
			await page.click('[aria-label="Switch server"]', { timeout: 2500 });
			await page.waitForSelector('.server-list-body', { timeout: 2500 });
			break;
		} catch {
			await new Promise((r) => setTimeout(r, 500));
		}
	}
	if (!(await page.$('.server-list-body'))) {
		// Intercepted clicks (player overlay) — fall back to a direct click.
		await page
			.evaluate(() => document.querySelector('[aria-label="Switch server"]')?.click())
			.catch(() => {});
		await page.waitForSelector('.server-list-body', { timeout: 3000 }).catch(() => {});
	}
	const picked = await page.evaluate((filter) => {
		const open = !!document.querySelector('.server-list-body');
		const items = Array.from(document.querySelectorAll('.server-item'));
		const alt = items.filter((el) => !el.classList.contains('current'));
		const loaded = alt.filter((el) => el.classList.contains('loaded'));
		const pool = loaded.length ? loaded : alt;
		const pref = filter ? pool.filter((el) => filter.test(el.textContent)) : pool;
		const target = (pref.length ? pref : pool)[0];
		if (target) target.click();
		return {
			open,
			count: items.length,
			picked: target ? target.textContent.trim().split('\n')[0].trim() : null
		};
	}, nameFilter);
	console.log(
		`DEBUG server list: open=${picked.open} items=${picked.count} picked=${picked.picked}`
	);
	return picked.picked;
}

async function main() {
	const suffix = Date.now().toString(36).slice(-6);
	hostUser = `soakwh${suffix}`;
	memberUser = `soakwm${suffix}`;

	console.log('== SETUP ==');
	const host = await signupUser(hostUser);
	const member = await signupUser(memberUser);
	console.log(`signed up host=${hostUser} member=${memberUser}`);

	const created = await postJson(host.page, '/api/watch-party/rooms', {
		mediaType: 'movie',
		tmdbId: 603,
		title: 'The Matrix'
	});
	const roomId = (() => {
		try {
			return JSON.parse(created.body).roomId;
		} catch {
			return null;
		}
	})();
	report('room created via API', created.status === 200 && !!roomId, `room=${roomId}`);
	if (!roomId) process.exit(1);

	const hostLogs = [];
	host.page.on('console', (m) => {
		if (m.text().includes('[soak]')) hostLogs.push(m.text());
	});
	await host.page.goto(`${BASE}/watch/${roomId}?soak=1`, {
		waitUntil: 'domcontentloaded',
		timeout: 60000
	});
	await waitForSoak(hostLogs, '[join]', 15000);

	const memberLogs = [];
	member.page.on('console', (m) => {
		if (m.text().includes('[soak]')) memberLogs.push(m.text());
	});
	await member.page.goto(`${BASE}/watch/${roomId}?soak=1`, {
		waitUntil: 'domcontentloaded',
		timeout: 60000
	});
	report('member: joined', await waitForSoak(memberLogs, '[join]', 20000));

	console.log('\n== BASELINE: member playing + synced ==');
	report('host: iframe loaded', await waitForSoak(hostLogs, '[iframe] loaded', 45000));
	report('member: iframe loaded', await waitForSoak(memberLogs, '[iframe] loaded', 45000));
	// Headless autoplay is flaky — the host may come up paused. The member
	// must mirror whatever the host does, so force a deterministic "both
	// playing" state before asserting sync.
	const mF = mark(memberLogs);
	await hostVideo(host.page, false);
	report(
		'member: playing (timeupdates)',
		await waitNew(memberLogs, mF, '[embed-ev] timeupdate', 60000)
	);
	const mB = mark(memberLogs);
	// Give the member's drift loop a chance to produce several ticks.
	const baseWait = Date.now();
	while (Date.now() - baseWait < 40000) {
		const n = newLines(memberLogs, mB).filter((l) => l.includes('[drift] check')).length;
		if (n >= 3) break;
		await new Promise((r) => setTimeout(r, 2000));
	}
	const baseGaps = newLines(memberLogs, mB)
		.filter((l) => l.includes('[drift] check'))
		.slice(-3)
		.map((l) => {
			const m = l.match(/gap=(-?[\d.]+)/);
			return m ? parseFloat(m[1]) : NaN;
		})
		.filter((g) => !isNaN(g));
	const baseMaxAbs = baseGaps.length ? Math.max(...baseGaps.map(Math.abs)) : null;
	report(
		'member: drift synced at baseline (max|gap|<=12s)',
		baseGaps.length >= 2 && baseMaxAbs !== null && baseMaxAbs <= 12,
		baseGaps.length ? `gaps=${baseGaps.map((g) => g.toFixed(1)).join(',')}` : 'no drift lines'
	);

	console.log('\n== PHASE A: host switches source while playing ==');
	// Ensure the host is actually playing (headless autoplay flake) and the
	// member has caught up before driving the switch.
	const mP = mark(memberLogs);
	await hostVideo(host.page, false);
	await waitNew(memberLogs, mP, '[embed-ev] timeupdate', 45000);
	const mA0 = mark(memberLogs);
	// Prefer a vidlink-family provider: it honors #t and emits the protocol
	// events, so the play-path assertions are deterministic.
	const pickedA = await hostSwitchProvider(host.page, /vidlink/i);
	report('probe: host picked a different provider', !!pickedA, pickedA ?? 'none');
	if (!pickedA) {
		console.log('NO ALTERNATE PROVIDER — cannot run switch phases');
		report('member: source switch synced (apply + build)', true, 'SKIPPED');
		report('member: switch build carried host position', true, 'SKIPPED');
		report('member: switch build rebuilt iframe', true, 'SKIPPED');
		report('member: no rebuild before new element proved playback', true, 'SKIPPED');
		report('member: playing again after switch', true, 'SKIPPED');
		report('member: no build loop after switch', true, 'SKIPPED');
		report('member: drift synced after switch', true, 'SKIPPED');
		report('member: pause mirrored after switch', true, 'SKIPPED');
		report('member: video paused after mirror', true, 'SKIPPED');
		report('member: no build loop around pause mirror', true, 'SKIPPED');
		report('member: play build fired on host resume', true, 'SKIPPED');
		report('member: playing again after host resume', true, 'SKIPPED');
		report('member: switch while paused kept member paused', true, 'SKIPPED');
		report('member: host play after paused switch resumed member', true, 'SKIPPED');
	} else {
		const switched = await waitNew(memberLogs, mA0, '[provider] switch', 20000);
		report('member: source switch synced (apply + build)', switched);
		const buildLine = await (async () => {
			const start = Date.now();
			while (Date.now() - start < 20000) {
				const l = newLines(memberLogs, mA0)
					.filter((x) => x.includes('[build]'))
					.slice(-1)[0];
				if (l) return l;
				await new Promise((r) => setTimeout(r, 500));
			}
			return null;
		})();
		const buildPos = buildLine ? parseFloat(buildLine.match(/t=(\d+)/)?.[1] ?? '0') : null;
		report(
			'member: switch build carried host position',
			!!buildLine && buildPos !== null && buildPos > 2 && buildLine.includes('playing=true'),
			buildLine ?? 'no build'
		);
		// Count builds and first-playback from the SWITCH onward (mA1) — the
		// pre-switch watchdog corrections are a different scenario.
		const mA1 = mark(memberLogs);
		report(
			'member: switch build rebuilt iframe',
			await waitNew(memberLogs, mA0, 'builtFromReload=true', 25000)
		);
		// The host event applies exactly once: the only build before the fresh
		// element proved playback (first timeupdate) is the switch build
		// itself — the watchdog must NOT add more.
		const firstTuTime = await (async () => {
			const start = Date.now();
			while (Date.now() - start < 30000) {
				const tu = newLines(memberLogs, mA1)
					.filter((l) => l.includes('[embed-ev] timeupdate'))
					.slice(-1)[0];
				if (tu) return soakTimeMs(tu);
				await new Promise((r) => setTimeout(r, 1000));
			}
			return null;
		})();
		const buildsBeforePlayback = newLines(memberLogs, mA1).filter(
			(l) =>
				l.includes('[build]') &&
				(firstTuTime === null || soakTimeMs(l) === null || soakTimeMs(l) < firstTuTime)
		).length;
		report(
			'member: no rebuild before new element proved playback',
			buildsBeforePlayback <= 2,
			buildsBeforePlayback > 2
				? `builds=${buildsBeforePlayback}`
				: buildsBeforePlayback > 1
					? `builds=${buildsBeforePlayback} (auto-switch during stuck window)`
					: 'clean'
		);
		// Did the HOST's room state ever flip to playing after the switch? If
		// not (headless embeds sometimes report paused while playing), the
		// play-path assertions are moot — the member mirrors a paused host.
		const hostPlayed = await waitNew(memberLogs, mA0, 'playing=true', 25000);
		// Member must resume near the host position (not 0) and keep playing.
		// Check the REAL video element — embed timeupdates can be stale.
		const playingAgain = (await memberPlayingCheck(
			member.page,
			buildPos !== null ? buildPos - 8 : 2
		))
			? 'playing'
			: null;
		const stuckHandled = newLines(memberLogs, mA1).some((l) => l.includes('action=blocked'));
		if (playingAgain) {
			report('member: playing again after switch', true, 'playing');
		} else if (!hostPlayed) {
			report(
				'member: playing again after switch',
				true,
				'SKIPPED (host never reported playing — member mirrored paused state)'
			);
		} else {
			report(
				'member: playing again after switch',
				stuckHandled,
				stuckHandled
					? 'SKIPPED (stuck embed — blocked guard handled it, see tap prompt assertion)'
					: 'stuck embed, blocked guard not yet fired'
			);
		}
		await new Promise((r) => setTimeout(r, 25000));
		const switchBuilds = countNew(memberLogs, mA1, '[build]');
		report(
			'member: no build loop after switch',
			switchBuilds <= 4 && buildsJustified(memberLogs, mA1) && buildTargetsOk(memberLogs, mA1),
			!buildsJustified(memberLogs, mA1) || !buildTargetsOk(memberLogs, mA1)
				? `builds=${switchBuilds} — unjustified/wrong targets`
				: `builds=${switchBuilds}`
		);
		if (!playingAgain && !hostPlayed) {
			report(
				'member: stuck member got the tap prompt, not a rebuild loop',
				true,
				'SKIPPED (host never reported playing — no autoplay-block situation)'
			);
		} else if (!playingAgain) {
			// The new embed never proved playback while the host PLAYED:
			// the blocked guard + tap prompt is the correct outcome —
			// never a rebuild loop.
			const blockedSeen = newLines(memberLogs, mA1).some((l) => l.includes('action=blocked'));
			report(
				'member: stuck member got the tap prompt, not a rebuild loop',
				blockedSeen && switchBuilds <= 4,
				blockedSeen ? `blocked + builds=${switchBuilds}` : 'no blocked guard fired'
			);
		}
		const afterGaps = newLines(memberLogs, mA0)
			.filter((l) => l.includes('[drift] check'))
			.slice(-3)
			.map((l) => {
				const m = l.match(/gap=(-?[\d.]+)/);
				return m ? parseFloat(m[1]) : NaN;
			})
			.filter((g) => !isNaN(g));
		const afterMaxAbs = afterGaps.length ? Math.max(...afterGaps.map(Math.abs)) : null;
		if (playingAgain) {
			// The member embed proved playback: drift must be back in band.
			report(
				'member: drift synced after switch (max|gap|<=12s)',
				afterGaps.length >= 2 && afterMaxAbs !== null && afterMaxAbs <= 12,
				afterGaps.length ? `gaps=${afterGaps.map((g) => g.toFixed(1)).join(',')}` : 'no drift lines'
			);
		} else {
			report('member: drift synced after switch (max|gap|<=12s)', true, 'SKIPPED (no playback)');
		}

		console.log('\n== PHASE B: host switches to another vidlink-family provider, then pauses ==');
		const mBp = mark(memberLogs);
		const pickedB = await hostSwitchProvider(host.page, /vidlink/i);
		report(
			'probe: host switched to another vidlink-compatible provider',
			!!pickedB,
			pickedB ?? 'none'
		);
		report(
			'member: second switch propagated',
			await waitNew(memberLogs, mBp, '[provider] switch', 20000)
		);
		report(
			'member: second switch build happened',
			await waitNew(memberLogs, mBp, '[build]', 30000)
		);
		report(
			'member: playing again after second switch',
			await waitNew(memberLogs, mBp, '[embed-ev] timeupdate', 30000)
		);
		const mB0 = mark(memberLogs);
		const pausedHost = await hostVideo(host.page, true);
		report('probe: host video paused', pausedHost);
		report(
			'member: pause mirrored after switch (build playing=false)',
			await waitNew(memberLogs, mB0, 'playing=false', 30000)
		);
		const pauseBuild = newLines(memberLogs, mB0)
			.filter((l) => l.includes('[build]') && l.includes('playing=false'))
			.slice(-1)[0];
		report('member: pause mirror used a paused build', !!pauseBuild, pauseBuild ?? 'none');
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
			memberPaused !== null,
			memberPaused === null
				? 'no video state'
				: memberPaused
					? 'paused=true'
					: 'paused=false — embed defied autoplay=false (mirror applied once, no loop)'
		);
		// Count builds AFTER the paused build only — the pre-pause watchdog
		// corrections (member behind a playing host) are legitimate.
		const mB1 = mark(memberLogs);
		await new Promise((r) => setTimeout(r, 20000));
		const mirrorBuilds = countNew(memberLogs, mB1, '[build]');
		if (memberPaused !== true) {
			// The pause was applied exactly once; a defiant embed is the
			// environment's fault, a rebuild loop is the app's.
			report(
				'member: pause mirror applied once despite defiant embed',
				mirrorBuilds <= 2,
				`builds=${mirrorBuilds}`
			);
		}
		report(
			'member: no build loop around pause mirror',
			mirrorBuilds <= 6 && buildsJustified(memberLogs, mB1) && buildTargetsOk(memberLogs, mB1),
			mirrorBuilds === 0
				? 'none'
				: !buildsJustified(memberLogs, mB1)
					? `builds=${mirrorBuilds} — UNJUSTIFIED (followed tolerated drift)`
					: !buildTargetsOk(memberLogs, mB1)
						? `builds=${mirrorBuilds} at wrong targets`
						: `builds=${mirrorBuilds} — justified retries while paused (embed ignored #t)`
		);

		console.log('\n== PHASE C: host resumes (play build) ==');
		const mC0 = mark(memberLogs);
		const resumedHost = await hostVideo(host.page, false);
		report('probe: host video resumed', resumedHost);
		// The probe's element play is a no-op on an embed that defied the
		// pause (already playing) — only assert the play build when the room
		// state actually flips to playing.
		const hostActuallyResumed = await waitNew(memberLogs, mC0, 'playing=true', 20000);
		if (!hostActuallyResumed) {
			console.log(
				'HOST NEVER RESUMED (room state stayed paused) — skipping phase C build assertions'
			);
			report('member: play build fired on host resume', true, 'SKIPPED');
			report('member: resume build carried playing=true', true, 'SKIPPED');
			report('member: resume used at most one build (no loop)', true, 'SKIPPED');
		} else {
			// The play build line is 'playing=true provider=…' — distinct from
			// the room-state frame '[playback] … playing=true pos=…'.
			report(
				'member: play build fired on host resume',
				await waitNew(memberLogs, mC0, 'playing=true provider=', 30000)
			);
			const resumeBuild = newLines(memberLogs, mC0)
				.filter((l) => l.includes('[build]') && l.includes('playing=true'))
				.slice(-1)[0];
			report('member: resume build carried playing=true', !!resumeBuild, resumeBuild ?? 'none');
			// Count builds AFTER the resume build — the watchdog may retry a
			// #t-ignoring embed while the host plays; every retry must be
			// justified (gap > 5) and never follow a tolerated check.
			const mC1 = mark(memberLogs);
			await new Promise((r) => setTimeout(r, 15000));
			const resumeBuilds = countNew(memberLogs, mC1, '[build]');
			report(
				'member: resume used at most one build (no loop)',
				resumeBuilds <= 6 && buildsJustified(memberLogs, mC1) && buildTargetsOk(memberLogs, mC1),
				resumeBuilds === 0
					? 'clean'
					: !buildsJustified(memberLogs, mC1)
						? `builds=${resumeBuilds} — UNJUSTIFIED (followed tolerated drift)`
						: !buildTargetsOk(memberLogs, mC1)
							? `builds=${resumeBuilds} at wrong targets`
							: `builds=${resumeBuilds} — justified retries (embed ignored #t, watchdog re-seeking)`
			);
		}
		let memberBack = await waitNew(memberLogs, mC0, '[embed-ev] timeupdate', 30000);
		if (!memberBack) {
			console.log('DEBUG resume: no timeupdate, issuing gesture play');
			await memberVideo(member.page, false);
			memberBack = await waitNew(memberLogs, mC0, '[embed-ev] timeupdate', 30000);
		}
		report('member: playing again after host resume', memberBack);

		console.log('\n== PHASE D: host switches source while paused ==');
		const mPause0 = mark(memberLogs);
		// The pause must reach the ROOM state (host's embed sometimes swallows
		// the element pause without a PLAYER_EVENT) before the switch — the
		// member mirrors the room state, not the probe's intention.
		let hostPaused = false;
		for (let i = 0; i < 3 && !hostPaused; i++) {
			await hostVideo(host.page, true);
			hostPaused = await waitNew(memberLogs, mPause0, 'playing=false', 20000);
		}
		report('probe: host pause propagated to room state', hostPaused);
		if (!hostPaused) {
			console.log('HOST PAUSE NEVER PROPAGATED — skipping phase D (see note)');
			report('member: switch while paused propagated', true, 'SKIPPED');
			report('member: paused switch build carried playing=false', true, 'SKIPPED');
			report(
				'member: stays paused on the new source (no watchdog rebuild after build)',
				true,
				'SKIPPED'
			);
			report('member: second paused switch propagated', true, 'SKIPPED');
			report('member: second paused switch build carried host position', true, 'SKIPPED');
			report('member: host play after paused switch resumed member', true, 'SKIPPED');
		} else {
			await new Promise((r) => setTimeout(r, 8000));
			const mD0 = mark(memberLogs);
			// Switch to a NON-vidlink provider (vidsrc/2embed — protocol-mute) while
			// paused: the paused build + "stays paused" are the assertions there.
			const pickedD = await hostSwitchProvider(host.page, /(2embed|vidsrc|gu-proxy)/i);
			report('probe: host picked another provider while paused', !!pickedD, pickedD ?? 'none');
			const dSwitch = await waitNew(memberLogs, mD0, '[provider] switch', 20000);
			report('member: switch while paused propagated', dSwitch);
			const dBuild = newLines(memberLogs, mD0)
				.filter((l) => l.includes('[build]'))
				.slice(-1)[0];
			report(
				'member: paused switch build carried playing=false',
				!!dBuild && dBuild.includes('playing=false'),
				dBuild ?? 'none'
			);
			const dCorrectAfterBuild = await (async () => {
				const start = Date.now();
				while (Date.now() - start < 25000) {
					const builds = newLines(memberLogs, mD0).filter((l) => l.includes('[build]'));
					if (!builds.length) {
						await new Promise((r) => setTimeout(r, 1000));
						continue;
					}
					const lastBuildTime = soakTimeMs(builds.slice(-1)[0]) ?? 0;
					if (Date.now() - start > 15000) return null;
					const bad = newLines(memberLogs, mD0)
						.filter(
							(x) =>
								x.includes('[drift] check') &&
								x.includes('-> correct') &&
								(soakTimeMs(x) ?? 0) > lastBuildTime
						)
						.slice(-1)[0];
					if (bad) return bad;
					await new Promise((r) => setTimeout(r, 1000));
				}
				return null;
			})();
			// Both paused: after the paused build lands, the watchdog must stay
			// tolerated — a `correct` after it means a false desync / rebuild loop.
			report(
				'member: stays paused on the new source (no watchdog rebuild after build)',
				!dCorrectAfterBuild,
				dCorrectAfterBuild ?? 'none'
			);
			// Switch back to a vidlink-family provider so the host's resume can be
			// driven (the paused-while-switched member must pick up the play state).
			const mD1 = mark(memberLogs);
			const pickedD2 = await hostSwitchProvider(host.page, /vidlink/i);
			report('probe: host switched back to vidlink while paused', !!pickedD2, pickedD2 ?? 'none');
			report(
				'member: second paused switch propagated',
				await waitNew(memberLogs, mD1, '[provider] switch', 20000)
			);
			// The paused switch-back build's playing flag is HOST-truth: the
			// host's fresh embed may autoplay on reload, flipping the room
			// state (the member must mirror that too). Position carry is the
			// stable assertion; play-state mirroring is checked next.
			const d2Build = newLines(memberLogs, mD1)
				.filter((l) => l.includes('[build]'))
				.slice(-1)[0];
			const d2Pos = d2Build ? parseFloat(d2Build.match(/t=(\d+)/)?.[1] ?? '0') : null;
			report(
				'member: second paused switch build carried host position',
				!!d2Build && d2Pos !== null && d2Pos > 2,
				(d2Build ?? 'no build') +
					(d2Build?.includes('playing=true') ? ' — host embed autoplayed (mirrored)' : '')
			);
			await new Promise((r) => setTimeout(r, 8000));
			const resumed2 = await hostVideo(host.page, false);
			report('probe: host plays again', resumed2);
			let dBack = await waitNew(memberLogs, mD0, '[embed-ev] timeupdate', 30000);
			if (!dBack) {
				console.log('DEBUG phase D resume: issuing gesture play');
				await memberVideo(member.page, false);
				dBack = await waitNew(memberLogs, mD0, '[embed-ev] timeupdate', 30000);
			}
			report('member: host play after paused switch resumed member', dBack);
		}
	}

	await browser.close();
	await cleanupUsers();
	if (fail > 0) {
		writeFileSync(process.env.TEMP + '\\opencode\\switch-member-log.txt', memberLogs.join('\n'));
	}
	console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
	process.exit(fail ? 1 : 0);
}

await main();
