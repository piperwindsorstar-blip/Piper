// ============================================================================
//  BAKED STAMPS — class sheet + race sheet + per-race class sheets.
//  A race with its own 12-class sheet uses that drawing. Everyone else falls
//  back to the generic class sheet plus a race overlay.
// ============================================================================

import {
  CLASS_SHEET, RACE_SHEET,
  FAIRY_CLASS_SHEET, ELF_CLASS_SHEET,
  DWARF_CLASS_SHEET, GNOME_CLASS_SHEET,
  SAURIAN_CLASS_SHEET, LUPINE_CLASS_SHEET,
  OGREKIN_CLASS_SHEET, MERFOLK_CLASS_SHEET,
  DRACONIAN_CLASS_SHEET, AUTOMATON_CLASS_SHEET,
  REVENANT_CLASS_SHEET,
} from './stampSheets.js';

export const CLASS_CELL = {
  warrior:   [0, 0],
  guardian:  [1, 0],
  monk:      [2, 0],
  lancer:    [3, 0],
  thief:     [0, 1],
  archer:    [1, 1],
  dancer:    [2, 1],
  jester:    [3, 1],
  mage:      [0, 2],
  cleric:    [1, 2],
  summoner:  [2, 2],
  spiritist: [3, 2],
};

// Saurian sheet is 3 columns × 4 rows (jester shares dancer; last tile is the nude).
const SAURIAN_CELL = {
  warrior:   [0, 0],
  guardian:  [1, 0],
  monk:      [2, 0],
  lancer:    [0, 1],
  thief:     [1, 1],
  archer:    [2, 1],
  dancer:    [0, 2],
  jester:    [0, 2],
  mage:      [1, 2],
  cleric:    [2, 2],
  summoner:  [0, 3],
  spiritist: [1, 3],
};

export const RACE_CELL = {
  human:     [0, 0],
  elf:       [1, 0],
  dwarf:     [2, 0],
  fairy:     [3, 0],
  saurian:   [0, 1],
  lupine:    [1, 1],
  ogrekin:   [2, 1],
  gnome:     [3, 1],
  merfolk:   [0, 2],
  draconian: [1, 2],
  automaton: [2, 2],
  revenant:  [3, 2],
};

export let STAMP_GEN = 0;
const punched = new WeakMap();
const grids = new WeakMap();

// ---------------------------------------------------------------------------
//  RECOLOR — the stamp sheets are one fixed painted illustration per
//  race+class cell, so a player's chosen skin tone / hair color (picked at
//  creation, and honored by the procedural anime painter this baked art
//  otherwise replaces) never showed up on it. Rather than repaint the sheets,
//  each race gets a hand-picked anchor point landing on its own face (and,
//  where hair/fur/beard is actually visible on an armoured warrior — the
//  pose every anchor below was calibrated against — a hair anchor too);
//  recoloring flood-fills out from there by material similarity and hue-
//  shifts what it finds toward the chosen color, keeping every pixel's own
//  painted lightness so the existing shading and highlights survive.
//
//  Anchors are fractions of the same near-full-cell crop drawBakedBody uses
//  (see srcRect below), so they apply to the body sprite directly; the bust
//  crops the same cell's top 48% and stretches it, so its anchor is derived
//  from the body one rather than re-measured by hand.
// ---------------------------------------------------------------------------
const SKIN_ANCHOR = {
  human: [0.498, 0.324], elf: [0.50, 0.33], dwarf: [0.55, 0.33],
  fairy: [0.50, 0.37], saurian: [0.59, 0.17], lupine: [0.50, 0.24],
  ogrekin: [0.48, 0.23], gnome: [0.52, 0.36], merfolk: [0.48, 0.27],
  draconian: [0.35, 0.20], revenant: [0.53, 0.15],
  // automaton has no organic skin — its "skin" swatches are a chassis
  // paint job, a different feature; deliberately left untinted for now.
};
const HAIR_ANCHOR = {
  // Only where hair/fur/beard is actually visible on the armoured warrior
  // pose every other class was rendered from the same illustration set as.
  // A full-helm class (most of them, for most races) will simply flood-fill
  // nothing at this spot and no-op, same as picking the default color does —
  // races without a real hair/fur/beard concept (saurian, ogrekin, draconian,
  // automaton, revenant) are left out entirely rather than guessed at. A
  // third, optional entry overrides the default 0.24 match tolerance — elf's
  // hair sits close enough to its own skin tone in hue that the default let
  // a flood fill cross the neckline onto skin; tightened just for elf so a
  // dwarf's beard (a very different material from its own face) keeps the
  // looser tolerance it actually needs to cover its own shading range.
  human: [0.41, 0.11], elf: [0.39, 0.15, 0.16], dwarf: [0.50, 0.42],
  fairy: [0.50, 0.28], gnome: [0.50, 0.45],
  lupine: [0.519, 0.217], merfolk: [0.476, 0.220],
};

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0; const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : l > 0.5 ? d / (2 - max - min) : d / (max + min);
  if (d !== 0) {
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(hue2rgb(h + 1 / 3) * 255), Math.round(hue2rgb(h) * 255), Math.round(hue2rgb(h - 1 / 3) * 255)];
}

