import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createCan, FLAVORS } from './can.js';

gsap.registerPlugin(ScrollTrigger);

const FLAVOR_DATA = [
  { key: 'xoconostle', name: 'Xoconostle + Key Lime + Sea Salt', word: 'Sharp.' },
  { key: 'guava', name: 'Guava + Jamaica + Pink Peppercorn', word: 'Bloom.' },
  { key: 'tamarind', name: 'Tamarind + Mandarin + Chile de Árbol', word: 'Heat.' },
  { key: 'guanabana', name: 'Guanábana + Mexican Lime + Basil', word: 'Green.' },
];

const html = document.documentElement;
const body = document.body;
let menuOpen = false, modalOpen = false, lastFocus = null;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileMQ = matchMedia('(max-width: 899px)');
const mobile = mobileMQ.matches;
if (mobile) html.classList.add('mobile');

/* ------------------------------------------------------------------ 3D can */
let can = null;
if (!reduced) {
  try { can = createCan($('#gl')); } catch (e) { console.warn('WebGL unavailable', e); }
}
const isStatic = !can;
window.__can = can;
if (isStatic) html.classList.add('static');

/* ------------------------------------------------------------------ smooth scroll */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: false });
  lenis.on('scroll', (e) => { ScrollTrigger.update(); can?.kick(e.velocity); });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  window.__lenis = lenis; window.ScrollTrigger = ScrollTrigger;
} else {
  document.body.style.overflow = 'hidden';
}
let programmatic = false, programmaticTimer = null;
function scrollTo(target, opts = {}) {
  if (lenis) {
    programmatic = true;
    clearTimeout(programmaticTimer);
    programmaticTimer = setTimeout(() => { programmatic = false; }, ((opts.duration ?? 1.4) * 1000) + 400);
    lenis.scrollTo(target, { duration: 1.4, easing: (x) => 1 - Math.pow(1 - x, 4), ...opts, onComplete: () => { programmatic = false; opts.onComplete?.(); } });
  }
  else {
    const el = typeof target === 'string' ? $(target) : target;
    if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'auto' });
    else el?.scrollIntoView({ behavior: 'auto' });
  }
}
$$('[data-scroll]').forEach((a) => a.addEventListener('click', (e) => {
  const href = a.getAttribute('href');
  if (!href || !href.startsWith('#')) return;
  e.preventDefault();
  if (a.hasAttribute('data-close-cart')) closeCart();
  if (a.hasAttribute('data-close-modal')) closeModal();
  closeMenu();
  scrollTo(href === '#top' ? 0 : href);
}));

/* ------------------------------------------------------------------ flavor state */
let activeFlavor = 0;
const heroFlavorName = $('#hero-flavor .hero__flavor-name');
function setFlavor(i, { spin = true } = {}) {
  activeFlavor = i;
  body.dataset.flavor = FLAVORS[i];
  heroFlavorName.textContent = FLAVOR_DATA[i].name;
  can?.setFlavor(i, { spin });
}

/* ------------------------------------------------------------------ poses */
const POSE = mobile ? {
  hero: { nx: 0, ny: 0.27, scale: 0.40, rotY: 0, tiltX: 0, tiltZ: 0, float: 1, shadow: 0.6 },
  flavors: { nx: 0.0, ny: 0.34, scale: 0.29, rotY: 0, tiltX: 0, tiltZ: -0.06, float: 1, shadow: 0.5 },
  inside: { nx: 0, ny: 0.3, scale: 0, rotY: 0, tiltX: 0, tiltZ: 0, float: 0, shadow: 0 },
  exit: { nx: 0, ny: 0.3, scale: 0, rotY: 0, tiltX: 0, tiltZ: 0, float: 0, shadow: 0 },
} : {
  hero: { nx: 0, ny: -0.03, scale: 0.62, rotY: 0, tiltX: 0, tiltZ: 0, float: 1, shadow: 1 },
  flavors: { nx: 0.38, ny: -0.02, scale: 0.60, rotY: 0, tiltX: 0, tiltZ: -0.07, float: 1, shadow: 1 },
  inside: { nx: 0, ny: -0.05, scale: 0.64, rotY: 0, tiltX: 0, tiltZ: 0, float: 1, shadow: 0.8 },
  exit: { nx: 0, ny: -1.7, scale: 0.35, rotY: 0.9, tiltX: 0, tiltZ: 0.25, float: 0, shadow: 0 },
};
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPose = (A, B, t) => Object.fromEntries(Object.keys(A).map((k) => [k, lerp(A[k], B[k] ?? A[k], t)]));
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ------------------------------------------------------------------ age gate + intro */
const gate = $('#gate');
const heroLines = $$('.hero__title .line > span');
const heroEls = $$('.hero__top, .hero__sub, .hero__copy .btn, .hero__scroll, .hero__stats, .hero__flavor');
heroEls.forEach((el) => el.classList.add('hero__intro-el'));
let introDone = false;

