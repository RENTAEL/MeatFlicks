import puppeteer from 'puppeteer';

const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

// Find all buttons with "Play" text
const data = await p.evaluate(() => {
  const allButtons = Array.from(document.querySelectorAll('button'));
  const playBtn = allButtons.find(b => (b.innerText || '').trim() === 'Play');
  if (!playBtn) return { error: 'no play button' };
  return {
    id: playBtn.id,
    text: (playBtn.innerText || '').trim(),
    slot: playBtn.getAttribute('data-slot'),
    class: (playBtn.className || '').substring(0, 100),
    rect: {
      x: playBtn.getBoundingClientRect().x,
      y: playBtn.getBoundingClientRect().y,
      w: playBtn.getBoundingClientRect().width,
      h: playBtn.getBoundingClientRect().height,
    },
    innerHTML: playBtn.innerHTML.substring(0, 200),
  };
});
console.log(JSON.stringify(data));

await b.close();
