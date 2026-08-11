import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'https://streamium-cosmic.vercel.app';
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
	const pulses = [...document.querySelectorAll('.h-32.animate-pulse')];
	const ioTest = () => new Promise((resolve) => {
		if (!pulses[0]) return resolve('no sentinel');
		const r = pulses[0].getBoundingClientRect();
		const cs = getComputedStyle(pulses[0]);
		let fired = null;
		const io = new IntersectionObserver((entries) => {
			fired = entries[0].isIntersecting;
			io.disconnect();
			resolve({ rect: { x: r.x, y: r.y, w: r.width, h: r.height }, display: cs.display, visibility: cs.visibility, fired });
		}, { threshold: 0.1 });
		io.observe(pulses[0]);
		setTimeout(() => { io.disconnect(); resolve({ rect: { x: r.x, y: r.y, w: r.width, h: r.height }, display: cs.display, visibility: cs.visibility, fired, timeout: true }); }, 1500);
	});
	return ioTest();
});
console.log('sentinel:', JSON.stringify(info));
console.log('console errors:', errors.slice(0, 5).join('\n') || '(none)');
await browser.close();