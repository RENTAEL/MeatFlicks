import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));

// Fetch the page and check if the dropdown works on the ACTUAL plain bit-ui trigger
// Check if there's any error in the console
const errors = [];
p.on('pageerror', err => errors.push(err.message));

// Try to programmatically open the dropdown via DOM events
// First, let's understand what events are on the button by checking Svelte internals
const diagnosis = await p.evaluate(() => {
  const btn = document.getElementById('bits-c9');
  if (!btn) return { error: 'no button' };
  
  // Check for Svelte event listeners via internal properties
  const svelteEvents = [];
  for (const key in btn) {
    if (key.startsWith('__svelte') || key.startsWith('on') || key.startsWith('__listener'))
      svelteEvents.push(key);
  }
  
  // Try to find nearby error boundary or error state
  const body = document.body;
  const bodyText = body.innerText;
  const hasError = bodyText.includes('Error') || bodyText.includes('error');
  
  return {
    svelteProps: svelteEvents,
    hasError,
    bodySnippet: bodyText.substring(0, 500),
    buttonVisible: btn.offsetParent !== null,
    buttonRect: {
      x: btn.getBoundingClientRect().x,
      y: btn.getBoundingClientRect().y,
      w: btn.getBoundingClientRect().width,
      h: btn.getBoundingClientRect().height,
    },
  };
});
console.log('Diagnosis:', JSON.stringify(diagnosis, null, 2));
console.log('Errors:', errors);

await b.close();
