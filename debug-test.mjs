import puppeteer from 'puppeteer';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

const data = await p.evaluate(() => {
  const trigger = document.getElementById('bits-c9');
  if (!trigger) return { error: 'no trigger found', url: location.href };
  
  return {
    id: trigger.id,
    class: (trigger.className || '').substring(0, 60),
    expanded: trigger.getAttribute('aria-expanded'),
    state: trigger.getAttribute('data-state'),
  };
});

console.log(JSON.stringify(data));

if (!data.error) {
  await p.click('#bits-c9');
  await new Promise(r => setTimeout(r, 2000));
  
  const after = await p.evaluate(() => {
    const trigger = document.getElementById('bits-c9');
    const content = document.querySelector('[role="menu"], [data-slot="dropdown-menu-content"]');
    return {
      expanded: trigger?.getAttribute('aria-expanded'),
      state: trigger?.getAttribute('data-state'),
      contentExists: !!content,
    };
  });
  console.log(JSON.stringify(after));
}

await b.close();
