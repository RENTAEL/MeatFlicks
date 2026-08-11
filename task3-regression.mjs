import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

// --- embedded Player on the standalone player route ---
await page.goto(BASE + '/tv/1399/1/1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.player-root', { timeout: 20000 }).catch(() => {});
await page.waitForSelector('.player-controls', { timeout: 20000 }).catch(() => {});
check('embedded player renders', (await page.locator('.player-root').count()) > 0);
check('controls bar renders', (await page.locator('.player-controls').count()) > 0);

const buttonLabels = [
	'Play', 'Back 10 seconds', 'Forward 10 seconds', 'Mute', 'Enter fullscreen', 'Keyboard shortcuts'
];
for (const label of buttonLabels) {
	const count = await page.locator(`.player-controls [aria-label="${label}"]`).count();
	check(`controls bar has ${label} button`, count > 0);
}

await page.click('.player-controls [aria-label="Enter fullscreen"]');
await page.waitForTimeout(200);
await page.keyboard.press('?');
await page.waitForTimeout(300);
const helpVisible = await page.locator('.shortcuts-panel').count();
check('? opens shortcuts help', helpVisible > 0);
const shortcutRows = await page.locator('.shortcut-row').count();
check('help lists 7 shortcuts', shortcutRows === 7, `rows=${shortcutRows}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Escape closes help', (await page.locator('.shortcuts-panel').count()) === 0);

const volBefore = await page.evaluate(() => Number(localStorage.getItem('streamium-player-volume') ?? '100'));
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(300);
const volAfter = await page.evaluate(() => Number(localStorage.getItem('streamium-player-volume') ?? '100'));
check('ArrowDown lowers volume (persisted)', volAfter === Math.max(0, volBefore - 30), `${volBefore} -> ${volAfter}`);

await page.keyboard.press('m');
await page.waitForTimeout(300);
const muted = await page.evaluate(() => localStorage.getItem('streamium-player-muted'));
check('M toggles mute (persisted)', muted === '1', `muted=${muted}`);

await page.keyboard.press('ArrowUp');
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(300);
const mutedAfterUnmute = await page.evaluate(() => localStorage.getItem('streamium-player-muted'));
check('ArrowUp unmutes when raising volume', mutedAfterUnmute === '0' || mutedAfterUnmute === null, `muted=${mutedAfterUnmute}`);

const seekButtonWorks = await page.locator('.player-controls [aria-label="Back 10 seconds"]').click().then(() => true).catch(() => false);
check('seek button clickable', seekButtonWorks);

// --- movie detail page renders its own embedded Player (InlinePlayer overlay is not routed) ---
await page.goto(BASE + '/movie/550', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForSelector('.player-root .player-controls', { timeout: 45000 }).catch(() => {});
check('movie embedded player renders', (await page.locator('.player-root .player-controls').count()) > 0);
const moviePlayToggled = await page
	.locator('.player-root .player-controls [aria-label="Play"]')
	.click()
	.then(() => true)
	.catch(() => false);
check('movie player play button clickable', moviePlayToggled);

check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));

await ctx.close();
await browser.close();

const passed = results.filter((r) => r.ok).length;
for (const r of results) {
	console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