function playIntro() {
  if (introDone) return;
  introDone = true;
  lenis?.start();
  if (isStatic) { document.body.style.overflow = ''; heroEls.forEach((el) => (el.style.opacity = 1)); return; }
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  can.set({ ...POSE.hero, ny: POSE.hero.ny + 1.9, scale: POSE.hero.scale * 0.85, rotY: -2.6 });
  tl.to(can.pose, { ny: POSE.hero.ny, scale: POSE.hero.scale, rotY: 0, duration: 1.9, ease: 'power3.out' }, 0.05)
    .fromTo('.hero__wordmark', { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 1.6, ease: 'power3.out' }, 0)
    .to(heroLines, { y: 0, duration: 1.2, stagger: 0.09, ease: 'power4.out' }, 0.5)
    .to(heroEls, { opacity: 1, duration: 1, stagger: 0.06, ease: 'power2.out' }, 0.9);
  startHeroCycle();
}

async function enter() {
  const btn = $('#gate-enter');
  btn.classList.add('is-loading');
  if (can) await Promise.race([can.readyPromise, new Promise((r) => setTimeout(r, 6000))]);
  try { localStorage.setItem('tt-age', '1'); } catch (e) { /* private mode */ }
  gsap.timeline()
    .to('.gate__inner', { y: -40, opacity: 0, duration: 0.6, ease: 'power3.in' })
    .to(gate, { yPercent: -100, duration: 1.05, ease: 'power4.inOut' }, 0.25)
    .add(playIntro, 0.75)
    .set(gate, { display: 'none' });
}
$('#gate-enter').addEventListener('click', enter);
$('#gate-no').addEventListener('click', () => {
  $('#gate-denied').hidden = false;
  $('.gate__actions').style.display = 'none';
  $('.gate__q').style.display = 'none';
});
let remembered = false;
try { remembered = localStorage.getItem('tt-age') === '1'; } catch (e) { /* noop */ }
if (remembered) {
  gate.style.display = 'none';
  if (can) can.readyPromise.then(playIntro); else playIntro();
} else {
  $('#gate-enter').focus({ preventScroll: true });
}

