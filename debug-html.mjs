import puppeteer from 'puppeteer';
import fs from 'fs';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

const fullHTML = await p.evaluate(() => {
  const trigger = document.getElementById('bits-c9');
  if (!trigger) return 'NOT FOUND';
  return trigger.outerHTML;
});
fs.writeFileSync('debug-trigger.txt', fullHTML);

// Check all attributes on the trigger
const attrs = await p.evaluate(() => {
  const trigger = document.getElementById('bits-c9');
  if (!trigger) return {};
  const attrs = {};
  for (const attr of trigger.attributes) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
});
fs.writeFileSync('debug-attrs.json', JSON.stringify(attrs, null, 2));

// Check what event listeners are registered via CDP
const cdp = await p.target().createCDPSession();

// First, find the node ID for the trigger button
const doc = await cdp.send('DOM.getDocument');
const searchResult = await cdp.send('DOM.querySelector', {
  nodeId: doc.root.nodeId,
  selector: '#bits-c9'
});

if (searchResult.nodeId) {
  const listeners = await cdp.send('DOMDebugger.getEventListeners', {
    nodeId: searchResult.nodeId
  });
  fs.writeFileSync('debug-listeners.json', JSON.stringify(listeners.listeners.map(l => ({
    type: l.type,
    useCapture: l.useCapture,
    once: l.once,
    passive: l.passive,
    lineNumber: l.lineNumber,
  })), null, 2));
}

console.log('Check the debug files');
await b.close();
