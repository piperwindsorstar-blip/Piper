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
  if (labelFrac == null) labelFrac = img.height >= img.width ? 0.20 : 0.17;
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

export function drawBakedBody(ctx, o) {
  const root = o.kitRoot ?? 'warrior';
  const bob = (o.frame === 1 || o.frame === 5) ? 1 : 0;
  const w = o.w || 36;
  const h = o.h || 48;
  const dx = 1, dy = 1 + bob, dw = w - 2, dh = h - 2 - (o.frame === 2 ? 1 : 0);
  const dedicated = RACE_CLASS_SHEET[o.raceId];
  if (dedicated && punched.get(dedicated)) {
    const cell = classCellFor(o.raceId, root);
    return drawStampCell(ctx, dedicated, cell[0], cell[1], dx, dy, dw, dh);
  }
  const classCell = CLASS_CELL[root];
  if (!classCell || !punched.get(classImg)) return false;
  drawStampCell(ctx, classImg, classCell[0], classCell[1], dx, dy, dw, dh);
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
  const srcC = punched.get(sheet);
  if (!srcC) return false;
  const cell = classCellFor(sheet === classImg ? 'human' : o.raceId, root);
  const [sx, sy, sw, sh] = srcRect(sheet, cell[0], cell[1]);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(srcC, sx, sy, sw, sh * 0.48, w * 0.08, h * 0.04, w * 0.84, h * 0.92);
  return true;
}
