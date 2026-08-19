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

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const suffix = Date.now().toString(36).slice(-6);
const hostUser = `joinh${suffix}`;
const memberUser = `joinm${suffix}`;
const probePass = 'ProbePass123!';

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

const soakLines = (logs) =>
	logs.filter((l) => typeof l === 'string' && l.includes('[soak]')).map((l) => String(l));
const mark = (logs) => soakLines(logs).length;
const newLines = (logs, m) => soakLines(logs).slice(m);

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
			} catch {}
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
			} catch {}
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	return false;
}

async function memberVideoState(page) {
	for (const f of await vidlinkFrames(page, 5000)) {
		try {
			const s = await f
				.evaluate(
					() => {
						const v = document.querySelector('video');
						return v ? { paused: v.paused, t: v.currentTime } : null;
					},
					undefined,
					{ timeout: 2000 }
				)
				.catch(() => null);
			if (s) return s;
		} catch {}
	}
	return null;
}

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
	console.log(`DEBUG server list: open=${picked.open} items=${picked.count} picked=${picked.picked}`);
	return picked.picked;
}

try {
	console.log('== SETUP ==');
	const host = await signupUser(hostUser);
	const member = await signupUser(memberUser);
	console.log(`host=${hostUser} member=${memberUser}`);

	const created = await postJson(host.page, '/api/watch-party/rooms', {
		mediaType: 'movie',
		tmdbId: 603,
		title: 'The Matrix'
	});
	const roomId = JSON.parse(created.body).roomId;
	console.log('room:', roomId);

	const hostLogs = [];
	host.page.on('console', (m) => {
		if (m.text().includes('[soak]')) hostLogs.push(m.text());
	});
	await host.page.goto(`${BASE}/watch/${roomId}?soak=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
	await new Promise((r) => setTimeout(r, 5000));

	// Let host's iframe load, then force play and let it run to a real position.
	await hostVideo(host.page, false);
	await new Promise((r) => setTimeout(r, 10000));

	const hostPos = await (async () => {
		for (let attempt = 0; attempt < 8; attempt++) {
			for (const f of await vidlinkFrames(host.page, 5000)) {
				try {
					const t = await f
						.evaluate(
							() => {
								const v = document.querySelector('video');
								if (!v) return -1;
								if (v.paused) v.play().catch(() => {});
								return v.currentTime;
							},
							undefined,
							{ timeout: 2000 }
						)
						.catch(() => -1);
					if (t >= 20) return t;
				} catch {}
			}
			// The default embed produced no video (headless flake) — switch the
			// host to a vidlink-family provider that honors #t + the soak
			// protocol, then retry.
			if (attempt === 2 || attempt === 5) {
				const picked = await hostSwitchProvider(host.page, /vidlink/i);
				console.log('host provider switch attempt ->', picked);
				await new Promise((r) => setTimeout(r, 6000));
				await hostVideo(host.page, false);
			}
			await new Promise((r) => setTimeout(r, 5000));
		}
		return -1;
	})();
	console.log('host playing at position ~', hostPos.toFixed(1));

	// Now the member joins. Timeline from here.
	console.log('\n== MEMBER JOIN TIMELINE ==');
	const memberLogs = [];
	member.page.on('console', (m) => {
		if (m.text().includes('[soak]')) memberLogs.push(m.text());
	});
	const t0 = Date.now();
	const overlayProbe = [];
	await member.page.goto(`${BASE}/watch/${roomId}?soak=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
	await member.page.waitForSelector('.player-root', { timeout: 30000 }).catch(() => {});
	overlayProbe.push([Date.now() - t0, await member.page
		.evaluate(() => {
			const ov = document.querySelector('.overlay-text');
			const sub = document.querySelector('.overlay-sub');
			return ov ? `${ov.textContent}${sub ? ' / ' + sub.textContent : ''}` : 'NO-OVERLAY';
		})
		.catch(() => '?')]);

	// Poll overlay + iframe state + soak logs until member is really playing.
	const m = mark(memberLogs);
	const startWait = Date.now();
	let firstJoin = null, firstIframe = null, firstBuild = null, firstTu = null, firstDriftTolerated = null;
	let lastVideo = null;
	const iframeSrcSamples = [];
	const buildsBeforeTu = [];
	const buildsBeforeIframe = [];
	const iframeSrcAt = () =>
		member.page
			.evaluate(() => {
				const el = document.querySelector('.player-root iframe');
				return el ? el.src : null;
			})
			.catch(() => null);
	while (Date.now() - startWait < 240000) {
		const lines = newLines(memberLogs, m);
		if (!firstJoin) {
			const l = lines.find((x) => x.includes('[join]'));
			if (l) firstJoin = { t: Date.now() - t0, line: l };
		}
		if (!firstIframe) {
			const l = lines.find((x) => x.includes('[iframe] loaded'));
			if (l) firstIframe = { t: Date.now() - t0, line: l };
		}
		if (!firstBuild) {
			const l = lines.find((x) => x.includes('[build]'));
			if (l) firstBuild = { t: Date.now() - t0, line: l };
		}
		if (!firstTu) {
			const l = lines.find((x) => x.includes('[embed-ev] timeupdate'));
			if (l) firstTu = { t: Date.now() - t0, line: l };
		}
		if (!firstDriftTolerated) {
			const l = lines.find((x) => x.includes('[drift] check') && x.includes('tolerated'));
			if (l) firstDriftTolerated = { t: Date.now() - t0, line: l };
		}
		if (firstTu) {
			lastVideo = await memberVideoState(member.page);
		}
		// Track iframe src evolution — the fix's claim is the FIRST src is the
		// host target (#t=), not the base URL (position 0) followed by a reload.
		const s = await iframeSrcAt();
		if (s && (iframeSrcSamples.length === 0 || iframeSrcSamples[iframeSrcSamples.length - 1][1] !== s)) {
			iframeSrcSamples.push([Date.now() - t0, s.replace(/([&?])_=\d+/, '$1_=NN'), s.includes('#t=')]);
		}
		// Count [build]s before the first timeupdate — should be exactly 1.
		if (!firstTu) {
			for (const l of lines) {
				if (l.includes('[build]') && !buildsBeforeTu.includes(l)) buildsBeforeTu.push(l);
			}
		}
		// Count [build]s before the first iframe load — must be exactly 1.
		// The reload-loop regression fired a build every ~3s while the embed
		// was still loading (each one cancelling the in-flight load).
		if (!firstIframe) {
			for (const l of lines) {
				if (l.includes('[build]') && !buildsBeforeIframe.includes(l)) buildsBeforeIframe.push(l);
			}
		}
		// sample overlay every ~2s until playback starts
		if (!firstTu && (overlayProbe.length < 8 || Date.now() - overlayProbe[overlayProbe.length - 1][0] > 4000)) {
			overlayProbe.push([
				Date.now() - t0,
				await member.page
					.evaluate(() => {
						const ov = document.querySelector('.overlay-text');
						const sub = document.querySelector('.overlay-sub');
						return ov ? `${ov.textContent}${sub ? ' / ' + sub.textContent : ''}` : 'NO-OVERLAY';
					})
					.catch(() => '?')
			]);
		}
		if (firstTu && lastVideo && (lastVideo.t >= 20 || (!lastVideo.paused && lastVideo.t > 2))) break;
		await new Promise((r) => setTimeout(r, 1000));
	}
	const tEnd = Date.now() - t0;

	console.log('overlay samples (ms since nav):', JSON.stringify(overlayProbe));
	console.log('iframe src samples:', JSON.stringify(iframeSrcSamples, null, 2));
	console.log('builds before first timeupdate:', JSON.stringify(buildsBeforeTu));
	console.log('member [join]:            ', firstJoin ? `${firstJoin.t}ms` : 'MISSING', firstJoin?.line ?? '');
	console.log('member [iframe] loaded:   ', firstIframe ? `${firstIframe.t}ms` : 'MISSING', firstIframe?.line ?? '');
	console.log('member first [build]:     ', firstBuild ? `${firstBuild.t}ms` : 'MISSING', firstBuild?.line ?? '');
	console.log('member first timeupdate:  ', firstTu ? `${firstTu.t}ms` : 'MISSING', firstTu?.line ?? '');
	console.log('member first tolerated:   ', firstDriftTolerated ? `${firstDriftTolerated.t}ms` : 'MISSING', firstDriftTolerated?.line ?? '');
	console.log('member video (t_end):     ', JSON.stringify(lastVideo));
	console.log(`TOTAL join->playing:      ${tEnd}ms  (host was at ~${hostPos.toFixed(1)}s)`);

	// ASSERTIONS for the join fix.
	const pass = [];
	const fail = [];
	const firstSampleTargeted = iframeSrcSamples.length && iframeSrcSamples[0][2];
	pass.push(...(firstSampleTargeted ? ['first iframe src IS host-targeted (#t=)'] : []));
	fail.push(...(!firstSampleTargeted ? ['FAIL: first iframe src was NOT targeted (base-load-then-rebuild path)'] : []));
	// Reload-loop regression: exactly ONE build before the first iframe load.
	// More means the join branch kept re-firing while the embed was loading
	// (each rebuild cancelling the in-flight load -> member never settles).
	const exactlyOneJoinBuild = buildsBeforeIframe.length === 1;
	pass.push(...(exactlyOneJoinBuild ? [`exactly 1 build before first iframe load (${buildsBeforeIframe.length}) — no reload loop`] : []));
	fail.push(...(!exactlyOneJoinBuild ? [`FAIL: ${buildsBeforeIframe.length} build(s) before first iframe load — reload loop (member kept rebuilding while the embed was loading)`] : []));
	// Every pre-play build must carry a real host position (hostPos trajectory),
	// never the base-load signature of t≈0. Count=2 is normal (join build +
	// host-move retarget); count=1 is ideal.
	const buildsOk = buildsBeforeTu.length > 0 && buildsBeforeTu.every((b) => {
		const m = b.match(/\[build\] t=(\d+)/);
		return m && Number(m[1]) >= Math.max(0, hostPos - 5);
	});
	pass.push(...(buildsOk ? [`all ${buildsBeforeTu.length} pre-play build(s) carried host positions (none at 0/base-load)`] : []));
	fail.push(...(!buildsOk ? [`FAIL: a pre-play build carried a base-load position (0) — rebuild path still present: ${JSON.stringify(buildsBeforeTu)}`] : []));
	const synced = lastVideo && hostPos >= 0 && (lastVideo.t ?? 0) >= hostPos - 5;
	pass.push(...(synced ? ['member video reached host position'] : []));
	fail.push(...(!synced ? [`FAIL: member video not near host position (host ~${hostPos.toFixed(1)}, member ${lastVideo?.t?.toFixed(1) ?? 'n/a'})`] : []));
	const fastEnough = tEnd < 15000;
	pass.push(...(fastEnough ? [`join->playing in ${tEnd}ms (< 15s)`] : []));
	fail.push(...(!fastEnough ? [`FAIL: join->playing took ${tEnd}ms (>= 15s)`] : []));
	// Member's builds must track the host's advancing position (host keeps
	// playing for the whole run), proving the sync target follows the host.
	const lastBuildT = (() => {
		const m = buildsBeforeTu[buildsBeforeTu.length - 1]?.match(/\[build\] t=(\d+)/);
		return m ? Number(m[1]) : null;
	})();
	const hostAtEnd = hostPos + tEnd / 1000;
	const tracksHost = hostPos >= 0 && lastBuildT != null && Math.abs(lastBuildT - hostAtEnd) < 20;
	pass.push(...(tracksHost ? [`member's last build (t=${lastBuildT}) tracks host position (~${hostAtEnd.toFixed(0)})`] : []));
	fail.push(...(!tracksHost ? [`FAIL: member's last build (t=${lastBuildT}) far from host position (~${hostAtEnd.toFixed(0)})`] : []));
	console.log('\n== JOIN-FIX ASSERTIONS ==');
	for (const p of pass) console.log('  PASS', p);
	for (const f of fail) console.log('  FAIL', f);

	console.log('\nfull member soak log:');
	for (const l of soakLines(memberLogs)) console.log('  ', l);

	await host.ctx.close();
	await member.ctx.close();
} finally {
	try {
		await turso.execute({ sql: 'DELETE FROM users WHERE username IN (?, ?)', args: [hostUser, memberUser] });
		console.log('cleaned probe users');
	} catch (e) {
		console.log('cleanup skipped:', e.message);
	}
	await browser.close();
}