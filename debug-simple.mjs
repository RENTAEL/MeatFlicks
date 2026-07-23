import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

console.log = msg => process.stdout.write(msg + '\n');

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

// Check URL and trigger
const info = await p.evaluate(() => {
  const trigger = document.getElementById('bits-c9');
  return {
    url: location.href,
    hasTrigger: !!trigger,
    triggerHTML: trigger ? trigger.outerHTML.substring(0, 200) : 'none',
  };
});
console.log('Info:', JSON.stringify(info, null, 2));

if (info.hasTrigger) {
  // Dispatch pointerdown with exact properties bits-ui expects
  const clickResult = await p.evaluate(() => {
    const trigger = document.getElementById('bits-c9');
    trigger.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true,
      pointerType: 'mouse', button: 0, clientX: 100, clientY: 100,
      ctrlKey: false
    }));
    trigger.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true,
      pointerType: 'mouse', button: 0, clientX: 100, clientY: 100
    }));
    return {
      expanded: trigger.getAttribute('aria-expanded'),
      state: trigger.getAttribute('data-state'),
    };
  });
  console.log('Click result:', JSON.stringify(clickResult));
  
  await new Promise(r => setTimeout(r, 1000));
  
  const final = await p.evaluate(() => {
    const trigger = document.getElementById('bits-c9');
    const content = document.querySelector('[role="menu"], [data-slot="dropdown-menu-content"]');
    return {
      expanded: trigger?.getAttribute('aria-expanded'),
      state: trigger?.getAttribute('data-state'),
      contentExists: !!content,
      url: location.href,
    };
  });
  console.log('Final:', JSON.stringify(final, null, 2));
}

await b.close();
