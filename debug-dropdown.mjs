import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

try {
  await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
} catch(e) { console.log('Navigation error:', e.message); }
await new Promise(r => setTimeout(r, 5000));

// Check if trigger exists and its structure
const info = await p.evaluate(() => {
  const triggers = document.querySelectorAll('button[data-slot="dropdown-menu-trigger"]');
  const buttons = document.querySelectorAll('button');
  return {
    triggerCount: triggers.length,
    triggers: Array.from(triggers).map(t => ({
      id: t.id,
      innerHTML: t.innerHTML.substring(0, 200),
      childButtons: t.querySelectorAll('button').length,
    })),
    allButtonTags: Array.from(document.querySelectorAll('button')).map(b => b.tagName + ' ' + (b.id || 'no-id') + ' "' + (b.innerText || '').trim().substring(0, 20) + '"').slice(0, 10),
  };
});
console.log('Page info:', JSON.stringify(info, null, 2));

// Click the trigger
const triggers = await p.$$('button[data-slot="dropdown-menu-trigger"]');
if (triggers.length > 0) {
  await triggers[0].click();
  await new Promise(r => setTimeout(r, 1500));
  
  const after = await p.evaluate(() => {
    const content = document.querySelector('[data-slot="dropdown-menu-content"], [role="menu"]');
    const items = document.querySelectorAll('[role="menuitem"]');
    return {
      url: location.href,
      contentExists: !!content,
      contentHTML: content ? content.innerHTML.substring(0, 500) : 'none',
      menuItems: Array.from(items).map(i => (i.innerText || '').trim()),
      expanded: document.querySelector('#bits-c9')?.getAttribute('aria-expanded'),
    };
  });
  console.log('After click:', JSON.stringify(after, null, 2));
}

await b.close();
