// ============================================================================
//  SHOP — buy and sell, with a live "what would this do for whom" panel so you
//  can see which party member the item is actually an upgrade for.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu, header } from '../../engine/ui.js';
import { SHOPS } from '../../data/maps.js';
import { getItem, canEquip, isEquippable } from '../../data/items.js';
import { CLASSES } from '../../data/classes.js';
import { stats } from '../character.js';

export class ShopScene {
  constructor(app) { this.app = app; }

  enter(opts) {
    this.g = this.app.game;
    this.shop = SHOPS[opts.shopId];
    this.title = opts.name ?? this.shop?.name ?? 'Shop';
    this.mode = 'root';
    this.msg = null; this.msgT = 0; this.t = 0;
    this.root = new Menu({ items: ['Buy', 'Sell', 'Leave'], x: 24, y: 34, cellW: 60, cellH: 13, rows: 3 });
    this.list = new Menu({ items: [], x: 24, y: 46, cellW: 130, cellH: 11, rows: 10 });
    this.qty = 1;
  }

  say(m) { this.msg = m; this.msgT = 2.2; }

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
      return { label: it.name, note: `${this.g.sellPrice(s.id)}G x${s.count}`, id: s.id, item: it };
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
    scr.clear('#0d1020');
    for (let y = 0; y < H; y += 4) scr.rect(0, y, W, 1, '#0f1224');
    header(scr, this.title.toUpperCase(), `${this.g.gold}G`);

    if (this.mode === 'root') {
      scr.window(12, 26, 100, 60);
      this.root.draw(scr);
      scr.window(120, 26, W - 132, 60);
      scr.textWrap('A Merchant in the party buys cheaper and sells dearer as their rank climbs.',
        126, 32, W - 144, PAL.textDim, { lineHeight: 9 });
    } else {
      scr.window(6, 26, 148, H - 56);
      scr.text(this.mode === 'buy' ? 'BUY' : 'SELL', 14, 30, PAL.gold);
      this.list.x = 24; this.list.y = 44; this.list.cellW = 124; this.list.rows = 12;
      this.list.draw(scr);
      this.drawDetail(scr);
    }

    scr.window(6, H - 26, W - 12, 22);
    scr.text(this.msg ?? 'Z confirm · X back', 14, H - 20, this.msg ? PAL.gold : PAL.textDim);
  }

  drawDetail(scr) {
    const cur = this.list.current;
    scr.window(158, 26, W - 164, H - 56);
    if (!cur?.item) return;
    const it = cur.item;
    let y = 32;
    scr.text(it.name, 164, y, PAL.gold); y += 12;
    const kind = it.kind === 'weapon' ? `${it.wtype} · reach ${it.reach}`
      : it.kind === 'armor' ? `${it.aclass} armour` : it.kind;
    scr.text(kind, 164, y, PAL.cyan); y += 11;
    if (it.atk) { scr.text(`ATK ${it.atk}`, 164, y, PAL.text); y += 9; }
    if (it.def) { scr.text(`DEF ${it.def}`, 164, y, PAL.text); y += 9; }
    if (it.element && it.element !== 'none') { scr.text(`Element ${it.element}`, 164, y, PAL.magenta); y += 9; }
    if (it.bonus) {
      y += scr.textWrap(Object.entries(it.bonus).map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`).join(' '),
        164, y, W - 176, PAL.green, { lineHeight: 9 }) * 9;
    }
    if (it.heal) { scr.text(`Heals ${it.heal}`, 164, y, PAL.green); y += 9; }
    if (it.healMp) { scr.text(`Restores ${it.healMp} MP`, 164, y, PAL.cyan); y += 9; }
    y += 4;

    if (isEquippable(it)) {
      scr.text('FOR WHOM', 164, y, PAL.gold); y += 10;
      for (const ch of this.g.party) {
        const cls = CLASSES[ch.classId];
        const ok = canEquip(cls, it);
        let note = ok ? '' : 'no';
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
            note = d === 0 ? '=' : d > 0 ? `+${d}` : `${d}`;
          }
        }
        scr.text(ch.name.slice(0, 7), 164, y, ok ? PAL.text : PAL.grey);
        scr.textRight(note, W - 12, y, !ok ? PAL.grey : note.startsWith('+') ? PAL.green : note === '=' ? PAL.textDim : PAL.red);
        y += 10;
      }
    }
  }
}
