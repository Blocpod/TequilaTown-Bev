// usage: node site.mjs <outprefix> <width> <height> <ys comma | "auto:N">
import puppeteer from 'puppeteer-core';
const [prefix, w = '1440', h = '900', ys = 'auto:12', gate = 'skip'] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--hide-scrollbars'],
});
const page = await browser.newPage();
if (process.env.REDUCED) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1, isMobile: +w < 900, hasTouch: +w < 900 });
const logs = [];
page.on('console', m => { const t = m.text(); if (!/Download the React|DevTools/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
if (gate === 'skip') await page.evaluateOnNewDocument(() => { try { localStorage.setItem('tt-age', '1'); } catch (e) {} });
await page.goto('http://localhost:5220/', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 3200));
const H = await page.evaluate(() => document.documentElement.scrollHeight);
let list = ys.startsWith('auto:') ? Array.from({ length: +ys.split(':')[1] + 1 }, (_, i) => Math.round(i * (H - +h) / +ys.split(':')[1])) : ys.split(',').map(Number);
console.log('scrollHeight', H, 'positions', list.join(','));
for (const y of list) {
  // scroll in steps like a person, so velocity-driven code sees sane numbers
  const cur = await page.evaluate(() => window.scrollY);
  const steps = 10;
  for (let k = 1; k <= steps; k++) {
    const v = Math.round(cur + (y - cur) * k / steps);
    await page.evaluate(v => { if (window.__lenis) window.__lenis.scrollTo(v, { immediate: true, force: true }); else window.scrollTo(0, v); }, v);
    await new Promise(r => setTimeout(r, 70));
  }
  await new Promise(r => setTimeout(r, 1700));
  const dbg = await page.evaluate(() => window.__can ? JSON.stringify(Object.fromEntries(Object.entries(window.__can.pose).filter(([k,v])=>typeof v==='number').map(([k,v])=>[k,+v.toFixed(2)]))) : '');
  console.log(y, dbg);
  await page.screenshot({ path: `${prefix}-${String(y).padStart(5, '0')}.png` });
}
console.log(logs.slice(0, 30).join('\n') || '(no console output)');
await browser.close();