/* ------------------------------------------------------------------ hero flavor cycle */
let heroTimer = null, heroST = null;
// ScrollTrigger only sets isActive / fires onToggle when progress changes, so a trigger that starts at 0
// never toggles on a fresh load. Gate on the live scroll position instead, which is always defined.
const heroVisible = () => heroST && (lenis ? lenis.scroll : window.scrollY) < heroST.end && !menuOpen && !modalOpen;
function startHeroCycle() {
  stopHeroCycle();
  if (isStatic || !introDone) return;
  heroTimer = setInterval(() => {
    if (heroVisible() && document.visibilityState === 'visible') setFlavor((activeFlavor + 1) % 4);
  }, 5200);
}
function stopHeroCycle() { clearInterval(heroTimer); heroTimer = null; }
heroST = ScrollTrigger.create({ trigger: '#top', start: 'top top', end: 'bottom 45%' });
if (!isStatic) {
  gsap.to('.hero__wordmark', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__bottom, .hero__top', { opacity: 0, y: -40, ease: 'none', scrollTrigger: { trigger: '#top', start: '40% top', end: 'bottom top', scrub: true } });
}

/* ------------------------------------------------------------------ can travel between sections */
if (!isStatic) {
  const travel = (trigger, from, to, extra) => ScrollTrigger.create({
    trigger, start: 'top bottom', end: 'top top', refreshPriority: -1,
    onUpdate: (self) => { if (self.progress <= 0) return; const p = easeIO(self.progress); can.set(lerpPose(from, to, p)); extra?.(p); },
    onLeaveBack: () => { if (trigger !== '#flavors') can.set(from); extra?.(0); },
  });
  travel('#flavors', POSE.hero, POSE.flavors);
  travel('#inside', POSE.flavors, POSE.inside, (p) => { can.topic.mix = p; });       // topic layer fades in on the way into Inside
  travel('#story', POSE.inside, POSE.exit, (p) => { can.topic.mix = 1 - p; });      // and out on the way to Story
  // In the hero, stop scroll-travel from fighting the intro tween: only write when progress > 0.
  ScrollTrigger.getAll().forEach((st) => { if (st.vars.trigger === '#flavors') {
    const orig = st.vars.onUpdate; st.vars.onUpdate = (s) => { if (s.progress > 0.001) orig(s); };
  } });
}

/* ------------------------------------------------------------------ snap helper for pinned steppers */
function makeSnap(getST, n) {
  let timer = null, snapping = false, safety = null;
  return () => {
    if (!lenis || snapping || programmatic) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (programmatic || Math.abs(lenis.velocity) > 0.6) { return; }
      const st = getST(); if (!st) return;
      const p = st.progress; if (p <= 0.002 || p >= 0.998) return;
      const i = Math.min(n - 1, Math.floor(p * n));
      const target = st.start + ((i + 0.5) / n) * (st.end - st.start);
      if (Math.abs(target - lenis.scroll) < 4) return;
      snapping = true;
      clearTimeout(safety); safety = setTimeout(() => { snapping = false; }, 1400);
      lenis.scrollTo(target, { duration: 0.9, easing: (x) => 1 - Math.pow(1 - x, 3), onComplete: () => { snapping = false; clearTimeout(safety); } });
    }, 220);
  };
}

/* ------------------------------------------------------------------ 02 flavors (pinned) */
const panels = $$('.flavor-panel');
const dots = $$('#flavors-dots button');
const counter = $('#flavors-counter .cur');
const wordWrap = $('#flavors-word');
const flavorsBar = $('#flavors-bar');
let flavorsST = null;
const flavorsSnap = makeSnap(() => flavorsST, 4);
let flavorsActive = 0;
let inFlavors = false;

function goFlavor(i, { instant = false } = {}) {
  if (i === flavorsActive && !instant) return;
  const prev = panels[flavorsActive], next = panels[i];
  flavorsActive = i;
  setFlavor(i, { spin: !instant });
  dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
  counter.textContent = String(i + 1).padStart(2, '0');

  // giant word swap
  const oldSpans = $$('span', wordWrap);
  const newSpan = document.createElement('span');
  newSpan.textContent = FLAVOR_DATA[i].word;
  wordWrap.appendChild(newSpan);
  gsap.fromTo(newSpan, { yPercent: 100 }, { yPercent: 0, duration: 1.1, ease: 'power4.out' });
  oldSpans.forEach((sp) => { gsap.killTweensOf(sp); gsap.to(sp, { yPercent: -100, duration: 0.9, ease: 'power4.in', onComplete: () => sp.remove() }); });

  // panel swap
  const outEls = $$(':scope > *:not(img)', prev);
  const inEls = $$(':scope > *:not(img)', next);
  gsap.killTweensOf([...outEls, ...inEls]);
  gsap.to(outEls, { y: -18, opacity: 0, duration: 0.35, stagger: 0.025, ease: 'power2.in', onComplete: () => {
    prev.classList.remove('is-active'); gsap.set(outEls, { clearProps: 'all' });
  } });
  next.classList.add('is-active');
  gsap.fromTo(inEls, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.06, ease: 'power4.out', delay: 0.25, clearProps: 'transform' });
}

