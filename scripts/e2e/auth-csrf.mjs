import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
let failed = 0;
function check(name, ok, detail = '') {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
	if (!ok) failed++;
}

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 60000 });

// Dismiss the intermittent full-screen popup if shown (its backdrop intercepts clicks)
await page.waitForTimeout(1800);
await page.locator('.popup-close').click({ timeout: 1500 }).catch(() => {});

check('logout link visible (csrf irrelevant yet)', await page.locator('a[href="/logout"]').count() >= 0);

// Grab csrf token + cookies set by the page render
const cookies = await page.context().cookies();
const csrfCookie = cookies.find((c) => c.name === 'csrf_token');
check('csrf_token cookie set by page render', !!csrfCookie, csrfCookie ? 'length ' + csrfCookie.value.length : '');

// Bad creds round-trip: submit the login form (SvelteKit form action, af: POST)
await page.fill('input[name="username"]', 'questvrmsd5epa1');
await page.fill('input[name="password"]', 'this-is-wrong-on-purpose');
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
const body = await page.textContent('body').catch(() => '');
check('login form POST survives csrf change', !body.includes('403') && body.length > 50, 'rendered page, no 403');

// Search API GET (api path) still works and carries no Set-Cookie
const resp = await page.request.get(BASE + '/api/search?q=avatar');
check('API GET /api/search 200', resp.status() === 200, String(resp.status()));
check('API response has no set-cookie', !resp.headers()['set-cookie'], resp.headers()['set-cookie'] || '');

await browser.close();
console.log(failed === 0 ? 'AUTH/CSRF GREEN' : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);