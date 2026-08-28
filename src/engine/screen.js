// ============================================================================
//  SCREEN — a 256x224 framebuffer (SNES resolution) scaled up with
//  nearest-neighbour sampling, so everything drawn into it reads as pixel art.
//
//  The palette and window chrome are tuned to the Final Fantasy VI look:
//  a deep indigo-to-blue gradient window with a light bevelled border, drop
//  shadowed text, and a restrained 16-bit palette.
// ============================================================================

export const W = 256;
export const H = 224;

export const PAL = {
  black:    '#000000',
  night:    '#101024',
  ink:      '#181830',
  win0:     '#1c2f7a',   // window gradient top
  win1:     '#0e1640',   // window gradient bottom
  frame0:   '#c8d8f8',   // window bevel light
  frame1:   '#5878c8',   // window bevel mid
  frame2:   '#203060',   // window bevel dark
  text:     '#f8f8f8',
  textDim:  '#a8b0c8',
  textShade:'#101020',
  gold:     '#f8d048',
  green:    '#68d868',
  red:      '#f85858',
  cyan:     '#68d8f8',
  magenta:  '#e878d8',
  grey:     '#808898',
  white:    '#ffffff',
};

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

  /** FF6-style bevelled message window. */
  window(x, y, w, h, opts = {}) {
    x |= 0; y |= 0; w |= 0; h |= 0;
    const alpha = opts.alpha ?? 1;
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    this.vgrad(x + 2, y + 2, w - 4, h - 4, opts.top ?? PAL.win0, opts.bottom ?? PAL.win1);
    // outer dark edge
    this.outline(x, y, w, h, PAL.frame2);
    // bevel: light on top/left, mid on bottom/right
    this.rect(x + 1, y + 1, w - 2, 1, PAL.frame0);
    this.rect(x + 1, y + 1, 1, h - 2, PAL.frame0);
    this.rect(x + 1, y + h - 2, w - 2, 1, PAL.frame1);
    this.rect(x + w - 2, y + 1, 1, h - 2, PAL.frame1);
    // corner studs
    for (const [cx, cy] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) {
      this.px(cx, cy, PAL.frame0);
    }
    c.restore();
  }

  // --- text ----------------------------------------------------------------
  setFont(size = 8, bold = false) {
    this.ctx.font = `${bold ? 'bold ' : ''}${size}px "Courier New", ui-monospace, monospace`;
    this.ctx.textBaseline = 'top';
    this._fs = size;
  }

  /** Character advance for the current font size. */
  charW(size = this._fs ?? 8) { return Math.round(size * 0.6); }

  textWidth(str, size = 8) { return str.length * this.charW(size); }

  /**
   * Draw text with a hard drop shadow, one character at a time on an integer
   * grid so the spacing stays pixel-stable at any scale.
   */
  text(str, x, y, color = PAL.text, opts = {}) {
    const size = opts.size ?? 8;
    const bold = opts.bold ?? false;
    this.setFont(size, bold);
    const c = this.ctx;
    const adv = this.charW(size);
    let cx = Math.round(x);
    const cy = Math.round(y);
    const shadow = opts.shadow ?? PAL.textShade;
    for (const ch of String(str)) {
      if (ch !== ' ') {
        if (shadow) { c.fillStyle = shadow; c.fillText(ch, cx + 1, cy + 1); }
        c.fillStyle = color;
        c.fillText(ch, cx, cy);
      }
      cx += adv;
    }
    return cx - x;
  }

  textRight(str, x, y, color, opts = {}) {
    const w = this.textWidth(str, opts.size ?? 8);
    return this.text(str, x - w, y, color, opts);
  }

  textCenter(str, cx, y, color, opts = {}) {
    const w = this.textWidth(str, opts.size ?? 8);
    return this.text(str, Math.round(cx - w / 2), y, color, opts);
  }

  /** Word-wrap into a box; returns the number of lines drawn. */
  textWrap(str, x, y, maxW, color = PAL.text, opts = {}) {
    const size = opts.size ?? 8;
    const lh = opts.lineHeight ?? size + 2;
    const perLine = Math.max(1, Math.floor(maxW / this.charW(size)));
    const words = String(str).split(/\s+/);
    const lines = [];
    let line = '';
    for (const wd of words) {
      if (!line.length) { line = wd; continue; }
      if (line.length + 1 + wd.length <= perLine) line += ' ' + wd;
      else { lines.push(line); line = wd; }
    }
    if (line.length) lines.push(line);
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