if (!isStatic) {
  flavorsST = ScrollTrigger.create({
    trigger: '#flavors-stage', pin: true, start: 'top top', end: '+=420%', anticipatePin: 1,
    onUpdate: (self) => {
      const i = Math.min(3, Math.floor(self.progress * 4));
      if (i !== flavorsActive) goFlavor(i);
      gsap.set(flavorsBar, { scaleX: self.progress });
      flavorsSnap();
    },
    onToggle: (self) => { inFlavors = self.isActive; if (self.isActive) setFlavor(flavorsActive, { spin: flavorsActive !== activeFlavor }); },
  });
  dots.forEach((d) => d.addEventListener('click', () => {
    const i = +d.dataset.go;
    const y = flavorsST.start + ((i + 0.5) / 4) * (flavorsST.end - flavorsST.start);
    scrollTo(y, { duration: 1.2 });
  }));
}

window.__dbg = () => ({ heroVisible: heroVisible(), timer: !!heroTimer, activeFlavor, flavorsActive });

/* ------------------------------------------------------------------ 03 inside */
// Every ingredient step spins the can a full turn and lands on the front (Joe's rule: start and end on the front).
const TOPIC_VIEW = [
  { rotY: 0, tiltX: 0, dy: 0 },
  { rotY: 0, tiltX: 0, dy: 0 },
  { rotY: 0, tiltX: 0, dy: 0 },
  { rotY: 0, tiltX: 0, dy: 0 },
];
function applyTopicView(i) {
  if (!can || mobile) return;
  const v = TOPIC_VIEW[i];
  gsap.to(can.topic, { rotY: v.rotY, tiltX: v.tiltX, dy: v.dy, duration: 1.3, ease: 'power3.inOut', overwrite: 'auto' });
}
const tabs = $$('#inside-tabs [role="tab"]');
const ingredients = $$('.ingredient');
let insideActive = 0, insideUser = false;
let insideST = null;
const insideSnap = makeSnap(() => insideST, 4);
function goIngredient(i) {
  if (i === insideActive) return;
  const prev = ingredients[insideActive], next = ingredients[i];
  insideActive = i;
  setFlavor(i); // each ingredient step shows a different can
  applyTopicView(i);
  const fb = $('.inside__fallback'); if (fb) fb.src = `/img/cut-${FLAVORS[i]}-front.png`;
  tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
  const outEls = $$(':scope > *', prev), inEls = $$(':scope > *', next);
  if (reduced) { prev.hidden = true; prev.classList.remove('is-active'); next.hidden = false; next.classList.add('is-active'); return; }
  gsap.killTweensOf([...outEls, ...inEls]);
  gsap.to(outEls, { y: -14, opacity: 0, duration: 0.3, stagger: 0.03, ease: 'power2.in', onComplete: () => { prev.hidden = true; prev.classList.remove('is-active'); gsap.set(outEls, { clearProps: 'all' }); } });
  next.hidden = false; next.classList.add('is-active');
  gsap.fromTo(inEls, { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.06, ease: 'power4.out', delay: 0.2, clearProps: 'transform' });
  if (can) { gsap.fromTo(can.pose, { tiltZ: -0.09 }, { tiltZ: POSE.inside.tiltZ, duration: 1.2, ease: 'elastic.out(1, .45)', overwrite: false }); }
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => { insideUser = true; goIngredient(i); });
  t.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();
    const n = ['ArrowDown', 'ArrowRight'].includes(e.key) ? (i + 1) % 4 : (i + 3) % 4;
    insideUser = true; goIngredient(n); tabs[n].focus();
  });
});
if (!isStatic && !mobile) {
  insideST = ScrollTrigger.create({
    trigger: '#inside-stage', pin: true, start: 'top top', end: '+=220%', anticipatePin: 1,
    onUpdate: (self) => { if (!insideUser) { const i = Math.min(3, Math.floor(self.progress * 4)); if (i !== insideActive) goIngredient(i); } insideSnap(); },
    onToggle: (self) => { if (self.isActive) { setFlavor(insideActive, { spin: insideActive !== activeFlavor }); applyTopicView(insideActive); } },
    onLeave: () => { insideUser = false; }, onLeaveBack: () => { insideUser = false; },
  });
}

