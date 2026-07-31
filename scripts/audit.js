import puppeteer from 'puppeteer';

const BASE_URL = process.env.AUDIT_URL || 'http://localhost:5173';
const REPORT = [];
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function log(phase, message, status = 'INFO') {
  const entry = { phase, message, status, timestamp: new Date().toISOString() };
  REPORT.push(entry);
  const emoji = status === 'ERROR' ? '\u274C' : status === 'WARN' ? '\u26A0\uFE0F' : '\u2705';
  console.log(`${emoji} [${phase}] ${message}`);
}

function collectConsole(page, phase) {
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (text.includes('ERR_BLOCKED_BY_CLIENT')) return;
    if (text.includes('state_referenced_locally')) return;
    if (text.includes('favicon')) return;
    if (type === 'error') {
      const args = msg.args().map(a => a.toString()).join(' ');
      log(phase, `CONSOLE ERROR: ${text} ${args ? '| ' + args : ''}`, 'ERROR');
    } else if (type === 'warning') {
      log(phase, `CONSOLE WARNING: ${text}`, 'WARN');
    }
  });
}

function collectNetwork(page, phase) {
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.includes('localhost') || url.includes(new URL(BASE_URL).host)) {
      log(phase, `NETWORK FAIL: ${req.failure()?.errorText} \u2014 ${url}`, 'ERROR');
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      const url = res.url();
      const host = new URL(BASE_URL).host;
      if (url.includes(host)) {
        log(phase, `HTTP ${res.status()}: ${url}`, 'ERROR');
      } else {
        log(phase, `HTTP ${res.status()}: ${url}`, 'WARN');
      }
    }
  });
}

async function navigate(page, url, phase, timeout = 15000) {
  try {
    const response = await page.goto(`${BASE_URL}${url}`, {
      waitUntil: 'domcontentloaded',
      timeout,
    });
    await delay(1000);
    if (!response) {
      log(phase, `Navigate to ${url} returned null response`, 'ERROR');
      return false;
    }
    const status = response.status();
    if (status >= 400) {
      log(phase, `${url} returned HTTP ${status}`, 'ERROR');
      return false;
    }
    log(phase, `${url} \u2192 HTTP ${status}`, 'INFO');
    return true;
  } catch (err) {
    log(phase, `Navigate to ${url} FAILED: ${err.message}`, 'ERROR');
    return false;
  }
}

async function checkOverflow(page, phase, label) {
  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > window.innerWidth,
    vertical: document.documentElement.scrollHeight > window.innerHeight,
  }));
  if (overflow.horizontal) {
    log(phase, `${label}: Horizontal overflow detected`, 'ERROR');
  }
  return overflow;
}

async function checkForErrorText(page, phase, label) {
  const errorText = await page.evaluate(() => {
    const body = document.body.innerText;
    if (body.includes('500') || body.includes('Internal Error') || body.includes('Error:')) {
      return body.slice(0, 200);
    }
    return null;
  });
  if (errorText) {
    log(phase, `${label}: page contains error text: "${errorText}"`, 'ERROR');
  }
}

async function checkBackground(page, phase) {
  const bgColor = await page.evaluate(() => {
    const style = window.getComputedStyle(document.body);
    return style.backgroundColor;
  });
  if (bgColor === 'rgb(255, 255, 255)' || bgColor === 'white') {
    log(phase, 'Background is WHITE \u2014 expected dark theme', 'WARN');
  }
}

async function visualCheck(page, phase, selector, label, required = false) {
  try {
    const el = await page.waitForSelector(selector, { visible: true, timeout: 3000 });
    if (el) {
      const box = await el.boundingBox();
      const text = await el.evaluate((node) => node.textContent?.trim().slice(0, 60));
      if (box && (box.x < 0 || box.y < 0 || box.width === 0 || box.height === 0)) {
        log(phase, `${label}: FOUND but OFFSCREEN (x:${box.x}, y:${box.y}, w:${box.width}, h:${box.height})`, 'WARN');
      } else if (box) {
        log(phase, `${label}: VISIBLE at (${Math.round(box.x)},${Math.round(box.y)}) \u2014 "${text || '(no text)'}"`, 'INFO');
      }
    }
  } catch {
    log(phase, `${label}: NOT FOUND or NOT VISIBLE`, required ? 'ERROR' : 'WARN');
  }
}

