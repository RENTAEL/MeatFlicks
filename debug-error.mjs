import puppeteer from 'puppeteer';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();

p.on('pageerror', err => console.log('PAGE_ERROR:', err.message));

await p.goto('https://streamium-cosmic.vercel.app/', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));

console.log('Homepage title:', await p.title());

// Now go to movie detail
await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));

// Click play button
const buttons = await p.$$('button');
for (const btn of buttons) {
  const text = await btn.evaluate(el => (el.innerText || '').trim());
  if (text === 'Play') {
    await btn.click();
    console.log('Clicked Play');
    break;
  }
}

await new Promise(r => setTimeout(r, 3000));

const after = await p.evaluate(() => {
  return {
    url: location.href,
    hasMenu: !!document.querySelector('[role="menu"]'),
  };
});
console.log('After click:', JSON.stringify(after));

await b.close();
