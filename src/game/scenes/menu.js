// ============================================================================
//  PARTY MENU — status, arts, items, equipment, formation, jobs, class ladder,
//  and saving. The LADDER page is the one that matters most: it draws the whole
//  promotion tree for a character, marks the path they actually took, and shows
//  which of the two branch choices is still ahead of them.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu, header, hpColor, stat as statLine } from '../../engine/ui.js';
import { heroSprite } from '../../engine/sprites.js';
import {
  stats, knownSkills, upcomingSkills, jobInfo, jobProgress, equipItem, unequipSlot,
  promotionPath, refreshPromotion, expForLevel, MAX_LEVEL,
} from '../character.js';
import { CLASSES, STAT_KEYS, TIER_NAME, PROMOTION_LEVELS } from '../../data/classes.js';
import { ELEMENT_BY_ID } from '../../data/elements.js';
import { SCHOOLS, STATUS } from '../../data/skills.js';
import { getItem, SLOTS as EQUIP_SLOTS, canEquip } from '../../data/items.js';
import { MAX_JOB_RANK, RANK_TITLES } from '../../data/jobs.js';
import { formatTime } from '../state.js';
import { SLOTS, saveSummary } from '../../engine/save.js';

const PAGES = [
  { id: 'status', label: 'Status' },
  { id: 'arts', label: 'Arts' },
  { id: 'items', label: 'Items' },
  { id: 'equip', label: 'Equip' },
  { id: 'formation', label: 'Formation' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'ladder', label: 'Ladder' },
  { id: 'save', label: 'Save' },
  { id: 'close', label: 'Close' },
];

export class MenuScene {
  constructor(app) { this.app = app; }

  enter() {
    this.g = this.app.game;
    this.t = 0;
    this.mode = 'root';
    this.who = 0;
    this.msg = null;
    this.msgT = 0;
    this.root = new Menu({
      items: PAGES.map((p) => ({ label: p.label, id: p.id })),
      x: 16, y: 32, cellW: 70, cellH: 13, rows: PAGES.length,
    });
    this.list = new Menu({ items: [], x: 100, y: 34, cellW: 148, cellH: 11, rows: 14 });
    this.equipSlot = 0;
    this.formCursor = { row: 1, col: 0 };
    this.formPicked = null;
  }

  say(m) { this.msg = m; this.msgT = 2.4; }

  update(dt, input) {
    this.t += dt;
    this.g.playtime += dt;
    this.root.update(dt); this.list.update(dt);
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg = null; }

