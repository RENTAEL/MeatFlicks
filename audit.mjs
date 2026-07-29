import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

const BASE = 'https://streamium-cosmic.vercel.app';
const PAGES = [
  { name: 'Home', path: '/' },
  { name: 'Movies', path: '/movies' },
  { name: 'TV Shows', path: '/tv' },
  { name: 'Afrikaans', path: '/afrikaans' },
  { name: 'Login', path: '/login' },
  { name: 'Signup', path: '/signup' },
  { name: '404 (non-existent)', path: '/this-is-not-a-real-page-12345' },
  { name: 'Watchlist', path: '/watchlist' },
  { name: 'History', path: '/history' },
];

let results = [];
let errors = [];

async function auditPage(page, { name, path }) {
  const url = `${BASE}${path}`;
  console.log(`\n━━━ ${name} ━━━`);
  console.log(`  URL: ${url}`);

  const consoleEntries = [];
  let pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleEntries.push(`CONSOLE ERROR: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  page.on('response', resp => {
    if (!resp.ok() && resp.status() >= 400) {
      consoleEntries.push(`HTTP ${resp.status()}: ${resp.url()}`);
    }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    // extra wait for any lazy-loaded content
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
  } catch (e) {
    errors.push(`  ✗ NAV ERROR: ${name} — ${e.message}`);
    return { name, url, errors: [`Navigation timeout or failure: ${e.message}`] };
  }

  // Collect diagnostics
  const diagnostics = { errors: [...consoleEntries, ...pageErrors] };

  // Check no sidebar
  const hasSidebar = await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="sidebar"], [class*="side-nav"], [class*="Sidebar"]');
    // Allow shadcn sidebar UI primitives but not the main nav sidebar
    return els.length > 0;
  });

  // Check main content is full width
  const layoutWidth = await page.evaluate(() => {
    const main = document.querySelector('main') || document.querySelector('[class*="flex-1"]');
    if (!main) return 'unknown';
    const rect = main.getBoundingClientRect();
    return `${Math.round(rect.width)}px`;
  });

  // Check GavinBadge exists
  const hasGavinBadge = await page.evaluate(() => {
    const btn = document.querySelector('[class*="gavin-badge"], [aria-label*="Made by Gavin"]');
    return !!btn;
  });

  // Check footer has Gavin credit
  const hasGavinCredit = await page.evaluate(() => {
    const body = document.body.innerText;
    return body.includes('Gavin') && body.includes('Crafted');
  });

  // Check for console Easter egg
  const hasConsoleEgg = await page.evaluate(() => {
    return !!document.querySelector('script') ? 'yes (script present)' : 'unable to verify runtime console';
  });

  const status = diagnostics.errors.length === 0 ? '✅ PASS' : '⚠️  ISSUES';

  console.log(`  Status: ${status}`);
  console.log(`  Layout width: ${layoutWidth}${hasSidebar ? ' ⚠️ sidebar elements found' : ''}`);
  console.log(`  GavinBadge: ${hasGavinBadge ? '✅' : '❌'}`);
  console.log(`  Gavin credit: ${hasGavinCredit ? '✅' : '❌'}`);

  if (diagnostics.errors.length > 0) {
    diagnostics.errors.forEach(e => console.log(`    └ ${e}`));
  }

  return { name, url, layoutWidth, hasSidebar, hasGavinBadge, hasGavinCredit, hasConsoleEgg, errors: diagnostics.errors };
}

(async () => {
  console.log('═══════════════════════════════════════');
  console.log('   STREAMIUM PRODUCTION AUDIT');
  console.log('═══════════════════════════════════════\n');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  for (const p of PAGES) {
    const r = await auditPage(page, p);
    results.push(r);
  }

  await browser.close();

  console.log('\n═══════════════════════════════════════');
  console.log('   SUMMARY');
  console.log('═══════════════════════════════════════\n');

  let passCount = 0;
  for (const r of results) {
    const icon = r.errors.length === 0 ? '✅' : '⚠️';
    console.log(`  ${icon}  ${r.name} — ${r.errors.length} issues`);
    if (r.errors.length === 0) passCount++;
  }

  console.log(`\n  Passed: ${passCount}/${results.length}`);
  console.log(`\n  GavinBadge present: ${results.every(r => r.hasGavinBadge) ? '✅ on all pages' : '⚠️  missing on some'}`);
  console.log(`  Gavin credit in footer: ${results.filter(r => r.hasGavinCredit).length}/${results.length} pages`);

  console.log('\n═══════════════════════════════════════\n');
})();
