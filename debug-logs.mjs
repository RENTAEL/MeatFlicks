import puppeteer from 'puppeteer';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

// Capture ALL console output
p.on('console', msg => console.log('BROWSER', msg.type(), msg.text()));
p.on('pageerror', err => console.log('PAGE_ERROR', err.message));

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));

// Click play
const buttons = await p.$$('button');
for (const btn of buttons) {
  const text = await btn.evaluate(el => (el.innerText || '').trim());
  if (text === 'Play') {
    await btn.click();
    console.log('Clicked Play');
    break;
  }
}

await new Promise(r => setTimeout(r, 2000));

// Check everything
const state = await p.evaluate(() => {
  return {
    url: location.href,
    dropdownOpen: document.querySelector('[role="menu"]') !== null,
    contentEl: document.querySelector('[data-slot="dropdown-menu-content"]'),
    bodyHTML_500: document.body.innerHTML.substring(0, 500),
  };
});
console.log('STATE:', JSON.stringify(state, null, 2));

await b.close();
