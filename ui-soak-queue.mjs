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

const suffix = Date.now().toString(36).slice(-6);
const hostUser = `soakqh${suffix}`;
const memberUser = `soakqm${suffix}`;
const probePass = 'ProbePass123!';
const TMDB1 = 603; // The Matrix (room media)
const DUNE = 438631; // Dune
const DUNE2 = 693134; // Dune: Part Two

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

async function delJson(page, url) {
	return page.evaluate(async (u) => {
		const csrf = await fetch('/api/csrf').then((r) => r.json());
		const token = csrf?.token || csrf?.csrfToken || '';
		const res = await fetch(u, {
			method: 'DELETE',
			headers: { 'X-CSRF-Token': token },
			credentials: 'include'
		});
		return { status: res.status, ok: res.ok, body: await res.text() };
	}, url);
}

async function getJson(page, url) {
	return page.evaluate(async (u) => {
		const res = await fetch(u, { credentials: 'include' });
		return { status: res.status, ok: res.ok, body: await res.text() };
	}, url);
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

async function roomState(page, roomId) {
	const res = await getJson(page, `/api/watch-party/rooms/${roomId}`);
	try {
		return JSON.parse(res.body);
	} catch {
		return null;
	}
}

async function queueTitles(page, roomId) {
	const s = await roomState(page, roomId);
	return s?.queue?.map((q) => q.title) ?? null;
}

console.log('== SETUP ==');
const host = await signupUser(hostUser);
const member = await signupUser(memberUser);
console.log(`signed up host=${hostUser} member=${memberUser}`);

const created = await postJson(host.page, '/api/watch-party/rooms', {
	mediaType: 'movie',
	tmdbId: TMDB1,
	title: 'The Matrix'
});
const roomId = (() => {
	try {
		return JSON.parse(created.body).roomId;
	} catch {
		return null;
	}
})();
report(
	'room created via API',
	created.status === 200 && !!roomId,
	`status=${created.status} room=${roomId}`
);
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
await waitForSoak(memberLogs, '[join]', 15000);
console.log('both pages joined');

console.log('\n== QUEUE: ADD ==');
const add1 = await postJson(host.page, `/api/watch-party/rooms/${roomId}/queue`, {
	mediaType: 'movie',
	tmdbId: DUNE,
	title: 'Dune'
});
report('host: add Dune -> 200', add1.status === 200, `status=${add1.status}`);
const add2 = await postJson(host.page, `/api/watch-party/rooms/${roomId}/queue`, {
	mediaType: 'movie',
	tmdbId: DUNE2,
	title: 'Dune: Part Two'
});
report('host: add Dune: Part Two -> 200', add2.status === 200, `status=${add2.status}`);

const q1 = await waitFor(async () => {
	const t = await queueTitles(member.page, roomId);
	return t && t.length === 2 ? t : null;
}, 20000);
report(
	'member: queue via API = [Dune, Dune: Part Two]',
	!!q1 && q1[0] === 'Dune' && q1[1] === 'Dune: Part Two',
	JSON.stringify(q1)
);

const memberQueueDom = await waitFor(async () => {
	if ((await member.page.locator('.queue-item').count()) !== 2) return null;
	const titles = [];
	for (let i = 0; i < 2; i++) {
		titles.push((await member.page.locator('.queue-item-title').nth(i).textContent()) ?? '');
	}
	return titles;
}, 20000);
report(
	'member: queue panel shows both titles',
	!!memberQueueDom && memberQueueDom.join('|') === 'Dune|Dune: Part Two',
	JSON.stringify(memberQueueDom)
);
if (!memberQueueDom) {
	console.log(
		'  DIAG member panel html:',
		(
			(await member.page
				.locator('.queue-panel')
				.innerHTML()
				.catch(() => 'NO PANEL')) ?? ''
		).slice(0, 600)
	);
	console.log('  DIAG member soak lines:');
	for (const l of soakLines(memberLogs)) console.log('    ' + l);
}
report(
	'member: Up next chip = Dune',
	(
		await waitFor(
			async () => (await member.page.locator('.upnext-chip').textContent()) ?? null,
			15000
		)
	)?.includes('Dune') ?? false
);
report(
	'member: no queue search input',
	(await member.page.locator('.queue-search-input').count()) === 0
);
report('member: no Play next button', (await member.page.locator('.queue-play-btn').count()) === 0);

const memberAdd = await postJson(member.page, `/api/watch-party/rooms/${roomId}/queue`, {
	mediaType: 'movie',
	tmdbId: DUNE,
	title: 'Dune'
});
report('member: POST queue add -> 403', memberAdd.status === 403, `status=${memberAdd.status}`);
const memberAdvance = await postJson(member.page, `/api/watch-party/rooms/${roomId}/queue/advance`);
report(
	'member: POST queue advance -> 403',
	memberAdvance.status === 403,
	`status=${memberAdvance.status}`
);

console.log('\n== QUEUE: PERSISTENCE ACROSS RECONNECT ==');
await member.page.goto(`${BASE}/watch/${roomId}?soak=1`, {
	waitUntil: 'domcontentloaded',
	timeout: 60000
});
const qAfterReload = await waitFor(async () => {
	const t = await queueTitles(member.page, roomId);
	return t && t.length === 2 ? t : null;
}, 20000);
report('member: queue persists after page reload', !!qAfterReload, JSON.stringify(qAfterReload));
report(
	'member: queue panel re-rendered after reload',
	(await waitFor(
		async () => ((await member.page.locator('.queue-item').count()) === 2 ? true : null),
		20000
	)) === true
);

console.log('\n== QUEUE: REORDER ==');
const s2 = await roomState(member.page, roomId);
const ids = s2.queue.map((q) => q.id);
const reorder = await postJson(host.page, `/api/watch-party/rooms/${roomId}/queue/reorder`, {
	orderedIds: [ids[1], ids[0]]
});
report('host: reorder -> 200', reorder.status === 200, `status=${reorder.status}`);
const q2 = await waitFor(async () => {
	const t = await queueTitles(member.page, roomId);
	return t && t[0] === 'Dune: Part Two' && t[1] === 'Dune' ? t : null;
}, 20000);
report('member: sees reordered queue (Dune2 first)', !!q2, JSON.stringify(q2));

console.log('\n== QUEUE: ADVANCE (via real UI button) ==');
await host.page.locator('.queue-play-btn').scrollIntoViewIfNeeded();
await host.page.locator('.queue-play-btn').click();
const advState = await waitFor(async () => {
	const s = await roomState(host.page, roomId);
	return s?.media?.tmdbId === DUNE2 && s?.queue?.length === 1 ? s : null;
}, 20000);
report(
	'host: Play next button -> Dune: Part Two now playing',
	!!advState,
	`media=${advState?.media?.title} queue=${JSON.stringify(advState?.queue?.map((q) => q.title))}`
);
report(
	'host: [soak] queue advanced logged',
	await waitForSoak(hostLogs, '[queue] advanced', 15000),
	soakLines(hostLogs)
		.filter((l) => l.includes('[queue]'))
		.join(' | ')
);

const switched = await waitFor(async () => {
	const s = await roomState(member.page, roomId);
	return s?.media?.tmdbId === DUNE2 && s.queue?.length === 1 && s.queue[0].title === 'Dune'
		? s
		: null;
}, 20000);
report('room media now Dune: Part Two, queue=[Dune]', !!switched);
report(
	'host: [soak] queue advanced logged',
	await waitForSoak(hostLogs, '[queue] advanced', 15000),
	soakLines(hostLogs)
		.filter((l) => l.includes('[queue]'))
		.join(' | ')
);
report('host: [soak] media switch logged', await waitForSoak(hostLogs, '[media] switch', 20000));
report(
	'member: [soak] media switch logged',
	await waitForSoak(memberLogs, '[media] switch', 20000)
);

const memberTitle = await waitFor(async () => {
	const t = await member.page.locator('.room-title').textContent();
	return t === 'Dune: Part Two' ? t : null;
}, 20000);
report('member: player title = Dune: Part Two', !!memberTitle, memberTitle ?? 'stale');

async function iframeAfterMediaSwitch(logs) {
	const lines = soakLines(logs);
	const switchIdx = lines.findIndex((l) => l.includes('[media] switch'));
	if (switchIdx < 0) return false;
	return lines.slice(switchIdx + 1).some((l) => l.includes('[iframe] loaded'));
}
report(
	'member: new source iframe loaded AFTER switch',
	await waitFor(() => iframeAfterMediaSwitch(memberLogs), 45000)
);
report(
	'host: new source iframe loaded AFTER switch',
	await waitFor(() => iframeAfterMediaSwitch(hostLogs), 45000)
);
report(
	'member: drift loop still running after switch',
	await waitFor(() => {
		const lines = soakLines(memberLogs);
		const switchIdx = lines.findIndex((l) => l.includes('[media] switch'));
		return switchIdx >= 0 && lines.slice(switchIdx + 1).some((l) => l.includes('[drift] check'));
	}, 30000)
);

console.log('\n== QUEUE: EMPTY-ADVANCE NO-OP ==');
const adv2 = await postJson(host.page, `/api/watch-party/rooms/${roomId}/queue/advance`);
let adv2Body = null;
try {
	adv2Body = JSON.parse(adv2.body);
} catch {}
report(
	'advance (Dune left) -> plays Dune',
	adv2.status === 200 && adv2Body?.advanced?.tmdbId === DUNE,
	`advanced=${adv2Body?.advanced?.title ?? 'none'}`
);
const afterDune = await waitFor(async () => {
	const s = await roomState(member.page, roomId);
	return s?.media?.tmdbId === DUNE && s.queue?.length === 0 ? s : null;
}, 20000);
report('room media = Dune, queue empty', !!afterDune);
const adv3 = await postJson(host.page, `/api/watch-party/rooms/${roomId}/queue/advance`);
let adv3Body = null;
try {
	adv3Body = JSON.parse(adv3.body);
} catch {}
report(
	'empty-queue advance -> no-op (advanced=null)',
	adv3.status === 200 && adv3Body?.advanced === null,
	`advanced=${JSON.stringify(adv3Body?.advanced ?? null)}`
);
const noChange = await waitFor(async () => {
	const s = await roomState(member.page, roomId);
	return s?.media?.tmdbId === DUNE ? s : null;
}, 15000);
report('media unchanged after no-op advance', !!noChange);
report(
	'member: sees empty queue state',
	(await waitFor(
		async () => ((await member.page.locator('.queue-item').count()) === 0 ? true : null),
		20000
	)) === true
);

console.log('\n== REGRESSIONS: CHAT + KICK ==');
const chat = await postJson(member.page, `/api/watch-party/rooms/${roomId}/messages`, {
	body: 'queue test chat'
});
report('member: chat message -> 200', chat.status === 200, `status=${chat.status}`);
const chatSeen = await waitFor(async () => {
	const s = await roomState(host.page, roomId);
	return s?.messages?.some((m) => m.body === 'queue test chat') ? true : null;
}, 15000);
report('host: sees member chat message', !!chatSeen);

const kickState = await roomState(host.page, roomId);
const target = kickState.participants.find((p) => p.username === memberUser);
const kickRes = await postJson(host.page, `/api/watch-party/rooms/${roomId}/kick`, {
	userId: target?.userId ?? ''
});
report('host: kick member -> 200', kickRes.status === 200, `status=${kickRes.status}`);
report('member: [soak] kick logged', await waitForSoak(memberLogs, '[kick]', 20000));

console.log('\n== NON-SOAK USAGE UNCHANGED ==');
const plainCtx = await browser.newContext();
const plain = await plainCtx.newPage();
await plain.goto(BASE + '/signup', { waitUntil: 'domcontentloaded', timeout: 60000 });
await plain.waitForSelector('input[name="username"]', { timeout: 20000 });
await plain.fill('input[name="username"]', `soakqp${suffix}`);
await plain.fill('input[name="email"]', `soakqp${suffix}@probe.test`);
await plain.fill('input[name="password"]', probePass);
await plain.click('button[type="submit"]');
await plain.waitForURL(BASE + '/', { timeout: 30000 }).catch(() => {});
await plain.waitForTimeout(2000);
const plainSoak = [];
plain.on('console', (m) => {
	if (m.text().includes('[soak]')) plainSoak.push(m.text());
});
await plain.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await plain.waitForTimeout(5000);
report('non-soak: no overlay', (await plain.locator('.soak-panel').count()) === 0);
report('non-soak: no [soak] console output', plainSoak.length === 0, plainSoak[0] ?? 'clean');

console.log('\n== HOST SOAK LOG (queue/membership section) ==');
for (const l of soakLines(hostLogs).filter(
	(l) => l.includes('[queue]') || l.includes('[media]') || l.includes('[join]')
)) {
	console.log('  ' + l);
}

await browser.close();
try {
	const r = await turso.execute({
		sql: 'DELETE FROM users WHERE username IN (?, ?, ?)',
		args: [hostUser, memberUser, `soakqp${suffix}`]
	});
	console.log(`cleaned probe user(s): ${r.rowsAffected}`);
} catch (e) {
	console.log('cleanup skipped:', e.message);
}
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
