// scripts/auth-audit.js
//
// Usage:
//   node scripts/auth-audit.js https://your-domain.com
//
// Tests: signup -> login -> auth UI -> logout

const puppeteer = require('puppeteer');

const BASE_URL = process.argv[2] || 'http://localhost:5173';
const TEST_USER = {
  username: `testuser_${Date.now()}`,
  email: `test_${Date.now()}@streamium.test`,
  password: 'Test1234!@#$',
};

const results = [];
let criticalErrors = [];
let authNetworkFails = [];

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForUrlChange(page, expectedSubstring, timeout = 8000) {
  const startUrl = page.url();
  const poll = async () => {
    for (let i = 0; i < timeout / 200; i++) {
      await wait(200);
      const cur = page.url();
      if (cur !== startUrl && (!expectedSubstring || cur.includes(expectedSubstring))) return cur;
    }
    return null;
  };
  return poll();
}

async function findButtonByText(page, texts, parentSelector = '') {
  const baseSelector = parentSelector
    ? `${parentSelector} button, ${parentSelector} a, ${parentSelector} input[type="submit"]`
    : 'button, a, input[type="submit"]';
  const buttons = await page.$$(baseSelector);
  for (const btn of buttons) {
    const text = await page.evaluate(el => (el.textContent || el.value || '').toLowerCase().trim(), btn);
    if (texts.some(t => text.includes(t.toLowerCase()))) return btn;
  }
  return null;
}

async function findSubmitButton(page, parentSelector = '') {
  const baseSelector = parentSelector
    ? `${parentSelector} button[type="submit"], ${parentSelector} input[type="submit"]`
    : 'button[type="submit"], input[type="submit"]';
  let btn = await page.$(baseSelector);
  if (btn) return btn;
  return findButtonByText(page, ['sign up', 'register', 'create account', 'skep rekening', 'sign in', 'login', 'teken aan'], parentSelector);
}

function log(step, status, detail = '') {
  const icon = status === 'PASS' ? '✔' : status === 'FAIL' ? '✘' : '!';
  const entry = { step, status, detail, time: new Date().toISOString() };
  results.push(entry);
  console.log(`${icon} [${status}] ${step}${detail ? ` - ${detail}` : ''}`);
}