async function runAudit() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  STREAMIUM FULL PRODUCTION AUDIT');
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Time:   ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(10000);

  collectConsole(page, 'GLOBAL');
  collectNetwork(page, 'GLOBAL');

  // ═══════════════════════════════════════════════
  //  PHASE 1: HOMEPAGE
  // ═══════════════════════════════════════════════
  console.log('\n--- PHASE 1: HOMEPAGE ---\n');

  await navigate(page, '/', 'HOMEPAGE');
  await checkBackground(page, 'HOMEPAGE');
  await checkOverflow(page, 'HOMEPAGE', 'Homepage');
  await checkForErrorText(page, 'HOMEPAGE', 'Homepage');

  await visualCheck(page, 'HOMEPAGE', 'header', 'Header', true);
  await visualCheck(page, 'HOMEPAGE', 'footer', 'Footer', false);
  await visualCheck(page, 'HOMEPAGE', 'main, .hero-section, section', 'Main content area', true);

  // ═══════════════════════════════════════════════
  //  PHASE 2: AUTH PAGES
  // ═══════════════════════════════════════════════
  console.log('\n--- PHASE 2: AUTH PAGES ---\n');

  await navigate(page, '/login', 'AUTH');
  await checkOverflow(page, 'AUTH', '/login');
  await visualCheck(page, 'AUTH', 'form', 'Login form', true);
  await visualCheck(page, 'AUTH', 'input[type="text"], input[name="username"]', 'Username input', true);
  await visualCheck(page, 'AUTH', 'input[type="password"]', 'Password input', true);
  await visualCheck(page, 'AUTH', 'button[type="submit"]', 'Submit button', true);
  await visualCheck(page, 'AUTH', 'a[href*="signup"]', 'Link to signup', true);

  await navigate(page, '/signup', 'AUTH');
  await checkOverflow(page, 'AUTH', '/signup');
  await visualCheck(page, 'AUTH', 'form', 'Signup form', true);
  await visualCheck(page, 'AUTH', 'input[name="username"]', 'Username input', true);
  await visualCheck(page, 'AUTH', 'input[type="password"]', 'Password input', true);
  await visualCheck(page, 'AUTH', 'button[type="submit"]', 'Submit button', true);

  // ═══════════════════════════════════════════════
  //  PHASE 3: ALL CONTENT/BROWSE PAGES
  // ═══════════════════════════════════════════════
  console.log('\n--- PHASE 3: CONTENT PAGES ---\n');

  const staticPages = [
    { url: '/movies', label: '/movies' },
    { url: '/tv', label: '/tv' },
    { url: '/watchlist', label: '/watchlist' },
    { url: '/history', label: '/history' },
    { url: '/search', label: '/search' },
    { url: '/explore', label: '/explore' },
    { url: '/settings', label: '/settings' },
    { url: '/admin', label: '/admin' },
    { url: '/admin/features', label: '/admin/features' },
    { url: '/afrikaans', label: '/afrikaans' },
    { url: '/profile', label: '/profile' },
    { url: '/profile/edit', label: '/profile/edit' },
    { url: '/offline', label: '/offline' },
  ];

  for (const { url, label } of staticPages) {
    const ok = await navigate(page, url, 'PAGES');
    if (ok) {
      await checkOverflow(page, 'PAGES', label);
      await checkForErrorText(page, 'PAGES', label);
      await visualCheck(page, 'PAGES', 'main, .page-content, [role="main"]', `${label} main container`, false);
    }
  }

  // ═══════════════════════════════════════════════
  //  PHASE 4: DYNAMIC/DETAIL PAGES
  // ═══════════════════════════════════════════════
  console.log('\n--- PHASE 4: DETAIL/DYNAMIC PAGES ---\n');

  const detailPages = [
    { url: '/movie/550', label: '/movie/550' },
    { url: '/tv/1399', label: '/tv/1399' },
    { url: '/genre/movies', label: '/genre/movies' },
  ];

  for (const { url, label } of detailPages) {
    const ok = await navigate(page, url, 'DETAIL');
    if (ok) {
      await checkOverflow(page, 'DETAIL', label);
      await checkForErrorText(page, 'DETAIL', label);
      await visualCheck(page, 'DETAIL', 'main, article, .page-content', `${label} main content`, false);
    }
  }

  // Check person page and collection page with real-looking slugs
  const dynamicSlugs = [
    { url: '/genre/action', label: '/genre/action' },
    { url: '/explore/movies', label: '/explore/movies' },
  ];

  for (const { url, label } of dynamicSlugs) {
    const ok = await navigate(page, url, 'DYNAMIC');
    if (ok) {
      await checkOverflow(page, 'DYNAMIC', label);
      await checkForErrorText(page, 'DYNAMIC', label);
    }
  }

  // ═══════════════════════════════════════════════
  //  PHASE 5: RESPONSIVE BREAKPOINTS
  // ═══════════════════════════════════════════════
  console.log('\n--- PHASE 5: RESPONSIVE BREAKPOINTS ---\n');

  const breakpoints = [
    { width: 1920, height: 1080, label: 'Desktop (1920px)' },
    { width: 1440, height: 900, label: 'Desktop (1440px)' },
    { width: 1280, height: 800, label: 'Desktop (1280px)' },
    { width: 1024, height: 768, label: 'Tablet landscape (1024px)' },
    { width: 768, height: 1024, label: 'Tablet portrait (768px)' },
    { width: 430, height: 932, label: 'Mobile (430px)' },
    { width: 414, height: 896, label: 'Mobile (414px)' },
    { width: 390, height: 844, label: 'Mobile (390px)' },
    { width: 375, height: 812, label: 'Mobile (375px)' },
    { width: 360, height: 800, label: 'Mobile (360px)' },
    { width: 320, height: 568, label: 'Mobile (320px)' },
  ];

  for (const { width, height, label } of breakpoints) {
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await delay(1000);

    const overflow = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > window.innerWidth,
    }));

    if (overflow.horizontal) {
      log('RESPONSIVE', `${label}: Horizontal overflow`, 'ERROR');
    } else {
      log('RESPONSIVE', `${label}: No overflow`, 'INFO');
    }
  }

  // ═══════════════════════════════════════════════
  //  PHASE 6: MOBILE HAMBURGER MENU (CRITICAL)
  // ═══════════════════════════════════════════════
  console.log('\n--- PHASE 6: MOBILE HAMBURGER MENU ---\n');

  const mobilesViewports = [
    { width: 375, height: 812, label: 'iPhone X (375px)' },
    { width: 414, height: 896, label: 'iPhone 11 (414px)' },
    { width: 390, height: 844, label: 'iPhone 14 (390px)' },
    { width: 430, height: 932, label: 'iPhone 15 (430px)' },
    { width: 360, height: 800, label: 'Galaxy S20 (360px)' },
    { width: 320, height: 568, label: 'Small (320px)' },
  ];

  for (const { width, height, label } of mobilesViewports) {
    await page.setViewport({ width, height, deviceScaleFactor: 3 });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await delay(1500);

    // Check for hamburger menu button with exact aria-label
    const hamburger = await page.$('button[aria-label="Menu"], .mobile-header-btn[aria-label="Menu"]');
    if (hamburger) {
      const box = await hamburger.boundingBox();
      if (box) {
        const inViewport = box.x >= 0 && box.y > 0 && box.x + box.width <= width && box.y + box.height <= height;
        const headerHeight = 64;
        const expectedTop = Math.round((headerHeight - box.height) / 2);
        const yOffset = Math.abs(box.y - expectedTop);

        if (!inViewport) {
          log('MOBILE', `${label}: Hamburger OUTSIDE viewport (y:${Math.round(box.y)})`, 'ERROR');
        } else if (yOffset > 10) {
          log('MOBILE', `${label}: Hamburger position OFF by ${yOffset}px (expected ~${expectedTop}px from top, got ${Math.round(box.y)}px)`, 'ERROR');
        } else {
          log('MOBILE', `${label}: Hamburger correctly positioned at y=${Math.round(box.y)}px`, 'INFO');
        }

        // Try clicking to open menu
        await hamburger.click();
        await delay(600);

        const drawerOpen = await page.evaluate(() => {
          return !!document.querySelector('.menu-drawer, .menu-backdrop, [class*="drawer"], [role="dialog"]');
        });
        if (drawerOpen) {
          const drawerEl = await page.$('.menu-drawer, .menu-backdrop, [class*="drawer"]');
          if (drawerEl) {
            const drawerBox = await drawerEl.boundingBox();
            if (drawerBox) {
              log('MOBILE', `${label}: Menu drawer opened at y=${Math.round(drawerBox.y)}, h=${Math.round(drawerBox.height)}`, 'INFO');
            }
          }

          // Check drawer has navigation links
          const links = await page.evaluate(() => {
            const nav = document.querySelector('.menu-drawer, .menu-backdrop, [role="dialog"]');
            if (!nav) return 0;
            return nav.querySelectorAll('a, button').length;
          });
          log('MOBILE', `${label}: Menu drawer has ${links} interactive elements`, links > 0 ? 'INFO' : 'WARN');

          // Close by pressing Escape
          await page.keyboard.press('Escape');
          await delay(400);
          const stillOpen = await page.evaluate(() => {
            return !!document.querySelector('.menu-drawer, .menu-backdrop');
          });
          log('MOBILE', `${label}: Menu closes on Escape`, stillOpen ? 'WARN' : 'INFO');
        } else {
          log('MOBILE', `${label}: Hamburger clicked but drawer did NOT open`, 'ERROR');
        }
      } else {
        log('MOBILE', `${label}: Hamburger has no bounding box`, 'ERROR');
      }
    } else {
      log('MOBILE', `${label}: No hamburger menu button found`, 'ERROR');
    }
  }

  // ═══════════════════════════════════════════════
  //  PHASE 7: MOBILE HEADER ON ALL PAGES
  // ═══════════════════════════════════════════════
  console.log('\n--- PHASE 7: MOBILE HEADER ACROSS ALL PAGES ---\n');

  const allRoutes = [
    '/', '/login', '/signup', '/movies', '/tv', '/watchlist', '/history',
    '/search', '/explore', '/settings', '/admin', '/profile', '/movie/550',
    '/tv/1399', '/genre/movies', '/afrikaans',
  ];

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });

  for (const route of allRoutes) {
    const ok = await navigate(page, route, 'MHDR', 10000);
    if (ok) {
      const btn = await page.$('button[aria-label="Menu"], .mobile-header-btn[aria-label="Menu"]');
      if (btn) {
        const box = await btn.boundingBox();
        if (box) {
          const inBounds = box.y > 0 && box.y < 100;
          if (!inBounds) {
            log('MHDR', `${route}: Hamburger at y=${Math.round(box.y)} \u2014 TOO HIGH`, 'ERROR');
          }
        }
      }
      await checkOverflow(page, 'MHDR', route);
      await checkForErrorText(page, 'MHDR', route);
    }
  }

  // ═══════════════════════════════════════════════
  //  PHASE 8: PLAYER TEST
  // ═══════════════════════════════════════════════
  console.log('\n--- PHASE 8: PLAYER ---\n');

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  let playerUrl = null;
  for (const testUrl of ['/movie/550', '/tv/1399', '/movies']) {
    await page.goto(`${BASE_URL}${testUrl}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await delay(1000);
    playerUrl = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href*="watch"], a[href*="play"], a[href*="movie/"], a[href*="tv/"]')];
      return links[0]?.href || null;
    });
    if (playerUrl) break;
  }

  if (playerUrl) {
    log('PLAYER', `Found player URL: ${playerUrl}`, 'INFO');
    await navigate(page, new URL(playerUrl).pathname, 'PLAYER');
    await visualCheck(page, 'PLAYER', 'iframe, video', 'Player element', true);

    const hasSandbox = await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      return iframe?.hasAttribute('sandbox') ?? false;
    });
    if (hasSandbox) {
      log('PLAYER', 'IFRAME HAS SANDBOX \u2014 PLAYER WILL BE BLOCKED', 'ERROR');
    } else {
      log('PLAYER', 'No sandbox on iframe', 'INFO');
    }

    const allowFullscreen = await page.evaluate(() => {
      return document.querySelector('iframe')?.getAttribute('allow')?.includes('fullscreen') || false;
    });
    log('PLAYER', `Fullscreen permission: ${allowFullscreen ? 'present' : 'MISSING'}`, allowFullscreen ? 'INFO' : 'WARN');

    const blockedFrames = await page.evaluate(() => {
      const iframes = [...document.querySelectorAll('iframe')];
      return iframes.filter(f => f.clientWidth === 0 && f.clientHeight === 0).length;
    });
    if (blockedFrames > 0) {
      log('SECURITY', `${blockedFrames} zero-dimension iframe(s) \u2014 blocked by CSP/X-Frame-Options`, 'WARN');
    }
  } else {
    log('PLAYER', 'No player page found to test', 'WARN');
  }

  // ═══════════════════════════════════════════════
  //  PHASE 9: AUTH CSRF CHECK
  // ═══════════════════════════════════════════════
  console.log('\n--- PHASE 9: AUTH CSRF CHECK ---\n');

  await navigate(page, '/login', 'CSRF');
  try {
    const result = await page.evaluate(async () => {
      const input = document.querySelector('input[name="csrf_token"]');
      const token = input ? input.value : '';
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'username=&password=',
        credentials: 'include'
      });
      const text = await res.text();
      return { status: res.status, body: text.slice(0, 200), contentType: res.headers.get('content-type') || '' };
    });
    log('CSRF', `POST /login => HTTP ${result.status}`, result.status >= 400 ? 'WARN' : 'INFO');
    log('CSRF', `Response: ${result.body.slice(0, 80).trim()}`, 'INFO');
  } catch (err) {
    log('CSRF', `CSRF test failed: ${err.message}`, 'ERROR');
  }

  // ═══════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════
  const errors = REPORT.filter((r) => r.status === 'ERROR');
  const warnings = REPORT.filter((r) => r.status === 'WARN');
  const infos = REPORT.filter((r) => r.status === 'INFO');

  console.log(`\n${'='.repeat(60)}`);
  console.log('  AUDIT COMPLETE');
  console.log(`${'='.repeat(60)}`);
  console.log(`  \u2705 PASS:     ${infos.length}`);
  console.log(`  \u26A0\uFE0F  WARNINGS: ${warnings.length}`);
  console.log(`  \u274C ERRORS:   ${errors.length}`);
  console.log(`${'='.repeat(60)}`);

  if (errors.length > 0) {
    console.log('\n\u2500\u2500\u2500 ERRORS \u2500\u2500\u2500');
    errors.forEach((e) => console.log(`  \u274C [${e.phase}] ${e.message}`));
  }

  if (warnings.length > 0) {
    console.log('\n\u2500\u2500\u2500 WARNINGS \u2500\u2500\u2500');
    warnings.forEach((w) => console.log(`  \u26A0\uFE0F  [${w.phase}] ${w.message}`));
  }

  console.log('');
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
}

runAudit().catch((err) => {
  console.error('AUDIT CRASHED:', err);
  process.exit(1);
});
