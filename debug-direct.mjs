import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

// Try clicking the Play button with force:true (click at center of element)
const clicked = await p.evaluate(() => {
  const trigger = document.getElementById('bits-c9');
  if (!trigger) return 'no trigger';
  const rect = trigger.getBoundingClientRect();
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  
  // Try multiple approaches
  trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  
  return `clicked at (${x}, ${y})`;
});
console.log('Clicked:', clicked);

await new Promise(r => setTimeout(r, 2000));

// Check dropdown state immediately
const state1 = await p.evaluate(() => {
  const trigger = document.getElementById('bits-c9');
  const content = document.querySelector('[data-slot="dropdown-menu-content"], [role="menu"]');
  const items = document.querySelectorAll('[role="menuitem"]');
  return {
    expanded: trigger?.getAttribute('aria-expanded'),
    state: trigger?.getAttribute('data-state'),
    contentExists: !!content,
    menuItems: Array.from(items).map(i => (i.innerText || '').trim()),
    url: location.href,
  };
});
console.log('State1:', JSON.stringify(state1, null, 2));

// Try Puppeteer's own click function on the exact element
const playBtn = await p.$('#bits-c9');
if (playBtn) {
  await playBtn.click({ force: true });
  await new Promise(r => setTimeout(r, 2000));
  
  const state2 = await p.evaluate(() => {
    const trigger = document.getElementById('bits-c9');
    const content = document.querySelector('[data-slot="dropdown-menu-content"], [role="menu"]');
    return {
      expanded: trigger?.getAttribute('aria-expanded'),
      state: trigger?.getAttribute('data-state'),
      contentExists: !!content,
      url: location.href,
    };
  });
  console.log('State2:', JSON.stringify(state2, null, 2));
}

await b.close();
