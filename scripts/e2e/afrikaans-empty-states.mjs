import { chromium } from 'playwright';

const BASE = 'https://streamium-cosmic.vercel.app';
let failed = 0;
function check(name, ok, detail = '') {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
	if (!ok) failed++;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(BASE + '/afrikaans', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);

// Dismiss the intermittent full-screen popup if shown (its backdrop intercepts clicks)
await page.locator('.popup-close').click({ timeout: 1500 }).catch(() => {});

// Rails populated (empty-state variant must NOT show)
const railEmptyCount = await page.locator('text=Nog geen onlangse films nie').count();
check('rails populated, no empty-state variant', railEmptyCount === 0, `${railEmptyCount} empty states found`);

// Search gibberish -> empty state appears
await page.fill('.search-input', 'zzzzqqqq');
await page.waitForTimeout(800);
const emptyTitle = await page.textContent('.empty-state__title').catch(() => '');
check('search empty state shows bilingual title', emptyTitle.includes('Geen resultate') && emptyTitle.includes('No results'), emptyTitle);

const clearBtn = page.locator('.empty-state__action');
check('clear button visible', await clearBtn.isVisible(), 'Maak skoon / Clear');
const subtitle = await page.textContent('.empty-state__subtitle').catch(() => '');
check('subtitle bilingual', subtitle.includes('Probeer') && subtitle.includes('Try a different search'), subtitle);

// Icon is search variant
const iconSvg = await page.locator('.empty-state__icon svg').count();
check('search icon rendered', iconSvg === 1);

// Click Clear -> grid returns
await clearBtn.click();
await page.waitForTimeout(800);
const gridCards = await page.evaluate(
	() => document.querySelectorAll('a[href^="/afrikaans/"]').length
);
check('clear restores grid', gridCards > 20, `${gridCards} cards`);
check('input cleared', (await page.inputValue('.search-input')) === '');

await browser.close();
console.log(failed === 0 ? '\nEMPTY STATES GREEN' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);