    if (this.mode === 'root') {
      this.root.handle(input);
      if (input.tap('cancel') || input.tap('menu')) { this.app.pop(); return; }
      if (input.tap('confirm')) this.openPage(this.root.current.id);
      return;
    }
    if (input.tap('cancel')) {
      if (this.mode === 'equipList') { this.mode = 'equip'; return; }
      if (this.mode === 'itemTarget') { this.mode = 'items'; return; }
      this.mode = 'root';
      return;
    }
    switch (this.mode) {
      case 'status': case 'jobs': case 'ladder': return this.cycleChar(input);
      case 'arts': return this.updateArts(input);
      case 'items': return this.updateItems(input);
      case 'itemTarget': return this.updateItemTarget(input);
      case 'equip': return this.updateEquip(input);
      case 'equipList': return this.updateEquipList(input);
      case 'formation': return this.updateFormation(input);
      case 'save': return this.updateSave(input);
      default: break;
    }
  }

  openPage(id) {
    if (id === 'close') { this.app.pop(); return; }
    this.mode = id;
    if (id === 'arts') this.refreshArts();
    if (id === 'items') this.refreshItems();
    if (id === 'save') {
      this.list.setItems(SLOTS.map((s) => {
        const sum = saveSummary(s);
        return { label: `Slot ${s}`, id: s, note: sum ? `${sum.leader} Lv${sum.level} ${formatTime(sum.playtime)}` : 'empty' };
      }));
    }
    if (id === 'formation') {
      const c = this.g.party[0];
      this.formCursor = { ...c.grid };
      this.formPicked = null;
    }
  }

  get ch() { return this.g.party[this.who]; }

  cycleChar(input) {
    if (input.tap('left')) this.who = (this.who + this.g.party.length - 1) % this.g.party.length;
    if (input.tap('right')) this.who = (this.who + 1) % this.g.party.length;
    if (input.tap('up')) this.who = (this.who + this.g.party.length - 1) % this.g.party.length;
    if (input.tap('down')) this.who = (this.who + 1) % this.g.party.length;
  }

  // --- arts ----------------------------------------------------------------
  refreshArts() {
    const ch = this.ch;
    const known = knownSkills(ch);
    const soon = upcomingSkills(ch, 8);
    this.list.setItems([
      ...known.map((k) => ({
        label: k.name, note: k.ip ? `${k.ip}IP` : `${k.mp}MP`, skill: k,
      })),
      ...soon.map((k) => ({
        label: `${k.name}`, note: `Lv${k.lv}`, skill: k, disabled: true,
      })),
    ]);
  }

  updateArts(input) {
    this.list.handle(input);
    if (input.tap('shift')) { this.who = (this.who + 1) % this.g.party.length; this.refreshArts(); }
  }

  // --- items ---------------------------------------------------------------
  refreshItems() {
    this.list.setItems(this.g.inventory.map((s) => {
      const it = getItem(s.id);
      return { label: it.name, note: `x${s.count}`, id: s.id, item: it };
    }), true);
    if (!this.list.length) this.list.setItems([{ label: '— nothing —', disabled: true }]);
  }

  updateItems(input) {
    this.list.handle(input);
    if (input.tap('confirm') && this.list.current?.item) {
      const it = this.list.current.item;
      if (it.kind === 'consumable' && (it.heal || it.healMp || it.cures || it.revives)) {
        this.mode = 'itemTarget';
        this.who = 0;
      } else if (it.camp) {
        this.g.removeItem(it.id);
        this.g.restParty();
        this.say('The party makes camp. Everyone recovers.');
        this.refreshItems();
      } else {
        this.say('Not something to use here.');
      }
    }
  }

  updateItemTarget(input) {
    this.cycleChar(input);
    if (input.tap('confirm')) {
      const it = this.list.current.item;
      const ch = this.ch;
      const s = stats(ch);
      if (ch.hp <= 0 && !it.revives) { this.say(`${ch.name} is beyond a ${it.name}.`); return; }
      let used = false;
      if (it.revives && ch.hp <= 0) { ch.hp = Math.max(1, Math.floor(s.maxHp * 0.5)); ch.alive = true; used = true; }
      if (it.heal && ch.hp > 0) {
        const before = ch.hp;
        ch.hp = Math.min(s.maxHp, ch.hp + it.heal);
        if (ch.hp !== before) used = true;
      }
      if (it.healMp) { const b = ch.mp; ch.mp = Math.min(s.maxMp, ch.mp + it.healMp); if (ch.mp !== b) used = true; }
      if (it.cures) for (const c of it.cures) if (ch.statuses[c]) { delete ch.statuses[c]; used = true; }
      if (!used) { this.say('It would do nothing.'); return; }
      this.g.removeItem(it.id);
      this.say(`${ch.name} uses ${it.name}.`);
      const alch = this.g.party.find((c) => c.jobId === 'alchemist');
      if (alch) { const m = this.g.jobTick(alch, 2); if (m) this.say(m); }
      this.refreshItems();
      this.mode = 'items';
    }
  }

  // --- equipment -----------------------------------------------------------
  updateEquip(input) {
    this.cycleChar({ tap: (b) => (b === 'left' || b === 'right') && input.tap(b) });
    if (input.tap('up')) this.equipSlot = (this.equipSlot + EQUIP_SLOTS.length - 1) % EQUIP_SLOTS.length;
    if (input.tap('down')) this.equipSlot = (this.equipSlot + 1) % EQUIP_SLOTS.length;
    if (input.tap('shift')) {
      const slot = EQUIP_SLOTS[this.equipSlot];
      const removed = unequipSlot(this.ch, slot);
      if (removed) { this.g.addItem(removed); this.say(`Removed ${getItem(removed).name}.`); }
      return;
    }
    if (input.tap('confirm')) {
      const slot = EQUIP_SLOTS[this.equipSlot];
      const cls = CLASSES[this.ch.classId];
      const options = this.g.equipmentFor(this.ch, slot).filter((s) => canEquip(cls, getItem(s.id)));
      if (!options.length) { this.say('Nothing that fits this slot.'); return; }
      const before = stats(this.ch);
      this.list.setItems(options.map((s) => {
        const it = getItem(s.id);
        const delta = previewDelta(this.ch, slot, it, before);
        return { label: it.name, note: delta, id: s.id, item: it, noteColor: delta.startsWith('+') ? PAL.green : delta.startsWith('-') ? PAL.red : PAL.textDim };
      }));
      this.mode = 'equipList';
    }
  }

  updateEquipList(input) {
    this.list.handle(input);
    if (input.tap('confirm') && this.list.current?.id) {
      const slot = EQUIP_SLOTS[this.equipSlot];
      const id = this.list.current.id;
      const r = equipItem(this.ch, id);
      if (!r.ok) { this.say(r.reason); return; }
      this.g.removeItem(id);
      if (r.removed) this.g.addItem(r.removed);
      this.say(`${this.ch.name} equips ${getItem(id).name}.`);
      this.mode = 'equip';
    }
  }

  // --- formation -----------------------------------------------------------
  updateFormation(input) {
    const d = input.dir();
    if (d.y) this.formCursor.row = Math.max(0, Math.min(2, this.formCursor.row + d.y));
    if (d.x) this.formCursor.col = Math.max(0, Math.min(2, this.formCursor.col + d.x));
    if (input.tap('confirm')) {
      const here = this.g.party.find((c) => c.grid.row === this.formCursor.row && c.grid.col === this.formCursor.col);
      if (this.formPicked) {
        const a = this.formPicked;
        const ag = { ...a.grid };
        a.grid.row = this.formCursor.row; a.grid.col = this.formCursor.col;
        if (here && here !== a) { here.grid.row = ag.row; here.grid.col = ag.col; }
        this.formPicked = null;
      } else if (here) {
        this.formPicked = here;
      }
    }
    if (input.tap('shift')) { this.g.autoFormation(); this.formPicked = null; this.say('Formation reset to defaults.'); }
  }

  // --- save ----------------------------------------------------------------
  updateSave(input) {
    this.list.handle(input);
    if (input.tap('confirm')) {
      const slot = this.list.current.id;
      if (this.g.save(slot)) this.say(`Saved to slot ${slot}.`);
      else this.say('Could not write the save.');
      this.openPage('save');
    }
  }

  // --- draw ----------------------------------------------------------------
  draw(scr) {
    scr.clear('#0b0e1c');
    for (let y = 0; y < H; y += 4) scr.rect(0, y, W, 1, '#0d1122');
    header(scr, 'PARTY', `${this.g.gold}G   ${formatTime(this.g.playtime)}`);

    scr.window(6, 24, 84, H - 30);
    this.root.x = 22; this.root.y = 32;
    this.root.draw(scr, { inactive: this.mode !== 'root' });

    if (this.mode === 'root') this.drawRoster(scr);
    else {
      scr.window(94, 24, W - 100, H - 30);
      switch (this.mode) {
        case 'status': this.drawStatus(scr); break;
        case 'arts': this.drawArts(scr); break;
        case 'items': case 'itemTarget': this.drawItems(scr); break;
        case 'equip': case 'equipList': this.drawEquip(scr); break;
        case 'formation': this.drawFormation(scr); break;
        case 'jobs': this.drawJobs(scr); break;
        case 'ladder': this.drawLadder(scr); break;
        case 'save': this.drawSave(scr); break;
        default: break;
      }
    }

    if (this.msg) {
      scr.window(6, H - 24, W - 12, 20);
      scr.text(this.msg, 14, H - 18, PAL.gold);
    }
  }

  drawRoster(scr) {
    scr.window(94, 24, W - 100, H - 30);
    this.g.party.forEach((ch, i) => {
      const y = 30 + i * 46;
      const s = stats(ch);
      const cls = CLASSES[ch.classId];
      const el = ELEMENT_BY_ID[ch.elementId];
      const cv = heroSprite({ classId: ch.classId, elementId: ch.elementId, skin: ch.skin, hair: ch.hair, frame: Math.floor(this.t * 3 + i) % 2 });
      scr.ctx.drawImage(cv, 100, y);
      scr.text(ch.name, 128, y + 2, PAL.text);
      scr.text(`Lv${ch.level} ${cls.name}`, 128, y + 12, PAL.textDim);
      scr.rect(128, y + 22, 4, 5, el.color);
      scr.text(`${el.name} · ${jobInfo(ch).name} ${jobInfo(ch).rank}`, 135, y + 21, PAL.textDim);
      scr.bar(128, y + 30, 60, 4, ch.hp / s.maxHp, hpColor(ch.hp / s.maxHp));
      scr.bar(128, y + 36, 60, 3, s.maxMp ? ch.mp / s.maxMp : 0, PAL.cyan);
      scr.textRight(`${ch.hp}/${s.maxHp}`, W - 10, y + 2, PAL.text);
      if (refreshPromotion(ch)) scr.textRight('PROMOTION READY', W - 10, y + 14, PAL.gold);
    });
  }

  charHeader(scr) {
    const ch = this.ch;
    const cls = CLASSES[ch.classId];
    const el = ELEMENT_BY_ID[ch.elementId];
    const cv = heroSprite({ classId: ch.classId, elementId: ch.elementId, skin: ch.skin, hair: ch.hair, frame: 0 });
    scr.ctx.drawImage(cv, 100, 28);
    scr.text(ch.name, 128, 30, PAL.gold);
    scr.text(`Lv${ch.level} ${cls.name}`, 128, 40, PAL.text);
    scr.rect(128, 51, 4, 5, el.color);
    scr.text(el.name, 135, 50, el.color);
    scr.textRight('< > switch', W - 10, 30, PAL.textDim);
    return 64;
  }

  drawStatus(scr) {
    const ch = this.ch;
    let y = this.charHeader(scr);
    const s = stats(ch);
    const cls = CLASSES[ch.classId];
    const el = ELEMENT_BY_ID[ch.elementId];
    const job = jobInfo(ch);

    scr.text(`${TIER_NAME[cls.tier]} tier ${cls.tier}`, 100, y, PAL.magenta);
    scr.textRight(`${job.name} rank ${job.rank}`, W - 10, y, PAL.cyan);
    y += 12;

    const left = [['HP', `${ch.hp}/${s.maxHp}`], ['MP', `${ch.mp}/${s.maxMp}`],
      ['STR', s.str], ['VIT', s.vit], ['AGI', s.agi]];
    const right = [['INT', s.int], ['SPR', s.spr], ['LCK', s.lck],
      ['ATK', s.power], ['DEF', s.armor]];
    left.forEach(([k, v], i) => statLine(scr, k, v, 100, y + i * 10, { w: 60 }));
    right.forEach(([k, v], i) => statLine(scr, k, v, 172, y + i * 10, { w: 66 }));
    y += 54;

    scr.rect(100, y, W - 110, 1, PAL.frame1); y += 5;
    statLine(scr, 'Reach', s.reach, 100, y, { w: 60 });
    statLine(scr, 'Crit', `${(s.crit * 100).toFixed(0)}%`, 172, y, { w: 66 }); y += 10;
    statLine(scr, 'Evade', `${(s.evade * 100).toFixed(0)}%`, 100, y, { w: 60 });
    statLine(scr, 'Grid', `r${ch.grid.row} c${ch.grid.col}`, 172, y, { w: 66 }); y += 12;

    const next = ch.level >= MAX_LEVEL ? null : expForLevel(ch.level + 1) - ch.exp;
    scr.text(next === null ? 'EXP  —  maximum level' : `EXP to next  ${next}`, 100, y, PAL.textDim); y += 10;
    const promo = refreshPromotion(ch);
    if (promo) {
      scr.text(promo.branching ? 'PROMOTION READY — a choice of two' : 'PROMOTION READY', 100, y, PAL.gold);
    } else {
      const nextLv = PROMOTION_LEVELS.find((l) => l > ch.level);
      scr.text(nextLv ? `Next promotion at level ${nextLv}` : 'Class ladder complete', 100, y, PAL.textDim);
    }
    y += 12;
    scr.text(`Perk — ${el.perk}`, 100, y, PAL.gold); y += 9;
    y += scr.textWrap(el.perkText, 100, y, W - 112, PAL.textDim, { lineHeight: 9 }) * 9 + 2;
    const st = Object.keys(ch.statuses).filter((k) => STATUS[k]);
    if (st.length) scr.text(`Status: ${st.map((k) => STATUS[k].name).join(', ')}`, 100, y, PAL.magenta);
  }

  drawArts(scr) {
    const y = this.charHeader(scr);
    const cls = CLASSES[this.ch.classId];
    scr.text(cls.schools.map((s) => SCHOOLS[s].name).join(' · '), 100, y, PAL.cyan);
    this.list.x = 110; this.list.y = y + 12; this.list.cellW = 138; this.list.rows = 9;
    this.list.draw(scr);
    const k = this.list.current?.skill;
    if (k) {
      scr.rect(100, H - 46, W - 110, 1, PAL.frame1);
      scr.textWrap(k.blurb ?? '', 100, H - 42, W - 112, PAL.textDim, { lineHeight: 9, maxLines: 2 });
      scr.text(`${SCHOOLS[k.school].name} · reach ${k.range} · ${k.target}`, 100, H - 22, PAL.text);
    }
    scr.textRight('SHIFT next member', W - 10, H - 12, PAL.textDim);
  }

  drawItems(scr) {
    scr.text(`ITEMS  ${this.g.inventory.length}/${this.g.carryLimit()}`, 100, 30, PAL.gold);
    this.list.x = 112; this.list.y = 44; this.list.cellW = 132; this.list.rows = 9;
    this.list.draw(scr, { inactive: this.mode === 'itemTarget' });
    const it = this.list.current?.item;
    if (it) {
      scr.rect(100, H - 60, W - 110, 1, PAL.frame1);
      scr.text(it.name, 100, H - 56, PAL.gold);
      const desc = it.heal ? `Restores ${it.heal} HP.` : it.healMp ? `Restores ${it.healMp} MP.`
        : it.cures ? `Cures ${it.cures.join(', ')}.` : it.camp ? 'Rest anywhere.'
          : it.kind === 'material' ? 'A crafting material.' : `Value ${it.price}G.`;
      scr.textWrap(desc, 100, H - 46, W - 112, PAL.textDim, { lineHeight: 9, maxLines: 2 });
    }
    if (this.mode === 'itemTarget') {
      scr.window(96, H - 34, W - 102, 30);
      scr.text('Use on:', 102, H - 28, PAL.gold);
      this.g.party.forEach((ch, i) => {
        const x = 140 + i * 28;
        scr.text(ch.name.slice(0, 4), x, H - 28, i === this.who ? PAL.white : PAL.textDim);
        scr.bar(x, H - 18, 24, 3, ch.hp / stats(ch).maxHp, hpColor(ch.hp / stats(ch).maxHp));
      });
    }
  }

  drawEquip(scr) {
    const ch = this.ch;
    const y = this.charHeader(scr);
    const s = stats(ch);
    EQUIP_SLOTS.forEach((slot, i) => {
      const id = ch.equip[slot];
      const sel = i === this.equipSlot && this.mode === 'equip';
      const yy = y + i * 12;
      if (sel) scr.text('>', 100, yy, PAL.gold);
      scr.text(slot.toUpperCase(), 108, yy, PAL.textDim);
      scr.text(id ? getItem(id).name : '—', 158, yy, id ? PAL.text : PAL.grey);
    });
    let yy = y + 66;
    scr.rect(100, yy, W - 110, 1, PAL.frame1); yy += 5;
    statLine(scr, 'ATK', s.power, 100, yy, { w: 60 });
    statLine(scr, 'DEF', s.armor, 172, yy, { w: 66 }); yy += 10;
    statLine(scr, 'WARD', s.ward, 100, yy, { w: 60 });
    statLine(scr, 'REACH', s.reach, 172, yy, { w: 66 });

    if (this.mode === 'equipList') {
      scr.window(96, y + 88, W - 102, H - y - 96);
      this.list.x = 112; this.list.y = y + 96; this.list.cellW = 130; this.list.rows = 5;
      this.list.draw(scr);
    } else {
      scr.textRight('SHIFT unequip', W - 10, H - 12, PAL.textDim);
    }
  }

  drawFormation(scr) {
    scr.text('FORMATION', 100, 30, PAL.gold);
    scr.text('Column 0 is the front rank.', 100, 42, PAL.textDim);
    const ox = 118, oy = 58, cw = 34, chh = 30;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = ox + c * cw, yy = oy + r * chh;
        const sel = this.formCursor.row === r && this.formCursor.col === c;
        scr.rect(x, yy, cw - 4, chh - 4, c === 0 ? '#1d2a52' : c === 1 ? '#18233f' : '#141c30');
        scr.outline(x, yy, cw - 4, chh - 4, sel ? PAL.gold : PAL.frame2);
        const occ = this.g.party.find((ch) => ch.grid.row === r && ch.grid.col === c);
        if (occ) {
          const cv = heroSprite({ classId: occ.classId, elementId: occ.elementId, skin: occ.skin, hair: occ.hair, frame: 0 });
          scr.ctx.save();
          if (this.formPicked === occ) scr.ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 8);
          scr.ctx.drawImage(cv, x + 3, yy - 6);
          scr.ctx.restore();
          scr.text(occ.name.slice(0, 5), x + 1, yy + chh - 12, PAL.text, { size: 8 });
        }
      }
    }
    for (let c = 0; c < 3; c++) scr.textCenter(`col ${c}`, ox + c * cw + 15, oy - 10, PAL.textDim);
    let y = oy + 3 * chh + 4;
    const occ = this.g.party.find((ch) => ch.grid.row === this.formCursor.row && ch.grid.col === this.formCursor.col);
    if (occ) {
      const s = stats(occ);
      scr.text(`${occ.name} — reach ${s.reach}`, 100, y, PAL.text); y += 10;
      scr.textWrap(s.reach >= 9 ? 'Reaches any cell from anywhere. Safe at the back.'
        : s.reach === 3 ? 'Reaches one column deeper than a sword.'
          : 'Strikes the enemy front rank only.', 100, y, W - 112, PAL.textDim, { lineHeight: 9 });
    }
    scr.textRight(this.formPicked ? 'Z place / swap' : 'Z pick   SHIFT auto', W - 10, H - 12, PAL.textDim);
  }

  drawJobs(scr) {
    const ch = this.ch;
    let y = this.charHeader(scr);
    const job = jobInfo(ch);
    const prog = jobProgress(ch);
    scr.text(job.name.toUpperCase(), 100, y, PAL.gold);
    scr.textRight(`${RANK_TITLES[job.rank - 1]} (${job.rank}/${MAX_JOB_RANK})`, W - 10, y, PAL.cyan);
    y += 11;
    scr.bar(100, y, W - 112, 5, prog.ratio, PAL.cyan);
    y += 8;
    scr.text(prog.next === null ? 'Mastered.' : `${prog.next} more job actions to rank ${job.rank + 1}.`,
      100, y, PAL.textDim);
    y += 12;
    y += scr.textWrap(job.blurb, 100, y, W - 112, PAL.textDim, { lineHeight: 9 }) * 9 + 4;

    scr.text('BONUS AT THIS RANK', 100, y, PAL.gold); y += 10;
    const parts = Object.entries(job.bonus).map(([k, v]) => `${k.toUpperCase()} +${v}`);
    y += scr.textWrap(parts.join('   '), 100, y, W - 112, PAL.green, { lineHeight: 9 }) * 9 + 4;

    scr.text(`FIELD — ${job.field.name}`, 100, y, PAL.gold); y += 10;
    y += scr.textWrap(job.field.text, 100, y, W - 112, PAL.text, { lineHeight: 9 }) * 9 + 4;
    scr.text('PASSIVE', 100, y, PAL.gold); y += 10;
    scr.textWrap(job.passive.text, 100, y, W - 112, PAL.text, { lineHeight: 9 });
  }

  drawLadder(scr) {
    const ch = this.ch;
    this.charHeader(scr);
    const path = promotionPath(ch);
    const root = path[0];
    let y = 62;
    scr.text('CLASS LADDER', 100, y, PAL.gold);
    scr.textRight(`tier ${CLASSES[ch.classId].tier}/4`, W - 10, y, PAL.textDim);
    y += 12;

    // walk the tree down the line the character actually took, showing the
    // branch they rejected in grey so the choice stays visible
    let node = root;
    let tier = 0;
    while (node) {
      const taken = node.id === ch.classId;
      const isPast = path.some((p) => p.id === node.id);
      const lvl = tier === 0 ? 1 : PROMOTION_LEVELS[tier - 1];
      const color = taken ? PAL.gold : isPast ? PAL.text : PAL.grey;
      scr.text(`${String(lvl).padStart(2)}`, 100, y, PAL.textDim);
      scr.text(node.name, 116, y, color);
      if (taken) scr.textRight('◀ here', W - 10, y, PAL.gold);
      y += 10;

      const next = path[tier + 1];
      if (!next) {
        // show what is still ahead
        if (node.promotions.length) {
          const opts = node.promotions.map((p) => CLASSES[p]);
          const at = PROMOTION_LEVELS[tier];
          scr.text(`${String(at).padStart(2)}`, 100, y, PAL.textDim);
          if (opts.length > 1) {
            scr.text(`${opts[0].name}`, 116, y, PAL.cyan);
            scr.text('or', 116, y + 9, PAL.textDim);
            scr.text(`${opts[1].name}`, 132, y + 9, PAL.cyan);
            y += 20;
          } else { scr.text(opts[0].name, 116, y, PAL.cyan); y += 10; }
          scr.text(ch.level >= at ? 'Ready — visit a temple.' : `At level ${at}.`,
            116, y, ch.level >= at ? PAL.gold : PAL.textDim);
          y += 12;
        } else {
          scr.text('Ladder complete.', 116, y, PAL.magenta);
          y += 12;
        }
        break;
      }
      // the sibling not taken
      const sibs = node.promotions.map((p) => CLASSES[p]).filter((p) => p.id !== next.id);
      for (const s of sibs) {
        scr.text('  ', 100, y, PAL.textDim);
        scr.text(`(${s.name})`, 116, y, PAL.grey);
        y += 10;
      }
      node = next;
      tier++;
    }

    const cls = CLASSES[ch.classId];
    scr.rect(100, H - 44, W - 110, 1, PAL.frame1);
    scr.textWrap(cls.blurb, 100, H - 40, W - 112, PAL.textDim, { lineHeight: 9, maxLines: 2 });
    scr.textWrap(cls.schools.map((s) => SCHOOLS[s].name).join(' · '), 100, H - 20, W - 112,
      PAL.cyan, { size: 8, lineHeight: 9, maxLines: 1 });
  }

  drawSave(scr) {
    scr.text('SAVE', 100, 30, PAL.gold);
    this.list.x = 116; this.list.y = 48; this.list.cellW = 128; this.list.rows = 3; this.list.cellH = 22;
    this.list.draw(scr);
    scr.textWrap('Saves live in this browser. Clearing site data clears them.',
      100, H - 40, W - 112, PAL.textDim, { lineHeight: 9 });
  }
}

function previewDelta(ch, slot, item, before) {
  const prev = ch.equip[slot];
  ch.equip[slot] = item.id;
  const after = stats(ch);
  ch.equip[slot] = prev;
  const key = slot === 'weapon' ? 'power' : 'armor';
  const d = after[key] - before[key];
  return d === 0 ? '=' : d > 0 ? `+${d}` : `${d}`;
}
