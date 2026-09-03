# Tequila Town

Immersive single-page site for Tequila Town sparkling tequila. Vite 5, vanilla JS, Three.js (persistent 3D can), GSAP ScrollTrigger, Lenis.

## Run

```bash
npm install
npm run dev      # http://localhost:5220
npm run build    # dist/
```

## Structure

- `index.html` all copy and markup (age gate, nav, 7 sections, newsletter, footer, cooler drawer, coming-soon modal)
- `src/styles.css` design system: bone/ink tokens, four flavor tints sampled from the cans, Fraunces + Archivo, static (reduced-motion / no-WebGL) mode, mobile re-staging
- `src/can.js` the 3D can: unwrapped label textures, aluminum lathe caps, pose API, flavor swap with spin
- `src/main.js` choreography: gate + intro, can travel between sections, pinned Flavors / Inside / Story, cooler, modal, forms
- `public/img/` can renders (`can-*`), cutouts (`cut-*`), cylinder label maps (`label-*`), botanical stamps (`botanical-*`)

## QA (headless Chrome, works without the GPU)

```bash
node scripts/qa/site.mjs out 1440 900 auto:12        # desktop pass, logs the can pose per stop
node scripts/qa/site.mjs out 390 844 auto:14         # mobile pass
REDUCED=1 node scripts/qa/site.mjs out 1440 900 0,1300   # reduced-motion static mode
node scripts/qa/interact.mjs                          # gate, nav, tabs, cooler, modal flows
node scripts/qa/prep.mjs                              # regenerate textures / cutouts / botanicals from can renders
```

## Open items

- Price is `TBA` (copy placeholder). Cart, checkout, email capture, and social links are demo stubs (email stored in localStorage); wire to a commerce backend and ESP before launch.
- Google Fonts are loaded from the CDN; self-host Fraunces + Archivo for production.
