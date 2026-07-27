const puppeteer = require('puppeteer');

const BASE = process.env.BASE_URL || 'http://localhost:5173';

const PAGES = [
  { name: 'Homepage', path: '/' },
  { name: 'Search', path: '/search' },
  { name: 'Movies Explore', path: '/explore/movies' },
  { name: 'TV Series', path: '/explore/tv-shows' },
  { name: 'Anime', path: '/anime' },
  { name: 'Movie Detail', path: '/movie/tt0816692' },
  { name: 'Anime Detail', path: '/anime/steel-ball-run' },
];

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const results = [];

  for (const pageInfo of PAGES) {
    console.log(`\n=== Testing: ${pageInfo.name} (${pageInfo.path}) ===`);
    const page = await browser.newPage();
    const pageResult = { name: pageInfo.name, path: pageInfo.path, issues: [], passed: [] };

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    try {
      await page.goto(`${BASE}${pageInfo.path}`, { waitUntil: 'networkidle2', timeout: 20000 });
    } catch (e) {
      pageResult.issues.push(`Navigation timeout or failed: ${e.message}`);
      results.push(pageResult);
      await page.close();
      continue;
    }

    await new Promise(r => setTimeout(r, 2000));

    const offlineText = await page.evaluate(() => document.body.innerText.includes("You're offline"));
    if (offlineText) {
      pageResult.issues.push('"You\'re offline" text found on page');
    } else {
      pageResult.passed.push('No offline banner found');
    }

    const loadingText = await page.evaluate(() => {
      const main = document.querySelector('main')?.innerText || document.body.innerText;
      const trimmed = main.trim();
      return trimmed === 'Loading...' && document.querySelectorAll('a, button, img').length < 3;
    });
    if (loadingText) pageResult.issues.push('Page stuck on "Loading..." with no content');
    else pageResult.passed.push('Not stuck on loading');

    const noItems = await page.evaluate(() => {
      return document.body.innerText.includes('No items found matching these filters') ||
        document.body.innerText.includes('No matches found');
    });
    const emptyMovie = await page.evaluate(() => {
      return document.body.innerText.includes('No titles just yet') ||
        document.body.innerText.includes('We couldn\'t find anything');
    });
    if (noItems && pageInfo.name === 'Search') {
      const hasSearchQuery = await page.evaluate(() => {
        const input = document.querySelector('input[type="search"], input[placeholder*="search" i]');
        return input ? (input).value.length > 0 : false;
      });
      if (!hasSearchQuery) pageResult.issues.push('Search shows "No items found" before user searched');
      else pageResult.passed.push('Search results area working');
    }
    if (emptyMovie) pageResult.issues.push('Movies/TV explore page is empty');

    const cardCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="/movie/"], a[href*="/anime/"], a[href*="/tv/"], .card, [class*="card"]').length;
    });
    if (cardCount > 0) {
      pageResult.passed.push(`Found ${cardCount} media cards/links`);
    } else if (['Homepage', 'Movies Explore', 'TV Series', 'Anime'].includes(pageInfo.name)) {
      pageResult.issues.push('No media cards found on page that should have content');
    }

    if (consoleErrors.length > 0) {
      const relevantErrors = consoleErrors.filter(e =>
        !e.includes('AudioContext') &&
        !e.includes('autoplay') &&
        !e.includes('favicon') &&
        !e.includes('apple-mobile-web-app')
      );
      if (relevantErrors.length > 0) {
        pageResult.issues.push(`Console errors: ${relevantErrors.slice(0, 5).join(' | ')}`);
      }
    }

    results.push(pageResult);
    await page.close();
  }

  console.log('\n\n========== AUDIT REPORT ==========\n');
  let totalIssues = 0;

  for (const r of results) {
    console.log(`\u25b8 ${r.name} (${r.path})`);
    if (r.issues.length === 0) {
      console.log('  \u2705 ALL CLEAR');
    } else {
      for (const issue of r.issues) {
        console.log(`  \u274c ${issue}`);
        totalIssues++;
      }
    }
    for (const pass of r.passed) {
      console.log(`  \u2713 ${pass}`);
    }
  }

  console.log(`\n========== ${totalIssues} issues remaining ==========\n`);

  await browser.close();
  return totalIssues;
}

run().then((issues) => {
  if (issues > 0) {
    console.log('\u26a0\ufe0f  Issues found \u2014 fix them before deploying.');
    process.exit(1);
  } else {
    console.log('\u2705 All pages pass. Safe to deploy.');
    process.exit(0);
  }
});
