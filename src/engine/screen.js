// ============================================================================
//  SCREEN — a 256x224 framebuffer (SNES resolution) scaled up with
//  nearest-neighbour sampling, so everything drawn into it reads as pixel art.
//
//  Text is drawn from the 5x7 bitmap font in font.js rather than from a system
//  typeface, and windows use the Final Fantasy VI frame: a near-black outer
//  keyline with the corner pixels knocked out, a light periwinkle bevel, a
//  mid-blue inner rule, and a steep blue gradient behind it.
// ============================================================================

import { drawText, measure, wrap, glyph, GLYPH_H } from './font.js';

export const W = 256;
export const H = 224;

// A 16-bit palette pulled toward the FFVI menu ROM: the window blues, the
// off-white body text with its near-black shadow, and the amber highlight.
export const PAL = {
  black:    '#000000',
  night:    '#08081a',
  ink:      '#101028',
  win0:     '#3050c0',   // window gradient top
  win1:     '#101862',   // window gradient middle
  win2:     '#080c38',   // window gradient bottom
  frame0:   '#b8c8f8',   // bright bevel
  frame1:   '#7088d8',   // mid bevel
  frame2:   '#283878',   // inner rule
  frame3:   '#000010',   // outer keyline
  text:     '#f8f8f8',
  textDim:  '#a0b0d0',
  textShade:'#101020',
  gold:     '#f8d048',
  goldDim:  '#c89820',
  green:    '#68e068',
  red:      '#f86060',
  cyan:     '#70d8f8',
  magenta:  '#e880e0',
  grey:     '#7880a0',
  white:    '#ffffff',
};

/** size (in px, as callers request it) -> integer bitmap scale */
export function fontScale(size = 8) {
  if (size >= 20) return 3;
  if (size >= 12) return 2;
  return 1;
}
export const LINE = GLYPH_H + 3;

export class Screen {
  constructor(canvas) {
    this.canvas = canvas;
    this.buf = document.createElement('canvas');
    this.buf.width = W;
    this.buf.height = H;
    this.ctx = this.buf.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.out = canvas.getContext('2d');
    this.out.imageSmoothingEnabled = false;
    this.scale = 1;
    this.shake = 0;
    this.flash = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const pad = 8;
    const sx = Math.floor((window.innerWidth - pad) / W);
    const sy = Math.floor((window.innerHeight - pad) / H);
    this.scale = Math.max(1, Math.min(sx, sy));
    this.canvas.width = W * this.scale;
    this.canvas.height = H * this.scale;
    this.canvas.style.width = `${W * this.scale}px`;
    this.canvas.style.height = `${H * this.scale}px`;
    this.out.imageSmoothingEnabled = false;
  }

  present() {
    let ox = 0, oy = 0;
    if (this.shake > 0) {
      ox = Math.round((Math.random() - 0.5) * this.shake);
      oy = Math.round((Math.random() - 0.5) * this.shake);
      this.shake = Math.max(0, this.shake - 0.6);
    }
    this.out.imageSmoothingEnabled = false;
    this.out.fillStyle = '#000';
    this.out.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.out.drawImage(this.buf, ox * this.scale, oy * this.scale,
      W * this.scale, H * this.scale);
  }

  // --- primitives ----------------------------------------------------------
  clear(color = PAL.black) {
    const c = this.ctx;
    c.fillStyle = color;
    c.fillRect(0, 0, W, H);
  }

