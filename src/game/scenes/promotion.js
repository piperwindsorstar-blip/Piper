// ============================================================================
//  PROMOTION — the class ladder's payoff screen.
//
//  Linear promotions (levels 5 and 15) are a confirmation. Every other one —
//  10, 20, 40, 60 and 80 — is a real fork: two successors shown side by side
//  with their growth deltas, the schools each grants and loses, and where each
//  goes on to lead, because the choice you make here decides which pair is on
//  offer at the next branch.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu, header } from '../../engine/ui.js';
import { actorSprite } from '../../engine/sprites.js';
import { Particles } from '../../engine/particles.js';
import { refreshPromotion, promote, stats } from '../character.js';
import { CLASSES, TIER_NAME, PROMOTION_BONUS } from '../../data/classes.js';
import { SCHOOLS } from '../../data/skills.js';
import { ELEMENT_BY_ID } from '../../data/elements.js';
import { RACE_BY_ID } from '../../data/races.js';

const HEAD_Y = 30, HEAD_H = 42;
const BOX_Y = 78, BOX_H = H - BOX_Y - 18;

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
    this.fxp = new Particles(200);
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
    this.fxp.update(dt);
    if (!this.ch) { this.app.pop(); return; }
    this.choice?.update(dt);

    if (this.result) {
      this.resultT += dt;
      if (this.resultT < 0.9 && Math.random() < 0.5) {
        this.fxp.rise(W / 2 + (Math.random() - 0.5) * 60, 150,
          ELEMENT_BY_ID[this.ch.elementId].color, 2, 20);
      }
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
      this.fxp.burst(W / 2, 150, ELEMENT_BY_ID[this.ch.elementId].color, 26, 90);
    }
  }

  draw(scr) {
    const ch = this.ch;
    if (!ch) return;
    const el = ELEMENT_BY_ID[ch.elementId];
    scr.setGrade(el.color, 0.12);
    scr.bloom = 0.5;
    scr.vignette = 0.6;
    scr.clear('#070912');
    for (let y = 0; y < H; y += 3) scr.rect(0, y, W, 1, 'rgba(255,255,255,0.012)');
    scr.light(W / 2, 120, 210, el.color, 0.14);

    if (this.result) return this.drawResult(scr);

    const branching = this.promo.branching;
    header(scr, branching ? 'A CHOICE OF PATHS' : 'PROMOTION',
      `${this.index + 1} OF ${this.queue.length}`);
    this.drawHead(scr, ch, el);

    const opts = this.promo.choices;
    const colW = branching ? (W - 44) / 2 : W - 32;
    opts.forEach((opt, i) => {
      const x = 16 + i * (colW + 12);
      const sel = this.choice.index === i;
      scr.panel(x, BOX_Y, colW, BOX_H, sel
        ? { accent: true, accentWidth: 34, top: 'rgba(46,58,92,0.94)', border: 'rgba(240,180,76,0.55)' }
        : { alpha: 0.86 });
      this.drawOption(scr, ch, opt, x + 14, BOX_Y + 10, colW - 28, sel);
    });

    // The tier-7 bonus line is long enough to run into the control hint, so the
    // hint sheds its optional first clause before the two collide.
    const bonus = PROMOTION_BONUS[this.promo.tier];
    const paid = `+${bonus.hp} HP   +${bonus.mp} MP   +${bonus.str} to every stat`;
    scr.text(paid, 16, H - 13, PAL.green);
    const full = branching ? 'Arrows choose   ·   Z accept   ·   X decide later'
      : 'Z accept   ·   X decide later';
    const short = 'Z accept   ·   X decide later';
    const room = W - 16 - (16 + scr.textWidth(paid) + 12);
    const hint = scr.textWidth(full) <= room ? full : short;
    if (scr.textWidth(hint) <= room) scr.textRight(hint, W - 16, H - 13, PAL.textFaint);
  }

  drawHead(scr, ch, el) {
    const cls = CLASSES[ch.classId];
    scr.panel(16, HEAD_Y, W - 32, HEAD_H, { accent: true, accentWidth: 30 });
    const cv = actorSprite({
      classId: ch.classId, raceId: ch.raceId, elementId: ch.elementId,
      skin: ch.skin, hair: ch.hair, equip: ch.equip, frame: Math.floor(this.t * 3) % 2,
    });
    scr.light(46, HEAD_Y + 26, 34, el.color, 0.18);
    scr.ctx.drawImage(cv, 26, HEAD_Y - 4);
    scr.text(ch.name, 70, HEAD_Y + 8, PAL.accent);
    // the element swatch follows the class name rather than sitting at a fixed
    // x, because "Draconian Dawnedge" is a lot longer than "Elf Mage"
    const line = `Lv ${ch.level}   ${RACE_BY_ID[ch.raceId ?? 'human'].name} ${cls.name}`;
    scr.text(line, 70, HEAD_Y + 22, PAL.text);
    const ex = 70 + scr.textWidth(line) + 14;
    scr.rect(ex, HEAD_Y + 23, 4, 6, el.color);
    scr.text(el.name, ex + 8, HEAD_Y + 22, el.color);

    scr.textRight(`${TIER_NAME[cls.tier]}  →  ${TIER_NAME[this.promo.tier]}`,
      W - 26, HEAD_Y + 8, PAL.magenta);
    scr.textRight(`at level ${this.promo.level}`, W - 26, HEAD_Y + 22, PAL.textFaint);
  }

  drawOption(scr, ch, opt, x, y, w, sel) {
    scr.text(opt.name, x, y, sel ? PAL.white : PAL.text);
    y += 12;
    scr.rect(x, y, w, 1, sel ? 'rgba(240,180,76,0.40)' : PAL.line);
    y += 6;
    y += scr.textWrap(opt.blurb, x, y, w, PAL.textDim, { lineHeight: 10, maxLines: 3 }) * 10 + 4;

    // Growth against the class held now: the bar is the new value, the pale
    // tick is where it sits today, and the number is the difference.
    const cur = CLASSES[ch.classId];
    const keys = ['hp', 'mp', 'str', 'vit', 'agi', 'int', 'spr', 'lck'];
    const maxG = Math.max(...keys.map((k) => Math.max(opt.growth[k], cur.growth[k])));
    const barX = x + 28, barW = w - 74;
    for (const k of keys) {
      const now = cur.growth[k], nxt = opt.growth[k];
      const d = Math.round((nxt - now) * 10) / 10;
      scr.text(k.toUpperCase(), x, y, PAL.textDim);
      scr.bar(barX, y, barW, 5, nxt / maxG, d >= 0 ? PAL.cyan : PAL.grey);
      scr.rect(barX + Math.round(barW * (now / maxG)), y - 1, 1, 7, 'rgba(255,255,255,0.6)');
      scr.textRight(d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1), x + w, y,
        d > 0 ? PAL.green : d < 0 ? PAL.red : PAL.textFaint);
      y += 8;
    }
    y += 4;

    const gained = opt.schools.filter((s) => !cur.schools.includes(s));
    const lost = cur.schools.filter((s) => !opt.schools.includes(s));
    scr.text('+', x, y, PAL.green);
    scr.textWrap(gained.length ? gained.map((s) => SCHOOLS[s].name).join(', ') : 'nothing new',
      x + 10, y, w - 10, gained.length ? PAL.green : PAL.textFaint,
      { lineHeight: 10, maxLines: 1 });
    y += 11;
    if (lost.length) {
      scr.text('−', x, y, PAL.red);
      scr.textWrap(lost.map((s) => SCHOOLS[s].name).join(', '), x + 10, y, w - 10, PAL.red,
        { lineHeight: 10, maxLines: 1 });
      y += 11;
    }
    y += 2;

    scr.rect(x, y, w, 1, PAL.line); y += 6;
    if (opt.promotions.length) {
      const next = opt.promotions.map((p) => CLASSES[p]);
      scr.text(`AT LEVEL ${opt.promoteLevel}`, x, y, PAL.accent); y += 11;
      scr.textWrap(next.map((n) => n.name).join('   /   '), x, y, w, PAL.cyan,
        { lineHeight: 10, maxLines: 2 });
    } else {
      scr.textWrap('THE SUMMIT — the ladder ends here.', x, y, w, PAL.magenta,
        { lineHeight: 10, maxLines: 2 });
    }
  }

  drawResult(scr) {
    const ch = this.ch;
    const { before, after, to } = this.result;
    const el = ELEMENT_BY_ID[ch.elementId];
    header(scr, 'PROMOTED');

    scr.panel(16, HEAD_Y, W - 32, H - HEAD_Y - 34, { accent: true, accentWidth: 34 });

    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(this.resultT * 3.4));
    scr.light(W / 2, 132, 66, el.color, 0.28 * pulse);
    const cv = actorSprite({
      classId: ch.classId, raceId: ch.raceId, elementId: ch.elementId,
      skin: ch.skin, hair: ch.hair, equip: ch.equip, frame: 0,
    });
    scr.ctx.drawImage(cv, W / 2 - cv.width, 96, cv.width * 2, cv.height * 2);
    this.fxp.draw(scr);

    const line = `${ch.name} is now a ${to.name}`;
    const lw = scr.textWidth(line, 12);
    scr.textGlow(line, Math.round(W / 2 - lw / 2), 190, PAL.accent, el.color, { size: 12 });
    scr.textCenter(`${TIER_NAME[to.tier]} tier   ·   level ${ch.level}`, W / 2, 208, PAL.magenta);

    // the stat jump, in two columns down the sides of the sprite
    const keys = ['hp', 'mp', 'str', 'vit', 'agi', 'int', 'spr', 'lck'];
    keys.forEach((k, i) => {
      const left = i % 2 === 0;
      const x = left ? 40 : W - 176;
      const yy = 54 + Math.floor(i / 2) * 16;
      const b = k === 'hp' ? before.maxHp : k === 'mp' ? before.maxMp : before[k];
      const a = k === 'hp' ? after.maxHp : k === 'mp' ? after.maxMp : after[k];
      scr.text(k.toUpperCase(), x, yy, PAL.textDim);
      scr.text(String(b), x + 34, yy, PAL.textFaint);
      scr.text('→', x + 74, yy, PAL.textFaint);
      scr.text(String(a), x + 90, yy, PAL.green);
      if (a > b) scr.text(`+${a - b}`, x + 126, yy, PAL.green);
    });

    scr.rect(40, 226, W - 80, 1, PAL.line);
    scr.textWrap(to.blurb, 40, 232, W - 80, PAL.textDim, { lineHeight: 11, maxLines: 1 });
    if (this.resultT > 0.5) scr.textRight('Z', W - 30, 232, PAL.accent);
  }
}
