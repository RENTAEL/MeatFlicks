import puppeteer from 'puppeteer';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

// Click play button
const buttons = await p.$$('button');
for (const btn of buttons) {
  const text = await btn.evaluate(el => (el.innerText || '').trim());
  if (text === 'Play') {
    await btn.click();
    break;
  }
}

await new Promise(r => setTimeout(r, 2000));

// Full DOM dump of body
const bodyHTML = await p.evaluate(() => {
  return document.body.innerHTML.substring(0, 10000);
});

// Also check for content specifically
const contentSearch = await p.evaluate(() => {
  // Search all elements
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  const results = [];
  let node;
  while (node = walker.nextNode()) {
    const el = node;
    const text = (el.innerText || '').trim();
    if (text.includes('VidCore') || text.includes('Provider') || text.includes('Select')) {
      results.push({
        tag: el.tagName,
        id: el.id,
        class: (el.className || '').substring(0, 50),
        text: text.substring(0, 100),
        role: el.getAttribute('role'),
        visible: el.offsetParent !== null,
      });
    }
  }
  return results;
});

console.log('Content search:', JSON.stringify(contentSearch, null, 2));
console.log('---');
console.log('Body HTML snippet:', bodyHTML.substring(0, 2000));

await b.close();