  rect(x, y, w, h, color) {
    const c = this.ctx;
    c.fillStyle = color;
    c.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  outline(x, y, w, h, color) {
    this.rect(x, y, w, 1, color);
    this.rect(x, y + h - 1, w, 1, color);
    this.rect(x, y, 1, h, color);
    this.rect(x + w - 1, y, 1, h, color);
  }

  px(x, y, color) { this.rect(x, y, 1, 1, color); }

  vgrad(x, y, w, h, top, bottom) {
    const c = this.ctx;
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  /**
   * The Final Fantasy VI menu window: a three-stop blue gradient behind a
   * three-ring frame, with the four extreme corner pixels knocked out so the
   * box reads as rounded at 1:1.
   */
  window(x, y, w, h, opts = {}) {
    x |= 0; y |= 0; w |= 0; h |= 0;
    const c = this.ctx;
    c.save();
    c.globalAlpha = opts.alpha ?? 1;

    // body: bright at the top, falling away steeply, as the SNES gradient does
    const g = c.createLinearGradient(0, y + 3, 0, y + h - 3);
    g.addColorStop(0, opts.top ?? PAL.win0);
    g.addColorStop(0.45, opts.mid ?? PAL.win1);
    g.addColorStop(1, opts.bottom ?? PAL.win2);
    c.fillStyle = g;
    c.fillRect(x + 3, y + 3, w - 6, h - 6);

    // ring 3 — inner rule
    this.outline(x + 2, y + 2, w - 4, h - 4, PAL.frame2);
    // ring 2 — the bright bevel, brighter along the top and left
    this.rect(x + 1, y + 1, w - 2, 1, PAL.frame0);
    this.rect(x + 1, y + 1, 1, h - 2, PAL.frame0);
    this.rect(x + 1, y + h - 2, w - 2, 1, PAL.frame1);
    this.rect(x + w - 2, y + 1, 1, h - 2, PAL.frame1);
    // ring 1 — outer keyline
    this.outline(x, y, w, h, PAL.frame3);

    // knock the extreme corners out to round the box
    for (const [cx, cy] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) {
      c.clearRect(cx, cy, 1, 1);
    }
    // and dot the bevel corners so the rounding reads
    for (const [cx, cy] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) {
      this.px(cx, cy, PAL.frame1);
    }
    c.restore();
  }

  // --- text (bitmap font) --------------------------------------------------
  /** Average advance, for callers that lay out on a rough character grid. */
  charW(size = 8) { return 6 * fontScale(size); }

  textWidth(str, size = 8) { return measure(str, fontScale(size)); }

  lineHeight(size = 8) { return GLYPH_H * fontScale(size) + 3; }

  text(str, x, y, color = PAL.text, opts = {}) {
    const scale = fontScale(opts.size ?? 8);
    return drawText(this.ctx, str, x, y, color, {
      scale, shadow: opts.shadow === null ? null : (opts.shadow ?? PAL.textShade),
    });
  }

  textRight(str, x, y, color, opts = {}) {
    return this.text(str, x - this.textWidth(str, opts.size ?? 8), y, color, opts);
  }

  textCenter(str, cx, y, color, opts = {}) {
    return this.text(str, Math.round(cx - this.textWidth(str, opts.size ?? 8) / 2), y, color, opts);
  }

  /** Word-wrap into a box; returns the number of lines drawn. */
  textWrap(str, x, y, maxW, color = PAL.text, opts = {}) {
    const size = opts.size ?? 8;
    const scale = fontScale(size);
    const lh = opts.lineHeight ?? (GLYPH_H * scale + 3);
    const lines = wrap(str, maxW, scale);
    const limit = opts.maxLines ?? lines.length;
    lines.slice(0, limit).forEach((l, i) => this.text(l, x, y + i * lh, color, opts));
    return Math.min(lines.length, limit);
  }

  // --- bars ----------------------------------------------------------------
  bar(x, y, w, h, ratio, fill, back = '#101828') {
    ratio = Math.max(0, Math.min(1, ratio || 0));
    this.rect(x, y, w, h, back);
    this.outline(x, y, w, h, '#000');
    const inner = Math.max(0, Math.round((w - 2) * ratio));
    if (inner > 0) {
      this.rect(x + 1, y + 1, inner, h - 2, fill);
      this.rect(x + 1, y + 1, inner, 1, this.lighten(fill, 0.35));
    }
  }

  lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + 255 * amt) | 0;
    const g = Math.min(255, ((n >> 8) & 255) + 255 * amt) | 0;
    const b = Math.min(255, (n & 255) + 255 * amt) | 0;
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  darken(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, ((n >> 16) & 255) * (1 - amt)) | 0;
    const g = Math.max(0, ((n >> 8) & 255) * (1 - amt)) | 0;
    const b = Math.max(0, (n & 255) * (1 - amt)) | 0;
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  fade(alpha, color = '#000') {
    const c = this.ctx;
    c.save();
    c.globalAlpha = Math.max(0, Math.min(1, alpha));
    c.fillStyle = color;
    c.fillRect(0, 0, W, H);
    c.restore();
  }

  addShake(amount) { this.shake = Math.max(this.shake, amount); }
}
