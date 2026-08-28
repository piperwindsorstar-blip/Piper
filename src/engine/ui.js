// ============================================================================
//  UI — cursor lists, dialogue boxes and the small widgets every scene reuses.
// ============================================================================

import { PAL, W, H } from './screen.js';

export class Menu {
  /**
   * @param {object} o {items, columns, rows, x, y, cellW, cellH, wrap}
   *   `items` may be strings or {label, disabled, note, color}
   */
  constructor(o = {}) {
    this.items = o.items ?? [];
    this.columns = o.columns ?? 1;
    this.rows = o.rows ?? this.items.length;
    this.index = 0;
    this.scroll = 0;
    this.x = o.x ?? 8; this.y = o.y ?? 8;
    this.cellW = o.cellW ?? 96;
    this.cellH = o.cellH ?? 12;
    this.wrap = o.wrap ?? true;
    this.blink = 0;
  }

  setItems(items, keepIndex = false) {
    this.items = items;
    if (!keepIndex) { this.index = 0; this.scroll = 0; }
    this.clamp();
  }

  get length() { return this.items.length; }
  get current() { return this.items[this.index]; }
  label(i) { const it = this.items[i]; return typeof it === 'string' ? it : it?.label ?? ''; }
  disabled(i = this.index) { const it = this.items[i]; return typeof it === 'object' && it?.disabled; }

  clamp() {
    if (!this.items.length) { this.index = 0; this.scroll = 0; return; }
    this.index = Math.max(0, Math.min(this.index, this.items.length - 1));
    const page = this.rows * this.columns;
    const row = Math.floor(this.index / this.columns);
    const firstRow = Math.floor(this.scroll / this.columns);
    if (row < firstRow) this.scroll = row * this.columns;
    if (row >= firstRow + this.rows) this.scroll = (row - this.rows + 1) * this.columns;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, this.items.length - page)));
  }

  move(dx, dy) {
    if (!this.items.length) return false;
    const n = this.items.length;
    let i = this.index;
    if (dx) {
      i += dx;
      if (this.columns === 1) { /* horizontal is a no-op in a single column */ i = this.index; }
    }
    if (dy) i += dy * this.columns;
    if (i < 0) i = this.wrap ? (n + (i % n)) % n : 0;
    if (i >= n) i = this.wrap ? i % n : n - 1;
    const changed = i !== this.index;
    this.index = i;
    this.clamp();
    return changed;
  }

  handle(input) {
    let moved = false;
    if (input.tap('up')) moved = this.move(0, -1) || moved;
    if (input.tap('down')) moved = this.move(0, 1) || moved;
    if (this.columns > 1) {
      if (input.tap('left')) moved = this.move(-1, 0) || moved;
      if (input.tap('right')) moved = this.move(1, 0) || moved;
    }
    return moved;
  }

  update(dt) { this.blink = (this.blink + dt) % 1; }

  draw(scr, opts = {}) {
    const page = this.rows * this.columns;
    const end = Math.min(this.items.length, this.scroll + page);
    for (let i = this.scroll; i < end; i++) {
      const k = i - this.scroll;
      const cx = this.x + (k % this.columns) * this.cellW;
      const cy = this.y + Math.floor(k / this.columns) * this.cellH;
      const it = this.items[i];
      const obj = typeof it === 'object' ? it : { label: it };
      let color = obj.color ?? PAL.text;
      if (obj.disabled) color = PAL.grey;
      if (i === this.index && !opts.inactive) {
        // a selection slab with a bright accent edge, rather than a caret that
        // disappears on the off phase of a blink
        const hh = (opts.size ?? 8) + 5;
        scr.rect(cx - 8, cy - 3, this.cellW - 4, hh, 'rgba(120,155,235,0.20)');
        scr.rect(cx - 8, cy - 3, 2, hh, PAL.accent);
        color = obj.disabled ? PAL.grey : (obj.color ?? PAL.white);
      }
      scr.text(obj.label ?? '', cx, cy, color, { size: opts.size ?? 8 });
      if (obj.note !== undefined) {
        scr.textRight(String(obj.note), cx + this.cellW - 10, cy, obj.noteColor ?? PAL.textDim, { size: opts.size ?? 8 });
      }
    }
    // scroll indicators, pinned to the right edge of the list
    const rx = this.x + this.cellW * this.columns - 8;
    if (this.scroll > 0) scr.text('▲', rx, this.y - 10, PAL.accentDim);
    if (end < this.items.length) scr.text('▼', rx, this.y + this.rows * this.cellH - 2, PAL.accentDim);
  }
}

