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
const adminUser = `admin${suffix}`;
const hostUser = `sessh${suffix}`;
const probePass = 'ProbePass123!';

const pass = [];
const fail = [];

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

async function hasSelector(page, selector, timeoutMs = 5000) {
	try {
		await page.waitForSelector(selector, { timeout: timeoutMs });
		return true;
	} catch {
		return false;
	}
}

async function panelRows(page) {
	return page.evaluate(() =>
		Array.from(document.querySelectorAll('.session-item')).map((el) => ({
			code: el.querySelector('.room-code')?.textContent?.trim() ?? null,
			title: el.querySelector('.session-title')?.textContent?.trim() ?? null,
			members: el.querySelector('.session-meta .meta-item')?.textContent?.trim() ?? null
		}))
	);
}

try {
	console.log('== SETUP ==');
	const admin = await signupUser(adminUser);
	const host = await signupUser(hostUser);
	const member = await signupUser(`sessm${suffix}`);
	console.log(`admin=${adminUser} host=${hostUser} member=sessm${suffix}`);

	// Promote the admin user directly (role column, default USER).
	await turso.execute({
		sql: "UPDATE users SET role = 'ADMIN' WHERE username = ?",
		args: [adminUser]
	});
	console.log('promoted admin role');

	// Role is baked into the session cookie at login (hooks.server.ts uses
	// sessionData.role), so re-mint the session: clear cookies, then log in
	// again — the fresh cookie carries the ADMIN role.
	await admin.ctx.clearCookies();
	await admin.page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await admin.page.waitForSelector('input[name="password"]', {
		timeout: 20000
	});
	await admin.page.fill('input[name="username"]', adminUser);
	await admin.page.fill('input[name="password"]', probePass);
	await admin.page.click('button[type="submit"]');
	await admin.page.waitForURL(BASE + '/', { timeout: 30000 }).catch(() => {});
	await admin.page.waitForTimeout(2000);

	const adminToggleVisible = await hasSelector(admin.page, '.admin-sessions-btn');
	pass.push(...(adminToggleVisible ? ['admin sees Active Sessions toggle'] : []));
	fail.push(...(!adminToggleVisible ? ['FAIL: admin does NOT see Active Sessions toggle'] : []));

	const nonAdminToggleVisible = await hasSelector(host.page, '.admin-sessions-btn', 3000);
	pass.push(...(!nonAdminToggleVisible ? ['non-admin does NOT see the toggle'] : []));
	fail.push(...(nonAdminToggleVisible ? ['FAIL: non-admin sees the Active Sessions toggle'] : []));

	// Non-admin API gate.
	const nonAdminApi = await host.page.evaluate(async () => {
		const res = await fetch('/api/admin/watch-party/sessions');
		return { status: res.status };
	});
	pass.push(...(nonAdminApi.status === 403 ? ['non-admin API -> 403'] : []));
	fail.push(...(nonAdminApi.status !== 403 ? [`FAIL: non-admin API -> ${nonAdminApi.status}`] : []));

	// Admin API snapshot (logged-in).
	const adminApi = await admin.page.evaluate(async () => {
		const res = await fetch('/api/admin/watch-party/sessions');
		const body = await res.json();
		return { status: res.status, sessions: Array.isArray(body.sessions) ? body.sessions : null };
	});
	pass.push(...(adminApi.status === 200 ? ['admin API -> 200'] : []));
	fail.push(...(adminApi.status !== 200 ? [`FAIL: admin API -> ${adminApi.status}`] : []));
	pass.push(...(adminApi.sessions ? ['snapshot returns sessions array'] : []));
	fail.push(...(!adminApi.sessions ? ['FAIL: snapshot missing sessions array'] : []));

	console.log('\n== LIVE FLOW ==');
	// Host creates a room and opens the watch page (host is an active member).
	const created = await postJson(host.page, '/api/watch-party/rooms', {
		mediaType: 'movie',
		tmdbId: 603,
		title: 'The Matrix'
	});
	const roomId = JSON.parse(created.body).roomId;
	console.log('room:', roomId);
	await host.page.goto(`${BASE}/watch/${roomId}`, {
		waitUntil: 'domcontentloaded',
		timeout: 60000
	});
	await new Promise((r) => setTimeout(r, 4000));

	// Open the admin panel — EventSource connects, initial push arrives.
	await admin.page.click('.admin-sessions-btn');
	const panelOpen = await hasSelector(admin.page, '.panel-wrap', 8000);
	pass.push(...(panelOpen ? ['panel opened with live EventSource'] : []));
	fail.push(...(!panelOpen ? ['FAIL: panel did not open'] : []));

	// Wait for the room to appear in the panel (SSE push, no reload), then a
	// DISTINCT user joins to push the member count 1 -> 2.
	let sawRoom = false;
	let sawMembers2 = false;
	const start = Date.now();
	const joinResult = await member.page.goto(`${BASE}/watch/${roomId}`, {
		waitUntil: 'domcontentloaded',
		timeout: 60000
	});
	console.log('member join page status:', joinResult?.status());
	await member.page.waitForTimeout(4000);
	while (Date.now() - start < 30000) {
		const rows = await panelRows(admin.page);
		const row = rows.find((r) => r.code === roomId);
		if (row) {
			sawRoom = true;
			const members = Number((row.members ?? '').replace(/\D/g, ''));
			if (members >= 2) sawMembers2 = true;
		}
		if (sawRoom && sawMembers2) break;
		await new Promise((r) => setTimeout(r, 1500));
	}
	pass.push(...(sawRoom ? [`room ${roomId} appeared in panel live (SSE)`] : []));
	fail.push(...(!sawRoom ? [`FAIL: room ${roomId} never appeared in panel`] : []));
	pass.push(...(sawMembers2 ? ['member count incremented live to 2 via SSE'] : []));
	fail.push(...(!sawMembers2 ? ['FAIL: member count did not update to 2 via SSE'] : []));

	// End the session from the panel (two-step confirm) — row must vanish live.
	const endBtn = admin.page.locator('.session-item', { hasText: roomId }).locator('.end-btn');
	const endVisible = await hasSelector(admin.page, '.end-btn', 5000);
	let closeApi = null;
	if (endVisible) {
		await endBtn.click();
		const confirmVisible = await hasSelector(admin.page, '.confirm-yes', 5000);
		closeApi = await admin.page.evaluate(
			async (rid) => {
				const csrf = await fetch('/api/csrf').then((r) => r.json());
				const token = csrf?.token || csrf?.csrfToken || '';
				const res = await fetch(`/api/admin/watch-party/sessions/${rid}/close`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
					credentials: 'include'
				});
				return { status: res.status, body: await res.text() };
			},
			roomId
		);
		if (confirmVisible) await admin.page.click('.confirm-yes');
	}
	const rowAfter = await turso.execute({
		sql: 'SELECT closed_at FROM watch_party_rooms WHERE id = ?',
		args: [roomId]
	});
	console.log('close api:', JSON.stringify(closeApi), 'room row:', JSON.stringify(rowAfter.rows));
	let rowGone = false;
	const start2 = Date.now();
	while (Date.now() - start2 < 30000) {
		const rows = await panelRows(admin.page);
		if (!rows.some((r) => r.code === roomId)) {
			rowGone = true;
			break;
		}
		await new Promise((r) => setTimeout(r, 1500));
	}
	pass.push(...(rowGone ? ['ended session removed from panel live'] : []));
	fail.push(...(!rowGone ? ['FAIL: ended session still listed in panel'] : []));

	console.log('\n== ASSERTIONS ==');
	for (const p of pass) console.log('  PASS', p);
	for (const f of fail) console.log('  FAIL', f);
	console.log(`\nRESULT: ${pass.length} pass, ${fail.length} fail`);

	await admin.ctx.close();
	await host.ctx.close();
	await member.ctx.close();
} finally {
	try {
		await turso.execute({
			sql: 'DELETE FROM users WHERE username IN (?, ?, ?)',
			args: [adminUser, hostUser, `sessm${suffix}`]
		});
		console.log('cleaned probe users');
	} catch (e) {
		console.log('cleanup skipped:', e.message);
	}
	await browser.close();
}