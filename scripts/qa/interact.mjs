import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const logs = [];
page.on('console', m => { const t = m.text(); if (!/GL Driver|vite|preload/.test(t)) logs.push(`[${m.type()}] ${t}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5220/', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));
await page.click('#gate-enter');
await new Promise(r => setTimeout(r, 4200));
await page.screenshot({ path: 'i-hero-after-gate.png' });
console.log('gate display:', await page.evaluate(() => getComputedStyle(document.getElementById('gate')).display), 'age stored:', await page.evaluate(() => localStorage.getItem('tt-age')));
// nav link scroll
await page.click('.nav__links a[href="#inside"]');
await new Promise(r => setTimeout(r, 2500));
console.log('scrollY after nav Inside:', await page.evaluate(() => Math.round(window.scrollY)), 'inside top:', await page.evaluate(() => Math.round(document.getElementById('inside').getBoundingClientRect().top)));
// tab click
await page.click('#tab-2');
await new Promise(r => setTimeout(r, 1200));
console.log('tab-2 selected:', await page.evaluate(() => document.getElementById('tab-2').getAttribute('aria-selected')), 'ing-2 hidden:', await page.evaluate(() => document.getElementById('ing-2').hidden));
await page.screenshot({ path: 'i-inside-tab.png' });
// shop: add to cooler
await page.evaluate(() => window.__lenis.scrollTo('#shop', { immediate: true, force: true }));
await new Promise(r => setTimeout(r, 1500));
await page.click('[data-add="wild-four"]');
await new Promise(r => setTimeout(r, 1200));
await page.screenshot({ path: 'i-cart.png' });
console.log('cart open:', await page.evaluate(() => document.getElementById('cart').classList.contains('is-open')), 'count:', await page.evaluate(() => document.getElementById('cart-count').textContent));
await page.click('#cart-close');
await new Promise(r => setTimeout(r, 900));
// coming soon modal
await page.click('.find__city [data-soon]');
await new Promise(r => setTimeout(r, 900));
await page.screenshot({ path: 'i-modal.png' });
console.log('modal open:', await page.evaluate(() => document.getElementById('modal').classList.contains('is-open')));
await page.type('#modal-email', 'joe@example.com');
await page.click('#modal-form button[type=submit]');
await new Promise(r => setTimeout(r, 600));
console.log('modal msg:', await page.evaluate(() => document.querySelector('#modal-form .email-form__msg').textContent));
await page.keyboard.press('Escape');
await new Promise(r => setTimeout(r, 700));
console.log('modal closed:', await page.evaluate(() => !document.getElementById('modal').classList.contains('is-open')));
console.log(logs.join('\n') || '(no console output)');
await browser.close();
