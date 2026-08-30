// ============================================================================
//  SHOP — buy and sell, with a live "what would this do for whom" panel so you
//  can see which party member the item is actually an upgrade for.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu, header, statRow } from '../../engine/ui.js';
import { SHOPS } from '../../data/maps.js';
import { getItem, canEquip, isEquippable } from '../../data/items.js';
import { CLASSES } from '../../data/classes.js';
import { RACE_BY_ID } from '../../data/races.js';
import { actorSprite } from '../../engine/sprites.js';
import { stats } from '../character.js';

const LX = 16, LW = 212;              // stock list
const DX = 240, DW = W - DX - 16;     // detail panel
const TOP = 36, BODY_H = H - TOP - 44;

export class ShopScene {
  constructor(app) { this.app = app; }

  enter(opts) {
    this.g = this.app.game;
    this.shop = SHOPS[opts.shopId];
    this.title = opts.name ?? this.shop?.name ?? 'Shop';
    this.mode = 'root';
    this.msg = null; this.msgT = 0; this.t = 0;
    this.root = new Menu({ items: ['Buy', 'Sell', 'Leave'], x: LX + 24, y: TOP + 20, cellW: LW - 40, cellH: 18, rows: 3 });
    this.list = new Menu({ items: [], x: LX + 24, y: TOP + 20, cellW: LW - 40, cellH: 14, rows: 11 });
  }

  say(m) { this.msg = m; this.msgT = 2.4; }

  buildBuy() {
    this.list.setItems((this.shop?.stock ?? []).map((id) => {
      const it = getItem(id);
      const price = this.g.buyPrice(id);
      return { label: it.name, note: `${price}G`, id, price, item: it, disabled: price > this.g.gold };
    }));
  }

  buildSell() {
    this.list.setItems(this.g.inventory.map((s) => {
      const it = getItem(s.id);
      return { label: it.name, note: `${this.g.sellPrice(s.id)}G  x${s.count}`, id: s.id, item: it };
    }));
    if (!this.list.length) this.list.setItems([{ label: '— nothing to sell —', disabled: true }]);
  }

  update(dt, input) {
    this.t += dt;
    this.g.playtime += dt;
    this.root.update(dt); this.list.update(dt);
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg = null; }

    if (this.mode === 'root') {
      this.root.handle(input);
      if (input.tap('cancel')) { this.app.pop(); return; }
      if (input.tap('confirm')) {
        const pick = this.root.current;
        if (pick === 'Buy') { this.buildBuy(); this.mode = 'buy'; }
        else if (pick === 'Sell') { this.buildSell(); this.mode = 'sell'; }
        else this.app.pop();
      }
      return;
    }

