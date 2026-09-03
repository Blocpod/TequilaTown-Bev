import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const IMG = '/Users/countergrind/tequila-town/public/img';
const flavors = ['xoconostle','guava','tamarind','guanabana'];
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox','--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.goto('file:///Users/countergrind/tequila-town/public/img/', { waitUntil: 'load' });
const result = await page.evaluate(async (flavors) => {
  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const getData = img => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return { c, x, d: x.getImageData(0, 0, c.width, c.height), w: c.width, h: c.height }; };
  const px = (D, x, y) => { const i = (y * D.w + Math.round(x)) * 4; return [D.d.data[i], D.d.data[i+1], D.d.data[i+2]]; };
  const sat = ([r,g,b]) => Math.max(r,g,b) - Math.min(r,g,b);
  const out = { colors: {}, geom: {} };
  for (const f of flavors) {
    const F = getData(await load(`can-${f}-front.png`));
    const B = getData(await load(`can-${f}-back.png`));
    const bg = px(F, 5, 5);
    const cx0 = Math.round(F.w / 2);
    // find band rows on center column (saturated)
    let bandBot = F.h - 1; while (bandBot > 0 && sat(px(F, cx0, bandBot)) < 35) bandBot--;
    let bandTop = bandBot; while (bandTop > 0 && sat(px(F, cx0, bandTop - 1)) >= 35) bandTop--;
    const bandMid = Math.round((bandTop + bandBot) / 2);
    let x1 = cx0, x2 = cx0;
    while (x1 > 0 && sat(px(F, x1 - 1, bandMid)) > 25) x1--;
    while (x2 < F.w - 1 && sat(px(F, x2 + 1, bandMid)) > 25) x2++;
    const cx = (x1 + x2) / 2, R = (x2 - x1) / 2;
    const bandColor = px(F, cx, bandMid);
    // non-bg test
    const diff = (D, x, y) => { const p = px(D, x, y); return Math.max(Math.abs(p[0]-bg[0]), Math.abs(p[1]-bg[1]), Math.abs(p[2]-bg[2])); };
    // lid top: scan center col from top
    let lidTop = 0; while (lidTop < F.h && diff(F, cx, lidTop) < 8) lidTop++;
    // label top: first row where width >= 0.985 * 2R
    let labelTop = lidTop;
    for (let y = lidTop; y < F.h * 0.4; y++) {
      let a = Math.round(cx), b = Math.round(cx);
      while (a > 0 && diff(F, a - 1, y) >= 8) a--;
      while (b < F.w - 1 && diff(F, b + 1, y) >= 8) b++;
      if ((b - a) >= 0.985 * (x2 - x1)) { labelTop = y; break; }
    }
    // can bottom (rim) : scan center col from bottom
    let canBot = F.h - 1; while (canBot > 0 && diff(F, cx, canBot) < 8) canBot--;
    const cream = px(F, cx, labelTop + 30);
    const creamRow = labelTop + 30;
    out.colors[f] = { band: bandColor, cream, bg };
    out.geom[f] = { x1, x2, cx, R, lidTop, labelTop, bandTop, bandBot, canBot, w: F.w, h: F.h };
    // ---- unwrap texture ----
    const TW = 2048, TH = 1536;
    const T = document.createElement('canvas'); T.width = TW; T.height = TH; const tx = T.getContext('2d');
    const labelH = bandBot - labelTop + 1;
    const lumRow = (D) => { const arr = new Float32Array(D.w); for (let x = 0; x < D.w; x++) { const p = px(D, x, creamRow); arr[x] = 0.2126*p[0]+0.7152*p[1]+0.0722*p[2]; } return arr; };
    const LF = lumRow(F), LB = lumRow(B);
    const L0 = Math.max(LF[Math.round(cx)], LB[Math.round(cx)]);
    const gains = new Float32Array(TW);
    for (let u = 0; u < TW; u++) {
      const phi = (u / TW) * Math.PI * 2 - Math.PI / 2; // front spans [-pi/2, pi/2]
      let src, xs;
      if (phi <= Math.PI / 2) { src = F; xs = cx + R * Math.sin(phi); }
      else { src = B; xs = cx - R * Math.sin(phi - Math.PI); }
      // back: phi in (pi/2, 3pi/2); delta = phi - pi in (-pi/2, pi/2); screen x = cx + R sin(delta)
      if (phi > Math.PI / 2) xs = cx + R * Math.sin(phi - Math.PI);
      xs = Math.min(x2 - 0.5, Math.max(x1 + 0.5, xs));
      tx.drawImage(src.c, xs - 0.5, labelTop, 1, labelH, u, 0, 1, TH);
      const L = (src === F ? LF : LB)[Math.round(xs)];
      gains[u] = Math.min(1.35, Math.max(0.85, L0 / Math.max(1, L)));
    }
    // flatten lighting
    const id = tx.getImageData(0, 0, TW, TH); const d = id.data;
    for (let y = 0; y < TH; y++) for (let u = 0; u < TW; u++) { const i = (y * TW + u) * 4; const g = gains[u]; d[i] = Math.min(255, d[i]*g); d[i+1] = Math.min(255, d[i+1]*g); d[i+2] = Math.min(255, d[i+2]*g); }
    tx.putImageData(id, 0, 0);
    out[`label-${f}`] = T.toDataURL('image/jpeg', 0.92);
    // ---- botanical engraving: key the cream out of the lower front label ----
    {
      const fx0 = x1 + 6, fx1 = x2 - 6, fy0 = Math.round(labelTop + (bandTop - labelTop) * 0.615), fy1 = bandTop - 4;
      const bw = fx1 - fx0, bh = fy1 - fy0;
      const Bc = document.createElement('canvas'); Bc.width = bw; Bc.height = bh; const bx = Bc.getContext('2d');
      bx.drawImage(F.c, fx0, fy0, bw, bh, 0, 0, bw, bh);
      const im = bx.getImageData(0, 0, bw, bh); const d = im.data;
      // per-column cream reference from the row just under the text (top of crop is mostly cream)
      const cream = px(F, cx, fy0 + 4); const cL = 0.2126*cream[0]+0.7152*cream[1]+0.0722*cream[2];
      for (let i = 0; i < d.length; i += 4) {
        const L = 0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2];
        const gainX = LF[fx0 + ((i/4) % bw)] / Math.max(1, LF[Math.round(cx)]);
        let a = Math.min(1, Math.max(0, (cL * gainX - L) / (cL * gainX * 0.70)));
        // soft knee: kill paper noise, keep engraving strokes
        a = Math.min(1, Math.max(0, (a - 0.14) / (0.86 - 0.14))); a = a * a * (3 - 2 * a);
        d[i+3] = Math.round(a * 255);
        // single-ink stamp in the flavor's band color
        d[i] = bandColor[0]; d[i+1] = bandColor[1]; d[i+2] = bandColor[2];
      }
      bx.putImageData(im, 0, 0);
      out[`botanical-${f}`] = Bc.toDataURL('image/png');
    }
    // ---- cutouts (front & back) ----
    for (const [name, D] of [['front', F], ['back', B]]) {
      const C = document.createElement('canvas'); C.width = D.w; C.height = D.h; const cc = C.getContext('2d');
      cc.drawImage(D.c, 0, 0);
      const im = cc.getImageData(0, 0, D.w, D.h); const dd = im.data;
      const pad = 3;
      for (let y = 0; y < D.h; y++) for (let x = 0; x < D.w; x++) {
        const i = (y * D.w + x) * 4;
        const inside = x >= x1 - pad && x <= x2 + pad && y >= lidTop - 2 && y <= canBot + 2;
        if (!inside) { dd[i+3] = 0; continue; }
        // corners: fade near-bg pixels within 40px of the 4 corners of the rect
        const nearCorner = (y < lidTop + 40 || y > canBot - 40) && (x < x1 + 40 || x > x2 - 40);
        if (nearCorner) {
          const dmax = Math.max(Math.abs(dd[i]-bg[0]), Math.abs(dd[i+1]-bg[1]), Math.abs(dd[i+2]-bg[2]));
          if (dmax < 10) dd[i+3] = 0; else if (dmax < 24) dd[i+3] = Math.round(255 * (dmax - 10) / 14);
        }
      }
      cc.putImageData(im, 0, 0);
      // crop to rect
      const cw = x2 - x1 + 2 * pad + 2, ch = canBot - lidTop + 6;
      const O = document.createElement('canvas'); O.width = cw; O.height = ch;
      O.getContext('2d').drawImage(C, x1 - pad - 1, lidTop - 3, cw, ch, 0, 0, cw, ch);
      out[`cut-${f}-${name}`] = O.toDataURL('image/png');
      out.geom[f].cut = { w: cw, h: ch };
    }
  }
  return out;
}, flavors);
for (const [k, v] of Object.entries(result)) {
  if (k === 'colors' || k === 'geom') continue;
  const ext = v.startsWith('data:image/jpeg') ? 'jpg' : 'png';
  fs.writeFileSync(`${IMG}/${k}.${ext}`, Buffer.from(v.split(',')[1], 'base64'));
}
console.log(JSON.stringify({ colors: result.colors, geom: result.geom }, null, 1));
await browser.close();
