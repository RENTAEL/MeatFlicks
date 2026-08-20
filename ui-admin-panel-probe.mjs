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
const adminUser = `apadm${suffix}`;
const regUser = `apusr${suffix}`;
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

async function loginUser(ctx, page, username) {
	await ctx.clearCookies();
	await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await page.waitForSelector('input[name="password"]', { timeout: 20000 });
	await page.fill('input[name="username"]', username);
	await page.fill('input[name="password"]', probePass);
	await page.click('button[type="submit"]');
	await page.waitForURL(BASE + '/', { timeout: 30000 }).catch(() => {});
	await page.waitForTimeout(2000);
}

async function hasSelector(page, selector, timeoutMs = 5000) {
	try {
		await page.waitForSelector(selector, { timeout: timeoutMs });
		return true;
	} catch {
		return false;
	}
}

async function api(page, path, method = 'GET', body = null) {
	return page.evaluate(
		async ([p, m, b]) => {
			const headers = { 'Content-Type': 'application/json' };
			if (m !== 'GET') {
				const csrf = await fetch('/api/csrf').then((r) => r.json());
				headers['X-CSRF-Token'] = csrf?.token || csrf?.csrfToken || '';
			}
			const res = await fetch(p, {
				method: m,
				headers,
				body: b ? JSON.stringify(b) : undefined,
				credentials: 'include'
			});
			return { status: res.status, body: await res.json().catch(() => null) };
		},
		[path, method, body]
	);
}

