import puppeteer from 'puppeteer';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

// Find all buttons with "Play" text and click
const buttons = await p.$$('button');
let clicked = false;
for (const btn of buttons) {
  const text = await btn.evaluate(el => (el.innerText || '').trim());
  if (text === 'Play') {
    console.log('Found Play button, clicking...');
    await btn.click();
    clicked = true;
    break;
  }
}

if (!clicked) {
  console.log('No Play button found');
  await b.close();
  process.exit(0);
}

await new Promise(r => setTimeout(r, 2000));

const result = await p.evaluate(() => {
  // Check for dropdown content anywhere in DOM
  const content = document.querySelector('[role="menu"], [data-slot="dropdown-menu-content"]');
  const items = document.querySelectorAll('[role="menuitem"]');
  
  // Also check for any portal at the body level
  const bodyChildren = Array.from(document.body.children);
  const portalContent = bodyChildren.filter(c => {
    const text = (c.innerText || '').trim();
    return text.includes('VidCore') || text.includes('Provider') || text.includes('2Embed');
  });

  return {
    contentExists: !!content,
    contentItems: Array.from(items).map(i => (i.innerText || '').trim()),
    portalContent: portalContent.map(c => ({
      tag: c.tagName,
      text: (c.innerText || '').substring(0, 200),
      role: c.getAttribute('role'),
    })),
  };
});

console.log('Result:', JSON.stringify(result, null, 2));

await b.close();
