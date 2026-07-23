import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const BASE_URL = 'https://streamium-cosmic.vercel.app';

const ROUTES = [
  { name: 'Homepage', path: '/' },
  { name: 'Movies', path: '/movies' },
  { name: 'TV Shows', path: '/tv-shows' },
  { name: 'Anime', path: '/anime' },
  { name: 'Search', path: '/search' },
];

const REPORT = { timestamp: new Date().toISOString(), baseUrl: BASE_URL, issues: [], pages: [] };

async function crawl() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Prevent OfflineIndicator from false-triggering in headless env
  // Use a simpler approach — just stub navigator.onLine via page context after each navigation
  // (full evaluateOnNewDocument can interfere with SvelteKit hydration in some cases)

  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push({ text: msg.text() }); });
  page.on('requestfailed', (req) => { failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }); });

  for (const route of ROUTES) {
    console.log(`Testing: ${route.name}`);
    const pageIssues = [];
    consoleErrors.length = 0;
    failedRequests.length = 0;

    try {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
      pageIssues.push({ severity: 'CRITICAL', detail: `Page failed to load: ${e.message}` });
      REPORT.pages.push({ route: route.name, issues: pageIssues, status: 'FAILED' });
      continue;
    }

    // Stub navigator.onLine after each nav to avoid OfflineIndicator false-triggers
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
    }).catch(() => {});

    // Wait for either media cards or the page body to be present
    await Promise.race([
      page.waitForSelector('.media-card', { timeout: 8000 }).catch(() => {}),
      page.waitForSelector('body', { timeout: 8000 }).catch(() => {}),
    ]);
    await sleep(1500);

    // Offline check — only flag if we're on the actual offline page, not just the indicator
    const isOfflinePage = page.url().includes('/offline') || await page.$('[class*="offline-page"]').catch(() => null);
    if (isOfflinePage) {
      pageIssues.push({ severity: 'CRITICAL', detail: 'Offline page shown — service worker still active or network issue' });
    }

    // Card count
    const cardCount = await page.$$eval('[class*="card"], [class*="Card"], [class*="movie"], [class*="poster"], a[href*="/movie/"], a[href*="/tv/"]', els => els.length);
    console.log(`  Cards: ${cardCount}`);

    if (route.name === 'Homepage' && cardCount === 0) pageIssues.push({ severity: 'CRITICAL', detail: 'Homepage has zero cards' });
    if (route.name === 'Movies' && cardCount <= 3) pageIssues.push({ severity: 'CRITICAL', detail: `Movies page has ${cardCount} cards — should be ~20` });
    if (route.name === 'TV Shows' && cardCount <= 3) pageIssues.push({ severity: 'CRITICAL', detail: `TV page has ${cardCount} cards — should be ~20` });

    // Card clickability — try clicking the first visible card area (skip Search: cards here are results, clicking navigates away)
    const cardAreas = await page.$$('.media-card');
    if (cardAreas.length > 0 && route.name !== 'Search') {
      const preUrl = page.url();
      try {
        // Click the poster area which is an <a> tag now
        const firstPosterLink = await page.$('.media-card a[href*="/movie/"], .media-card a[href*="/tv/"]');
        if (firstPosterLink) {
          await Promise.all([page.waitForNavigation({ timeout: 10000 }), firstPosterLink.click()]);
          if (page.url() === preUrl) pageIssues.push({ severity: 'HIGH', detail: 'Clicking card does not navigate' });
          else {
            // Wait for dynamic imports (MediaDetailsPage is lazy-loaded)
            await sleep(2000);
            const hasTitle = await page.$eval('h1, h2, [class*="title"]', () => true).catch(() => false);
            if (!hasTitle) pageIssues.push({ severity: 'MEDIUM', detail: 'Detail page has no title' });
            await page.goBack();
          }
        } else {
          pageIssues.push({ severity: 'HIGH', detail: 'Cards present but no clickable links found' });
        }
      } catch (e) { pageIssues.push({ severity: 'HIGH', detail: `Navigation failed: ${e.message}` }); }
    }

    // Search test
    if (route.name === 'Search') {
      const input = await page.$('input[type="text"], input[type="search"]');
      if (!input) {
        pageIssues.push({ severity: 'HIGH', detail: 'No search input found' });
      } else {
        await input.type('Interstellar');
        await page.keyboard.press('Enter');
        await sleep(3000);
        const results = await page.$$eval('[class*="card"], [class*="result"]', els => els.length);
        if (results === 0) pageIssues.push({ severity: 'CRITICAL', detail: 'Search returned zero results' });
      }
    }

    // Service worker errors
    const swErrors = consoleErrors.filter(e => e.text.includes('service-worker') || e.text.includes('Failed to fetch'));
    if (swErrors.length > 0) pageIssues.push({ severity: 'CRITICAL', detail: 'Service worker errors in console' });

    // API failures
    const apiFails = failedRequests.filter(r => r.url.includes('api') || r.url.includes('tmdb'));
    if (apiFails.length > 0) pageIssues.push({ severity: 'HIGH', detail: `${apiFails.length} API requests failed` });

    // Mobile check
    await page.setViewport({ width: 375, height: 812 });
    await sleep(1000);
    const hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (hasScroll) pageIssues.push({ severity: 'MEDIUM', detail: 'Horizontal scroll on mobile' });
    await page.setViewport({ width: 1280, height: 800 });

    REPORT.pages.push({ route: route.name, path: route.path, status: 'OK', cardCount, issues: pageIssues });
    pageIssues.forEach(i => console.log(`  [${i.severity}] ${i.detail}`));
    REPORT.issues.push(...pageIssues.map(i => ({ ...i, page: route.name })));
  }

  REPORT.summary = {
    total: REPORT.issues.length,
    critical: REPORT.issues.filter(i => i.severity === 'CRITICAL').length,
    high: REPORT.issues.filter(i => i.severity === 'HIGH').length,
    medium: REPORT.issues.filter(i => i.severity === 'MEDIUM').length,
  };

  writeFileSync('audit-report.json', JSON.stringify(REPORT, null, 2));
  console.log(`\nReport: ${REPORT.summary.critical} critical, ${REPORT.summary.high} high, ${REPORT.summary.medium} medium`);
  await browser.close();
  return REPORT;
}

crawl().then(r => process.exit(r.summary.critical > 0 ? 1 : 0)).catch(e => { console.error(e); process.exit(1); });