/** A message box that reveals text a character at a time. */
export class Dialogue {
  constructor() {
    this.queue = [];
    this.text = '';
    this.shown = 0;
    this.speed = 46;   // characters per second
    this.done = true;
    this.speaker = null;
  }

  say(text, speaker = null) {
    this.queue.push({ text, speaker });
    if (this.done) this.next();
  }

  sayAll(lines, speaker = null) { for (const l of lines) this.say(l, speaker); }

  next() {
    const n = this.queue.shift();
    if (!n) { this.done = true; this.text = ''; this.speaker = null; return false; }
    this.text = n.text;
    this.speaker = n.speaker;
    this.shown = 0;
    this.done = false;
    return true;
  }

  get active() { return !this.done || this.queue.length > 0; }
  get revealed() { return this.shown >= this.text.length; }

  skipOrAdvance() {
    if (!this.revealed) { this.shown = this.text.length; return false; }
    return !this.next();       // true when the queue is now empty
  }

  update(dt) {
    if (!this.done && this.shown < this.text.length) {
      this.shown = Math.min(this.text.length, this.shown + this.speed * dt);
    }
  }

  draw(scr, opts = {}) {
    if (this.done && !this.queue.length) return;
    const h = opts.h ?? 56;
    const y = opts.y ?? (H - h - 10);
    const x = opts.x ?? 24;
    const w = opts.w ?? (W - 48);
    scr.panel(x, y, w, h, { accent: true, accentWidth: 24 });
    let ty = y + 9;
    if (this.speaker) {
      scr.text(this.speaker, x + 12, ty, PAL.accent);
      scr.rect(x + 12, ty + 10, scr.textWidth(this.speaker), 1, 'rgba(240,180,76,0.35)');
      ty += 15;
    }
    scr.textWrap(this.text.slice(0, Math.floor(this.shown)), x + 12, ty, w - 24, PAL.text,
      { maxLines: Math.floor((h - (ty - y) - 8) / 11), lineHeight: 11 });
    if (this.revealed) {
      const t = Math.floor(performance.now() / 350) % 2;
      scr.text('▼', x + w - 16, y + h - 13 + t, PAL.accent);
    }
  }
}

/** Small labelled value, used all over the status screens. */
export function stat(scr, label, value, x, y, opts = {}) {
  scr.text(label, x, y, opts.labelColor ?? PAL.textDim, { size: opts.size ?? 8 });
  scr.textRight(String(value), x + (opts.w ?? 64), y, opts.color ?? PAL.text, { size: opts.size ?? 8 });
}

export function hpColor(ratio) {
  if (ratio <= 0) return PAL.grey;
  if (ratio < 0.25) return PAL.red;
  if (ratio < 0.5) return PAL.gold;
  return PAL.green;
}

/** Header bar used at the top of full-screen menus. */
export function header(scr, title, right = null) {
  scr.rect(0, 0, W, 26, 'rgba(10,13,22,0.92)');
  scr.rect(0, 26, W, 1, PAL.line);
  scr.rect(0, 0, W, 1, 'rgba(180,205,255,0.18)');
  scr.rect(14, 8, 2, 10, PAL.accent);
  scr.text(title, 22, 9, PAL.text, { size: 8 });
  if (right) scr.textRight(right, W - 16, 9, PAL.textDim);
}

/** A key/value row with a dotted leader, for stat blocks. */
export function statRow(scr, label, value, x, y, w, opts = {}) {
  scr.text(label, x, y, opts.labelColor ?? PAL.textDim);
  const vw = scr.textWidth(String(value));
  const lw = scr.textWidth(label);
  for (let i = x + lw + 3; i < x + w - vw - 3; i += 3) scr.px(i, y + 5, 'rgba(148,162,192,0.28)');
  scr.textRight(String(value), x + w, y, opts.color ?? PAL.text);
}
