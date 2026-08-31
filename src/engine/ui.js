// ============================================================================
//  UI — cursor lists, dialogue boxes and the small widgets every scene reuses.
// ============================================================================

import { PAL, W, H, drawFit } from './screen.js';
import { iconSprite } from './icons.js';
import { sfx } from './audio.js';
import { actorPortraitSprite, npcPortraitSprite } from './sprites.js';

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
    if (moved) sfx.move();
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

/**
 * A cross-shaped command picker — a fixed handful of icon tiles arranged on a
 * small grid (typically a plus with one corner filled) rather than a scrolling
 * list. Navigation moves to the nearest item sharing the current row or
 * column, which is what makes an irregular layout (not every grid cell holds
 * an item) still feel like a d-pad cross instead of a maze.
 */
export class CommandWheel {
  /** @param {object} o {x, y, cell} top-left and the size of one square tile */
  constructor(o = {}) {
    this.x = o.x ?? 0; this.y = o.y ?? 0;
    this.cell = o.cell ?? 34;
    this.items = [];
    this.index = 0;
  }

  /**
   * `items`: [{id, label, icon, pos: [col, row], disabled}]
   * `defaultId` picks the opening selection by id (the centre command, in
   * practice) rather than by array order, which is otherwise whatever order
   * the caller happened to list the commands in.
   */
  setItems(items, { keepIndex = false, defaultId } = {}) {
    this.items = items;
    if (!keepIndex) {
      let start = defaultId ? items.findIndex((it) => it.id === defaultId && !it.disabled) : -1;
      if (start < 0) start = items.findIndex((it) => !it.disabled);
      this.index = start < 0 ? 0 : start;
    }
  }

  get length() { return this.items.length; }
  get current() { return this.items[this.index]; }
  disabled(i = this.index) { return !!this.items[i]?.disabled; }

  update() {}

  /** Move to whichever item shares this row (dx) or column (dy) and is nearest. */
  move(dx, dy) {
    const cur = this.items[this.index];
    if (!cur) return false;
    const [cx, cy] = cur.pos;
    let best = -1, bestDist = Infinity;
    this.items.forEach((it, i) => {
      if (i === this.index) return;
      const [x, y] = it.pos;
      if (dx && y === cy && Math.sign(x - cx) === Math.sign(dx)) {
        const d = Math.abs(x - cx);
        if (d < bestDist) { bestDist = d; best = i; }
      } else if (dy && x === cx && Math.sign(y - cy) === Math.sign(dy)) {
        const d = Math.abs(y - cy);
        if (d < bestDist) { bestDist = d; best = i; }
      }
    });
    if (best < 0) return false;
    this.index = best;
    return true;
  }

  handle(input) {
    let moved = false;
    if (input.tap('up')) moved = this.move(0, -1) || moved;
    if (input.tap('down')) moved = this.move(0, 1) || moved;
    if (input.tap('left')) moved = this.move(-1, 0) || moved;
    if (input.tap('right')) moved = this.move(1, 0) || moved;
    if (moved) sfx.move();
    return moved;
  }

  /**
   * Icons only — a tile this small cannot hold an icon and a legible label
   * both, and text that overflows one tile bleeds into its neighbour. The
   * selected command's name belongs to whatever draws the wheel (see its
   * header line in battle.js), not to the wheel itself.
   */
  draw(scr, opts = {}) {
    const { cell } = this;
    for (const it of this.items) {
      const [col, row] = it.pos;
      const x = this.x + col * cell, y = this.y + row * cell;
      const sel = it === this.current && !opts.inactive;
      const disabled = !!it.disabled;
      const size = cell - 4;
      scr.panel(x, y, size, size, sel
        ? { accent: true, accentWidth: size, border: 'rgba(240,180,76,0.65)', top: 'rgba(46,58,92,0.94)' }
        : { alpha: disabled ? 0.4 : 0.86 });
      const icon = iconSprite(it.icon ?? 'sword');
      const s = Math.max(0.4, (size - 4) / icon.width);
      const iw = icon.width * s, ih = icon.height * s;
      scr.ctx.save();
      scr.ctx.globalAlpha = disabled ? 0.4 : 1;
      scr.ctx.drawImage(icon, x + (size - iw) / 2, y + (size - ih) / 2, iw, ih);
      scr.ctx.restore();
    }
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
    this.portrait = null;
  }

  /**
   * `portrait`, when given, is either `{npcKind, variant}` (a townsfolk bust)
   * or a party member's own `{classId, raceId, elementId, skin, hair}` — the
   * same descriptor every other bust in the game already takes.
   */
  say(text, speaker = null, portrait = null) {
    this.queue.push({ text, speaker, portrait });
    if (this.done) this.next();
  }

  next() {
    const n = this.queue.shift();
    if (!n) { this.done = true; this.text = ''; this.speaker = null; this.portrait = null; return false; }
    this.text = n.text;
    this.speaker = n.speaker;
    this.portrait = n.portrait ?? null;
    this.shown = 0;
    this.done = false;
    return true;
  }

  get active() { return !this.done || this.queue.length > 0; }
  get revealed() { return this.shown >= this.text.length; }

  skipOrAdvance() {
    if (!this.revealed) { this.shown = this.text.length; return false; }
    sfx.confirm();
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

    let tx = x + 12, textW = w - 24;
    if (this.portrait) {
      const boxW = 40, boxH = h - 10;
      const bust = this.portrait.npcKind
        ? npcPortraitSprite(this.portrait.npcKind, this.portrait.variant ?? 0)
        : actorPortraitSprite(this.portrait);
      drawFit(scr, x + 8, y + 5, boxW, boxH, bust);
      tx = x + 8 + boxW + 10;
      textW = w - (tx - x) - 12;
    }

    let ty = y + 9;
    if (this.speaker) {
      scr.text(this.speaker, tx, ty, PAL.accent);
      scr.rect(tx, ty + 10, scr.textWidth(this.speaker), 1, 'rgba(240,180,76,0.35)');
      ty += 15;
    }
    scr.textWrap(this.text.slice(0, Math.floor(this.shown)), tx, ty, textW, PAL.text,
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
