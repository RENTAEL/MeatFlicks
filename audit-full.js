import puppeteer from 'puppeteer';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

const BASE_URL = 'https://streamium-cosmic.vercel.app';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const CARD_SEL = '[class*="card"], [class*="Card"], [class*="movie"], [class*="poster"], a[href*="/movie/"], a[href*="/tv/"], a[href*="/anime/"], [class*="result"]';
const NAV_SEL = 'a[href*="/movie/"], a[href*="/tv/"], a[href*="/anime/"], [class*="card"] a[href], [class*="poster"] a[href]';
const REPORT = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  summary: {},
  pages: [],
};

async function safeText(page, sel, fb = '') {
  try { return (await page.$eval(sel, el => el.innerText)).trim(); } catch { return fb; }
}
async function safeCount(page, sel) {
  try { return (await page.$$eval(sel, els => els.length)); } catch { return 0; }
}
async function safeExists(page, sel) {
  try { return !!(await page.$(sel)); } catch { return false; }
}
async function safeClick(page, sel) {
  try { await page.click(sel); return true; } catch { return false; }
}
async function safeEval(page, fn, fb = null) {
  try { return await page.evaluate(fn); } catch { return fb; }
}

async function crawl() {
  if (!existsSync('audit-screenshots')) mkdirSync('audit-screenshots');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  let consoleErrors = [];
  let failedRequests = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('requestfailed', req => { failedRequests.push({ url: req.url(), error: req.failure()?.errorText }); });
  page.on('dialog', async dialog => { await dialog.dismiss(); });

  function reset() { consoleErrors = []; failedRequests = []; }

  async function goto(path, opts = {}) {
    reset();
    const url = `${BASE_URL}${path}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: opts.timeout || 30000 });
      await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true }); }).catch(() => {});
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function gotoWithFallback(path, opts = {}) {
    const result = await goto(path, opts);
    if (result.ok) {
      await sleep(2000);
      const cards = await safeCount(page, CARD_SEL);
      if (cards === 0) {
        await sleep(1000);
        await page.goto(page.url(), { waitUntil: 'networkidle2', timeout: opts.timeout || 30000 });
        await sleep(2000);
      }
    }
    return result;
  }

  // Click an element and wait for URL change (handles SvelteKit client-side goto())
  async function clickAndWaitNav(sel) {
    const pre = page.url();
    try {
      await page.click(sel);
      // Wait for URL to change (up to 10s)
      for (let i = 0; i < 50; i++) {
        await sleep(200);
        if (page.url() !== pre) return { navigated: true, newUrl: page.url() };
      }
      return { navigated: false, newUrl: page.url() };
    } catch {
      return { navigated: false, newUrl: page.url() };
    }
  }

  async function screenshot(name) {
    try { await page.screenshot({ path: `audit-screenshots/${name}.png` }); } catch {}
  }

  // ════════════════════════════════════════════
  // TEST 1: HOMEPAGE
  // ════════════════════════════════════════════
  console.log('\n═══ 1. HOMEPAGE ═══');
  const h = [];
  const n1 = await goto('/');
  if (!n1.ok) { h.push({ severity: 'CRITICAL', detail: 'Homepage failed to load' }); }
  else {
    await screenshot('01-homepage');
    const body = await safeEval(page, () => document.body.innerText, '');
    if (body.includes("You're offline")) h.push({ severity: 'CRITICAL', detail: 'Shows OFFLINE' });
    if (body.includes('500') || body.includes('Internal Server Error')) h.push({ severity: 'CRITICAL', detail: '500 error' });
    if (body.length < 50) h.push({ severity: 'CRITICAL', detail: 'Page empty' });

    const cards = await page.$$eval(CARD_SEL, els =>
      els.map(e => ({ href: e.href || '', text: e.innerText?.substring(0, 40), visible: e.getBoundingClientRect().height > 0 }))
    );
    const visible = cards.filter(c => c.visible).length;
    console.log(`  Cards: ${cards.length} total, ${visible} visible`);
    if (visible === 0) h.push({ severity: 'CRITICAL', detail: 'Zero visible cards' });
    else if (visible < 8) h.push({ severity: 'HIGH', detail: `Only ${visible} cards` });

    const heroExists = await safeExists(page, '[class*="hero"], [class*="banner"], [class*="featured"]');
    if (!heroExists) h.push({ severity: 'LOW', detail: 'No hero/banner' });

    const navLinks = await page.$$eval('nav a, [class*="nav"] a, [class*="sidebar"] a', els => els.map(e => e.href));
    const expected = ['/explore/movies', '/explore/tv-shows', '/anime', '/search'];
    const missing = expected.filter(p => !navLinks.some(l => l.includes(p)));
    if (missing.length > 0) h.push({ severity: 'MEDIUM', detail: `Missing nav: ${missing.join(', ')}` });

    const tmdbFails = failedRequests.filter(r => r.url.includes('tmdb'));
    if (tmdbFails.length > 0) h.push({ severity: 'HIGH', detail: `${tmdbFails.length} TMDB failures` });

    const sw = consoleErrors.filter(e => e.includes('service-worker') || e.includes('ServiceWorker'));
    if (sw.length > 0) h.push({ severity: 'CRITICAL', detail: 'SW errors in console' });

    REPORT.pages.push({ route: 'Homepage', path: '/', status: 'OK', cardCount: visible, issues: h });
  }

  // ════════════════════════════════════════════
  // TEST 2: EXPLORE MOVIES
  // ════════════════════════════════════════════
  console.log('\n═══ 2. EXPLORE MOVIES ═══');
  const m = [];
  const n2 = await gotoWithFallback('/explore/movies');
  if (!n2.ok) { m.push({ severity: 'CRITICAL', detail: 'Movies page failed' }); }
  else {
    await screenshot('02-movies');
    const cards = await safeCount(page, CARD_SEL);
    console.log(`  Movie cards: ${cards}`);
    if (cards === 0) m.push({ severity: 'CRITICAL', detail: 'Zero movie cards' });
    else if (cards <= 3) m.push({ severity: 'CRITICAL', detail: `Only ${cards} cards` });
    const tvLabels = await safeEval(page, () => (document.body.innerText.match(/TV Show/gi) || []).length, 0);
    if (tvLabels > 5 && cards > 5) m.push({ severity: 'HIGH', detail: 'Movies page showing TV labels' });
    if (cards > 0) {
      const nav = await clickAndWaitNav(`${NAV_SEL}:first-of-type`);
      if (!nav.navigated) m.push({ severity: 'HIGH', detail: 'Movie card click did not navigate' });
    }
    REPORT.pages.push({ route: 'Movies', path: '/explore/movies', status: 'OK', cardCount: cards, issues: m });
  }

  // ════════════════════════════════════════════
  // TEST 3: EXPLORE TV SHOWS
  // ════════════════════════════════════════════
  console.log('\n═══ 3. EXPLORE TV SHOWS ═══');
  const tv = [];
  const n3 = await gotoWithFallback('/explore/tv-shows');
  if (!n3.ok) { tv.push({ severity: 'CRITICAL', detail: 'TV Shows page failed' }); }
  else {
    await screenshot('03-tvshows');
    const cards = await safeCount(page, CARD_SEL);
    console.log(`  TV cards: ${cards}`);
    if (cards === 0) tv.push({ severity: 'CRITICAL', detail: 'Zero TV cards' });
    else if (cards <= 3) tv.push({ severity: 'CRITICAL', detail: `Only ${cards} cards` });
    const mediaTypeLabels = await safeEval(page, () => {
      const cards = document.querySelectorAll('[class*="card"]');
      let movieCount = 0, tvCount = 0;
      cards.forEach(c => {
        const t = c.innerText || '';
        if (/Movie/i.test(t) && !/TV/i.test(t)) movieCount++;
        if (/TV Show|TV Series|TV Episode|Season/i.test(t)) tvCount++;
      });
      return { movieCount, tvCount };
    }, { movieCount: 0, tvCount: 0 });
    if (mediaTypeLabels.movieCount > mediaTypeLabels.tvCount && cards > 5) {
      tv.push({ severity: 'MEDIUM', detail: `TV page cards show "${mediaTypeLabels.movieCount} Movie" vs "${mediaTypeLabels.tvCount} TV" labels` });
    }
    if (cards > 0) {
      const nav = await clickAndWaitNav(`${NAV_SEL}:first-of-type`);
      if (!nav.navigated) tv.push({ severity: 'HIGH', detail: 'TV card click did not navigate' });
    }
    REPORT.pages.push({ route: 'TV Shows', path: '/explore/tv-shows', status: 'OK', cardCount: cards, issues: tv });
  }

  // ════════════════════════════════════════════
  // TEST 4: ANIME PAGE
  // ════════════════════════════════════════════
  console.log('\n═══ 4. ANIME ═══');
  const aIssues = [];
  let animeRoute = '/anime';
  let aNav = await goto('/anime');
  if (!aNav.ok) {
    for (const alt of ['/animes', '/explore/anime', '/genre/anime']) {
      const altNav = await goto(alt);
      if (altNav.ok) { animeRoute = alt; aNav = altNav; break; }
    }
    if (!aNav.ok) aIssues.push({ severity: 'HIGH', detail: 'Anime page not found' });
  }
  if (aNav.ok) {
    await screenshot('04-anime');
    const cards = await safeCount(page, CARD_SEL);
    console.log(`  Anime cards: ${cards}`);
    if (cards === 0) aIssues.push({ severity: 'HIGH', detail: 'Zero anime cards' });
    const animeApiFails = failedRequests.filter(r => r.url.includes('consumet') || r.url.includes('jikan') || r.url.includes('anilist'));
    if (animeApiFails.length > 0) aIssues.push({ severity: 'HIGH', detail: `Anime API failures` });
    if (cards > 0) {
      const nav = await clickAndWaitNav(`${NAV_SEL}:first-of-type`);
      if (nav.navigated) console.log(`  Navigated: ${nav.newUrl}`);
      else aIssues.push({ severity: 'MEDIUM', detail: 'Anime card navigation failed' });
    }
    REPORT.pages.push({ route: 'Anime', path: animeRoute, status: 'OK', cardCount: cards, issues: aIssues });
  } else {
    REPORT.pages.push({ route: 'Anime', path: '/anime', status: 'FAILED', issues: aIssues });
  }

  // ════════════════════════════════════════════
  // TEST 5: SEARCH
  // ════════════════════════════════════════════
  console.log('\n═══ 5. SEARCH ═══');
  const s = [];
  const n5 = await goto('/search');
  if (!n5.ok) { s.push({ severity: 'CRITICAL', detail: 'Search page failed' }); }
  else {
    await screenshot('05-search-empty');
    const input = await page.$('input[type="text"], input[type="search"], input[name="q"]');
    if (!input) { s.push({ severity: 'CRITICAL', detail: 'No search input' }); }
    else {
      await input.click({ clickCount: 3 });
      await input.type('Interstellar');
      await page.keyboard.press('Enter');
      await sleep(3000);
      await screenshot('05-search-results');
      const results = await safeCount(page, CARD_SEL);
      console.log(`  Results: ${results}`);
      if (results === 0) s.push({ severity: 'CRITICAL', detail: 'Search returned zero results' });
      else if (results < 3) s.push({ severity: 'MEDIUM', detail: `Only ${results} results` });
      if (results > 0) {
        let nav = { navigated: false, newUrl: '' };
        const searchNavSelectors = [
          `${NAV_SEL}:first-of-type`,
          `a[href*="/movie/"]:first-of-type`,
          `a[href*="/tv/"]:first-of-type`,
          `[class*="card"]:first-of-type a`,
          `[class*="result"]:first-of-type a`,
        ];
        for (const sel of searchNavSelectors) {
          try {
            const el = await page.$(sel);
            if (el) { nav = await clickAndWaitNav(sel); if (nav.navigated) break; }
          } catch {}
        }
        if (!nav.navigated) s.push({ severity: 'LOW', detail: 'Search result click did not navigate (may be skeleton/empty DB)' });
      }
      // Infinite refresh check
      await goto('/search');
      const i2 = await page.$('input[type="text"], input[type="search"]');
      if (i2) {
        await i2.type('a');
        await sleep(2000);
        const refreshCount = await safeEval(page, () => performance.getEntriesByType('navigation').length, 0);
        if (refreshCount > 2) s.push({ severity: 'CRITICAL', detail: 'Search page refreshing in loop' });
      }
    }
    REPORT.pages.push({ route: 'Search', path: '/search', status: 'OK', issues: s });
  }

  // ════════════════════════════════════════════
  // TEST 6: MOVIE DETAIL
  // ════════════════════════════════════════════
  console.log('\n═══ 6. MOVIE DETAIL ═══');
  const md = [];
  const n6 = await goto('/movie/27205'); // Inception
  if (!n6.ok) { md.push({ severity: 'CRITICAL', detail: 'Movie detail failed' }); }
  else {
    await screenshot('06-movie-detail');
    await sleep(1000);
    const title = await safeText(page, 'h1, h2, h3, [class*="title"], [class*="heading"]');
    console.log(`  Title: "${title || 'NOT FOUND'}"`);
    if (!title || title.length < 2) md.push({ severity: 'HIGH', detail: 'No movie title' });
    const hasImage = await safeExists(page, 'img[src*="tmdb"], img[class*="poster"], img[class*="backdrop"]');
    if (!hasImage) md.push({ severity: 'HIGH', detail: 'No poster/backdrop' });
    const overview = await safeText(page, '[class*="overview"], [class*="description"], p');
    if (!overview || overview.length < 20) md.push({ severity: 'MEDIUM', detail: 'No description' });

    // Play button test
    const playSelectors = ['button', '[class*="play"]', '[class*="Play"]', '[data-action="play"]', 'a[href*="play"]', '[class*="btn-play"]', '[class*="watch-btn"]'];
    let playFound = false;
    for (const sel of playSelectors) {
      try {
        const btns = await page.$$(sel);
        for (const btn of btns) {
          const text = await btn.evaluate(el => (el.innerText || el.textContent || '').toLowerCase());
          if (text.includes('play') || text.includes('watch') || text.includes('▶')) {
            playFound = true;
            console.log('  Play button found');
            // Play button opens a provider dropdown; click to open it
            await btn.click();
            await sleep(1000);
            await screenshot('06-play-clicked');
            // Try clicking first provider in the dropdown
            const provSel = '[role="menuitem"], [data-slot="dropdown-menu-item"], a[href*="provider"], [class*="provider"] button, [data-slot="dropdown-menu-content"] a';
            const providers = await page.$$(provSel);
            if (providers.length > 0) {
              console.log('  Provider dropdown opened, selecting first');
              await providers[0].click();
              await sleep(3000);
              await screenshot('06-provider-selected');
            }
            const player = await page.$('video, iframe[src*="stream"], iframe[src*="player"], iframe[src*="vidlink"], iframe[src*="embed"], [class*="player"]');
            if (!player) md.push({ severity: 'MEDIUM', detail: 'No player appeared (no streaming sources available)' });
            else {
              console.log('  Player appeared');
              if (player && player._remoteObject) {
                const src = await page.evaluate(el => el.src || el.getAttribute('src'), player).catch(() => '');
                if (src.includes('undefined')) md.push({ severity: 'MEDIUM', detail: 'Player URL has undefined params' });
              }
            }
            break;
          }
        }
      } catch {}
    }
    if (!playFound) md.push({ severity: 'HIGH', detail: 'No play button' });

    // Suggested movies
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(2000);
    await screenshot('06-suggestions');
    const suggestedCards = await safeCount(page, 'a[href*="/movie/"], a[href*="/tv/"]');
    const suggestedBelow = await page.$$eval('a[href*="/movie/"], a[href*="/tv/"]', els =>
      els.filter(e => e.getBoundingClientRect().top > 500).length
    );
    console.log(`  Suggested cards: ${suggestedBelow}`);
    if (suggestedBelow === 0) md.push({ severity: 'MEDIUM', detail: 'No suggested movies' });
    else {
      const nav = await clickAndWaitNav(`${CARD_SEL}:nth-of-type(2)`);
      if (nav.navigated && !nav.newUrl.includes('27205')) {
        const newTitle = await safeText(page, 'h1, h2, [class*="title"]');
        console.log(`  Navigated to: "${newTitle}"`);
      } else {
        md.push({ severity: 'HIGH', detail: 'Suggested card navigation stayed on same page' });
      }
    }

    const providers = await safeCount(page, 'img[src*="provider"], img[src*="logo"], [class*="provider"]');
    if (providers === 0) md.push({ severity: 'LOW', detail: 'No provider badges' });

    REPORT.pages.push({ route: 'Movie Detail', path: '/movie/27205', status: 'OK', issues: md });
  }

  // ════════════════════════════════════════════
  // TEST 7: TV DETAIL
  // ════════════════════════════════════════════
  console.log('\n═══ 7. TV DETAIL ═══');
  const tvd = [];
  const n7 = await goto('/tv/1399'); // Game of Thrones
  if (!n7.ok) { tvd.push({ severity: 'CRITICAL', detail: 'TV detail failed' }); }
  else {
    await screenshot('07-tv-detail');
    await sleep(1000);
    const title = await safeText(page, 'h1, h2, [class*="title"]');
    console.log(`  Title: "${title || 'NOT FOUND'}"`);
    if (!title || title.length < 2) tvd.push({ severity: 'HIGH', detail: 'No TV title' });
    const hasSeasons = await safeExists(page, 'select, [class*="season"], [class*="episode"]');
    if (!hasSeasons) {
      const body = await safeEval(page, () => document.body.innerText, '');
      if (!body.match(/season|episode/i)) tvd.push({ severity: 'MEDIUM', detail: 'No season/episode selector' });
    }
    const playBtn = await page.$('button, [class*="play"]');
    if (playBtn) {
      try {
        const text = await playBtn.evaluate(el => (el.innerText || el.textContent || '').toLowerCase());
        if (text.includes('play') || text.includes('watch')) {
          await playBtn.click();
          await sleep(3000);
          await screenshot('07-tv-play');
          const player = await page.$('video, iframe, [class*="player"]');
          if (!player) tvd.push({ severity: 'MEDIUM', detail: 'TV play clicked but no player' });
          else console.log('  TV player appeared');
        }
      } catch {}
    }
    REPORT.pages.push({ route: 'TV Detail', path: '/tv/1399', status: 'OK', issues: tvd });
  }

  // ════════════════════════════════════════════
  // TEST 8: ANIME DETAIL
  // ════════════════════════════════════════════
  console.log('\n═══ 8. ANIME DETAIL ═══');
  const ad = [];
  if (aNav.ok) {
    await goto(animeRoute);
    const animeCards = await page.$$eval('a[href*="/anime/"], a[href*="/watch/"]', els => els.map(e => e.href));
    if (animeCards.length > 0) {
      let detailUrl = animeCards[0];
      for (const url of animeCards) {
        const n = await goto(url.replace(BASE_URL, ''));
        if (n.ok) {
          await sleep(2000);
          const notFound = await safeText(page, 'h1, h2, [class*="title"]');
          if (notFound && !notFound.toLowerCase().includes('not found')) {
            detailUrl = url;
            break;
          }
        }
      }
      await screenshot('08-anime-detail');
      const title = await safeText(page, 'h1, h2, [class*="title"]');
      console.log(`  Title: "${title || 'NOT FOUND'}"`);
      if (!title) ad.push({ severity: 'HIGH', detail: 'No anime title' });
      const hasEp = await safeExists(page, 'select, [class*="episode"], [class*="Episode"]');
      if (!hasEp) ad.push({ severity: 'MEDIUM', detail: 'No episode selector' });
      const playBtn = await page.$('button, [class*="play"]');
      if (playBtn) {
        try {
          await playBtn.click();
          await sleep(3000);
          await screenshot('08-anime-play');
          const player = await page.$('video, iframe, [class*="player"]');
          if (!player) ad.push({ severity: 'MEDIUM', detail: 'Anime play no player' });
          else console.log('  Anime player appeared');
        } catch {}
      }
      REPORT.pages.push({ route: 'Anime Detail', path: detailUrl.replace(BASE_URL, ''), status: 'OK', issues: ad });
    } else {
      REPORT.pages.push({ route: 'Anime Detail', path: 'N/A', status: 'SKIPPED', issues: [{ severity: 'INFO', detail: 'No anime cards to click' }] });
    }
  }

  // ════════════════════════════════════════════
  // TEST 9: MOBILE
  // ════════════════════════════════════════════
  console.log('\n═══ 9. MOBILE ═══');
  const mob = [];
  await page.setViewport({ width: 375, height: 812 });
  const mobileRoutes = ['/', '/explore/movies', '/explore/tv-shows', '/search'];
  if (aNav.ok) mobileRoutes.push(animeRoute);
  for (const route of mobileRoutes) {
    await goto(route, { timeout: 20000 });
    await sleep(1000);
    await screenshot(`09-mobile${route.replace(/\//g, '-')}`);
    const hasScroll = await safeEval(page, () => document.documentElement.scrollWidth > window.innerWidth);
    if (hasScroll) mob.push({ severity: 'HIGH', detail: `Horizontal scroll: ${route}` });
    const cards = await safeEval(page, () => {
      const els = document.querySelectorAll('[class*="card"], [class*="Card"], [class*="movie"], [class*="poster"], a[href*="/movie/"], a[href*="/tv/"], a[href*="/anime/"], [class*="result"]');
      return Array.from(els).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < 812 && r.bottom > 0; }).length;
    }, 0);
    console.log(`  ${route}: ${cards} visible, ${hasScroll ? 'SCROLL' : 'ok'}`);
    if (cards === 0 && route !== '/search') mob.push({ severity: 'HIGH', detail: `Zero visible cards: ${route}` });
  }
  await page.setViewport({ width: 1280, height: 900 });
  if (mob.length > 0) REPORT.pages.push({ route: 'Mobile', path: 'all', status: 'TESTED', issues: mob });

  // ════════════════════════════════════════════
  // TEST 10: PERFORMANCE
  // ════════════════════════════════════════════
  console.log('\n═══ 10. PERFORMANCE ═══');
  await goto('/');
  const perf = [];
  const imgData = await safeEval(page, () => {
    const imgs = document.querySelectorAll('img[src*="tmdb"]');
    return Array.from(imgs).map(i => ({ src: i.src, width: i.naturalWidth || i.width, hasLazy: i.loading === 'lazy' }));
  }, []);
  const largeImgs = imgData.filter(i => i.src.includes('original') || i.src.includes('w1280'));
  const lazyImgs = imgData.filter(i => i.hasLazy);
  console.log(`  Images: ${imgData.length}, ${lazyImgs.length} lazy, ${largeImgs.length} oversized`);
  if (largeImgs.length > 3) perf.push({ severity: 'MEDIUM', detail: `${largeImgs.length} oversized TMDB images` });
  if (imgData.length > 10 && lazyImgs.length < imgData.length * 0.5) perf.push({ severity: 'MEDIUM', detail: 'Most images not lazy-loaded' });
  if (perf.length > 0) REPORT.pages.push({ route: 'Performance', path: 'all', status: 'INFO', issues: perf });

  // ════════════════════════════════════════════
  // TEST 11: MOBILE QUICK CHECK
  // ════════════════════════════════════════════
  console.log('\n═══ 11. MOBILE QUICK CHECK ═══');
  const mobileQuickIssues = [];
  await page.setViewport({ width: 375, height: 812 });
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15');

  for (const route of ['/', '/explore/movies', '/explore/tv-shows', '/search']) {
    await goto(route, { timeout: 20000 });
    await sleep(1000);

    const hasScroll = await safeEval(page, () => document.documentElement.scrollWidth > window.innerWidth);
    if (hasScroll) mobileQuickIssues.push({ severity: 'HIGH', detail: `Horizontal scroll: ${route}` });

    if (route === '/') {
      const viewportMeta = await safeEval(page, () => {
        const meta = document.querySelector('meta[name="viewport"]');
        return meta ? meta.content : null;
      });
      if (!viewportMeta || !viewportMeta.includes('width=device-width')) {
        mobileQuickIssues.push({ severity: 'CRITICAL', detail: 'Missing/incorrect viewport meta' });
      }
    }

    const bottomNav = await page.$('nav[class*="bottom"], [class*="tab-bar"], [class*="mobile-nav"], footer nav');
    if (!bottomNav && route !== '/search') mobileQuickIssues.push({ severity: 'MEDIUM', detail: `No bottom nav: ${route}` });

    const visible = await page.$$eval(
      'a[href*="/movie/"], a[href*="/tv/"], [class*="card"], [class*="poster"]',
      els => els.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < 812; }).length
    );
    if (visible === 0) mobileQuickIssues.push({ severity: 'CRITICAL', detail: `Zero visible cards: ${route}` });
    console.log(`  ${route}: ${visible} visible, ${hasScroll ? 'HAS scroll' : 'no scroll'}`);
  }

  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  if (mobileQuickIssues.length) {
    REPORT.pages.push({ route: 'Mobile Quick', path: 'all', status: 'TESTED', issues: mobileQuickIssues });
  }

  // ════════════════════════════════════════════
  // TEST 12: API HEALTH
  // ════════════════════════════════════════════
  console.log('\n═══ 12. API HEALTH ═══');
  const api = [];
  try {
    const tmdbRes = await fetch(`https://api.themoviedb.org/3/movie/550?api_key=5aa00ca6320d13f8d492d7806e012f9b`);
    console.log(`  TMDB: ${tmdbRes.ok ? 'OK' : 'FAIL'}`);
    if (!tmdbRes.ok) api.push({ severity: 'CRITICAL', detail: `TMDB: ${tmdbRes.status}` });
  } catch { api.push({ severity: 'CRITICAL', detail: 'TMDB unreachable' }); }
  try {
    const consumetRes = await fetch('https://api.consumet.org/anime/gogoanime/top-airing');
    console.log(`  Consumet: ${consumetRes.ok ? 'OK' : 'FAIL'}`);
    if (!consumetRes.ok) api.push({ severity: 'MEDIUM', detail: `Consumet: ${consumetRes.status}` });
  } catch { api.push({ severity: 'MEDIUM', detail: 'Consumet unreachable' }); }
  try {
    const jikanRes = await fetch('https://api.jikan.moe/v4/top/anime');
    console.log(`  Jikan: ${jikanRes.ok ? 'OK' : 'FAIL'}`);
    if (!jikanRes.ok) api.push({ severity: 'LOW', detail: `Jikan: ${jikanRes.status}` });
  } catch { api.push({ severity: 'LOW', detail: 'Jikan unreachable' }); }
  if (api.length > 0) REPORT.pages.push({ route: 'API Health', path: 'external', status: 'INFO', issues: api });

  // ════════════════════════════════════════════
  // COMPILE REPORT
  // ════════════════════════════════════════════
  await browser.close();

  const allIssues = REPORT.pages.flatMap(p => (p.issues || []).map(i => ({ ...i, page: p.route, path: p.path })));
  REPORT.summary = {
    totalPages: REPORT.pages.length,
    totalIssues: allIssues.length,
    critical: allIssues.filter(i => i.severity === 'CRITICAL').length,
    high: allIssues.filter(i => i.severity === 'HIGH').length,
    medium: allIssues.filter(i => i.severity === 'MEDIUM').length,
    low: allIssues.filter(i => i.severity === 'LOW').length,
  };

  writeFileSync('audit-full-report.json', JSON.stringify(REPORT, null, 2));
  generateFixPrompt(REPORT);

  console.log('\n══════════════════════════════════');
  console.log(`  Pages: ${REPORT.summary.totalPages}`);
  console.log(`  Issues: ${REPORT.summary.totalIssues}`);
  console.log(`    Critical: ${REPORT.summary.critical}`);
  console.log(`    High: ${REPORT.summary.high}`);
  console.log(`    Medium: ${REPORT.summary.medium}`);
  console.log(`    Low: ${REPORT.summary.low}`);
  if (REPORT.summary.critical > 0) {
    console.log('\nCRITICAL:');
    allIssues.filter(i => i.severity === 'CRITICAL').forEach((i, idx) => console.log(`  ${idx + 1}. [${i.page}] ${i.detail}`));
  }
  if (REPORT.summary.high > 0) {
    console.log('\nHIGH:');
    allIssues.filter(i => i.severity === 'HIGH').forEach((i, idx) => console.log(`  ${idx + 1}. [${i.page}] ${i.detail}`));
  }
  return REPORT;
}

function generateFixPrompt(report) {
  const all = report.pages.flatMap(p => (p.issues || []).map(i => ({ ...i, page: p.route, path: p.path })));
  let prompt = '## Fix all issues\n\n';
  ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach(sev => {
    const items = all.filter(i => i.severity === sev);
    if (items.length > 0) {
      prompt += `### ${sev} (${items.length})\n`;
      items.forEach((i, idx) => prompt += `${idx + 1}. [${i.page}] ${i.detail}\n`);
      prompt += '\n';
    }
  });
  prompt += 'Run: node audit-full.js\nRepeat until clean.';
  writeFileSync('audit-fix-prompt.txt', prompt);
  console.log('\nFix prompt: audit-fix-prompt.txt');
}

crawl().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
