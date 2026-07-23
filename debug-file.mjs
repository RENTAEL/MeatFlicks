import puppeteer from 'puppeteer';
import fs from 'fs';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

const info = await p.evaluate(() => {
  const trigger = document.getElementById('bits-c9');
  return {
    url: location.href,
    hasTrigger: !!trigger,
    triggerHTML: trigger ? trigger.outerHTML.substring(0, 300) : 'none',
  };
});
fs.writeFileSync('debug-output.json', JSON.stringify({ step: 'info', data: info }, null, 2) + '\n');

if (info.hasTrigger) {
  const clickResult = await p.evaluate(() => {
    const trigger = document.getElementById('bits-c9');
    trigger.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true,
      pointerType: 'mouse', button: 0, clientX: 100, clientY: 100,
      ctrlKey: false
    }));
    return {
      afterPointerDown: trigger.getAttribute('aria-expanded'),
      state: trigger.getAttribute('data-state'),
    };
  });
  fs.writeFileSync('debug-output.json', JSON.stringify({ step: 'clickResult', data: clickResult }, null, 2) + '\n');
  
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
  fs.writeFileSync('debug-output.json', JSON.stringify({ step: 'final', data: final }, null, 2) + '\n');
}

await b.close();
console.log('Done - check debug-output.json');
