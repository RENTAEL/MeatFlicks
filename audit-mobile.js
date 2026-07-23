import puppeteer from 'puppeteer';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

const BASE_URL = 'https://streamium-cosmic.vercel.app';
const MOBILE = { width: 375, height: 812 };
const REPORT = { timestamp: new Date().toISOString(), device: 'iPhone X (375x812)', baseUrl: BASE_URL, summary: {}, pages: [] };

async function safeText(page, sel, fb = '') { try { return (await page.$eval(sel, el => el.innerText)).trim(); } catch { return fb; } }
async function safeCount(page, sel) { try { return (await page.$$eval(sel, els => els.length)); } catch { return 0; } }
async function safeExists(page, sel) { try { return !!(await page.$(sel)); } catch { return false; } }
async function safeEval(page, fn, fb = null) { try { return await page.evaluate(fn); } catch { return fb; } }
async function safeTap(page, sel) { try { await page.tap(sel); return true; } catch { return false; } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function findButton(page, text) {
  return page.evaluate(txt => {
    const btns = document.querySelectorAll('button, a, [role="button"]');
    const found = Array.from(btns).find(el => (el.innerText || el.textContent || '').trim().toLowerCase().includes(txt.toLowerCase()));
    if (!found) return null;
    if (found.id) return '#' + CSS.escape(found.id);
    return found.tagName.toLowerCase();
  }, text).then(sel => sel ? page.$(sel) : null);
}
async function findByText(page, sel, text) {
  return page.evaluate((s, txt) => {
    const els = document.querySelectorAll(s);
    const found = Array.from(els).find(el => (el.innerText || el.textContent || '').toLowerCase().includes(txt.toLowerCase()));
    if (!found) return null;
    if (found.id) return '#' + CSS.escape(found.id);
    return found.tagName.toLowerCase();
  }, sel, text).then(sel => sel ? page.$(sel) : null);
}

async function crawl() {
  if (!existsSync('audit-screenshots')) mkdirSync('audit-screenshots');
  if (!existsSync('audit-screenshots/mobile')) mkdirSync('audit-screenshots/mobile');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport(MOBILE);
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');

  let consoleErrors = [], failedRequests = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('requestfailed', req => { failedRequests.push({ url: req.url(), error: req.failure()?.errorText }); });
  page.on('dialog', async d => await d.dismiss());
  function reset() { consoleErrors = []; failedRequests = []; }

  async function goto(path, opts = {}) {
    reset();
    try {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle2', timeout: opts.timeout || 30000 });
      console.log(`  \u2705 ${path}`);
      return { ok: true };
    } catch (e) {
      console.log(`  \u274c ${path} \u2014 ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  async function screenshot(name) {
    try { await page.screenshot({ path: `audit-screenshots/mobile/${name}.png`, fullPage: false }); } catch {}
  }
  async function fullScreenshot(name) {
    try { await page.screenshot({ path: `audit-screenshots/mobile/${name}.png`, fullPage: true }); } catch {}
  }

  // ────────────────────────────────────────────
  // M1. MOBILE HOMEPAGE
  // ────────────────────────────────────────────
  console.log('\n═══ M1. MOBILE HOMEPAGE ═══');
  const hI = [];
  const hN = await goto('/');
  if (!hN.ok) {
    hI.push({ severity: 'CRITICAL', detail: 'Homepage failed on mobile' });
  } else {
    await fullScreenshot('m01-homepage-full');
    await screenshot('m01-homepage-viewport');

    const hasHScroll = await safeEval(page, () => document.documentElement.scrollWidth > window.innerWidth);
    if (hasHScroll) hI.push({ severity: 'CRITICAL', detail: 'Horizontal scrollbar on homepage' });

    const bodyWidth = await safeEval(page, () => document.body.scrollWidth);
    if (bodyWidth > 375) hI.push({ severity: 'HIGH', detail: `Body overflow: ${bodyWidth}px > 375px` });

    const viewportMeta = await safeEval(page, () => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta ? meta.content : null;
    });
    if (!viewportMeta) hI.push({ severity: 'CRITICAL', detail: 'Missing viewport meta tag' });
    else if (!viewportMeta.includes('width=device-width')) hI.push({ severity: 'HIGH', detail: `Viewport meta incorrect: ${viewportMeta}` });
    else console.log(`  Viewport: ${viewportMeta}`);

    const hamburger = await safeExists(page, '[class*="hamburger"], [class*="menu-toggle"], button[aria-label*="menu"], [class*="mobile-menu"]');
    const bottomNav = await safeExists(page, 'nav[class*="bottom"], [class*="tab-bar"], [class*="mobile-nav"], footer nav');
    const topNav = await safeExists(page, 'header nav, nav[class*="top"], [class*="navbar"]');
    console.log(`  Hamburger: ${hamburger}, Bottom nav: ${bottomNav}, Top nav: ${topNav}`);
    if (!hamburger && !bottomNav) {
      hI.push({ severity: 'HIGH', detail: 'No mobile navigation (no hamburger, no bottom nav)' });
    }

    const cardSizes = await safeEval(page, () => {
      const cards = document.querySelectorAll('a[href*="/movie/"], a[href*="/tv/"], [class*="card"], [class*="poster"]');
      return Array.from(cards).slice(0, 10).map(c => {
        const r = c.getBoundingClientRect();
        return { width: Math.round(r.width), height: Math.round(r.height), visible: r.height > 0 };
      }).filter(c => c.visible);
    }, []);

    const visibleCards = cardSizes.length;
    const smallCards = cardSizes.filter(c => c.width < 44 || c.height < 44).length;
    const avgWidth = cardSizes.length > 0 ? Math.round(cardSizes.reduce((s, c) => s + c.width, 0) / cardSizes.length) : 0;
    console.log(`  Cards: ${visibleCards} visible, avg width: ${avgWidth}px, ${smallCards} too small`);

    if (visibleCards === 0) hI.push({ severity: 'CRITICAL', detail: 'Zero visible cards on mobile homepage' });
    if (visibleCards < 6) hI.push({ severity: 'HIGH', detail: `Only ${visibleCards} visible cards \u2014 grid probably broken` });
    if (smallCards > 0) hI.push({ severity: 'MEDIUM', detail: `${smallCards} cards below 44px touch target` });

    const gridInfo = await safeEval(page, () => {
      const cards = Array.from(document.querySelectorAll('a[href*="/movie/"], a[href*="/tv/"], [class*="card"]'));
      if (cards.length < 4) return { columns: 1, note: 'too few cards' };
      const rows = [];
      cards.forEach(c => {
        const top = Math.round(c.getBoundingClientRect().top);
        let found = false;
        for (const row of rows) {
          if (Math.abs(row.top - top) < 10) { row.count++; found = true; break; }
        }
        if (!found) rows.push({ top, count: 1 });
      });
      const maxCols = Math.max(...rows.map(r => r.count));
      return { columns: maxCols, rows: rows.length, sample: rows.slice(0, 3) };
    }, { columns: 1, rows: 0 });

    console.log(`  Grid: ${gridInfo.columns} columns, ${gridInfo.rows} rows`);
    if (gridInfo.columns === 1 && visibleCards > 4) {
      hI.push({ severity: 'MEDIUM', detail: 'Single column on mobile \u2014 should be 2-3 column grid' });
    }

    const tinyText = await safeEval(page, () => {
      const all = document.querySelectorAll('p, span, h1, h2, h3, h4, a, button, li, div');
      let count = 0;
      all.forEach(el => {
        const style = window.getComputedStyle(el);
        const size = parseFloat(style.fontSize);
        if (size > 0 && size < 12) count++;
      });
      return count;
    }, 0);
    if (tinyText > 10) hI.push({ severity: 'LOW', detail: `${tinyText} elements with font-size < 12px` });

    const heroHeight = await safeEval(page, () => {
      const hero = document.querySelector('[class*="hero"], [class*="banner"], [class*="featured"]');
      if (!hero) return null;
      return hero.getBoundingClientRect().height;
    }, null);
    if (heroHeight && heroHeight > 400) hI.push({ severity: 'MEDIUM', detail: `Hero too tall on mobile: ${Math.round(heroHeight)}px \u2014 should be ~250px` });

    REPORT.pages.push({ route: 'Homepage', path: '/', device: 'mobile', status: 'OK', cardCount: visibleCards, issues: hI });
  }

  // ────────────────────────────────────────────
  // M2. MOBILE MOVIES PAGE
  // ────────────────────────────────────────────
  console.log('\n═══ M2. MOBILE MOVIES ═══');
  const mI = [];
  const mN = await goto('/explore/movies');
  if (!mN.ok) {
    mI.push({ severity: 'CRITICAL', detail: 'Movies page failed on mobile' });
  } else {
    await fullScreenshot('m02-movies-full');
    await screenshot('m02-movies-viewport');

    const hasScroll = await safeEval(page, () => document.documentElement.scrollWidth > window.innerWidth);
    if (hasScroll) mI.push({ severity: 'CRITICAL', detail: 'Horizontal scroll on movies' });

    const cards = await safeCount(page, 'a[href*="/movie/"]');
    console.log(`  Cards: ${cards}`);
    if (cards === 0) mI.push({ severity: 'CRITICAL', detail: 'Zero movie cards on mobile' });

    if (cards > 0) {
      const pre = page.url();
      await safeTap(page, 'a[href*="/movie/"]:first-of-type');
      await sleep(2000);
      if (page.url() !== pre) console.log('  \u2705 Tapped and navigated');
      else mI.push({ severity: 'HIGH', detail: 'Tap did not navigate' });
    }

    REPORT.pages.push({ route: 'Movies', path: '/explore/movies', device: 'mobile', status: 'OK', cardCount: cards, issues: mI });
  }

  // ────────────────────────────────────────────
  // M3. MOBILE TV SHOWS
  // ────────────────────────────────────────────
  console.log('\n═══ M3. MOBILE TV SHOWS ═══');
  const tI = [];
  const tN = await goto('/explore/tv-shows');
  if (!tN.ok) {
    tI.push({ severity: 'CRITICAL', detail: 'TV Shows page failed on mobile' });
  } else {
    await fullScreenshot('m03-tvshows-full');
    const hasScroll = await safeEval(page, () => document.documentElement.scrollWidth > window.innerWidth);
    if (hasScroll) tI.push({ severity: 'CRITICAL', detail: 'Horizontal scroll on TV shows' });
    const cards = await safeCount(page, 'a[href*="/tv/"]');
    console.log(`  Cards: ${cards}`);
    if (cards === 0) tI.push({ severity: 'CRITICAL', detail: 'Zero TV cards on mobile' });
    REPORT.pages.push({ route: 'TV Shows', path: '/explore/tv-shows', device: 'mobile', status: 'OK', cardCount: cards, issues: tI });
  }

  // ────────────────────────────────────────────
  // M4. MOBILE SEARCH
  // ────────────────────────────────────────────
  console.log('\n═══ M4. MOBILE SEARCH ═══');
  const sI = [];
  const sN = await goto('/search');
  if (!sN.ok) {
    sI.push({ severity: 'CRITICAL', detail: 'Search page failed on mobile' });
  } else {
    await screenshot('m04-search-empty');

    const input = await page.$('input[type="text"], input[type="search"], input[name="q"]');
    if (!input) {
      sI.push({ severity: 'CRITICAL', detail: 'No search input on mobile' });
    } else {
      const inputWidth = await input.evaluate(el => el.getBoundingClientRect().width);
      if (inputWidth < 300) sI.push({ severity: 'MEDIUM', detail: `Search input too narrow: ${Math.round(inputWidth)}px` });

      await input.tap();
      await page.keyboard.type('Breaking Bad', { delay: 50 });
      await page.keyboard.press('Enter');
      await sleep(3000);
      await screenshot('m04-search-results');

      const results = await safeCount(page, 'a[href*="/movie/"], a[href*="/tv/"], [class*="card"], [class*="result"]');
      console.log(`  Results: ${results}`);
      if (results === 0) sI.push({ severity: 'CRITICAL', detail: 'Zero search results on mobile' });

      const shifted = await safeEval(page, () => window.visualViewport?.height < window.innerHeight);
      if (!shifted) sI.push({ severity: 'LOW', detail: 'Keyboard may not shift viewport properly' });
    }
    REPORT.pages.push({ route: 'Search', path: '/search', device: 'mobile', status: 'OK', issues: sI });
  }

  // ────────────────────────────────────────────
  // M5. MOBILE MOVIE DETAIL + PLAYER
  // ────────────────────────────────────────────
  console.log('\n═══ M5. MOBILE MOVIE DETAIL ═══');
  const mdI = [];
  const mdN = await goto('/movie/27205');
  if (!mdN.ok) {
    mdI.push({ severity: 'CRITICAL', detail: 'Movie detail failed on mobile' });
  } else {
    await fullScreenshot('m05-movie-detail-full');
    await screenshot('m05-movie-detail-viewport');

    const title = await safeText(page, 'h1, h2, [class*="title"]');
    if (!title) mdI.push({ severity: 'HIGH', detail: 'No title on mobile' });
    else {
      const titleSize = await safeEval(page, () => {
        const el = document.querySelector('h1, h2, [class*="title"]');
        return el ? parseFloat(window.getComputedStyle(el).fontSize) : 0;
      }, 0);
      if (titleSize > 0 && titleSize < 18) mdI.push({ severity: 'MEDIUM', detail: `Title font too small: ${titleSize}px` });
    }

    const posterWidth = await safeEval(page, () => {
      const img = document.querySelector('img[class*="poster"], img[src*="tmdb"]');
      return img ? img.getBoundingClientRect().width : 0;
    }, 0);
    if (posterWidth > 200) mdI.push({ severity: 'MEDIUM', detail: `Poster too wide: ${Math.round(posterWidth)}px \u2014 should be ~150px on mobile` });

    const playBtn = await findButton(page, 'play') || await page.$('[class*="play"]');
    if (!playBtn) {
      mdI.push({ severity: 'HIGH', detail: 'No play button on mobile' });
    } else {
      const btnWidth = await playBtn.evaluate(el => el.getBoundingClientRect().width);
      if (btnWidth < 100) mdI.push({ severity: 'MEDIUM', detail: `Play button narrow: ${Math.round(btnWidth)}px \u2014 should be full-width on mobile` });

      console.log('  Tapping play...');
      await playBtn.tap();
      await sleep(3000);
      await screenshot('m05-play-tapped');

      const player = await page.$('video, iframe, [class*="player"]');
      if (!player) {
        mdI.push({ severity: 'HIGH', detail: 'No player appeared after tapping play' });
      } else {
        const playerWidth = await player.evaluate(el => el.getBoundingClientRect().width);
        console.log(`  Player width: ${Math.round(playerWidth)}px`);

        if (playerWidth > 375) mdI.push({ severity: 'HIGH', detail: `Player overflows screen: ${Math.round(playerWidth)}px > 375px` });
        if (playerWidth < 300) mdI.push({ severity: 'MEDIUM', detail: `Player too narrow: ${Math.round(playerWidth)}px` });

        const isVideo = await safeExists(page, 'video');
        if (isVideo) {
          const hasControls = await safeExists(page, 'video[controls]');
          if (!hasControls) mdI.push({ severity: 'MEDIUM', detail: 'Video missing controls \u2014 user cannot play/pause' });
          console.log(`  Video element, controls: ${hasControls}`);

          const fsBtn = await page.$('button[class*="fullscreen"], [aria-label*="fullscreen"], button[title*="fullscreen"]');
          if (fsBtn) {
            await fsBtn.tap();
            await sleep(1500);
            await screenshot('m05-fullscreen');
            console.log('  \u2705 Tapped fullscreen');
          }
        }

        const isIframe = await safeExists(page, 'iframe');
        if (isIframe) {
          const iframeWidth = await page.$eval('iframe', el => el.getBoundingClientRect().width);
          if (iframeWidth > 375) mdI.push({ severity: 'HIGH', detail: `Iframe overflows: ${Math.round(iframeWidth)}px` });
        }

        const playerTop = await player.evaluate(el => el.getBoundingClientRect().top);
        if (playerTop < 0) mdI.push({ severity: 'LOW', detail: 'Player partially off-screen at top' });
        if (playerTop > 400) mdI.push({ severity: 'LOW', detail: 'Player too far down page \u2014 must scroll to see' });
      }
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1500);
    await screenshot('m05-suggestions');

    const suggested = await safeEval(page, () => {
      const cards = document.querySelectorAll('a[href*="/movie/"], a[href*="/tv/"]');
      return Array.from(cards).filter(c => {
        const r = c.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).length;
    }, 0);
    console.log(`  Suggested: ${suggested}`);

    if (suggested < 3) mdI.push({ severity: 'LOW', detail: 'Few suggested items visible on mobile' });

    if (suggested > 1) {
      const pre = page.url();
      try {
        const suggestions = await page.$$('a[href*="/movie/"], a[href*="/tv/"]');
        for (let i = 1; i < suggestions.length; i++) {
          const rect = await suggestions[i].boundingBox();
          if (rect && rect.y > 300) {
            await suggestions[i].tap();
            await sleep(2000);
            break;
          }
        }
        if (page.url() !== pre && !page.url().includes('27205')) {
          console.log('  \u2705 Suggested tap navigated to new movie');
        } else {
          mdI.push({ severity: 'HIGH', detail: 'Suggested card tap did not navigate' });
        }
      } catch {}
    }

    REPORT.pages.push({ route: 'Movie Detail + Player', path: '/movie/27205', device: 'mobile', status: 'OK', issues: mdI });
  }

  // ────────────────────────────────────────────
  // M6. MOBILE TV DETAIL + PLAYER
  // ────────────────────────────────────────────
  console.log('\n═══ M6. MOBILE TV DETAIL ═══');
  const tdI = [];
  const tdN = await goto('/tv/1399');
  if (!tdN.ok) {
    tdI.push({ severity: 'CRITICAL', detail: 'TV detail failed on mobile' });
  } else {
    await fullScreenshot('m06-tv-detail-full');
    await screenshot('m06-tv-detail-viewport');

    const title = await safeText(page, 'h1, h2, [class*="title"]');
    if (!title) tdI.push({ severity: 'HIGH', detail: 'No TV title on mobile' });

    const seasonSelector = await page.$('select, [class*="season"] select') || await findByText(page, 'button', 'Season');
    if (!seasonSelector) {
      tdI.push({ severity: 'MEDIUM', detail: 'No season selector on mobile' });
    } else {
      const selWidth = await seasonSelector.evaluate(el => el.getBoundingClientRect().width);
      if (selWidth < 200) tdI.push({ severity: 'MEDIUM', detail: `Season selector narrow: ${Math.round(selWidth)}px` });

      try {
        await seasonSelector.tap();
        await sleep(500);
        const isSelect = await seasonSelector.evaluate(el => el.tagName === 'SELECT');
        if (isSelect) {
          await seasonSelector.select('1');
          await sleep(1000);
          console.log('  \u2705 Changed season');
        }
      } catch {}
    }

    const episodes = await safeCount(page, '[class*="episode"]');
    console.log(`  Episodes visible: ${episodes}`);
    if (episodes === 0) tdI.push({ severity: 'LOW', detail: 'No episode buttons visible' });

    const play = await findButton(page, 'play') || await page.$('[class*="play"]');
    if (play) {
      await play.tap();
      await sleep(3000);
      await screenshot('m06-tv-play');
      if (!(await page.$('video, iframe, [class*="player"]'))) tdI.push({ severity: 'MEDIUM', detail: 'No player on TV mobile' });
      else console.log('  \u2705 TV player appeared');
    }

    REPORT.pages.push({ route: 'TV Detail + Player', path: '/tv/1399', device: 'mobile', status: 'OK', issues: tdI });
  }

  // ────────────────────────────────────────────
  // M7. MOBILE ANIME
  // ────────────────────────────────────────────
  console.log('\n═══ M7. MOBILE ANIME ═══');
  const aI = [];
  let aRoute = null;
  for (const r of ['/anime', '/animes', '/explore/anime']) {
    const n = await goto(r, { timeout: 15000 });
    if (n.ok) { aRoute = r; break; }
  }

  if (!aRoute) {
    aI.push({ severity: 'INFO', detail: 'No anime route found \u2014 skipping' });
  } else {
    await fullScreenshot('m07-anime-full');
    const cards = await safeCount(page, 'a[href*="/anime/"], a[href*="/watch/"], [class*="card"]');
    console.log(`  Cards: ${cards}`);
    if (cards === 0) aI.push({ severity: 'HIGH', detail: 'Zero anime cards on mobile' });

    if (cards > 0) {
      await safeTap(page, 'a[href*="/anime/"]:first-of-type, a[href*="/watch/"]:first-of-type');
      await sleep(2000);
      await screenshot('m07-anime-detail');
      const title = await safeText(page, 'h1, h2, [class*="title"]');
      if (!title) aI.push({ severity: 'HIGH', detail: 'No anime title on mobile' });

      const play = await findButton(page, 'play') || await page.$('[class*="play"]');
      if (play) {
        await play.tap();
        await sleep(3000);
        await screenshot('m07-anime-play');
        if (!(await page.$('video, iframe, [class*="player"]'))) aI.push({ severity: 'MEDIUM', detail: 'No anime player on mobile' });
        else console.log('  \u2705 Anime player appeared');
      }
    }

    REPORT.pages.push({ route: 'Anime', path: aRoute, device: 'mobile', status: 'OK', cardCount: cards, issues: aI });
  }

  // ────────────────────────────────────────────
  // M8. TOUCH INTERACTIONS
  // ────────────────────────────────────────────
  console.log('\n═══ M8. TOUCH INTERACTIONS ═══');
  const touchI = [];
  await goto('/');

  const scrollStart = await safeEval(page, () => window.scrollY);
  await page.evaluate(() => window.scrollBy(0, 300));
  await sleep(500);
  const scrollEnd = await safeEval(page, () => window.scrollY);
  if (scrollEnd === scrollStart) touchI.push({ severity: 'MEDIUM', detail: 'Scroll not working' });
  else console.log('  \u2705 Scroll works');

  const hasModal = await safeExists(page, '[class*="modal"], [class*="dialog"][open], [role="dialog"]');
  if (hasModal) touchI.push({ severity: 'HIGH', detail: 'Modal/dialog open without user action \u2014 blocks touch' });

  await goto('/explore/movies');
  await safeTap(page, 'a[href*="/movie/"]:first-of-type');
  await sleep(2000);
  const hasBackBtn = await safeExists(page, 'button[aria-label*="back"], a[class*="back"], [class*="back-button"]');
  if (!hasBackBtn) touchI.push({ severity: 'LOW', detail: 'No back button on detail page (mobile users expect one)' });

  await goto('/movie/27205');
  const overlapping = await safeEval(page, () => {
    const btns = document.querySelectorAll('button, a[role="button"]');
    let count = 0;
    for (let i = 0; i < btns.length; i++) {
      for (let j = i + 1; j < btns.length; j++) {
        const a = btns[i].getBoundingClientRect();
        const b = btns[j].getBoundingClientRect();
        if (a.width > 0 && b.width > 0 &&
            Math.abs(a.x - b.x) < 10 && Math.abs(a.y - b.y) < 10) {
          count++;
        }
      }
    }
    return count;
  }, 0);
  if (overlapping > 0) touchI.push({ severity: 'MEDIUM', detail: `${overlapping} overlapping touch targets` });

  if (touchI.length) REPORT.pages.push({ route: 'Touch Interactions', path: 'all', device: 'mobile', status: 'TESTED', issues: touchI });

  // ────────────────────────────────────────────
  // M9. MOBILE PERFORMANCE
  // ────────────────────────────────────────────
  console.log('\n═══ M9. MOBILE PERFORMANCE ═══');
  const perfI = [];
  await goto('/');

  const imgSizes = await safeEval(page, () => {
    return Array.from(document.querySelectorAll('img[src*="tmdb"]')).map(i => ({
      src: i.src.substring(0, 80),
      width: Math.round(i.getBoundingClientRect().width),
      naturalWidth: i.naturalWidth,
      loading: i.loading,
    }));
  }, []);

  const oversized = imgSizes.filter(i => i.naturalWidth > 500 && i.width < 200);
  console.log(`  Images: ${imgSizes.length}, oversized for mobile: ${oversized.length}`);

  if (oversized.length > 5) {
    perfI.push({ severity: 'MEDIUM', detail: `${oversized.length} images downloading full-res on mobile \u2014 use srcset or w185/w342` });
  }

  const hasSrcset = imgSizes.some(i => i.src.includes('w185') || i.src.includes('w342'));
  if (!hasSrcset && imgSizes.length > 0) {
    perfI.push({ severity: 'MEDIUM', detail: 'No responsive images (no srcset, no mobile-specific sizes)' });
  }

  const tapDelay = await safeEval(page, () => {
    const meta = document.querySelector('meta[name="viewport"]');
    return meta?.content?.includes('user-scalable=no');
  }, false);
  if (!tapDelay) perfI.push({ severity: 'LOW', detail: 'No user-scalable=no \u2014 may have 300ms tap delay' });

  const hasManifest = await safeExists(page, 'link[rel="manifest"]');
  const hasSW = await safeEval(page, () => 'serviceWorker' in navigator, false);
  console.log(`  PWA: manifest=${hasManifest}, SW=${hasSW}`);
  if (!hasManifest) perfI.push({ severity: 'LOW', detail: 'No web manifest (PWA install prompt)' });

  if (perfI.length) REPORT.pages.push({ route: 'Mobile Performance', path: 'all', device: 'mobile', status: 'INFO', issues: perfI });

  // ────────────────────────────────────────────
  // COMPILE
  // ────────────────────────────────────────────
  await browser.close();

  const all = REPORT.pages.flatMap(p => (p.issues || []).map(i => ({ ...i, page: p.route })));
  REPORT.summary = {
    totalTests: REPORT.pages.length,
    totalIssues: all.length,
    critical: all.filter(i => i.severity === 'CRITICAL').length,
    high: all.filter(i => i.severity === 'HIGH').length,
    medium: all.filter(i => i.severity === 'MEDIUM').length,
    low: all.filter(i => i.severity === 'LOW').length,
  };

  writeFileSync('audit-mobile-report.json', JSON.stringify(REPORT, null, 2));
  generateFixPrompt(REPORT);

  console.log('\n═══════════════════════════════════');
  console.log(' MOBILE AUDIT COMPLETE');
  console.log('═══════════════════════════════════');
  console.log(`  Critical: ${REPORT.summary.critical}`);
  console.log(`  High:     ${REPORT.summary.high}`);
  console.log(`  Medium:   ${REPORT.summary.medium}`);
  console.log(`  Low:      ${REPORT.summary.low}`);

  return REPORT;
}

function generateFixPrompt(report) {
  const all = report.pages.flatMap(p => (p.issues || []).map(i => ({ ...i, page: p.route })));
  let prompt = `Fix these MOBILE-specific issues.\n\n`;
  const sevs = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const labels = ['CRITICAL \u2014 Fix FIRST', 'HIGH \u2014 Fix SECOND', 'MEDIUM \u2014 Fix THIRD', 'LOW \u2014 Polish'];
  sevs.forEach((sev, idx) => {
    const items = all.filter(i => i.severity === sev);
    if (items.length) {
      prompt += `## ${labels[idx]} (${items.length})\n\n`;
      items.forEach((i, n) => prompt += `${n+1}. **[${i.page}]** ${i.detail}\n`);
      prompt += '\n';
    }
  });
  prompt += `## After fixing, run: node audit-mobile.js\n## Repeat until: Critical: 0, High: 0\n`;
  writeFileSync('audit-mobile-fix-prompt.txt', prompt);
}

crawl().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });