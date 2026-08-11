import { chromium } from 'playwright';

const b = await chromium.launch();
const p = await b.newPage();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 120)); });
await p.goto('https://streamium-cosmic.vercel.app/login', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
const fields = await p.evaluate(() =>
	[...document.querySelectorAll('input')].map((i) => ({ name: i.name, type: i.type, id: i.id, placeholder: i.placeholder }))
);
console.log('inputs:', JSON.stringify(fields));
await p.fill('input[type="text"]', 'questvrmsd5epa1');
await p.fill('input[type="password"]', 'Testpass123!');
const buttons = await p.evaluate(() => [...document.querySelectorAll('button')].map((b2) => b2.textContent.trim()).filter(Boolean));
console.log('buttons:', JSON.stringify(buttons));
await p.click('button[type="submit"]').catch(async () => { await p.click('button:has-text("Sign In")'); });
await p.waitForTimeout(5000);
console.log('URL after login:', p.url());
console.log('auth error:', await p.textContent('.auth-error').catch(() => 'n/a'));
await b.close();
