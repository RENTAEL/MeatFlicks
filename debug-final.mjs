import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });

await p.goto('https://streamium-cosmic.vercel.app/movie/27205', { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));

const info = await p.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  return buttons.map(b => ({
    id: b.id,
    text: (b.innerText || '').trim().substring(0, 30),
    childButtons: b.querySelectorAll('button').length,
    slot: b.getAttribute('data-slot'),
    className: (b.className || '').substring(0, 80),
  }));
});
console.log('All buttons:', JSON.stringify(info, null, 2));

// Find Play button and try clicking
const playTrigger = await p.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const play = btns.find(b => (b.innerText || '').trim().toLowerCase().includes('play') && !b.querySelector('button'));
  if (play) return { id: play.id, text: (play.innerText || '').trim() };
  return null;
});
console.log('Play trigger found:', JSON.stringify(playTrigger));

if (playTrigger) {
  const playBtn = await p.$(`#${playTrigger.id}, button`);
  // Find the right one
  const buttons = await p.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => (el.innerText || '').trim().toLowerCase());
    if (text.includes('play')) {
      const innerButtons = await btn.evaluate(el => el.querySelectorAll('button').length);
      if (innerButtons === 0) {
        console.log('Clicking play button (no nested buttons)...');
        await btn.click();
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }
  }

  await new Promise(r => setTimeout(r, 2000));

  // Check more carefully for dropdown
  const after = await p.evaluate(() => {
    const content = document.querySelector('[data-slot="dropdown-menu-content"], [role="menu"]');
    const items = document.querySelectorAll('[role="menuitem"]');
    const trigger = document.getElementById('bits-c9');
    return {
      url: location.href,
      contentExists: !!content,
      menuItems: Array.from(items).map(i => (i.innerText || '').trim()),
      expanded: trigger?.getAttribute('aria-expanded'),
      state: trigger?.getAttribute('data-state'),
      click: trigger?.getAttribute('onclick'),
    };
  });
  console.log('After click:', JSON.stringify(after, null, 2));

  // If dropdown still not visible, try dispatching click directly
  if (!after.contentExists) {
    console.log('Trying direct click dispatch...');
    const clicked = await p.evaluate(() => {
      const trigger = document.getElementById('bits-c9');
      if (trigger) {
        trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return true;
      }
      return false;
    });
    console.log('Dispatched:', clicked);
    await new Promise(r => setTimeout(r, 2000));
    
    const after2 = await p.evaluate(() => {
      const content = document.querySelector('[data-slot="dropdown-menu-content"], [role="menu"]');
      const items = document.querySelectorAll('[role="menuitem"]');
      const trigger = document.getElementById('bits-c9');
      return {
        contentExists: !!content,
        menuItems: Array.from(items).map(i => (i.innerText || '').trim()),
        expanded: trigger?.getAttribute('aria-expanded'),
        state: trigger?.getAttribute('data-state'),
      };
    });
    console.log('After dispatch:', JSON.stringify(after2, null, 2));
  }
}

await b.close();
