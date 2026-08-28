// ============================================================================
//  PROMOTION — the class ladder's payoff screen.
//
//  Linear promotions (levels 5 and 15) are a confirmation. Branch promotions
//  (levels 10 and 20) are a real fork: two successors are shown side by side
//  with their growth deltas, the schools each grants, and what each of them
//  goes on to become, because the choice at level 10 determines which pair of
//  masteries is available at level 20.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu, header } from '../../engine/ui.js';
import { heroSprite } from '../../engine/sprites.js';
import { refreshPromotion, promote, stats } from '../character.js';
import { CLASSES, STAT_KEYS, TIER_NAME, PROMOTION_BONUS } from '../../data/classes.js';
import { SCHOOLS } from '../../data/skills.js';
import { ELEMENT_BY_ID } from '../../data/elements.js';

export class PromotionScene {
  constructor(app) { this.app = app; }

  enter(opts = {}) {
    this.g = this.app.game;
    this.auto = !!opts.auto;
    this.t = 0;
    this.queue = this.g.party.filter((c) => refreshPromotion(c));
    this.index = 0;
    this.result = null;
    this.resultT = 0;
    this.setup();
  }

  setup() {
    const ch = this.queue[this.index];
    if (!ch) return;
    this.promo = refreshPromotion(ch);
    this.choice = new Menu({
      items: this.promo.choices.map((c) => ({ label: c.name, id: c.id })),
      x: 0, y: 0, cellW: 100, cellH: 12, rows: this.promo.choices.length,
    });
  }

  get ch() { return this.queue[this.index]; }

  update(dt, input) {
    this.t += dt;
    this.g.playtime += dt;
    if (!this.ch) { this.app.pop(); return; }
    this.choice?.update(dt);

    if (this.result) {
      this.resultT += dt;
      if (this.resultT > 0.5 && (input.tap('confirm') || input.tap('cancel'))) {
        this.result = null;
        this.resultT = 0;
        this.index++;
        if (this.index >= this.queue.length) { this.app.pop(); return; }
        this.setup();
      }
      return;
    }

    this.choice.handle(input);
    if (input.tap('cancel')) {
      // a promotion can always be deferred; the temple keeps the offer open
      this.index++;
      if (this.index >= this.queue.length) { this.app.pop(); return; }
      this.setup();
      return;
    }
    if (input.tap('confirm')) {
      const before = stats(this.ch);
      const r = promote(this.ch, this.choice.current.id);
      this.result = { ...r, before, after: stats(this.ch) };
      this.resultT = 0;
    }
  }

  draw(scr) {
    scr.clear('#0a0c1a');
    for (let y = 0; y < H; y += 4) scr.rect(0, y, W, 1, '#0c0f20');
    const ch = this.ch;
    if (!ch) return;

    if (this.result) return this.drawResult(scr);

    const branching = this.promo.branching;
    header(scr, branching ? 'A CHOICE OF PATHS' : 'PROMOTION',
      `${this.index + 1}/${this.queue.length}`);

    const cls = CLASSES[ch.classId];
    const el = ELEMENT_BY_ID[ch.elementId];
    scr.window(6, 24, W - 12, 32);
    const cv = heroSprite({ classId: ch.classId, elementId: ch.elementId, skin: ch.skin, hair: ch.hair, frame: Math.floor(this.t * 3) % 2 });
    scr.ctx.drawImage(cv, 10, 25);
    scr.text(ch.name, 40, 28, PAL.gold);
    scr.text(`Lv${ch.level} ${cls.name}`, 40, 39, PAL.text);
    scr.rect(112, 40, 4, 5, el.color);
    scr.text(el.name, 119, 39, el.color);
    scr.textRight(`${TIER_NAME[cls.tier]} → ${TIER_NAME[this.promo.tier]}`, W - 12, 28, PAL.magenta);
    scr.textRight(`+${PROMOTION_BONUS[this.promo.tier].hp} HP`, W - 12, 39, PAL.green);

    const opts = this.promo.choices;
    const colW = branching ? (W - 18) / 2 : W - 12;
    const boxY = 60, boxH = 142;
    opts.forEach((opt, i) => {
      const x = 6 + i * (colW + 6);
      const sel = this.choice.index === i;
      scr.window(x, boxY, colW, boxH, sel ? { top: '#2a3f96', bottom: '#12204e' } : {});
      if (sel) scr.outline(x, boxY, colW, boxH, PAL.gold);
      this.drawOption(scr, ch, opt, x + 6, boxY + 6, colW - 12, sel);
    });

    scr.window(6, 204, W - 12, 16);
    scr.textCenter(branching ? 'Arrows choose · Z accept · X later'
      : 'Z accept · X later', W / 2, 208, PAL.textDim);
  }

