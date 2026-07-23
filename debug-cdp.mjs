import puppeteer from 'puppeteer';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

// Use CDP to get event listeners
const cdp = await p.target().createCDPSession();
await cdp.send('Runtime.evaluate', {
  expression: 'document.getElementById("bits-c9")',
});

// Get all event listeners for the trigger
const result = await cdp.send('DOMDebugger.getEventListeners', {
  objectId: (await cdp.send('Runtime.evaluate', {
    expression: 'document.getElementById("bits-c9")',
  })).result.objectId,
});

const listeners = result.listeners.map(l => ({
  type: l.type,
  useCapture: l.useCapture,
  once: l.once,
  passive: l.passive,
}));
console.log(JSON.stringify({ listeners }, null, 2));

// Also try clicking via Puppeteer properly
await p.click('#bits-c9');
await new Promise(r => setTimeout(r, 1500));

const afterClick = await p.evaluate(() => {
  const trigger = document.getElementById('bits-c9');
  return {
    expanded: trigger?.getAttribute('aria-expanded'),
    state: trigger?.getAttribute('data-state'),
  };
});
console.log(JSON.stringify({ afterClick }, null, 2));

await b.close();