/* ------------------------------------------------------------------ 04 story (horizontal) */
const storyTrack = $('#story-track');
const storyBar = $('#story-bar');
const storyCount = $('#story-count');
const chapters = $$('.chapter');
if (!isStatic && !mobile) {
  const dist = () => storyTrack.scrollWidth - window.innerWidth;
  gsap.to(storyTrack, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: '#story-pin', pin: true, start: 'top top', end: () => '+=' + dist() * 1.15, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: (self) => {
        gsap.set(storyBar, { scaleX: self.progress });
        const ch = Math.max(0, Math.min(5, Math.round(self.progress * 5.6 - 0.3)));
        storyCount.textContent = `${String(ch).padStart(2, '0')} / 05`;
      },
    },
  });
  chapters.forEach((c, i) => {
    const els = $$(':scope > *:not(img)', c);
    if (i === 0) {
      gsap.from(els, { y: 40, opacity: 0, duration: 1.1, stagger: 0.08, ease: 'power4.out', scrollTrigger: { trigger: '#story', start: 'top 70%' } });
      return;
    }
    gsap.from(els, {
      y: 40, opacity: 0, duration: 1, stagger: 0.08, ease: 'power4.out',
      scrollTrigger: { trigger: c, containerAnimation: gsap.getTweensOf(storyTrack)[0], start: 'left 88%', toggleActions: 'play none none reverse' },
    });
  });
}

/* ------------------------------------------------------------------ reveals */
if (!isStatic) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
  $$('[data-reveal]').forEach((el) => io.observe(el));
  $$('.standard__head, .find__head, .shop__head, .inside__head').forEach((head) => {
    gsap.from($$(':scope > *', head), { y: 40, opacity: 0, duration: 1.1, stagger: 0.1, ease: 'power4.out', scrollTrigger: { trigger: head, start: 'top 85%' } });
  });
}

/* ------------------------------------------------------------------ nav theme + hide on scroll down */
const nav = $('#nav');
$$('[data-theme]').forEach((sec) => {
  ScrollTrigger.create({
    trigger: sec, start: 'top 36px', end: 'bottom 36px',
    onToggle: (self) => { if (self.isActive) nav.classList.toggle('nav--bone', sec.dataset.theme === 'bone'); },
  });
});
let lastY = 0;
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate: (self) => {
    const y = self.scroll();
    nav.classList.toggle('nav--hidden', y > lastY + 4 && y > 200 && !menuOpen);
    lastY = y;
  },
});

/* ------------------------------------------------------------------ mobile menu */
const burger = $('#nav-burger');
const menu = $('#mobile-menu');
function openMenu() { menuOpen = true; menu.hidden = false; burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu'); nav.classList.remove('nav--bone', 'nav--hidden'); lenis?.stop(); gsap.fromTo($$('a', menu), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.06, ease: 'power4.out' }); }
function closeMenu() { if (!menuOpen) return; menuOpen = false; menu.hidden = true; burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu'); if (introDone) lenis?.start(); ScrollTrigger.refresh(); }
burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));