    this.list.handle(input);
    if (input.tap('cancel')) { this.mode = 'root'; return; }
    if (input.tap('confirm') && !this.list.disabled() && this.list.current?.id) {
      const id = this.list.current.id;
      if (this.mode === 'buy') {
        const price = this.g.buyPrice(id);
        if (this.g.gold < price) { this.say('Not enough gold.'); return; }
        if (!this.g.addItem(id)) { this.say('The pack is full.'); return; }
        this.g.spend(price);
        this.say(`Bought ${getItem(id).name}.`);
        const m = this.g.party.find((c) => c.jobId === 'merchant');
        if (m) { const t = this.g.jobTick(m, 3); if (t) this.say(t); }
        this.buildBuy();
      } else {
        const price = this.g.sellPrice(id);
        this.g.removeItem(id);
        this.g.earn(price);
        this.say(`Sold for ${price}G.`);
        const m = this.g.party.find((c) => c.jobId === 'merchant');
        if (m) { const t = this.g.jobTick(m, 3); if (t) this.say(t); }
        this.buildSell();
      }
    }
  }

  draw(scr) {
    scr.setGrade('#ffbe78', 0.10);
    scr.bloom = 0.34;
    scr.vignette = 0.5;
    scr.clear('#0a0c16');
    for (let y = 0; y < H; y += 3) scr.rect(0, y, W, 1, 'rgba(255,255,255,0.012)');
    scr.light(W * 0.16, 0, 220, 'rgba(255,190,110,0.22)', 0.5);

    header(scr, this.title.toUpperCase(), `${this.g.gold} G`);

    if (this.mode === 'root') {
      scr.panel(LX, TOP, LW, 78, { accent: true });
      this.root.draw(scr);
      scr.panel(DX, TOP, DW, 78, { accent: true });
      scr.heading('TRADE', DX + 14, TOP + 10, DW - 28);
      scr.textWrap('A Merchant in the party buys cheaper and sells dearer as their rank climbs. A Provisioner cuts inn prices.',
        DX + 14, TOP + 28, DW - 28, PAL.textDim, { lineHeight: 11, maxLines: 4 });
    } else {
      scr.panel(LX, TOP, LW, BODY_H, { accent: true });
      scr.heading(this.mode === 'buy' ? 'BUY' : 'SELL', LX + 14, TOP + 10, LW - 28);
      this.list.y = TOP + 28;
      this.list.draw(scr);
      this.drawDetail(scr);
    }

    scr.panel(LX, H - 38, W - LX * 2, 26, this.msg ? { accent: true } : {});
    scr.text(this.msg ?? 'Z confirm   ·   X back', LX + 14, H - 30, this.msg ? PAL.accent : PAL.textFaint);
  }

  drawDetail(scr) {
    const cur = this.list.current;
    scr.panel(DX, TOP, DW, BODY_H, { accent: true });
    if (!cur?.item) return;
    const it = cur.item;
    let y = TOP + 10;
    scr.text(it.name, DX + 14, y, PAL.accent);
    scr.textRight(`${cur.price ?? this.g.sellPrice(it.id)} G`, DX + DW - 14, y, PAL.text);
    y += 12;
    scr.rect(DX + 14, y, DW - 28, 1, PAL.line); y += 8;

    const kind = it.kind === 'weapon' ? `${it.wtype}  ·  reach ${it.reach}`
      : it.kind === 'armor' ? `${it.aclass} armour` : it.kind;
    scr.text(kind, DX + 14, y, PAL.cyan); y += 14;

    const rowW = DW - 28;
    if (it.atk) { statRow(scr, 'Attack', it.atk, DX + 14, y, rowW); y += 12; }
    if (it.def) { statRow(scr, 'Defence', it.def, DX + 14, y, rowW); y += 12; }
    if (it.element && it.element !== 'none') { statRow(scr, 'Element', it.element, DX + 14, y, rowW, { color: PAL.magenta }); y += 12; }
    if (it.heal) { statRow(scr, 'Restores', `${it.heal} HP`, DX + 14, y, rowW, { color: PAL.green }); y += 12; }
    if (it.healMp) { statRow(scr, 'Restores', `${it.healMp} MP`, DX + 14, y, rowW, { color: PAL.cyan }); y += 12; }
    if (it.cures) { statRow(scr, 'Cures', it.cures.join(', '), DX + 14, y, rowW, { color: PAL.green }); y += 12; }
    if (it.bonus) {
      for (const [k, v] of Object.entries(it.bonus)) {
        statRow(scr, k.toUpperCase(), `${v > 0 ? '+' : ''}${v}`, DX + 14, y, rowW,
          { color: v > 0 ? PAL.green : PAL.red });
        y += 12;
      }
    }

    if (!isEquippable(it)) return;
    y += 6;
    scr.rect(DX + 14, y, DW - 28, 1, PAL.line); y += 8;
    scr.text('FOR WHOM', DX + 14, y, PAL.accent); y += 14;

    for (const ch of this.g.party) {
      const cls = CLASSES[ch.classId];
      const ok = canEquip(cls, it);
      let note = ok ? '' : '—';
      let col = PAL.grey;
      if (ok) {
        const slot = it.slot ?? (it.kind === 'weapon' ? 'weapon' : null);
        if (slot) {
          const before = stats(ch);
          const prev = ch.equip[slot];
          ch.equip[slot] = it.id;
          const after = stats(ch);
          ch.equip[slot] = prev;
          const key = slot === 'weapon' ? 'power' : 'armor';
          const d = after[key] - before[key];
          note = d === 0 ? 'no change' : d > 0 ? `+${d}` : `${d}`;
          col = d > 0 ? PAL.green : d === 0 ? PAL.textDim : PAL.red;
        }
      }
      const cv = actorSprite({
        classId: ch.classId, raceId: ch.raceId, elementId: ch.elementId,
        skin: ch.skin, hair: ch.hair, frame: 0,
      });
      scr.ctx.save();
      if (!ok) scr.ctx.globalAlpha = 0.35;
      scr.ctx.drawImage(cv, DX + 12, y - 16, Math.round(cv.width * 0.52), Math.round(cv.height * 0.52));
      scr.ctx.restore();
      scr.text(ch.name.slice(0, 9), DX + 36, y - 4, ok ? PAL.text : PAL.grey);
      scr.text(RACE_BY_ID[ch.raceId ?? 'human'].name, DX + 36, y + 6, PAL.textFaint);
      scr.textRight(note, DX + DW - 14, y, col);
      y += 26;
    }
  }
}
