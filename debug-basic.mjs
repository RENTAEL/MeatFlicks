import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

try {
  const resp = await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('Response status:', resp?.status());
} catch(e) { console.log('Nav error:', e.message); }

await new Promise(r => setTimeout(r, 8000));

const title = await p.title();
console.log('Title:', title);
const text = await p.evaluate(() => document.body.innerText.substring(0, 300));
console.log('Body:', text);
const hasPlay = await p.evaluate(() => {
  const all = document.body.innerText;
  return all.includes('Play') || all.includes('Inception');
});
console.log('Has content:', hasPlay);

await b.close();
