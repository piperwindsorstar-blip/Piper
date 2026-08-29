// ============================================================================
//  SCREEN — a 480x270 framebuffer (exactly quarter-scale 1080p) drawn with
//  nearest-neighbour sprites, then finished with a post pass: bloom on the
//  bright pixels, a per-scene colour grade, and a vignette.
//
//  That combination is what separates HD-2D from straight 16-bit: the art
//  underneath is still pixels on a grid, but the light on top of it is not.
// ============================================================================

import { drawText, measure, wrap, GLYPH_H } from './font.js';

export const W = 480;
export const H = 270;

// The on-screen touch pad is anchored to the viewport's corners, not the
// canvas — so on a canvas that fills most of a small phone screen, pad
// buttons sit on top of real menu content instead of beside it (a tap meant
// for a menu word lands on Cancel instead). These gutters keep the canvas
// entirely clear of the pad's footprint; #wrap/#cabinet apply matching
// padding via CSS the moment #touch gains .visible.
const TOUCH_TOP_GUTTER = 58;
const TOUCH_BOTTOM_GUTTER = 170;

// A modern dark-UI palette: near-black grounds, cool desaturated blues for
// surfaces, and a warm amber accent that never appears in the world art.
export const PAL = {
  black:    '#000000',
  void:     '#06070c',
  night:    '#0b0e18',
  ink:      '#12162340',
  panel:    'rgba(15,19,31,0.90)',
  panelHi:  'rgba(30,38,60,0.92)',
  line:     'rgba(150,175,235,0.22)',
  lineHi:   'rgba(180,205,255,0.50)',
  accent:   '#f0b44c',
  accentDim:'#a8762c',
  text:     '#eef2fb',
  textDim:  '#94a2c0',
  textFaint:'#5d6a86',
  shadow:   '#05060b',
  gold:     '#f0b44c',
  green:    '#6ee7a0',
  red:      '#ff6b7a',
  cyan:     '#5cd2f0',
  magenta:  '#c98bf5',
  grey:     '#6b7690',
  white:    '#ffffff',
  // legacy aliases so older call sites keep working
  win0:     'rgba(30,38,60,0.92)',
  win1:     'rgba(15,19,31,0.90)',
  win2:     'rgba(10,13,22,0.92)',
  frame0:   'rgba(180,205,255,0.50)',
  frame1:   'rgba(150,175,235,0.22)',
  frame2:   'rgba(90,110,160,0.20)',
  frame3:   'rgba(4,6,12,0.85)',
  textShade:'#05060b',
  goldDim:  '#a8762c',
};