// Hue-weighted so two pixels of the same material but different shading
// (a lit cheek vs. a shadowed jaw, painted at the same hue and a lower
// lightness) still count as close, while a same-lightness sliver of grey
// armor next to warm skin does not.
function materialDist(h1, s1, l1, h2, s2, l2) {
  const dl = l1 - l2;
  // Both near-gray (metal, bone, cloth-in-shadow): hue is numeric noise on a
  // color this close to grayscale, so fall back to lightness alone.
  if (s1 < 0.12 && s2 < 0.12) return Math.abs(dl) * 1.3;
  // One chromatic, one not (skin next to a steel helmet, say): that alone is
  // a material break — don't let a near-gray pixel's meaningless hue read as
  // "close" just because it happens to land near skin's hue by chance.
  const ds = s1 - s2;
  if (Math.abs(ds) > 0.22) return 1 + Math.abs(ds);
  let dh = Math.abs(h1 - h2);
  if (dh > 0.5) dh = 1 - dh;
  return Math.sqrt(dh * dh * 3.2 + ds * ds * 0.7 + dl * dl * 0.5);
}

/** Flood-fills out from (seedXFrac, seedYFrac) by material similarity and
 *  hue/saturation-shifts whatever it finds toward `targetHex`, preserving
 *  each pixel's own lightness. Aborts (leaving the art untouched) if the
 *  anchor lands on nothing opaque, the matched region is too small to be
 *  the intended material, or too large to be it either — the two guards
 *  that keep a miscalibrated anchor from silently painting half the sprite. */