/* ------------------------------------------------------------------ cart ("cooler") */
const cart = $('#cart'), scrim = $('#scrim'), cartItems = $('#cart-items'), cartEmpty = $('#cart-empty'), cartFoot = $('#cart-foot'), cartCount = $('#cart-count');
const items = new Map();
let packSize = 4;
const IMG = { 'wild-four': '/img/cut-xoconostle-front.png', xoconostle: '/img/cut-xoconostle-front.png', guava: '/img/cut-guava-front.png', tamarind: '/img/cut-tamarind-front.png', guanabana: '/img/cut-guanabana-front.png' };
function renderCart() {
  const n = [...items.values()].reduce((a, it) => a + it.qty, 0);
  cartCount.hidden = n === 0; cartCount.textContent = n;
  $('#cart-open').setAttribute('aria-label', n ? `Open cooler, ${n} items` : 'Open cooler');
  cartEmpty.hidden = n > 0; cartItems.hidden = n === 0; cartFoot.hidden = n === 0;
  cartItems.innerHTML = '';
  items.forEach((it, id) => {
    const li = document.createElement('li');
    li.innerHTML = `<img src="${IMG[it.key]}" alt="" width="56" height="152" /><div><p class="name">${it.name}</p><p class="sub">${it.sub}</p></div><div class="cart__qty"><button type="button" aria-label="Remove one" data-dec="${id}">&minus;</button><span>${it.qty}</span><button type="button" aria-label="Add one" data-inc="${id}">+</button></div>`;
    cartItems.appendChild(li);
  });
}
cartItems.addEventListener('click', (e) => {
  const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
  if (inc) items.get(inc.dataset.inc).qty++;
  if (dec) { const it = items.get(dec.dataset.dec); it.qty--; if (it.qty <= 0) items.delete(dec.dataset.dec); }
  renderCart();
});
function openCart() { cart.classList.add('is-open'); cart.setAttribute('aria-hidden', 'false'); scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add('is-open')); $('#cart-open').setAttribute('aria-expanded', 'true'); lenis?.stop(); $('#cart-close').focus(); }
function closeCart() { cart.classList.remove('is-open'); cart.setAttribute('aria-hidden', 'true'); scrim.classList.remove('is-open'); setTimeout(() => { if (!modalOpen) scrim.hidden = true; }, 500); $('#cart-open').setAttribute('aria-expanded', 'false'); if (introDone && !modalOpen) lenis?.start(); }
$('#cart-open').addEventListener('click', openCart);
$('#cart-close').addEventListener('click', closeCart);
scrim.addEventListener('click', () => { closeCart(); });
$$('#pack-sizes button').forEach((b) => b.addEventListener('click', () => {
  $$('#pack-sizes button').forEach((x) => x.setAttribute('aria-checked', 'false'));
  b.setAttribute('aria-checked', 'true'); packSize = +b.dataset.size;
}));
$$('[data-add]').forEach((b) => b.addEventListener('click', () => {
  const key = b.dataset.add;
  const id = key === 'wild-four' ? `wild-four-${packSize}` : key;
  const sub = key === 'wild-four' ? `${packSize}-pack · price at launch` : 'Single flavor · price at launch';
  const it = items.get(id) || { key, name: b.dataset.name, sub, qty: 0 };
  it.qty++; items.set(id, it); renderCart(); openCart();
}));

/* ------------------------------------------------------------------ coming soon modal */
const modal = $('#modal');
function openModal() { lastFocus = document.activeElement; modalOpen = true; modal.hidden = false; requestAnimationFrame(() => modal.classList.add('is-open')); lenis?.stop(); $('#modal-email').focus(); }
function closeModal() { if (!modalOpen) return; modalOpen = false; modal.classList.remove('is-open'); setTimeout(() => { modal.hidden = true; }, 450); if (introDone) lenis?.start(); lastFocus?.focus?.(); }
$$('[data-soon]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); closeCart(); openModal(); }));
$('#modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeCart(); closeMenu(); } });

/* ------------------------------------------------------------------ email forms */
$$('.email-form').forEach((form) => {
  const input = $('input', form), msg = $('.email-form__msg', form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { msg.textContent = 'That email does not look right. Try again.'; input.focus(); return; }
    try { const list = JSON.parse(localStorage.getItem('tt-list') || '[]'); list.push({ email: v, at: Date.now() }); localStorage.setItem('tt-list', JSON.stringify(list)); } catch (err) { /* noop */ }
    form.classList.add('is-done');
    msg.textContent = 'You are on the list. First pour is yours.';
  });
});

/* ------------------------------------------------------------------ housekeeping */
ScrollTrigger.sort();
ScrollTrigger.refresh();
document.fonts?.ready.then(() => ScrollTrigger.refresh());
window.addEventListener('load', () => ScrollTrigger.refresh());
mobileMQ.addEventListener('change', () => { location.reload(); });