/** size (in px, as callers request it) -> integer bitmap scale */
export function fontScale(size = 8) {
  if (size >= 24) return 4;
  if (size >= 18) return 3;
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

    // half- and quarter-size buffers for the bloom pass
    this.bloomA = document.createElement('canvas');
    this.bloomA.width = W >> 1; this.bloomA.height = H >> 1;
    this.bloomB = document.createElement('canvas');
    this.bloomB.width = W >> 2; this.bloomB.height = H >> 2;

    this.scale = 1;
    this.shake = 0;
    this.grade = null;        // {color, amount} tint applied in post
    this.bloom = 0.5;
    this.vignette = 0.5;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const pad = 8;
    const touchOn = document.getElementById('touch')?.classList.contains('visible') ?? false;
    const topGutter = touchOn ? TOUCH_TOP_GUTTER : 0;
    const bottomGutter = touchOn ? TOUCH_BOTTOM_GUTTER : 0;
    const sx = (window.innerWidth - pad) / W;
    const sy = (window.innerHeight - pad - topGutter - bottomGutter) / H;
    // integer scale where it fits, so pixels stay square
    const raw = Math.min(sx, sy);
    this.scale = raw >= 1 ? Math.max(1, Math.floor(raw)) : raw;
    this.canvas.width = Math.round(W * this.scale);
    this.canvas.height = Math.round(H * this.scale);
    this.canvas.style.width = `${Math.round(W * this.scale)}px`;
    this.canvas.style.height = `${Math.round(H * this.scale)}px`;
    this.out.imageSmoothingEnabled = false;
  }

  // --- post-processing -------------------------------------------------------
  /** Set the colour grade for the current scene. */
  setGrade(color, amount = 0.16) { this.grade = color ? { color, amount } : null; }

  applyPost() {
    const c = this.ctx;

    // BLOOM: threshold the frame, blur it by bouncing through two smaller
    // buffers, then add it back. Cheap, and it is what makes lit pixels read
    // as emitting rather than merely being bright.
    if (this.bloom > 0) {
      const a = this.bloomA.getContext('2d');
      const b = this.bloomB.getContext('2d');
      const aw = this.bloomA.width, ah = this.bloomA.height;
      a.globalCompositeOperation = 'source-over';
      a.clearRect(0, 0, aw, ah);
      a.imageSmoothingEnabled = true;
      a.drawImage(this.buf, 0, 0, aw, ah);
      // THRESHOLD: multiplying the frame by itself squares every channel, which
      // collapses the midtones and leaves only what was already near-white.
      // Doing it twice (a cube) keeps the highlights and almost nothing else —
      // a single flat multiply glows the entire image instead.
      a.globalCompositeOperation = 'multiply';
      a.drawImage(this.bloomA, 0, 0);
      a.drawImage(this.bloomA, 0, 0);
      a.globalCompositeOperation = 'source-over';

      b.clearRect(0, 0, this.bloomB.width, this.bloomB.height);
      b.imageSmoothingEnabled = true;
      b.drawImage(this.bloomA, 0, 0, this.bloomB.width, this.bloomB.height);

      c.save();
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = this.bloom;
      c.imageSmoothingEnabled = true;
      c.drawImage(this.bloomB, 0, 0, W, H);
      c.imageSmoothingEnabled = false;
      c.restore();
    }

    // COLOUR GRADE: a soft wash that ties the whole frame to one temperature
    if (this.grade) {
      c.save();
      c.globalCompositeOperation = 'overlay';
      c.globalAlpha = this.grade.amount;
      c.fillStyle = this.grade.color;
      c.fillRect(0, 0, W, H);
      c.restore();
    }

    // VIGNETTE: darkens the corners so the eye stays in the middle third
    if (this.vignette > 0) {
      const g = c.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${this.vignette})`);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
  }

  present() {
    this.applyPost();
    let ox = 0, oy = 0;
    if (this.shake > 0) {
      ox = Math.round((Math.random() - 0.5) * this.shake);
      oy = Math.round((Math.random() - 0.5) * this.shake);
      this.shake = Math.max(0, this.shake - 0.7);
    }
    this.out.imageSmoothingEnabled = false;
    this.out.fillStyle = '#000';
    this.out.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.out.drawImage(this.buf,
      Math.round(ox * this.scale), Math.round(oy * this.scale),
      Math.round(W * this.scale), Math.round(H * this.scale));
  }

  // --- primitives ------------------------------------------------------------
  clear(color = PAL.void) {
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, W, H);
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
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

  /** A rounded rectangle path, corners cut rather than curved at this scale. */
  roundRect(x, y, w, h, r = 3) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.lineTo(x + w, y + r);
    c.lineTo(x + w, y + h - r); c.lineTo(x + w - r, y + h);
    c.lineTo(x + r, y + h); c.lineTo(x, y + h - r);
    c.lineTo(x, y + r);
    c.closePath();
  }

  /**
   * The modern UI surface: a translucent dark panel, a hairline border that is
   * brighter along the top edge, an optional accent rule, and a soft drop
   * shadow underneath so it lifts off the world behind it.
   */
  panel(x, y, w, h, opts = {}) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const c = this.ctx;
    c.save();
    c.globalAlpha = opts.alpha ?? 1;

    // drop shadow
    if (opts.shadow !== false) {
      c.fillStyle = 'rgba(0,0,0,0.34)';
      this.roundRect(x + 1, y + 2, w, h, 3); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.18)';
      this.roundRect(x + 2, y + 4, w, h, 3); c.fill();
    }

    // body
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, opts.top ?? PAL.panelHi);
    g.addColorStop(1, opts.bottom ?? PAL.panel);
    c.fillStyle = g;
    this.roundRect(x, y, w, h, 3); c.fill();

    // hairline border, brighter along the lit top edge
    c.lineWidth = 1;
    c.strokeStyle = opts.border ?? PAL.line;
    this.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 3); c.stroke();
    c.fillStyle = opts.borderTop ?? PAL.lineHi;
    c.fillRect(x + 3, y, w - 6, 1);

    // accent rule under the top edge
    if (opts.accent) {
      c.fillStyle = opts.accent === true ? PAL.accent : opts.accent;
      c.fillRect(x + 3, y + 1, Math.min(w - 6, opts.accentWidth ?? 18), 1);
    }
    c.restore();
  }

  /** Legacy name — every existing call site draws the modern panel. */
  window(x, y, w, h, opts = {}) { this.panel(x, y, w, h, opts); }

  /** A section heading: small accent text over a hairline rule. */
  heading(text, x, y, w, color = PAL.accent) {
    this.text(text, x, y, color);
    this.rect(x, y + 9, w, 1, 'rgba(150,175,235,0.14)');
    return y + 13;
  }

  // --- text ------------------------------------------------------------------
  charW(size = 8) { return 6 * fontScale(size); }
  textWidth(str, size = 8) { return measure(str, fontScale(size)); }
  lineHeight(size = 8) { return GLYPH_H * fontScale(size) + 3; }

  text(str, x, y, color = PAL.text, opts = {}) {
    const scale = fontScale(opts.size ?? 8);
    return drawText(this.ctx, str, x, y, color, {
      scale, shadow: opts.shadow === null ? null : (opts.shadow ?? PAL.shadow),
    });
  }

  /** Text with a coloured halo — for titles and anything that should glow. */
  textGlow(str, x, y, color, glow = color, opts = {}) {
    const scale = fontScale(opts.size ?? 8);
    const c = this.ctx;
    c.save();
    c.globalAlpha = 0.30;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      drawText(c, str, x + dx, y + dy, glow, { scale, shadow: null });
    }
    c.restore();
    return drawText(c, str, x, y, color, { scale, shadow: opts.shadow ?? PAL.shadow });
  }

  textRight(str, x, y, color, opts = {}) {
    return this.text(str, x - this.textWidth(str, opts.size ?? 8), y, color, opts);
  }

  textCenter(str, cx, y, color, opts = {}) {
    return this.text(str, Math.round(cx - this.textWidth(str, opts.size ?? 8) / 2), y, color, opts);
  }

  textWrap(str, x, y, maxW, color = PAL.text, opts = {}) {
    const size = opts.size ?? 8;
    const scale = fontScale(size);
    const lh = opts.lineHeight ?? (GLYPH_H * scale + 3);
    const lines = wrap(str, maxW, scale);
    const limit = opts.maxLines ?? lines.length;
    lines.slice(0, limit).forEach((l, i) => this.text(l, x, y + i * lh, color, opts));
    return Math.min(lines.length, limit);
  }

  // --- gauges ----------------------------------------------------------------
  /** A slim modern bar: dark track, filled bar, a bright cap and a soft glow. */
  bar(x, y, w, h, ratio, fill, back = 'rgba(0,0,0,0.55)') {
    ratio = Math.max(0, Math.min(1, ratio || 0));
    const c = this.ctx;
    c.fillStyle = back;
    this.roundRect(x, y, w, h, 1); c.fill();
    const inner = Math.max(0, Math.round((w - 2) * ratio));
    if (inner > 0) {
      c.save();
      c.globalAlpha = 0.35;
      c.fillStyle = fill;
      this.roundRect(x, y - 1, inner + 2, h + 2, 1); c.fill();   // glow
      c.restore();
      c.fillStyle = fill;
      this.roundRect(x + 1, y + 1, inner, h - 2, 1); c.fill();
      c.fillStyle = this.lighten(fill, 0.45);
      c.fillRect(x + 1, y + 1, inner, 1);
    }
    c.strokeStyle = 'rgba(255,255,255,0.10)';
    c.lineWidth = 1;
    this.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 1); c.stroke();
  }

  lighten(hex, amt) {
    if (!hex.startsWith('#')) return hex;
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + 255 * amt) | 0;
    const g = Math.min(255, ((n >> 8) & 255) + 255 * amt) | 0;
    const b = Math.min(255, (n & 255) + 255 * amt) | 0;
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  darken(hex, amt) {
    if (!hex.startsWith('#')) return hex;
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

  /** An additive radial light. Used for torches, magic and rim lighting. */
  light(x, y, radius, color, intensity = 0.5) {
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = intensity;
    const g = c.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    c.restore();
  }

  /** A multiplicative shadow pool — the inverse of light(). */
  shade(x, y, radius, alpha = 0.4) {
    const c = this.ctx;
    c.save();
    const g = c.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    c.restore();
  }

  addShake(amount) { this.shake = Math.max(this.shake, amount); }
}
