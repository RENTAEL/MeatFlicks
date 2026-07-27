import puppeteer from 'puppeteer';

const BASE_URL = process.argv[2] || 'http://localhost:5173';

const TEST_QUERIES = [
  'Interstellar',
  'Naruto',
  'Breaking Bad',
  'tt',
  'Inception',
  'attack on titan',
  '',
];

const ISSUES = [];
function log(level, msg) { ISSUES.push({ level, msg }); console.log(`[${level}] ${msg}`); }

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

try {
  console.log('\n═══ DESKTOP SEARCH AUDIT ═══\n');

  const desktop = await browser.newPage();
  await desktop.setViewport({ width: 1920, height: 1080 });

  console.log('\n--- Homepage ---');
  await desktop.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 45000 });
  console.log(`  ✅ Homepage loaded: ${desktop.url()}`);

  const searchInputExists = await desktop.$('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search"], input[name="q"], input[aria-label*="search" i], [data-testid="search-input"]');
  
  if (!searchInputExists) {
    log('CRITICAL', 'No search input found on homepage');
  } else {
    log('OK', `Search input found: ${await searchInputExists.evaluate(el => el.placeholder || el.name || el.id || 'unnamed')}`);
  }

  console.log('\n--- /search page ---');
  await desktop.goto(`${BASE_URL}/search`, { waitUntil: 'networkidle2', timeout: 45000 });

  desktop.on('console', msg => {
    if (msg.type() === 'error') log('ERROR', `Console: ${msg.text().substring(0, 120)}`);
  });

  const searchPageInput = await desktop.$('input[type="search"], input[placeholder*="search" i], input[type="text"]');

  if (!searchPageInput) log('CRITICAL', '/search page: No search input found');
  else log('OK', 'Search input present on /search page');

  for (const query of TEST_QUERIES.filter(q => q.length > 0)) {
    console.log(`\n--- Query: "${query}" ---`);

    if (searchPageInput) {
      await searchPageInput.click({ clickCount: 3 });
      await searchPageInput.press('Backspace');
      await searchPageInput.type(query, { delay: 80 });
    }

    await new Promise(r => setTimeout(r, 4000));

    const currentUrl = desktop.url();
    console.log(`  URL: ${currentUrl}`);

    let refreshCount = 0;
    desktop.on('framenavigated', () => refreshCount++);
    await new Promise(r => setTimeout(r, 3000));
    if (refreshCount > 3) {
      log('CRITICAL', `Query "${query}": INFINITE REFRESH LOOP detected (${refreshCount} navigations)`);
    }

    const results = await desktop.$$('.media-card');
    console.log(`  Visible cards: ${results.length}`);

    if (results.length === 0) {
      const errorMsg = await desktop.$eval('body', el => el.innerText).catch(() => '');
      if (errorMsg.includes('error') || errorMsg.includes('No results') || errorMsg.includes('failed')) {
        log('HIGH', `Query "${query}": No results, error: "${errorMsg.substring(0, 150)}"`);
      } else if (errorMsg.trim().length < 50) {
        log('HIGH', `Query "${query}": Page appears blank/empty`);
      } else {
        log('HIGH', `Query "${query}": No cards found`);
      }
    } else {
      log('OK', `Query "${query}": ${results.length} cards shown`);
    }

    if (results.length > 0) {
      const firstCard = results[0];
      const img = await firstCard.$('img');
      const title = await firstCard.$('h2, h3, [class*="title" i], p');
      
      if (!img) log('MEDIUM', 'First card has no image');
      else {
        const imgSrc = await img.evaluate(el => el.getAttribute('src'));
        if (!imgSrc || imgSrc === '') log('HIGH', 'First card image src is empty');
        else console.log(`  First card img: ${imgSrc.substring(0, 80)}`);
      }
      
      if (title) {
        const titleText = await title.evaluate(el => el.textContent.trim());
        console.log(`  First card title: "${titleText}"`);
      }
    }

    const hasDupError = await desktop.evaluate(() => {
      return document.body.innerText.includes('each_key_duplicate');
    });
    if (hasDupError) {
      log('CRITICAL', `Query "${query}": each_key_duplicate error on page`);
    }
  }

  console.log('\n\n═══ MOBILE SEARCH AUDIT (375x812) ═══\n');

  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

  await mobile.goto(`${BASE_URL}/search`, { waitUntil: 'networkidle2', timeout: 15000 });
  console.log('  ✅ /search loaded on mobile');

  await mobile.screenshot({ path: 'audit-mobile-search-initial.png', fullPage: false });
  console.log('  Screenshot saved: audit-mobile-search-initial.png');

  const mobileIssues = await mobile.evaluate(() => {
    const issues = [];
    const htmlWidth = document.documentElement.scrollWidth;
    const viewportWidth = window.innerWidth;
    if (htmlWidth > viewportWidth + 5) {
      issues.push(`Horizontal overflow: html is ${htmlWidth}px but viewport is ${viewportWidth}px (diff: ${htmlWidth - viewportWidth}px)`);
    }

    const input = document.querySelector('input[type="search"], input[placeholder*="search" i], input[type="text"]');
    if (input) {
      const rect = input.getBoundingClientRect();
      if (rect.width < 200) issues.push(`Search input too narrow: ${Math.round(rect.width)}px`);
      if (rect.left < 0) issues.push(`Search input off-screen left: left=${rect.left}px`);
      if (rect.right > viewportWidth) issues.push(`Search input overflows right: right=${rect.right}px vs viewport=${viewportWidth}`);
    } else {
      issues.push('CRITICAL: No search input found on mobile');
    }

    const cards = document.querySelectorAll('[class*="card" i], [class*="movie" i], .movie-grid > *');
    if (cards.length > 0) {
      const firstCard = cards[0].getBoundingClientRect();
      if (firstCard.width < 100) issues.push(`Cards too small: ${Math.round(firstCard.width)}px wide`);
      if (firstCard.width > viewportWidth) issues.push(`Card wider than viewport: ${Math.round(firstCard.width)}px vs ${viewportWidth}px`);
    }

    const bodyFontSize = parseFloat(getComputedStyle(document.body).fontSize);
    if (bodyFontSize < 14) issues.push(`Body font too small: ${bodyFontSize}px`);

    const buttons = document.querySelectorAll('button, a[class*="button"], [role="button"]');
    let smallTargets = 0;
    buttons.forEach(btn => {
      const rect = btn.getBoundingClientRect();
      if (rect.height > 0 && rect.height < 44) smallTargets++;
    });
    if (smallTargets > 2) issues.push(`${smallTargets} touch targets smaller than 44px`);

    return issues;
  });

  mobileIssues.forEach(issue => log('MOBILE', issue));

  const mobileInput = await mobile.$('input[type="search"], input[placeholder*="search" i], input[type="text"]');
  if (mobileInput) {
    await mobileInput.click({ clickCount: 3 });
    await mobileInput.press('Backspace');
    await mobileInput.type('Interstellar', { delay: 80 });
    await new Promise(r => setTimeout(r, 2000));

    await mobile.screenshot({ path: 'audit-mobile-search-results.png', fullPage: false });
    console.log('  Screenshot saved: audit-mobile-search-results.png');

    const overflowAfter = await mobile.evaluate(() => {
      return {
        htmlWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 5,
      };
    });
    if (overflowAfter.horizontalScroll) {
      log('MOBILE', `After search: horizontal overflow persists (html: ${overflowAfter.htmlWidth}px, viewport: ${overflowAfter.viewportWidth}px)`);
    }

    const resultCards = await mobile.$$('[class*="card" i], [class*="movie" i], .movie-grid > *');
    console.log(`  Mobile results for "Interstellar": ${resultCards.length} cards`);
    if (resultCards.length === 0) log('HIGH', 'Mobile: No search results visible');
  }

  console.log('\n\n═══ NETWORK AUDIT ═══\n');

  const apiPage = await browser.newPage();
  await apiPage.setViewport({ width: 1920, height: 1080 });

  const apiCalls = [];
  apiPage.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api/') || url.includes('tmdb') || url.includes('consumet') || url.includes('graphql') || url.includes('search')) {
      apiCalls.push({
        url: url.substring(0, 120),
        status: response.status(),
        ok: response.ok(),
      });
    }
  });

  await apiPage.goto(`${BASE_URL}/search`, { waitUntil: 'networkidle2', timeout: 15000 });

  const apiInput = await apiPage.$('input[type="search"]');
  if (apiInput) {
    await apiInput.type('Interstellar', { delay: 50 });
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log(`\nAPI calls made:`);
  apiCalls.forEach(call => {
    const emoji = call.ok ? '✅' : call.status >= 400 ? '❌' : '⚠️';
    console.log(`  ${emoji} ${call.status} ${call.url}`);
  });

  const failedCalls = apiCalls.filter(c => !c.ok);
  if (failedCalls.length > 0) {
    log('HIGH', `${failedCalls.length} API calls failed`);
    failedCalls.forEach(c => log('HIGH', `  Failed: [${c.status}] ${c.url}`));
  }

  if (apiCalls.length === 0) {
    log('CRITICAL', 'No API calls made when searching');
  }

} catch (err) {
  log('CRITICAL', `Audit crashed: ${err.message}`);
  console.error(err);
} finally {
  console.log('\n\n═════════════════════════════════════');
  console.log(' SEARCH AUDIT REPORT');
  console.log('═════════════════════════════════════\n');

  const criticals = ISSUES.filter(i => i.level === 'CRITICAL');
  const highs = ISSUES.filter(i => i.level === 'HIGH');
  const mediums = ISSUES.filter(i => i.level === 'MEDIUM');

  console.log(`CRITICAL: ${criticals.length}`);
  criticals.forEach(i => console.log(`  ❌ ${i.msg}`));
  
  console.log(`\nHIGH: ${highs.length}`);
  highs.forEach(i => console.log(`  ⚠️ ${i.msg}`));
  
  console.log(`\nMEDIUM: ${mediums.length}`);
  mediums.forEach(i => console.log(`  • ${i.msg}`));

  console.log(`\nTOTAL: ${ISSUES.length} issues`);
  console.log(`\nScreenshots:`);
  console.log(`  audit-mobile-search-initial.png`);
  console.log(`  audit-mobile-search-results.png`);

  await browser.close();
}
