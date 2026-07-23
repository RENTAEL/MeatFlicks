import puppeteer from 'puppeteer';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

const BASE_URL = 'https://streamium-cosmic.vercel.app';
const TEST_MOVIE_ID = '27205';

if (!existsSync('audit-screenshots')) mkdirSync('audit-screenshots');

const REPORT = {
  timestamp: new Date().toISOString(),
  movie: 'Inception (27205)',
  steps: [],
  summary: {},
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function step(name, fn) {
  const s = { name, status: 'pending', detail: '' };
  try {
    const result = await fn();
    s.status = result.ok ? 'PASS' : 'FAIL';
    s.detail = result.detail || '';
    console.log(`  ${result.ok ? '\u2705' : '\u274c'} ${name}${result.detail ? ' \u2014 ' + result.detail : ''}`);
  } catch (e) {
    s.status = 'ERROR';
    s.detail = e.message;
    console.log(`  \u2728 ${name} \u2014 ${e.message}`);
  }
  REPORT.steps.push(s);
  return s;
}

async function crawl() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const errors = { console: [], network: [] };
  page.on('console', msg => { if (msg.type() === 'error') errors.console.push(msg.text()); });
  page.on('requestfailed', req => errors.network.push({ url: req.url(), error: req.failure()?.errorText, status: req.response()?.status() }));

  console.log(`\n\ud83c\udfaf AUDITING: ${BASE_URL}/movie/${TEST_MOVIE_ID}\n`);

  await step('Navigate to movie detail page', async () => {
    try {
      const resp = await page.goto(`${BASE_URL}/movie/${TEST_MOVIE_ID}`, { waitUntil: 'networkidle2', timeout: 30000 });
      const status = resp?.status();
      if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
      return { ok: true, detail: 'loaded (HTTP200)' };
    } catch (e) {
      return { ok: false, detail: e.message };
    }
  });

  try { await page.screenshot({ path: 'audit-screenshots/debug-movie-detail.png', fullPage: false }); } catch {}

  await step('Page has content (not empty/error)', async () => {
    const body = await page.$eval('body', el => el.innerText).catch(() => '');
    if (body.length < 50) return { ok: false, detail: `body has ${body.length} chars \u2014 nearly empty` };
    if (body.includes('500') || body.includes('Internal Server Error')) return { ok: false, detail: 'server error' };
    if (body.includes('404') || body.includes('Not Found')) return { ok: false, detail: '404 not found' };
    if (body.includes("You're offline")) return { ok: false, detail: 'offline message' };
    return { ok: true, detail: `${body.length} chars` };
  });

  await step('Movie title visible', async () => {
    const selectors = ['h1', 'h2', 'h3', '[class*="title"]', '[class*="heading"]', '[class*="name"]'];
    let found = null;
    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const text = (await el.evaluate(e => e.innerText)).trim();
          if (text.length > 2) { found = { sel, text }; break; }
        }
      } catch {}
    }
    if (!found) return { ok: false, detail: 'no title element found with >2 chars' };
    console.log(`     Title: "${found.text}" (from ${found.sel})`);
    return { ok: true, detail: `"${found.text}"` };
  });

  await step('Poster or backdrop image loads', async () => {
    const selectors = [
      'img[src*="tmdb"]',
      'img[class*="poster"]',
      'img[class*="backdrop"]',
      'img[class*="cover"]',
      'img[class*="hero"]',
    ];
    for (const sel of selectors) {
      const el = await page.$(sel).catch(() => null);
      if (el) {
        const src = await el.evaluate(e => e.src).catch(() => '');
        const natural = await el.evaluate(e => e.naturalWidth).catch(() => 0);
        if (natural > 0) return { ok: true, detail: `${natural}px wide, from ${src.substring(0, 60)}` };
      }
    }
    return { ok: false, detail: 'no loaded image found' };
  });

  await step('Movie details (overview, rating, etc.)', async () => {
    const body = await page.$eval('body', el => el.innerText).catch(() => '');
    const checks = {
      overview: body.length > 100,
      rating: /\d\.\d|rating/i.test(body),
      year: /\b(19|20)\d{2}\b/.test(body),
      genre: /action|drama|sci.?fi|thriller|comedy|adventure/i.test(body),
      duration: /min|hour|runtime/i.test(body),
    };
    const passed = Object.entries(checks).filter(([, v]) => v);
    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    if (passed.length < 3) return { ok: false, detail: `missing: ${failed.join(', ')}` };
    return { ok: true, detail: `found: ${passed.map(([k]) => k).join(', ')}` };
  });

  let playSelector = null;
  await step('Play/watch button exists', async () => {
    const candidates = [
      'button',
      'a',
      '[class*="play"]',
      '[class*="Play"]',
      '[class*="watch"]',
      '[data-action="play"]',
      '[role="button"]',
    ];

    for (const sel of candidates) {
      const els = await page.$$(sel);
      for (const el of els) {
        const text = await el.evaluate(e => e.innerText || e.textContent || '').catch(() => '');
        if (/play|watch|stream|\u25b6/i.test(text)) {
          playSelector = sel;
          const tag = await el.evaluate(e => e.tagName);
          const classes = await el.evaluate(e => e.className);
          console.log(`     Found: <${tag}> "${text.trim()}" classes="${classes}"`);
          return { ok: true, detail: `<${tag}> "${text.trim()}"` };
        }
      }
    }
    return { ok: false, detail: 'no element with "play"/"watch"/"\u25b6" text' };
  });

  if (!playSelector) {
    console.log('\n\u2b1b Cannot continue \u2014 no play button. Stopping.');
    await browser.close();
    return REPORT;
  }

  const preClickUrl = page.url();
  let clicked = false;

  await step('Click play button', async () => {
    const els = await page.$$(playSelector);
    for (const el of els) {
      const text = await el.evaluate(e => e.innerText || e.textContent || '').catch(() => '');
      if (/play|watch|stream|\u25b6/i.test(text)) {
        try {
          await el.click();
          clicked = true;
          return { ok: true, detail: 'clicked' };
        } catch (e) {
          return { ok: false, detail: `click failed: ${e.message}` };
        }
      }
    }
    return { ok: false, detail: 'play button disappeared' };
  });

  if (!clicked) {
    console.log('\n\u2b1b Cannot continue \u2014 click failed.');
    await browser.close();
    return REPORT;
  }

  await sleep(3000);
  try { await page.screenshot({ path: 'audit-screenshots/debug-after-play-click.png', fullPage: false }); } catch {}

  await step('Play button does NOT navigate away', async () => {
    const postUrl = page.url();
    if (postUrl === preClickUrl) return { ok: true, detail: 'stayed on same page' };
    if (postUrl.includes('/movie/')) return { ok: true, detail: 'still on a movie page (same or different)' };
    return { ok: false, detail: `navigated away to: ${postUrl}` };
  });

  await step('Video player or iframe appears', async () => {
    const playerChecks = [
      { sel: 'video', type: 'HTML5 video' },
      { sel: 'iframe[src*="stream"]', type: 'stream iframe' },
      { sel: 'iframe[src*="player"]', type: 'player iframe' },
      { sel: 'iframe[src*="vidlink"]', type: 'vidlink iframe' },
      { sel: 'iframe[src*="embed"]', type: 'embed iframe' },
      { sel: 'iframe[src*="vidsrc"]', type: 'vidsrc iframe' },
      { sel: 'iframe[src*="2embed"]', type: '2embed iframe' },
      { sel: 'iframe[src*="movie"]', type: 'movie iframe' },
      { sel: '[class*="player"]', type: 'player container' },
      { sel: '[class*="Player"]', type: 'Player container' },
      { sel: '[class*="video"]', type: 'video container' },
      { sel: '#player', type: '#player container' },
      { sel: '[id*="player"]', type: 'player ID' },
    ];

    for (const { sel, type } of playerChecks) {
      try {
        const el = await page.$(sel);
        if (el) {
          const box = await el.boundingBox();
          if (box && box.width > 0 && box.height > 0) {
            const src = sel.startsWith('iframe') ? await el.evaluate(e => e.src).catch(() => '') : '';
            if (src.includes('undefined')) {
              return { ok: false, detail: `${type} found but URL has "undefined" \u2192 ${src.substring(0, 80)}` };
            }
            return { ok: true, detail: `${type} visible (${Math.round(box.width)}\u00d7${Math.round(box.height)}px)${src ? ' \u2192 ' + src.substring(0, 80) : ''}` };
          }
        }
      } catch {}
    }

    const anyVid = await page.$('video');
    const anyIframe = await page.$('iframe');
    if (anyVid || anyIframe) {
      const tag = anyVid ? 'video' : 'iframe';
      const el = anyVid || anyIframe;
      const box = await el.boundingBox();
      if (box && box.width > 0) {
        return { ok: true, detail: `${tag} found but not in standard selectors` };
      }
    }

    return { ok: false, detail: 'no player element appeared' };
  });

  await step('Streaming API/resolver requests made', async () => {
    const streamReqs = errors.network.filter(r => 
      r.url.includes('stream') || r.url.includes('player') || 
      r.url.includes('vidlink') || r.url.includes('vidsrc') ||
      r.url.includes('embed') || r.url.includes('resolve') ||
      r.url.includes('provider') || r.url.includes('api/')
    );
    if (streamReqs.length === 0) {
      return { ok: false, detail: 'no streaming-related network requests at all' };
    }

    const summary = streamReqs.map(r => {
      const status = r.status ? `(HTTP ${r.status})` : r.error ? `(ERR: ${r.error})` : '';
      return `${r.url.substring(0, 80)} ${status}`;
    }).join(' | ');
    
    const failures = streamReqs.filter(r => r.status && r.status >= 400 || r.error);
    if (failures.length === streamReqs.length) {
      return { ok: false, detail: `all ${streamReqs.length} requests failed: ${summary}` };
    }
    if (failures.length > 0) {
      return { ok: true, detail: `${streamReqs.length} requests, ${failures.length} failed \u2014 ${summary}` };
    }
    return { ok: true, detail: `${streamReqs.length} requests made` };
  });

  await step('No console errors after play', async () => {
    const relevant = errors.console.filter(e => 
      e.includes('error') || e.includes('Error') || e.includes('fail') ||
      e.includes('undefined') || e.includes('null') || e.includes('cannot') ||
      e.includes('provider') || e.includes('stream') || e.includes('video')
    );
    if (relevant.length === 0) return { ok: true, detail: 'no errors' };
    return { ok: false, detail: `${relevant.length} errors: ${relevant.slice(0, 3).join(' | ')}` };
  });

  console.log('\n\ud83d\udccb CHECKING SUGGESTED/RELATED MOVIES\n');

  await step('Scroll to bottom reveals content', async () => {
    const preScroll = await page.$eval('body', el => el.scrollHeight).catch(() => 0);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(2000);
    const postScroll = await page.$eval('body', el => el.scrollHeight).catch(() => 0);
    if (postScroll > preScroll + 100) return { ok: true, detail: `page grew by ${postScroll - preScroll}px (lazy load)` };
    return { ok: true, detail: `no lazy growth (${preScroll} \u2192 ${postScroll}px)` };
  });

  try { await page.screenshot({ path: 'audit-screenshots/debug-suggestions.png', fullPage: true }); } catch {}

  await step('Suggested/related section exists', async () => {
    const labelChecks = [
      { sel: 'h2, h3, [class*="title"]', text: /suggest|recommend|related|similar|you might|more like|also/i },
      { sel: '*', text: /suggested|recommended|related|similar/i },
    ];
    for (const { sel, text } of labelChecks) {
      const els = await page.$$(sel);
      for (const el of els) {
        const t = await el.evaluate(e => e.innerText).catch(() => '');
        if (text.test(t)) return { ok: true, detail: `found heading: "${t.trim()}"` };
      }
    }
    return { ok: false, detail: 'no "suggested/related/similar" heading' };
  });

  await step('Suggested cards are present (\u22653)', async () => {
    const allCards = await page.$$eval('a[href*="/movie/"], a[href*="/tv/"]', els => 
      els.filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top > 400;
      }).map(e => ({ href: e.href, text: e.innerText?.substring(0, 40) }))
    );
    if (allCards.length >= 3) return { ok: true, detail: `${allCards.length} cards (e.g., ${allCards[0].text})` };
    if (allCards.length > 0) return { ok: false, detail: `only ${allCards.length} cards` };
    return { ok: false, detail: 'zero suggested cards below main content' };
  });

  await step('Clicking suggested card navigates to new movie', async () => {
    const preUrl = page.url();
    try {
      const cards = await page.$$('a[href*="/movie/"], a[href*="/tv/"]');
      for (const card of cards) {
        const rect = await card.boundingBox();
        if (rect && rect.y > 400 && rect.width > 0) {
          await card.click();
          await sleep(3000);
          break;
        }
      }
    } catch {}
    const newUrl = page.url();
    if (newUrl !== preUrl && !newUrl.includes(TEST_MOVIE_ID)) {
      const title = await page.$eval('h1, h2, [class*="title"]', el => el.innerText).catch(() => '');
      return { ok: true, detail: `navigated to "${title?.trim() || '(no title)'}"` };
    }
    return { ok: false, detail: `still on same page: ${newUrl}` };
  });

  await step('TMDB API calls on detail page succeed', async () => {
    const tmdbFails = errors.network.filter(r => r.url.includes('tmdb') && (r.status >= 400 || r.error));
    const tmdbOk = errors.network.filter(r => r.url.includes('tmdb') && r.status < 400);
    if (tmdbFails.length > 0) return { ok: false, detail: `${tmdbFails.length} failed TMDB calls: ${tmdbFails.map(r => r.url.substring(0, 60)).join(', ')}` };
    if (tmdbOk.length > 0) return { ok: true, detail: `${tmdbOk.length} TMDB calls OK` };
    return { ok: false, detail: 'no TMDB API calls at all \u2014 data is not being fetched from TMDB' };
  });

  await browser.close();

  const passed = REPORT.steps.filter(s => s.status === 'PASS').length;
  const failed = REPORT.steps.filter(s => s.status === 'FAIL').length;
  const errors_count = REPORT.steps.filter(s => s.status === 'ERROR').length;

  REPORT.summary = { total: REPORT.steps.length, passed, failed, errors: errors_count };

  console.log('\n═══════════════════════════════════════');
  console.log(' MOVIE FLOW AUDIT COMPLETE');
  console.log('═══════════════════════════════════════');
  console.log(`  \u2705 Passed: ${passed}`);
  console.log(`  \u274c Failed: ${failed}`);
  console.log(`  \u2728 Errors: ${errors_count}`);

  if (failed + errors_count > 0) {
    console.log('\n\u274c FAILURES:');
    REPORT.steps.filter(s => s.status !== 'PASS').forEach(s => {
      console.log(`  [${s.status}] ${s.name}`);
      console.log(`    ${s.detail}`);
    });
  }

  generateFixScript(REPORT);

  writeFileSync('audit-movie-flow.json', JSON.stringify(REPORT, null, 2));
  console.log('\n\ud83d\udcca Full report: audit-movie-flow.json');
  console.log('\ud83d\udd27 Fix script: fix-movie-flow.sh');
  console.log('\ud83d\udcf8 Screenshots: audit-screenshots/debug-*.png');

  return REPORT;
}

function generateFixScript(report) {
  const failures = report.steps.filter(s => s.status !== 'PASS');

  let script = `#!/bin/bash
# Fix script generated by audit-movie-flow.js
# Failures: ${failures.length}
# Run after fixing each issue, redeploy, and re-run: node audit-movie-flow.js

echo "Fix these ${failures.length} issues:"

`;

  failures.forEach((s, idx) => {
    script += `# ${idx + 1}. ${s.name}: ${s.detail}\n`;
  });

  script += `
echo ""
echo "After fixing:"
echo "  1. git add . && git commit -m 'fix: movie flow issues' && git push"
echo "  2. Wait for Vercel deploy"
echo "  3. node audit-movie-flow.js   # re-run to verify"
echo "  4. Repeat until 0 failures"
`;

  writeFileSync('fix-movie-flow.sh', script);
}

crawl().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });