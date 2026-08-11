import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BASE = 'https://streamium-cosmic.vercel.app';
const REPO = 'C:/Users/bezui/Downloads/Test site thing';

function envLine(file, key) {
	if (!existsSync(file)) return '';
	const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(key + '='));
	return line ? line.slice(key.length + 1).trim() : '';
}

const tmdbKey = envLine(`${REPO}/.env`, 'TMDB_API_KEY');
process.env.SESSION_SECRET = process.env.SESSION_SECRET || envLine(`${REPO}/.env`, 'SESSION_SECRET');
process.env.TMDB_API_KEY = tmdbKey;
const { encryptSession } = await import(pathToFileURL(`${REPO}/src/lib/server/session-crypto.ts`).href);
const cookie = encryptSession({ userId: 'user-diag', username: 'Diag', role: 'USER', expiresAt: Date.now() + 3600000 });

const created = await fetch(`${BASE}/api/watch-party/rooms`, {
	method: 'POST',
	headers: { 'content-type': 'application/json', cookie: `session=${cookie}` },
	body: JSON.stringify({ mediaType: 'movie', tmdbId: 550, title: 'Fight Club' })
}).then((r) => r.json());
const roomId = created.roomId;
console.log('room', roomId);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addCookies([{ name: 'session', value: cookie, domain: 'streamium-cosmic.vercel.app', path: '/' }]);
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
await page.goto(`${BASE}/watch/${roomId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });

await page.waitForFunction(() => !!document.querySelector('iframe.player-iframe') || !!document.querySelector('.yt-host'), null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500);

const dump = await page.evaluate(() => {
	const controls = document.querySelectorAll('.player-controls');
	const bar = document.querySelector('.player-bar');
	const iframe = document.querySelector('iframe.player-iframe');
	const r = iframe ? iframe.getBoundingClientRect() : null;
	const points = r
		? [
				{ x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 },
				{ x: r.x + r.width * 0.15, y: r.y + r.height * 0.85 },
				{ x: r.x + r.width * 0.85, y: r.y + r.height * 0.15 },
				{ x: r.x + r.width * 0.5, y: r.y + r.height * 0.92 }
			]
		: [];
	const hits = points.map((p) => {
		const el = document.elementFromPoint(p.x, p.y);
		const chain = [];
		let cur = el;
		while (cur && chain.length < 5) {
			const cs = getComputedStyle(cur);
			chain.push({
				tag: cur.tagName,
				cls: cur.className && typeof cur.className === 'string' ? cur.className.slice(0, 60) : '',
				z: cs.zIndex,
				pe: cs.pointerEvents,
				opacity: cs.opacity
			});
			cur = cur.parentElement;
		}
		return { x: Math.round(p.x), y: Math.round(p.y), topTag: el?.tagName ?? null, topCls: (el?.className?.slice?.(0, 60)) ?? null, chain };
	});
	const kids = [...document.querySelectorAll('.player-root > *')].map((k) => {
		const cs = getComputedStyle(k);
		return {
			tag: k.tagName,
			cls: (k.className && typeof k.className === 'string' ? k.className : '').slice(0, 60),
			z: cs.zIndex,
			pe: cs.pointerEvents,
			opacity: cs.opacity,
			display: cs.display,
			w: Math.round(k.getBoundingClientRect().width),
			h: Math.round(k.getBoundingClientRect().height)
		};
	});
	return {
		customControlsCount: controls.length,
		providerBarCount: bar ? 1 : 0,
		iframePresent: !!iframe,
		hits,
		kids
	};
});
console.log('overlay/hit-test dump (expect customControlsCount=0, top hit = IFRAME at video points):');
console.log(JSON.stringify(dump, null, 1));
await browser.close();
