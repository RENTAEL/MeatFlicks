import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

console.log = msg => process.stdout.write(msg + '\n');

p.on('console', msg => process.stdout.write('CONSOLE: ' + msg.text() + '\n'));

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));

// Try sending a real pointerdown event (like bits-ui expects)
const result = await p.evaluate(() => {
  const trigger = document.getElementById('bits-c9');
  if (!trigger) return 'no trigger';
  const rect = trigger.getBoundingClientRect();
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  
  // Simulate what a real browser click does:
  // 1. pointerdown with pointerType "mouse", button 0
  const pd = new PointerEvent('pointerdown', {
    bubbles: true, cancelable: true,
    pointerType: 'mouse', button: 0, clientX: x, clientY: y,
    ctrlKey: false
  });
  trigger.dispatchEvent(pd);
  
  // 2. pointerup
  const pu = new PointerEvent('pointerup', {
    bubbles: true, cancelable: true,
    pointerType: 'mouse', button: 0, clientX: x, clientY: y
  });
  trigger.dispatchEvent(pu);
  
  // Check state after events
  setTimeout(() => {
    // Will report via console
  }, 500);
  
  return {
    expanded: trigger.getAttribute('aria-expanded'),
    state: trigger.getAttribute('data-state'),
  };
});

console.log('After pointerdown/up:', JSON.stringify(result));
await new Promise(r => setTimeout(r, 1000));

const final = await p.evaluate(() => {
  const trigger = document.getElementById('bits-c9');
  const content = document.querySelector('[data-slot="dropdown-menu-content"], [role="menu"]');
  return {
    expanded: trigger?.getAttribute('aria-expanded'),
    state: trigger?.getAttribute('data-state'),
    contentExists: !!content,
    contentItems: content ? Array.from(content.querySelectorAll('[role="menuitem"]')).map(i => (i.innerText || '').trim()) : [],
  };
});
console.log('Final:', JSON.stringify(final, null, 2));

await b.close();
