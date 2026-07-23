import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

p.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));

// Check for any portal containers
const domSnapshot = await p.evaluate(() => {
  // Check all possible dropdown portal locations
  const portals = Array.from(document.querySelectorAll('[data-portal], [data-slot="portal"]'));
  const bodyChildren = Array.from(document.body.children).map(c => ({
    tag: c.tagName,
    id: c.id,
    class: c.className?.substring(0, 50),
    innerText: (c.innerText || '').substring(0, 100),
    role: c.getAttribute('role'),
    dataSlot: c.getAttribute('data-slot'),
    childCount: c.children.length,
  }));
  
  const trigger = document.getElementById('bits-c9');
  const triggerInfo = trigger ? {
    tag: trigger.tagName,
    ariaExpanded: trigger.getAttribute('aria-expanded'),
    dataState: trigger.getAttribute('data-state'),
    dataSlot: trigger.getAttribute('data-slot'),
    childButtons: trigger.querySelectorAll('button').length,
    className: (trigger.className || '').substring(0, 100),
    rect: trigger.getBoundingClientRect(),
  } : null;
  
  return { triggerInfo, portals: portals.length, bodyChildren: bodyChildren.filter(c => c.innerText || c.tagName !== 'SCRIPT') };
});
console.log('DOM Snapshot:');
console.log(JSON.stringify(domSnapshot, null, 2));

// Check Svelte/JS errors
await new Promise(r => setTimeout(r, 2000));

// Try clicking via tab-to-focus + keyboard
await p.keyboard.press('Tab');
await new Promise(r => setTimeout(r, 200));
await p.keyboard.press('Tab');
await new Promise(r => setTimeout(r, 200));
await p.keyboard.press('Tab');
await new Promise(r => setTimeout(r, 200));
await p.keyboard.press('Tab');
await new Promise(r => setTimeout(r, 200));
await p.keyboard.press('Tab');
await new Promise(r => setTimeout(r, 200));

const focusedInfo = await p.evaluate(() => {
  const focused = document.activeElement;
  return {
    tag: focused?.tagName,
    id: focused?.id,
    text: (focused?.innerText || '').trim().substring(0, 50),
    slot: focused?.getAttribute('data-slot'),
  };
});
console.log('Focused element:', JSON.stringify(focusedInfo));

// Press Enter on the focused element (hopefully the Play button)
await p.keyboard.press('Enter');
await new Promise(r => setTimeout(r, 2000));

const afterEnter = await p.evaluate(() => {
  const trigger = document.getElementById('bits-c9');
  const content = document.querySelector('[data-slot="dropdown-menu-content"], [role="menu"]');
  return {
    expanded: trigger?.getAttribute('aria-expanded'),
    state: trigger?.getAttribute('data-state'),
    contentExists: !!content,
  };
});
console.log('After Enter:', JSON.stringify(afterEnter));

await b.close();