try {
	console.log('== SETUP ==');
	const admin = await signupUser(adminUser);
	const reg = await signupUser(regUser);
	await turso.execute({
		sql: "UPDATE users SET role = 'ADMIN' WHERE username = ?",
		args: [adminUser]
	});
	await loginUser(admin.ctx, admin.page, adminUser);
	console.log(`admin=${adminUser} reg=${regUser}`);

	// 1. Settings page: admin sees the Admin Panel section, non-admin does not.
	await admin.page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await admin.page.waitForTimeout(2500);
	const adminSection = await hasSelector(admin.page, '.settings-section-admin');
	pass.push(...(adminSection ? ['admin sees Admin Panel section in /settings' ] : []));
	fail.push(...(!adminSection ? ['FAIL: admin does NOT see Admin Panel in /settings'] : []));
	const adminPanelInSettings = await hasSelector(admin.page, '.admin-panel');
	pass.push(...(adminPanelInSettings ? ['AdminPanel renders inside settings section'] : []));
	fail.push(...(!adminPanelInSettings ? ['FAIL: AdminPanel not rendered in settings'] : []));

	await reg.page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await reg.page.waitForTimeout(2500);
	const regSection = await hasSelector(reg.page, '.settings-section-admin', 3000);
	pass.push(...(!regSection ? ['non-admin does NOT see Admin Panel section in /settings'] : []));
	fail.push(...(regSection ? ['FAIL: non-admin sees Admin Panel section in /settings'] : []));

	// 2. /settings/admin page: admin gets the panel, non-admin gets the alert.
	await admin.page.goto(BASE + '/settings/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await admin.page.waitForTimeout(2000);
	const adminPagePanel = await hasSelector(admin.page, '.admin-panel');
	pass.push(...(adminPagePanel ? ['/settings/admin shows AdminPanel for admin'] : []));
	fail.push(...(!adminPagePanel ? ['FAIL: /settings/admin no AdminPanel for admin'] : []));

	await reg.page.goto(BASE + '/settings/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await reg.page.waitForTimeout(2000);
	const regAlert = await hasSelector(reg.page, '.dev-restricted');
	pass.push(...(regAlert ? ['non-admin sees DeveloperRestrictedAlert on /settings/admin'] : []));
	fail.push(...(!regAlert ? ['FAIL: non-admin no restricted alert'] : []));
	const regPanelLeak = await hasSelector(reg.page, '.admin-panel', 3000);
	pass.push(...(!regPanelLeak ? ['no AdminPanel leak to non-admin'] : []));
	fail.push(...(regPanelLeak ? ['FAIL: AdminPanel leaked to non-admin page'] : []));

	// 3. API gating: stats endpoint.
	const nonAdminStats = await api(reg.page, '/api/admin/system/stats');
	pass.push(...(nonAdminStats.status === 403 ? ['non-admin stats -> 403'] : []));
	fail.push(...(nonAdminStats.status !== 403 ? [`FAIL: non-admin stats -> ${nonAdminStats.status}`] : []));
	const adminStats = await api(admin.page, '/api/admin/system/stats');
	const stats = adminStats.body?.stats;
	pass.push(...(adminStats.status === 200 && stats && 'totalUsers' in stats && 'activeSessions' in stats
		? ['admin stats -> 200 with counts']
		: []));
	fail.push(...(adminStats.status !== 200 || !stats || !('totalUsers' in stats)
		? [`FAIL: admin stats -> ${adminStats.status} ${JSON.stringify(adminStats.body)}`] : []));

	// 4. Broadcast announcement: set, visible publicly, clear.
	const setAnn = await api(admin.page, '/api/admin/announcement', 'POST', { text: 'Probe broadcast: servers will be great forever.' });
	pass.push(...(setAnn.status === 200 && setAnn.body?.announcement?.text ? ['announcement broadcast (API ok)'] : []));
	fail.push(...(setAnn.status !== 200 ? [`FAIL: broadcast -> ${setAnn.status} ${JSON.stringify(setAnn.body)}`] : []));
	const pubAnn = await api(reg.page, '/api/announcement');
	pass.push(...(pubAnn.status === 200 && pubAnn.body?.announcement?.text?.includes('Probe broadcast')
		? ['public /api/announcement shows live announcement'] : []));
	fail.push(...(!pubAnn.body?.announcement?.text?.includes('Probe broadcast')
		? ['FAIL: public announcement missing'] : []));
	await reg.page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await reg.page.waitForTimeout(3000);
	const banner = await hasSelector(reg.page, '.announcement-banner');
	pass.push(...(banner ? ['site-wide announcement banner visible on home'] : []));
	fail.push(...(!banner ? ['FAIL: announcement banner not visible'] : []));
	const delAnn = await api(admin.page, '/api/admin/announcement', 'DELETE');
	pass.push(...(delAnn.status === 200 ? ['announcement cleared (DELETE ok)'] : []));
	fail.push(...(delAnn.status !== 200 ? ['FAIL: DELETE announcement'] : []));

	// 5. Feature flags: disable dqEnabled, verify public, re-enable.
	const offFlag = await api(admin.page, '/api/admin/flags', 'POST', { name: 'dqEnabled', enabled: false });
	pass.push(...(offFlag.status === 200 && offFlag.body?.flags?.dqEnabled === false ? ['flag dqEnabled disabled'] : []));
	fail.push(...(offFlag.status !== 200 || offFlag.body?.flags?.dqEnabled !== false ? ['FAIL: disable dqEnabled'] : []));
	const pubFlags = await api(reg.page, '/api/feature-flags');
	pass.push(...(pubFlags.status === 200 && pubFlags.body?.flags?.dqEnabled === false
		? ['public /api/feature-flags reflects dqEnabled=false'] : []));
	fail.push(...(pubFlags.body?.flags?.dqEnabled !== false ? ['FAIL: public flags stale'] : []));
	const onFlag = await api(admin.page, '/api/admin/flags', 'POST', { name: 'dqEnabled', enabled: true });
	pass.push(...(onFlag.status === 200 && onFlag.body?.flags?.dqEnabled === true ? ['flag dqEnabled re-enabled'] : []));
	fail.push(...(onFlag.status !== 200 || onFlag.body?.flags?.dqEnabled !== true ? ['FAIL: re-enable dqEnabled'] : []));

	// 6. Session actions: end-all (0 active expected) + clear-orphans, via UI with confirmations.
	await admin.page.goto(BASE + '/settings/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await admin.page.waitForTimeout(2000);
	const endAllBtn = admin.page.locator('.admin-option', { hasText: 'End all active sessions' }).locator('.btn-danger');
	await endAllBtn.click();
	const confirmBtn = admin.page.locator('button.btn-danger', { hasText: 'Yes, end everything' });
	const confirmShown = await confirmBtn.waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
	pass.push(...(confirmShown ? ['"End all" requires two-step confirmation'] : []));
	fail.push(...(!confirmShown ? ['FAIL: no confirmation for End all'] : []));
	await confirmBtn.click();
	await admin.page.waitForSelector('.result-banner', { timeout: 20000 }).catch(() => {});
	const endAllBanner = await admin.page.textContent('.result-banner').catch(() => '');
	pass.push(...(endAllBanner.includes('All sessions ended') ? ['end-all executed -> success banner'] : []));
	fail.push(...(!endAllBanner.includes('All sessions ended') ? [`FAIL: end-all banner = "${endAllBanner}"`] : []));

	await admin.page.locator('.admin-option', { hasText: 'Clear orphaned sessions' }).locator('.btn-danger').click();
	const orphanConfirmBtn = admin.page.locator('button.btn-danger', { hasText: 'Yes, clean up' });
	const orphanConfirmShown = await orphanConfirmBtn.waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
	pass.push(...(orphanConfirmShown ? ['"Clear orphans" requires two-step confirmation'] : []));
	fail.push(...(!orphanConfirmShown ? ['FAIL: no confirmation for Clear orphans'] : []));
	await orphanConfirmBtn.click();
	await admin.page.waitForSelector('.result-banner', { timeout: 20000 }).catch(() => {});
	const orphanBanner = await admin.page.textContent('.result-banner').catch(() => '');
	pass.push(...(orphanBanner.includes('Orphaned sessions cleaned') ? ['clear-orphans executed -> success banner'] : []));
	fail.push(...(!orphanBanner.includes('Orphaned sessions cleaned') ? [`FAIL: orphans banner = "${orphanBanner}"`] : []));

	// 7. Stats card renders in the panel.
	await admin.page.goto(BASE + '/settings/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await admin.page.waitForTimeout(2500);
	const statsGrid = await hasSelector(admin.page, '.stats-grid');
	pass.push(...(statsGrid ? ['system stats card renders in AdminPanel'] : []));
	fail.push(...(!statsGrid ? ['FAIL: stats grid missing'] : []));

	// 8. Catalog refresh (force) — slower, allowed up to 3 minutes server-side.
	const refresh = await api(admin.page, '/api/admin/catalog/refresh', 'POST');
	pass.push(...(refresh.status === 200 && refresh.body?.ok === true ? ['catalog refresh -> ok'] : []));
	fail.push(...(refresh.status !== 200 ? [`FAIL: catalog refresh -> ${refresh.status} ${JSON.stringify(refresh.body)}`] : []));

	console.log('\n== ASSERTIONS ==');
	for (const p of pass) console.log('  PASS', p);
	for (const f of fail) console.log('  FAIL', f);
	console.log(`\nRESULT: ${pass.length} pass, ${fail.length} fail`);

	await admin.ctx.close();
	await reg.ctx.close();
} finally {
	try {
		await turso.execute({
			sql: "DELETE FROM users WHERE username IN (?, ?)",
			args: [adminUser, regUser]
		});
		await turso.execute({
			sql: "DELETE FROM schema_info WHERE key = 'announcement' OR key = 'flag:dqEnabled'",
			args: []
		});
		console.log('cleaned probe users + test keys');
	} catch (e) {
		console.log('cleanup skipped:', e.message);
	}
	await browser.close();
}