function recolorRegion(imgData, w, h, seedXFrac, seedYFrac, targetHex, tol) {
  const a = imgData.data;
  const sx0 = Math.round(seedXFrac * w), sy0 = Math.round(seedYFrac * h);
  let rs = 0, gs = 0, bs = 0, cnt = 0;
  const R = 3;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = sx0 + dx, y = sy0 + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      if (a[i + 3] < 200) continue;
      rs += a[i]; gs += a[i + 1]; bs += a[i + 2]; cnt++;
    }
  }
  if (cnt === 0) return false;
  const seedHex = `#${[rs / cnt, gs / cnt, bs / cnt].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const [sh, ss, sl] = hexToHsl(seedHex);
  // A near-gray seed sampling a colorful target material (skin, fur, scale)
  // means the anchor landed on a shadow seam or shared edge with metal, not
  // the material itself — the seed's own low saturation would otherwise let
  // materialDist's achromatic branch flood-fill straight into actual armor.
  // Bailing out here is the same safe no-op as missing the anchor entirely.
  const [, targetSat] = hexToHsl(targetHex);
  if (ss < 0.15 && targetSat >= 0.15) return false;

  const visited = new Uint8Array(w * h);
  const stack = [sx0, sy0];
  const pixels = [];
  const maxPixels = Math.floor(w * h * 0.35);
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const idx = y * w + x;
    if (visited[idx]) continue;
    visited[idx] = 1;
    const i = idx * 4;
    if (a[i + 3] < 200) continue;
    const [ph, ps, pl] = hexToHsl(`#${[a[i], a[i + 1], a[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    if (materialDist(sh, ss, sl, ph, ps, pl) > tol) continue;
    pixels.push(idx);
    if (pixels.length > maxPixels) return false;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  if (pixels.length < 10) return false;

  const [th, ts] = hexToHsl(targetHex);
  for (const idx of pixels) {
    const i = idx * 4;
    const [, , l] = hexToHsl(`#${[a[i], a[i + 1], a[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    const [r, g, b] = hslToRgb(th, ts, l);
    a[i] = r; a[i + 1] = g; a[i + 2] = b;
  }
  return true;
}

const tintCache = new WeakMap();

/** The one cell a body/bust draws from, with skin/hair recolored in if this
 *  race has anchors for them — cached per (sheet, cell, colors) so repaints
 *  of the same character don't redo the flood fill every frame. */
function getTintedCell(sheet, col, row, raceId, skinHex, hairHex) {
  const skinAnchor = SKIN_ANCHOR[raceId], hairAnchor = HAIR_ANCHOR[raceId];
  if (!skinAnchor && !hairAnchor) return null;
  const key = `${col},${row}|${skinAnchor ? skinHex : ''}|${hairAnchor ? hairHex : ''}`;
  let byCell = tintCache.get(sheet);
  if (!byCell) { byCell = new Map(); tintCache.set(sheet, byCell); }
  if (byCell.has(key)) return byCell.get(key);

  const src = punched.get(sheet);
  const [sx, sy, sw, sh] = srcRect(sheet, col, row);
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(sw); cv.height = Math.ceil(sh);
  const ctx = cv.getContext('2d');
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  const imgData = ctx.getImageData(0, 0, cv.width, cv.height);
  let changed = false;
  if (skinAnchor && skinHex) changed = recolorRegion(imgData, cv.width, cv.height, skinAnchor[0], skinAnchor[1], skinHex, 0.30) || changed;
  if (hairAnchor && hairHex) changed = recolorRegion(imgData, cv.width, cv.height, hairAnchor[0], hairAnchor[1], hairHex, hairAnchor[2] ?? 0.24) || changed;
  if (changed) ctx.putImageData(imgData, 0, 0);
  byCell.set(key, cv);
  return cv;
}

function load(src, cols = 4, rows = 3) {
  const im = new Image();
  im.onload = () => { punched.set(im, punch(im)); STAMP_GEN += 1; };
  im.src = src;
  grids.set(im, { cols, rows });
  return im;
}

const classImg = load(CLASS_SHEET, 4, 3);
const raceImg = load(RACE_SHEET, 4, 3);

const RACE_CLASS_SHEET = {
  fairy:     load(FAIRY_CLASS_SHEET, 4, 3),
  elf:       load(ELF_CLASS_SHEET, 4, 3),
  dwarf:     load(DWARF_CLASS_SHEET, 4, 3),
  gnome:     load(GNOME_CLASS_SHEET, 4, 3),
  saurian:   load(SAURIAN_CLASS_SHEET, 3, 4),
  lupine:    load(LUPINE_CLASS_SHEET, 4, 3),
  ogrekin:   load(OGREKIN_CLASS_SHEET, 4, 3),
  merfolk:   load(MERFOLK_CLASS_SHEET, 4, 3),
  draconian: load(DRACONIAN_CLASS_SHEET, 4, 3),
  automaton: load(AUTOMATON_CLASS_SHEET, 4, 3),
  revenant:  load(REVENANT_CLASS_SHEET, 4, 3),
};

function punch(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  const w = c.width, h = c.height;
  const keyed = (r, gv, b) =>
    (b > r + 4 && b > gv + 1 && r < 62 && gv < 68 && b < 110)
    || (r + gv + b < 36);
  for (let i = 0; i < p.length; i += 4) {
    if (keyed(p[i], p[i + 1], p[i + 2])) p[i + 3] = 0;
  }
  // Drop leftover navy fringe, then soften the cut.
  const a0 = new Uint8ClampedArray(p.length);
  a0.set(p);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (a0[i + 3] === 0) continue;
      let empty = 0;
      if (a0[((y) * w + (x - 1)) * 4 + 3] === 0) empty++;
      if (a0[((y) * w + (x + 1)) * 4 + 3] === 0) empty++;
      if (a0[((y - 1) * w + x) * 4 + 3] === 0) empty++;
      if (a0[((y + 1) * w + x) * 4 + 3] === 0) empty++;
      if (empty === 0) continue;
      const r = p[i], gv = p[i + 1], b = p[i + 2];
      if (empty >= 2 && (b > r + 2 || r + gv + b < 90)) p[i + 3] = 0;
      else p[i + 3] = Math.max(0, p[i + 3] - 70 * empty);
    }
  }
  g.putImageData(d, 0, 0);
  return c;
}

function srcRect(img, col, row, labelFrac) {
  const g = grids.get(img) ?? { cols: 4, rows: 3 };
  if (labelFrac == null) labelFrac = img.height >= img.width ? 0.24 : 0.17;
  const cw = img.width / g.cols;
  const ch = img.height / g.rows;
  const padX = cw * 0.04;
  const padY = ch * 0.035;
  return [
    col * cw + padX,
    row * ch + padY,
    cw - padX * 2,
    ch * (1 - labelFrac) - padY,
  ];
}

export function stampsReady() {
  if (!punched.has(classImg) || !punched.has(raceImg)) return false;
  for (const im of Object.values(RACE_CLASS_SHEET)) {
    if (!punched.has(im)) return false;
  }
  return true;
}

function classCellFor(raceId, root) {
  if (raceId === 'saurian') return SAURIAN_CELL[root] ?? SAURIAN_CELL.warrior;
  return CLASS_CELL[root] ?? CLASS_CELL.warrior;
}

export function drawStampCell(ctx, sheet, col, row, dx, dy, dw, dh) {
  const src = punched.get(sheet);
  if (!src) return false;
  const [sx, sy, sw, sh] = srcRect(sheet, col, row);
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
  return true;
}

/** Draws one stamp cell, recolored toward `skinHex`/`hairHex` if this race
 *  has anchors for them and the caller actually asked for tinting (a player
 *  who kept the default look never touches this path — see actor.js). */
function drawCellTinted(ctx, sheet, col, row, raceId, skinHex, hairHex, dx, dy, dw, dh) {
  if (skinHex || hairHex) {
    const tinted = getTintedCell(sheet, col, row, raceId, skinHex, hairHex);
    if (tinted) {
      ctx.imageSmoothingEnabled = true;
      if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tinted, 0, 0, tinted.width, tinted.height, dx, dy, dw, dh);
      return true;
    }
  }
  return drawStampCell(ctx, sheet, col, row, dx, dy, dw, dh);
}

export function drawBakedBody(ctx, o) {
  const root = o.kitRoot ?? 'warrior';
  const bob = (o.frame === 1 || o.frame === 5) ? 1 : 0;
  const w = o.w || 36;
  const h = o.h || 48;
  const dx = 1, dy = 1 + bob, dw = w - 2, dh = h - 2 - (o.frame === 2 ? 1 : 0);
  const dedicated = RACE_CLASS_SHEET[o.raceId];
  if (dedicated && punched.get(dedicated)) {
    const cell = classCellFor(o.raceId, root);
    return drawCellTinted(ctx, dedicated, cell[0], cell[1], o.raceId, o.skinHex, o.hairHex, dx, dy, dw, dh);
  }
  const classCell = CLASS_CELL[root];
  if (!classCell || !punched.get(classImg)) return false;
  drawCellTinted(ctx, classImg, classCell[0], classCell[1], o.raceId ?? 'human', o.skinHex, o.hairHex, dx, dy, dw, dh);
  const raceCell = RACE_CELL[o.raceId ?? 'human'];
  if (o.raceId && o.raceId !== 'human' && raceCell && punched.get(raceImg)) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.62;
    drawStampCell(ctx, raceImg, raceCell[0], raceCell[1], dx, dy, dw, dh);
    ctx.restore();
    const src = punched.get(raceImg);
    const [sx, sy, sw, sh] = srcRect(raceImg, raceCell[0], raceCell[1]);
    ctx.drawImage(src, sx, sy, sw, sh * 0.38, dx + dw * 0.20, dy, dw * 0.60, dh * 0.36);
  }
  return true;
}

export function drawBakedBust(ctx, o, w, h) {
  const root = o.kitRoot ?? 'warrior';
  const dedicated = RACE_CLASS_SHEET[o.raceId];
  const sheet = (dedicated && punched.get(dedicated)) ? dedicated : classImg;
  if (!punched.get(sheet)) return false;
  const raceId = sheet === classImg ? 'human' : o.raceId;
  const cell = classCellFor(raceId, root);
  ctx.imageSmoothingEnabled = true;
  if (o.skinHex || o.hairHex) {
    const tinted = getTintedCell(sheet, cell[0], cell[1], raceId, o.skinHex, o.hairHex);
    if (tinted) {
      ctx.drawImage(tinted, 0, 0, tinted.width, tinted.height * 0.48, w * 0.08, h * 0.04, w * 0.84, h * 0.92);
      return true;
    }
  }
  const srcC = punched.get(sheet);
  const [sx, sy, sw, sh] = srcRect(sheet, cell[0], cell[1]);
  ctx.drawImage(srcC, sx, sy, sw, sh * 0.48, w * 0.08, h * 0.04, w * 0.84, h * 0.92);
  return true;
}