async function run() {
  console.log(`\nAuth Audit`);
  console.log(`   Target: ${BASE_URL}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const errors = [];
  const networkFails = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ text: msg.text(), location: msg.location() });
    }
  });

  page.on('requestfailed', (req) => {
    if (req.failure()?.errorText !== 'net::ERR_ABORTED') {
      networkFails.push({
        url: req.url(),
        error: req.failure()?.errorText,
        status: req.response()?.status(),
      });
    }
  });

  try {
    // PHASE 1
    console.log('--- PHASE 1: AUTH UI ON HOMEPAGE ---\n');

    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(2000);

    const header = await page.$('header');
    log('Header exists on homepage', header ? 'PASS' : 'FAIL');

    const signInBtn = await page.evaluate(() => {
      const sel = document.querySelector('[data-testid="signin-btn"], .signin-btn, .auth-signin, a[href*="login"], a[href*="signin"], a[href*="auth"]');
      if (sel) return true;
      const buttons = document.querySelectorAll('button, a');
      for (const b of buttons) {
        const t = b.textContent?.toLowerCase() || '';
        if (t.includes('sign in') || t.includes('login') || t.includes('teken aan')) return true;
      }
      return false;
    });
    log('Sign-in button visible on homepage', signInBtn ? 'PASS' : 'FAIL', signInBtn ? '' : 'No sign-in button found');

    const authBtn = await page.$('.auth-nav, .user-btn, [data-testid="user-btn"], [data-fab], .user-fab');
    log('Auth UI element on homepage', authBtn ? 'PASS' : '!', authBtn ? 'Auth component visible' : 'No auth component (expected if not logged in)');

    // PHASE 2
    console.log('\n--- PHASE 2: LOGIN PAGE ---\n');

    const loginPaths = ['/login', '/signin', '/auth', '/auth/login'];
    let loginPageFound = false;

    for (const path of loginPaths) {
      try {
        await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle2', timeout: 15000 });
        await wait(1000);
        const form = await page.$('form');
        const usernameInput = await page.$('input[name="username"], input[type="text"], input[placeholder*="username"], input[placeholder*="Username"], input[placeholder*="gebruiker"]');
        const passwordInput = await page.$('input[type="password"], input[name="password"]');
        if (form && usernameInput && passwordInput) {
          loginPageFound = true;
          log(`Login page found at ${path}`, 'PASS');
          break;
        }
      } catch {}
    }

    if (!loginPageFound) {
      log('Login page', 'FAIL', 'No login form found at /login, /signin, /auth, or /auth/login');
      if (signInBtn) {
        try {
          await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
          await wait(1000);
          const btn = await page.$('[data-testid="signin-btn"], .signin-btn, .auth-signin, a[href*="login"], a[href*="signin"], a[href*="auth"]')
            || await findButtonByText(page, ['sign in', 'login', 'teken aan']);
          if (btn) {
            await btn.click();
            await wait(2000);
            const newForm = await page.$('form');
            log('Clicked sign-in button form appeared', newForm ? 'PASS' : 'FAIL');
          }
        } catch (e) {
          log('Clicked sign-in button form', 'FAIL', e.message);
        }
      }
    }

    // PHASE 3
    console.log('\n--- PHASE 3: SIGNUP FLOW ---\n');

    const signupPaths = ['/signup', '/register', '/auth/signup', '/auth/register'];
    let signupPageFound = false;

    for (const path of signupPaths) {
      try {
        await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle2', timeout: 15000 });
        await wait(1000);
        const form = await page.$('form');
        if (form) {
          signupPageFound = true;
          log(`Signup page found at ${path}`, 'PASS');
          break;
        }
      } catch {}
    }

    if (!signupPageFound) {
      log('Signup page', 'FAIL', 'No signup form at /signup, /register, /auth/signup, /auth/register');
    }

    try {
      const usernameField = await page.$('input[name="username"], input[placeholder*="username"], input[placeholder*="Username"], input[placeholder*="gebruiker"], input[aria-label*="username" i]');
      const emailField = await page.$('input[type="email"], input[name="email"], input[placeholder*="email"], input[placeholder*="Email"]');
      const pwField = await page.$('input[type="password"][name="password"], input[type="password"]:not([name="confirm"])');
      const confirmPwField = await page.$('input[name="confirmPassword"], input[name="confirm_password"], input[placeholder*="confirm" i]');
      const submitButton = await page.$('button[type="submit"], input[type="submit"]')
        || await findButtonByText(page, ['sign up', 'register', 'create account', 'skep rekening']);

      if (usernameField && pwField && submitButton) {
        const fields = emailField ? 'username, email, password, submit' : 'username, password, submit';
        log('Signup form fields found', 'PASS', fields);

        await usernameField.click({ clickCount: 3 });
        await usernameField.type(TEST_USER.username);
        if (emailField) {
          await emailField.click({ clickCount: 3 });
          await emailField.type(TEST_USER.email);
        }
        await pwField.click({ clickCount: 3 });
        await pwField.type(TEST_USER.password);

        if (confirmPwField) {
          await confirmPwField.click({ clickCount: 3 });
          await confirmPwField.type(TEST_USER.password);
        }

        const navPromise = waitForUrlChange(page, '/');
        await submitButton.click();
        const newUrl = await navPromise || page.url();

        if (!newUrl.includes('/signup') && !newUrl.includes('/register')) {
          log('Signup submitted successfully', 'PASS', `Redirected to: ${new URL(newUrl).pathname}`);
        } else {
          const errorEl = await page.$('.error, .error-message, [data-error], [role="alert"], .form-error, .text-red-500, .text-destructive');
          const errorText = errorEl ? await page.evaluate(el => el.textContent, errorEl) : '';
          log('Signup form submission', 'FAIL', errorText?.trim() || 'Redirected back to signup page - likely CSRF or validation error');
        }
      } else {
        const missing = [];
        if (!usernameField) missing.push('username');
        if (!pwField) missing.push('password');
        if (!submitButton) missing.push('submit button');
        log('Signup form fields', 'FAIL', `Missing: ${missing.join(', ')}`);
      }
    } catch (e) {
      log('Signup flow', 'FAIL', e.message);
    }

    // PHASE 4
    console.log('\n--- PHASE 4: LOGIN FLOW ---\n');

    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await wait(1000);

      const atLoginPage = page.url().includes('/login');

      if (!atLoginPage) {
        log('Login form already logged in', 'PASS', `Skipped: session active from signup (at ${new URL(page.url()).pathname})`);

        await wait(500);
        const loggedInEl = await page.$('.auth-nav, .user-btn, [data-testid="user-btn"], [data-fab], .user-fab, .avatar');
        log('Post-login auth UI (from signup session)', loggedInEl ? 'PASS' : '!', loggedInEl ? 'Auth component visible (logged in)' : 'Auth component not found');
      } else {
        const usernameField = await page.$('input[name="username"], input[type="text"], input[placeholder*="username"], input[placeholder*="Username"], input[placeholder*="gebruiker"], input[aria-label*="username" i]');
        const pwField = await page.$('input[type="password"]');
        const submitButton = await page.$('button[type="submit"]')
          || await findButtonByText(page, ['sign in', 'login', 'teken aan']);

        if (usernameField && pwField && submitButton) {
          log('Login form fields found', 'PASS');

          await usernameField.click({ clickCount: 3 });
          await usernameField.type(TEST_USER.username);
          await pwField.click({ clickCount: 3 });
          await pwField.type(TEST_USER.password);

          const navPromise = waitForUrlChange(page, '/');
          await submitButton.click();
          const newUrl = await navPromise || page.url();

          if (!newUrl.includes('/login') && !newUrl.includes('/signin')) {
            log('Login submitted successfully', 'PASS', `Redirected to: ${new URL(newUrl).pathname}`);
            await wait(2000);
          } else {
            const errorEl = await page.$('.error, .error-message, [data-error], [role="alert"], .form-error, .text-red-500, .text-destructive');
            const errorText = errorEl ? await page.evaluate(el => el.textContent, errorEl) : '';
            log('Login form submission', 'FAIL', errorText?.trim() || 'Redirected back to login page');
          }
        } else {
          const missing = [];
          if (!usernameField) missing.push('username/email');
          if (!pwField) missing.push('password');
          if (!submitButton) missing.push('submit button');
          log('Login form fields', 'FAIL', `Missing: ${missing.join(', ')}`);
        }
      }
    } catch (e) {
      log('Login flow', 'FAIL', e.message);
    }

    // PHASE 5
    console.log('\n--- PHASE 5: LOGOUT FLOW ---\n');

    try {
      const wasLoggedIn = !!(await page.$('.user-btn'));
      if (wasLoggedIn) {
        await page.evaluate(async () => {
          await fetch('/logout', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'csrf_token=' });
        });
        await wait(1500);
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        await wait(1000);
        const stillLoggedIn = await page.$('.user-btn');
        log('Logout via POST /logout', stillLoggedIn ? 'FAIL' : 'PASS', stillLoggedIn ? 'Still logged in after logout' : 'Session cleared, user is logged out');
      } else {
        log('Logout already logged out', '!', 'No user button found - may already be logged out');
      }
    } catch (e) {
      log('Logout flow', 'FAIL', e.message);
    }

    // PHASE 6
    console.log('\n--- PHASE 6: MOBILE AUTH UI ---\n');

    await page.setViewport({ width: 375, height: 812 });

    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      await wait(1500);

      const hamburgerBtn = await page.$('[data-hamburger], .hamburger-btn, button[aria-label*="menu" i], button[aria-label*="open" i]');
      if (hamburgerBtn) {
        await hamburgerBtn.click();
        await wait(800);
        const menuLinks = await page.$$eval('nav a, [data-menu] a, .menu a, .drawer a', (links) =>
          links.map(a => ({ text: a.textContent?.trim(), href: a.getAttribute('href') }))
        );
        log('Mobile menu opened', menuLinks.length > 0 ? 'PASS' : 'FAIL');
        log('Mobile menu has auth link', menuLinks.some(l => /sign.?in|login|teken.?aan|sign.?out|logout|profile/i.test(l.text || '')) ? 'PASS' : '!', menuLinks.length > 0 ? `Links: ${menuLinks.map(l => l.text).filter(Boolean).join(', ')}` : 'Auth link missing from mobile menu');
      } else {
        log('Mobile hamburger menu', 'FAIL', 'No hamburger button found on mobile');
      }

      const mobileAuthEl = await page.$('.auth-nav, .user-btn, [data-fab], .user-fab, a[href*="login"], a[href*="profile"]');
      log('Mobile auth element visible', mobileAuthEl ? 'PASS' : '!');
    } catch (e) {
      log('Mobile auth check', 'FAIL', e.message);
    }

    // PHASE 7
    console.log('\n--- PHASE 7: NETWORK & CONSOLE SUMMARY ---\n');

    criticalErrors = errors.filter(e =>
      !e.text?.includes('ERR_BLOCKED_BY_CLIENT') &&
      !e.text?.includes('favicon') &&
      !e.text?.includes('preloaded')
    );

    log('Console errors (excluding blocked ads/preloads)', criticalErrors.length === 0 ? 'PASS' : 'FAIL', `${criticalErrors.length} errors found`);

    authNetworkFails = networkFails.filter(f =>
      f.url?.includes('/api/auth') || f.url?.includes('login') || f.url?.includes('signup')
    );

    log('Auth network failures', authNetworkFails.length === 0 ? 'PASS' : 'FAIL', `${authNetworkFails.length} failure(s)`);

    if (criticalErrors.length > 0) {
      console.log('\n   Console errors:');
      criticalErrors.forEach((e, i) => console.log(`   ${i + 1}. ${e.text?.slice(0, 120)}`));
    }

    if (authNetworkFails.length > 0) {
      console.log('\n   Auth network failures:');
      authNetworkFails.forEach((f) => console.log(`   - ${f.url} -> ${f.error}`));
    }

  } catch (e) {
    log('Audit crashed', 'FAIL', e.message);
    console.error(e);
  } finally {
    await browser.close();
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === '!').length;

  console.log(`\n===========================`);
  console.log(`  AUTH AUDIT COMPLETE`);
  console.log(`  ${passed} passed`);
  console.log(`  ${failed} failed`);
  console.log(`  ${warnings} warnings`);
  console.log(`===========================\n`);

  const fs = require('fs');
  fs.writeFileSync(
    'scripts/auth-audit-report.json',
    JSON.stringify({ summary: { passed, failed, warnings }, results, errors: criticalErrors || [], networkFails: authNetworkFails || [] }, null, 2)
  );
  console.log('   Full report saved to: scripts/auth-audit-report.json\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
