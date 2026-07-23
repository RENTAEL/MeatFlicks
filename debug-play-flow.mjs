import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

// Collect console logs
p.on('console', msg => console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`));
p.on('requestfailed', req => console.log(`[NET ERR] ${req.url()} ${req.failure()?.errorText}`));

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 3000));

// Find the Play button
const play = await p.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const playBtn = btns.find(b => (b.innerText || '').trim().toLowerCase() === 'play');
  if (!playBtn) return { error: 'no play button' };
  return {
    id: playBtn.id,
    outerHTML: playBtn.outerHTML.substring(0, 500),
    attrs: Array.from(playBtn.attributes).map(a => ({ name: a.name, value: a.value.substring(0, 100) })),
  };
});
console.log('Play button:', JSON.stringify(play, null, 2));

// Click Play
const playBtn = await p.$('button');
const btns = await p.$$('button');
for (const btn of btns) {
  const t = await btn.evaluate(el => (el.innerText || '').trim().toLowerCase());
  if (t === 'play') {
    console.log('Clicking Play...');
    await btn.click();
    await new Promise(r => setTimeout(r, 1000));
    break;
  }
}

// Check what appeared
const afterClick = await p.evaluate(() => {
  // Check for dropdown content
  const dropContent = document.querySelector('[data-slot="dropdown-menu-content"], [role="menu"], [class*="dropdown"]');
  return {
    url: location.href,
    dropHTML: dropContent ? dropContent.innerHTML.substring(0, 1000) : 'no dropdown found',
    providerElements: Array.from(document.querySelectorAll('[role="menuitem"]')).map(el => ({
      text: (el.innerText || '').trim(),
      html: el.outerHTML.substring(0, 200),
    })),
    player: document.querySelector('video, iframe, [class*="player"], [class*="Player"]') ? 'exists' : 'none',
  };
});
console.log('\nAfter click:', JSON.stringify(afterClick, null, 2));

await new Promise(r => setTimeout(r, 2000));

// Also check what MediaHeader renders for providers
const headerInfo = await p.evaluate(() => {
  const els = Array.from(document.querySelectorAll('*'));
  const providerRelated = els.filter(el => {
    const t = (el.innerText || '').toLowerCase();
    return (t.includes('provider') || t.includes('vidcore') || t.includes('vidlink') || t.includes('vidsrc') || t.includes('embed')) && el.children.length === 0;
  });
  return providerRelated.map(el => ({ text: (el.innerText || '').trim(), tag: el.tagName }));
});
console.log('Provider-related text nodes:', JSON.stringify(headerInfo, null, 2));

await b.close();
