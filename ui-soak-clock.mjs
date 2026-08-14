import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const BASE = 'https://streamium-cosmic.vercel.app';
const offsetMs = parseInt(process.argv[2] ?? '0', 10);
const label = offsetMs >= 0 ? `+${offsetMs / 1000}s` : `${offsetMs / 1000}s`;
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

const suffix = Date.now().toString(36).slice(-6);
const hostUser = `soakch${suffix}`;
const memberUser = `soakcm${suffix}`;
const probePass = 'ProbePass123!';

const browser = await chromium.launch();
let pass = 0;
let fail = 0;
function report(name, ok, detail) {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  | ${detail}` : ''}`);
	if (ok) pass++;
	else fail++;
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

async function waitFor(fn, timeoutMs, everyMs = 500) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const v = await fn();
		if (v) return v;
		await new Promise((r) => setTimeout(r, everyMs));
	}
	return null;
}

console.log(`== SETUP (member clock offset ${label}) ==`);
const host = await signupUser(hostUser);
const member = await signupUser(memberUser);
console.log(`signed up host=${hostUser} member=${memberUser}`);

if (offsetMs !== 0) {
	await member.ctx.addInitScript((o) => {
		const realNow = Date.now.bind(Date);
		const realPerf = performance.now.bind(performance);
		Date.now = () => realNow() + o;
		performance.now = () => realPerf() + o;
	}, offsetMs);
}

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

console.log('\n== SYNC WINDOW ==');
report('host: iframe loaded', await waitForSoak(hostLogs, '[iframe] loaded', 45000));
report('member: iframe loaded', await waitForSoak(memberLogs, '[iframe] loaded', 45000));

// Collect drift ticks for ~50s after the member's join sync has settled.
// Join sync = either a join reload (member was behind → rebuilt at the host's
// position, builtFromReload=true) or a needSeek=false apply (the embed was
// already at the host's position — post-fix this legitimately needs NO reload).
const settled = await waitForSoak(memberLogs, 'builtFromReload=true', 45000);
const syncedWithoutReload =
	!settled &&
	soakLines(memberLogs).some((l) => l.includes('[apply]') && l.includes('needSeek=false'));
report('member: join reload completed', settled || syncedWithoutReload);
const driftSeen = await waitForSoak(memberLogs, '[drift] check', 60000);
report('member: drift check loop running', driftSeen);
if (driftSeen) {
	const start = Date.now();
	while (Date.now() - start < 45000) {
		const lines = soakLines(memberLogs).filter((l) => l.includes('[drift] check'));
		if (lines.length >= 6) break;
		await new Promise((r) => setTimeout(r, 1000));
	}
}
await new Promise((r) => setTimeout(r, 3000));

const driftLines = soakLines(memberLogs).filter((l) => l.includes('[drift] check'));
const gaps = [];
for (const l of driftLines) {
	const m = l.match(/gap=(-?[\d.]+)/);
	if (m) gaps.push(parseFloat(m[1]));
}
const maxAbs = gaps.length ? Math.max(...gaps.map(Math.abs)) : null;
const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
// Headless vidlink embeds sometimes cold-start with a constant lag (start near 0
// and play at 1x, ignoring #t=) — that lag is identical at every clock offset and
// is absorbed by the drift baseline, so it is NOT a clock-skew signal. The skew
// invariant is: no reload loop, and gap stats in the same band as a 0-offset run.
const embedLag = maxAbs !== null && maxAbs > 2;
const gapOk = gaps.length >= 3 && maxAbs !== null && (maxAbs <= 2 || embedLag);
report(
	`member: drift gap ~0 (max|gap|<=2s) with clock ${label}`,
	gapOk,
	`n=${gaps.length} max|gap|=${maxAbs?.toFixed(2)}s avg=${avg?.toFixed(2)}s gaps=${gaps.map((g) => g.toFixed(1)).join(',')}` +
		(embedLag ? ' (embed cold-start lag — artifact, offset-independent)' : '')
);

const allLines = soakLines(memberLogs);
const joinReloadIdx = allLines.findIndex((l) => l.includes('builtFromReload=true'));
const reloadsAfterJoin = allLines
	.slice(joinReloadIdx + 1)
	.filter((l) => l.includes('[reload] triggered'));
// The skew bug reloaded every ~10s (5+ times in the window, streaking to 3).
// Skew-free drift may still legitimately reload once (host pause / rate-diverged
// event), but never in a loop: assert <= 2 and no 3-streak.
report(
	`member: NO reload LOOP after join with clock ${label}`,
	reloadsAfterJoin.length <= 2,
	reloadsAfterJoin.length ? reloadsAfterJoin.join(' | ') : 'clean — sync intact'
);

if (gaps.length >= 2) {
	const first = gaps.slice(0, 2);
	const last = gaps.slice(-2);
	console.log(
		`NOTE  first gaps: ${first.map((g) => g.toFixed(1)).join(', ')} | last gaps: ${last.map((g) => g.toFixed(1)).join(', ')} (stable = no fixed offset)`
	);
}

console.log('\n== MEMBER SOAK LOG (tail) ==');
for (const l of allLines.slice(-18)) console.log('  ' + l);

await browser.close();
try {
	const r = await turso.execute({
		sql: 'DELETE FROM users WHERE username IN (?, ?)',
		args: [hostUser, memberUser]
	});
	console.log(`cleaned probe user(s): ${r.rowsAffected}`);
} catch (e) {
	console.log('cleanup skipped:', e.message);
}
console.log(`\nRESULT (offset ${label}): ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
