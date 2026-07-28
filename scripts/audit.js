import puppeteer from 'puppeteer';

const BASE_URL = process.env.AUDIT_URL || 'http://localhost:5173';
const REPORT = [];

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
    if (type === 'error') {
      log(phase, `CONSOLE ERROR: ${text}`, 'ERROR');
    } else if (type === 'warning') {
      log(phase, `CONSOLE WARNING: ${text}`, 'WARN');
    }
  });
}

function collectNetwork(page, phase) {
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.includes('localhost') || url.includes(BASE_URL.replace('http://', ''))) {
      log(phase, `NETWORK FAIL: ${req.failure()?.errorText} \u2014 ${url}`, 'ERROR');
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes(BASE_URL.replace('http://', ''))) {
      log(phase, `HTTP ${res.status()}: ${res.url()}`, 'ERROR');
    }
  });
}

async function navigate(page, url, phase) {
  try {
    const response = await page.goto(`${BASE_URL}${url}`, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });
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

async function visualChecks(page, phase, checks) {
  for (const check of checks) {
    try {
      const el = await page.waitForSelector(check.selector, {
        visible: check.visible ?? true,
        timeout: 3000,
      });
      if (el) {
        const box = await el.boundingBox();
        const text = await el.evaluate((node) => node.textContent?.trim().slice(0, 50));
        if (box && (box.x < 0 || box.y < 0 || box.width === 0 || box.height === 0)) {
          log(phase, `${check.label}: FOUND but OFFSCREEN (x:${box.x}, y:${box.y}, w:${box.width}, h:${box.height})`, 'WARN');
        } else {
          log(phase, `${check.label}: VISIBLE \u2014 "${text || '(no text)'}"`, 'INFO');
        }
      }
    } catch {
      log(phase, `${check.label}: NOT FOUND or NOT VISIBLE`, check.required ? 'ERROR' : 'WARN');
    }
  }
}

async function runAudit() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(10000);

  collectConsole(page, 'GLOBAL');
  collectNetwork(page, 'GLOBAL');

  const homeOk = await navigate(page, '/', 'HOMEPAGE');
  if (homeOk) {
    await visualChecks(page, 'HOMEPAGE', [
      { selector: 'header', label: 'Header', required: true },
      { selector: 'header a', label: 'Logo link', required: true },
      { selector: '.auth-nav, header a[href*="signin"], header a[href*="signup"]', label: 'Auth section (desktop)', required: false },
      { selector: '.fab-container, .fab-btn', label: 'User FAB', required: true },
      { selector: 'footer', label: 'Footer', required: false },
    ]);

    const bgColor = await page.evaluate(() => {
      const style = window.getComputedStyle(document.body);
      return style.backgroundColor;
    });
    if (bgColor === 'rgb(255, 255, 255)' || bgColor === 'white') {
      log('HOMEPAGE', 'Background is WHITE \u2014 expected dark theme', 'WARN');
    }

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    if (hasOverflow) {
      log('HOMEPAGE', 'Horizontal overflow detected \u2014 layout is broken', 'ERROR');
    }
  }

  await navigate(page, '/signin', 'AUTH');
  await visualChecks(page, 'AUTH', [
    { selector: 'form', label: 'Sign-in form', required: true },
    { selector: 'input[type="text"], input[name="username"]', label: 'Username input', required: true },
    { selector: 'input[type="password"]', label: 'Password input', required: true },
    { selector: 'button[type="submit"]', label: 'Submit button', required: true },
    { selector: 'a[href*="signup"]', label: 'Link to sign-up', required: true },
  ]);

  await navigate(page, '/signup', 'AUTH');
  await visualChecks(page, 'AUTH', [
    { selector: 'form', label: 'Sign-up form', required: true },
    { selector: 'input[type="text"], input[name="username"]', label: 'Username input', required: true },
    { selector: 'input[type="password"]', label: 'Password input', required: true },
    { selector: 'a[href*="signin"]', label: 'Link to sign-in', required: true },
  ]);

  const contentPages = [
    { url: '/movies', label: 'Movies page' },
    { url: '/tv', label: 'TV page' },
    { url: '/watchlist', label: 'Watchlist' },
  ];

  for (const { url, label } of contentPages) {
    await navigate(page, url, 'CONTENT');
    await visualChecks(page, 'CONTENT', [
      { selector: 'main, .page-content, section', label: `${label} \u2014 main content`, required: false },
    ]);

    const errorText = await page.evaluate(() => {
      const body = document.body.innerText;
      if (body.includes('500') || body.includes('Internal Error') || (body.includes('undefined') && body.length < 100)) {
        return body.slice(0, 200);
      }
      return null;
    });
    if (errorText) {
      log('CONTENT', `${label} \u2014 page contains error text: "${errorText}"`, 'ERROR');
    }
  }

  const breakpoints = [
    { width: 1920, height: 1080, label: 'Desktop (1920px)' },
    { width: 1440, height: 900, label: 'Desktop (1440px)' },
    { width: 1280, height: 800, label: 'Desktop (1280px)' },
    { width: 1024, height: 768, label: 'Tablet (1024px)' },
    { width: 768, height: 1024, label: 'Tablet (768px)' },
    { width: 414, height: 896, label: 'Mobile (414px)' },
    { width: 375, height: 812, label: 'Mobile (375px)' },
    { width: 320, height: 568, label: 'Mobile (320px)' },
  ];

  for (const { width, height, label } of breakpoints) {
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 10000 });

    const overflow = await page.evaluate(() => {
      return {
        horizontal: document.documentElement.scrollWidth > window.innerWidth,
        vertical: document.documentElement.scrollHeight > window.innerHeight,
      };
    });

    if (overflow.horizontal) {
      log('RESPONSIVE', `${label}: Horizontal overflow`, 'ERROR');
    }

    try {
      const fab = await page.$('.fab-btn, .fab-container button');
      if (fab) {
        const box = await fab.boundingBox();
        if (box) {
          const inBounds = box.x > 0 && box.y > 0 && box.x + box.width < width && box.y + box.height < height;
          if (!inBounds) {
            log('RESPONSIVE', `${label}: FAB outside viewport (${box.x}, ${box.y})`, 'WARN');
          }
        }
      }
    } catch {
      log('RESPONSIVE', `${label}: FAB not found`, 'WARN');
    }

    log('RESPONSIVE', `${label}: passed`, 'INFO');
    await page.waitForTimeout(500);
  }

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  let playerUrl = null;
  for (const testUrl of ['/movie/550', '/tv/1399', '/movies']) {
    await page.goto(`${BASE_URL}${testUrl}`, { waitUntil: 'networkidle2', timeout: 10000 });
    playerUrl = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href*="watch"], a[href*="play"], a[href*="movie/"], a[href*="tv/"]')];
      return links[0]?.href || null;
    });
    if (playerUrl) break;
  }

  if (playerUrl) {
    await navigate(page, new URL(playerUrl).pathname, 'PLAYER');
    await visualChecks(page, 'PLAYER', [
      { selector: 'iframe, video', label: 'Player element', required: true },
    ]);

    const hasSandbox = await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      return iframe?.hasAttribute('sandbox') ?? false;
    });
    if (hasSandbox) {
      log('PLAYER', 'IFRAME HAS SANDBOX ATTRIBUTE \u2014 PLAYER WILL BE BLOCKED', 'ERROR');
    } else {
      log('PLAYER', 'No sandbox attribute \u2014 good', 'INFO');
    }

    const allow = await page.evaluate(() => {
      return document.querySelector('iframe')?.getAttribute('allow') || '';
    });
    if (!allow.includes('fullscreen')) {
      log('PLAYER', 'allow attribute missing fullscreen permission', 'WARN');
    }
  } else {
    log('PLAYER', 'Could not find a player page to test', 'WARN');
  }

  const blockedFrames = await page.evaluate(() => {
    const iframes = [...document.querySelectorAll('iframe')];
    return iframes.filter(f => f.clientWidth === 0 && f.clientHeight === 0).length;
  });
  if (blockedFrames > 0) {
    log('SECURITY', `${blockedFrames} iframe(s) have zero dimensions \u2014 possibly blocked by CSP/X-Frame-Options`, 'WARN');
  }

  await navigate(page, '/signin', 'AUTH-FLOW');
  try {
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForTimeout(1000);

      const stillAlive = await page.evaluate(() => document.body.innerText.length > 0);
      if (!stillAlive) {
        log('AUTH-FLOW', 'Page crashed after empty form submit', 'ERROR');
      }

      const errorMsg = await page.evaluate(() => {
        const body = document.body.innerText.toLowerCase();
        return body.includes('required') || body.includes('invalid') || body.includes('error') || body.includes('please');
      });
      if (!errorMsg) {
        log('AUTH-FLOW', 'No validation message after empty form submit', 'WARN');
      } else {
        log('AUTH-FLOW', 'Validation message shown for empty form \u2014 good', 'INFO');
      }
    }
  } catch (err) {
    log('AUTH-FLOW', `Form test failed: ${err.message}`, 'ERROR');
  }

  await navigate(page, '/', 'FAB');
  try {
    const fabBtn = await page.$('.fab-btn');
    if (fabBtn) {
      await fabBtn.click();
      await page.waitForTimeout(500);

      const panelOpen = await page.evaluate(() => {
        return !!document.querySelector('.fab-panel');
      });
      if (panelOpen) {
        log('FAB', 'Panel opens on click \u2014 good', 'INFO');

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        const panelClosed = await page.evaluate(() => {
          return !document.querySelector('.fab-panel');
        });
        if (panelClosed) {
          log('FAB', 'Panel closes on Escape \u2014 good', 'INFO');
        } else {
          log('FAB', 'Panel did NOT close on Escape', 'WARN');
        }
      } else {
        log('FAB', 'Panel did NOT open on click', 'ERROR');
      }
    }
  } catch (err) {
    log('FAB', `FAB interaction failed: ${err.message}`, 'ERROR');
  }

  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 10000 });

  try {
    const hamburger = await page.$('[aria-label*="menu"], .hamburger, .menu-btn, button[aria-label*="Open"]');
    if (hamburger) {
      await hamburger.click();
      await page.waitForTimeout(500);

      const drawerOpen = await page.evaluate(() => {
        return !!document.querySelector('.menu-panel, .drawer, .menu-open, [class*="slide"]');
      });
      if (drawerOpen) {
        log('MOBILE', 'Hamburger menu opens \u2014 good', 'INFO');
      } else {
        log('MOBILE', 'Hamburger button found but drawer did not open', 'WARN');
      }
    } else {
      log('MOBILE', 'No hamburger menu button found at 375px', 'WARN');
    }
  } catch (err) {
    log('MOBILE', `Mobile menu test failed: ${err.message}`, 'ERROR');
  }

  const errors = REPORT.filter((r) => r.status === 'ERROR');
  const warnings = REPORT.filter((r) => r.status === 'WARN');
  const infos = REPORT.filter((r) => r.status === 'INFO');

  console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log(' AUDIT COMPLETE');
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log(`  \u2705 INFO:     ${infos.length}`);
  console.log(`  \u26A0\uFE0F  WARNINGS: ${warnings.length}`);
  console.log(`  \u274C ERRORS:   ${errors.length}`);
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

  if (errors.length > 0) {
    console.log('\u2500\u2500\u2500 ERRORS \u2500\u2500\u2500');
    errors.forEach((e) => console.log(`  \u274C [${e.phase}] ${e.message}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('\u2500\u2500\u2500 WARNINGS \u2500\u2500\u2500');
    warnings.forEach((w) => console.log(`  \u26A0\uFE0F  [${w.phase}] ${w.message}`));
    console.log('');
  }

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
}

runAudit().catch((err) => {
  console.error('AUDIT SCRIPT CRASHED:', err);
  process.exit(1);
});