  drawOption(scr, ch, opt, x, y, w, sel) {
    scr.text(opt.name, x, y, sel ? PAL.white : PAL.text);
    y += 11;
    y += scr.textWrap(opt.blurb, x, y, w, PAL.textDim, { lineHeight: 9, maxLines: 3 }) * 9 + 3;

    // Growth deltas against the class they hold now, in two columns of four.
    // The number is the information; a bar next to it would only cost height.
    const cur = CLASSES[ch.classId];
    const keys = ['hp', 'mp', 'str', 'vit', 'agi', 'int', 'spr', 'lck'];
    scr.text('GROWTH / LEVEL', x, y, PAL.gold); y += 10;
    const half = Math.floor(w / 2);
    keys.forEach((k, i) => {
      const cx = x + (i % 2) * half;
      const cy = y + Math.floor(i / 2) * 10;
      const d = Math.round((opt.growth[k] - cur.growth[k]) * 10) / 10;
      scr.text(k.toUpperCase(), cx, cy, PAL.textDim);
      scr.textRight(d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1), cx + half - 6, cy,
        d > 0 ? PAL.green : d < 0 ? PAL.red : PAL.textDim);
    });
    y += 43;

    // schools gained and lost
    const gained = opt.schools.filter((s) => !cur.schools.includes(s));
    const lost = cur.schools.filter((s) => !opt.schools.includes(s));
    scr.text('+', x, y, PAL.green);
    y += scr.textWrap(gained.length ? gained.map((s) => SCHOOLS[s].name).join(', ') : 'nothing new',
      x + 8, y, w - 8, gained.length ? PAL.green : PAL.textDim, { lineHeight: 9, maxLines: 1 }) * 9;
    if (lost.length) {
      scr.text('-', x, y, PAL.red);
      y += scr.textWrap(lost.map((s) => SCHOOLS[s].name).join(', '), x + 8, y, w - 8, PAL.red,
        { lineHeight: 9, maxLines: 1 }) * 9;
    }
    y += 3;

    // where this branch leads
    if (opt.promotions.length) {
      const next = opt.promotions.map((p) => CLASSES[p]);
      const names = next.length > 1
        ? next.map((n) => n.name).join(' / ')
        : `${next[0].name} → ${next[0].promotions.map((p) => CLASSES[p].name).join(' / ')}`;
      scr.textWrap(names, x, y, w, PAL.cyan, { lineHeight: 9, maxLines: 3 });
    } else {
      scr.textWrap('A MASTERY — the ladder ends here.', x, y, w, PAL.magenta,
        { lineHeight: 9, maxLines: 2 });
    }
  }

  drawResult(scr) {
    const ch = this.ch;
    header(scr, 'PROMOTED');
    const { before, after, to } = this.result;
    scr.window(6, 30, W - 12, 150);
    const cv = heroSprite({ classId: ch.classId, elementId: ch.elementId, skin: ch.skin, hair: ch.hair, frame: 0 });
    // a flare behind the new sprite
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(this.resultT * 4));
    scr.ctx.globalAlpha = pulse * 0.5;
    scr.rect(W / 2 - 20, 38, 40, 40, ELEMENT_BY_ID[ch.elementId].color);
    scr.ctx.globalAlpha = 1;
    scr.ctx.drawImage(cv, W / 2 - cv.width / 2, 40);

    scr.textCenter(`${ch.name} is now a ${to.name}!`, W / 2, 82, PAL.gold);
    scr.textCenter(`${TIER_NAME[to.tier]} tier`, W / 2, 94, PAL.magenta);

    let y = 110;
    const keys = ['hp', 'mp', 'str', 'vit', 'agi', 'int', 'spr', 'lck'];
    keys.forEach((k, i) => {
      const x = 24 + (i % 2) * 108;
      const yy = y + Math.floor(i / 2) * 12;
      const b = k === 'hp' ? before.maxHp : k === 'mp' ? before.maxMp : before[k];
      const a = k === 'hp' ? after.maxHp : k === 'mp' ? after.maxMp : after[k];
      scr.text(k.toUpperCase(), x, yy, PAL.textDim);
      scr.text(`${b}`, x + 26, yy, PAL.textDim);
      scr.text('→', x + 52, yy, PAL.textDim);
      scr.text(`${a}`, x + 64, yy, PAL.green);
      if (a > b) scr.text(`+${a - b}`, x + 86, yy, PAL.green, { size: 8 });
    });

    scr.window(6, 184, W - 12, 34);
    scr.textWrap(to.blurb, 14, 190, W - 28, PAL.text, { lineHeight: 9, maxLines: 2 });
    if (this.resultT > 0.5) scr.textRight('Z', W - 14, 206, PAL.gold);
  }
}
