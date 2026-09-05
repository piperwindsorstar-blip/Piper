// ============================================================================
//  PARTY MENU — status, arts, items, equipment, formation, jobs, class ladder
//  and saving.
//
//  Two pages carry the weight. STATUS is the only place a player can read what
//  their RACE actually does once creation is behind them, so it spells out both
//  traits and every resistance. LADDER draws the whole eight-tier promotion
//  tree, marks the path actually walked, and names the branch still ahead.
// ============================================================================

import { PAL, W, H, drawFit } from '../../engine/screen.js';
import { Menu, header, hpColor, statRow } from '../../engine/ui.js';
import { actorPortraitSprite } from '../../engine/sprites.js';
import {
  stats, knownSkills, upcomingSkills, jobInfo, jobProgress, equipItem, unequipSlot,
  promotionPath, refreshPromotion, expForLevel, raceInfo, MAX_LEVEL, trainStat, TRAIN_COST,
} from '../character.js';
import { CLASSES, TIER_NAME, PROMOTION_LEVELS, STAT_KEYS } from '../../data/classes.js';
import { ELEMENT_BY_ID } from '../../data/elements.js';
import { ENEMIES, FAMILIES } from '../../data/enemies.js';
import { ACHIEVEMENTS } from '../../data/achievements.js';
import { RECIPES, canCraft, craft } from '../../data/recipes.js';
import { MAPS, REGIONS } from '../../data/maps.js';
import { SCHOOLS, STATUS } from '../../data/skills.js';
import { getItem, SLOTS as EQUIP_SLOTS, canEquip, WEAPON_TYPES, ARMOR_CLASSES } from '../../data/items.js';
import { MAX_JOB_RANK, RANK_TITLES } from '../../data/jobs.js';
import { formatTime } from '../state.js';
import { questState, questProgress, questReady, questsByLevel, questBand } from '../../data/quests.js';
import { nextStoryHint } from '../../data/story.js';
import { SLOTS, saveSummary } from '../../engine/save.js';
import { getTouchMode, cycleTouchMode, TOUCH_LABEL, getBattleSpeed, cycleBattleSpeed } from '../../engine/settings.js';
import {
  sfx, isMuted, toggleMuted, getSfxVolume, setSfxVolume, getMusicVolume, setMusicVolume,
} from '../../engine/audio.js';

const PAGES = [
  { id: 'status', label: 'Status' },
  { id: 'arts', label: 'Arts' },
  { id: 'items', label: 'Items' },
  { id: 'equip', label: 'Equip' },
  { id: 'craft', label: 'Craft' },
  { id: 'formation', label: 'Formation' },
  { id: 'train', label: 'Train' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'ladder', label: 'Ladder' },
  { id: 'quest', label: 'Quest' },
  { id: 'atlas', label: 'Atlas' },
  { id: 'bestiary', label: 'Bestiary' },
  { id: 'trophies', label: 'Trophies' },
  { id: 'save', label: 'Save' },
  { id: 'controls', label: 'Controls' },
  { id: 'close', label: 'Close' },
];

// layout
const NAV_X = 12, NAV_W = 88;
const BX = 110, BW = W - BX - 12;          // body panel
const TOP = 34, BODY_H = H - TOP - 32;
const IX = BX + 14, IW = BW - 28;         // body inner
const CW = Math.floor((IW - 16) / 2);     // two-column width
const HEAD_PORTRAIT_W = 40, HEAD_PORTRAIT_H = 38; // procedural bust in charHeader
// Quest page: side-quest list sits below the main-story block, leaving room
// at the panel's own bottom for the selected entry's hook/reminder text.
const QUEST_LIST_Y = TOP + 96, QUEST_LIST_ROWS = 6;
// Bestiary page: one list fills the body, leaving room at the bottom for the
// selected entry's family/element/blurb line.
const BESTIARY_LIST_Y = TOP + 34, BESTIARY_LIST_ROWS = 10;
// Trophies page: same shape as Bestiary — one list, one description line.
const TROPHY_LIST_Y = TOP + 34, TROPHY_LIST_ROWS = 10;
// Atlas page: same shape again — one list, one description line.
const ATLAS_LIST_Y = TOP + 34, ATLAS_LIST_ROWS = 10;
// Craft page: the list takes the left column; a detail panel (materials,
// have/need, gold) fills the right, mirroring Equip's own two-column split.
const CRAFT_LIST_Y = TOP + 34, CRAFT_LIST_ROWS = 10;

/** The procedural bust portrait, scaled to fit a box. */
function drawBust(scr, x, y, w, h, ch, alpha = 1) {
  scr.ctx.save();
  if (alpha !== 1) scr.ctx.globalAlpha = alpha;
  drawFit(scr, x, y, w, h, actorPortraitSprite(ch));
  scr.ctx.restore();
}

export class MenuScene {
  constructor(app) { this.app = app; }

  enter() {
    this.g = this.app.game;
    this.t = 0;
    this.openT = 0;
    this.mode = 'root';
    this.who = 0;
    this.msg = null;
    this.msgT = 0;
    this.root = new Menu({
      items: PAGES.map((p) => ({ label: p.label, id: p.id })),
      x: NAV_X + 20, y: TOP + 12, cellW: NAV_W - 30, cellH: 17, rows: PAGES.length,
    });
    this.list = new Menu({ items: [], x: IX + 12, y: TOP + 30, cellW: IW - 24, cellH: 13, rows: 13 });
    this.equipSlot = 0;
    this.formCursor = { row: 1, col: 0 };
    this.formPicked = null;
    this.formSide = 'grid';
    this.benchCursor = 0;
    this.trainIdx = 0;
    this.controlsIdx = 0;
    sfx.menuOpen();
  }

  say(m) { this.msg = m; this.msgT = 2.6; }

  colX(i) { return IX + i * (CW + 16); }
  /** Half of a column, for pages that need four columns of numbers. */
  subX(col, i) { return this.colX(col) + i * Math.floor((CW + 8) / 2); }
  get subW() { return Math.floor((CW + 8) / 2) - 10; }

  update(dt, input) {
    this.t += dt;
    this.openT = Math.min(0.2, this.openT + dt);
    this.g.playtime += dt;
    this.root.update(dt); this.list.update(dt);
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg = null; }

    if (this.mode === 'root') {
      this.root.handle(input);
      if (input.tap('cancel') || input.tap('menu')) { sfx.menuClose(); this.app.pop(); return; }
      if (input.tap('confirm')) { sfx.confirm(); this.openPage(this.root.current.id); }
      return;
    }
    if (input.tap('cancel')) {
      sfx.cancel();
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
      case 'craft': return this.updateCraft(input);
      case 'formation': return this.updateFormation(input);
      case 'train': return this.updateTrain(input);
      case 'save': return this.updateSave(input);
      case 'controls': return this.updateControls(input);
      case 'quest': return this.updateQuest(input);
      case 'atlas': return this.updateAtlas(input);
      case 'bestiary': return this.updateBestiary(input);
      case 'trophies': return this.updateTrophies(input);
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
        return {
          label: `Slot ${s}`, id: s,
          note: sum ? `${sum.leader} Lv${sum.level}   ${formatTime(sum.playtime)}` : 'empty',
        };
      }));
    }
    if (id === 'formation') {
      this.formCursor = { ...this.g.party[0].grid };
      this.formPicked = null;
    }
    if (id === 'craft') this.refreshCraft();
    if (id === 'quest') this.refreshQuest();
    if (id === 'atlas') this.refreshAtlas();
    if (id === 'bestiary') this.refreshBestiary();
    if (id === 'trophies') this.refreshTrophies();
  }

  get ch() { return this.g.party[this.who]; }

  cycleChar(input) {
    const n = this.g.party.length;
    if (input.tap('left') || input.tap('up')) this.who = (this.who + n - 1) % n;
    if (input.tap('right') || input.tap('down')) this.who = (this.who + 1) % n;
  }

  // --- arts ------------------------------------------------------------------
  refreshArts() {
    const ch = this.ch;
    this.list.setItems([
      ...knownSkills(ch).map((k) => ({
        label: k.name, note: k.ip ? `${k.ip} IP` : `${k.mp} MP`, skill: k,
      })),
      ...upcomingSkills(ch, 10).map((k) => ({
        label: k.name, note: `Lv${k.lv}`, skill: k, disabled: true,
      })),
    ]);
  }

  updateArts(input) {
    this.list.handle(input);
    if (input.tap('shift')) {
      this.who = (this.who + 1) % this.g.party.length;
      this.refreshArts();
    }
  }

  // --- items -----------------------------------------------------------------
  refreshItems() {
    this.list.setItems(this.g.inventory.map((s) => {
      const it = getItem(s.id);
      return { label: it.name, note: `x${s.count}`, id: s.id, item: it };
    }), true);
    if (!this.list.length) this.list.setItems([{ label: '— nothing carried —', disabled: true }]);
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

  // --- equipment -------------------------------------------------------------
  updateEquip(input) {
    const n = this.g.party.length;
    if (input.tap('left')) this.who = (this.who + n - 1) % n;
    if (input.tap('right')) this.who = (this.who + 1) % n;
    if (input.tap('up')) this.equipSlot = (this.equipSlot + EQUIP_SLOTS.length - 1) % EQUIP_SLOTS.length;
    if (input.tap('down')) this.equipSlot = (this.equipSlot + 1) % EQUIP_SLOTS.length;
    if (input.tap('shift')) {
      const removed = unequipSlot(this.ch, EQUIP_SLOTS[this.equipSlot]);
      if (removed) { sfx.equip(); this.g.addItem(removed); this.say(`Removed ${getItem(removed).name}.`); }
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
        return {
          label: it.name, note: delta, id: s.id, item: it,
          noteColor: delta.startsWith('+') ? PAL.green : delta.startsWith('-') ? PAL.red : PAL.textDim,
        };
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
      if (!r.ok) { sfx.error(); this.say(r.reason); return; }
      sfx.equip();
      this.g.removeItem(id);
      if (r.removed) this.g.addItem(r.removed);
      this.say(`${this.ch.name} equips ${getItem(id).name}.`);
      this.mode = 'equip';
    }
  }

  // --- formation -------------------------------------------------------------
  updateFormation(input) {
    // MENU toggles focus between the grid and the bench, unless a member is
    // already held (finish placing them first, don't strand the pick).
    if (input.tap('menu') && !this.formPicked) {
      this.formSide = this.formSide === 'bench' ? 'grid' : 'bench';
      this.benchCursor = 0;
      return;
    }
    if (this.formSide === 'bench') {
      const bench = this.g.benched();
      const d = input.dir();
      if (d.y && bench.length) this.benchCursor = (this.benchCursor + d.y + bench.length) % bench.length;
      if (input.tap('confirm') && bench.length) {
        this.formPicked = bench[this.benchCursor];
        this.formSide = 'grid';
      }
      return;
    }
    const d = input.dir();
    if (d.y) this.formCursor.row = Math.max(0, Math.min(2, this.formCursor.row + d.y));
    if (d.x) this.formCursor.col = Math.max(0, Math.min(2, this.formCursor.col + d.x));
    if (input.tap('confirm')) {
      const here = this.g.party.find((c) => c.grid.row === this.formCursor.row && c.grid.col === this.formCursor.col);
      if (this.formPicked) {
        const a = this.formPicked;
        if (!this.g.party.includes(a)) {
          // a bench pick: bring them into the active party at this cell
          const ok = this.g.benchInto(a.id, this.formCursor.row, this.formCursor.col);
          this.say(ok ? `${a.name} joins the formation.` : 'The party is full.');
        } else {
          const ag = { ...a.grid };
          a.grid.row = this.formCursor.row; a.grid.col = this.formCursor.col;
          if (here && here !== a) { here.grid.row = ag.row; here.grid.col = ag.col; }
        }
        this.formPicked = null;
      } else if (here) {
        this.formPicked = here;
      }
    }
    if (input.tap('shift')) {
      this.g.autoFormation();
      this.formPicked = null;
      this.say('Formation reset to defaults.');
    }
  }

  // --- train (Learning Points) ------------------------------------------------
  updateTrain(input) {
    const n = this.g.party.length;
    if (input.tap('left')) this.who = (this.who + n - 1) % n;
    if (input.tap('right')) this.who = (this.who + 1) % n;
    if (input.tap('up')) this.trainIdx = (this.trainIdx + STAT_KEYS.length - 1) % STAT_KEYS.length;
    if (input.tap('down')) this.trainIdx = (this.trainIdx + 1) % STAT_KEYS.length;
    if (input.tap('confirm')) {
      const key = STAT_KEYS[this.trainIdx];
      if (trainStat(this.g, this.ch, key)) { sfx.confirm(); this.say(`${this.ch.name}'s ${key.toUpperCase()} rises.`); }
      else { sfx.error(); this.say(`Needs ${TRAIN_COST} LP.`); }
    }
  }

  // --- save ------------------------------------------------------------------
  updateSave(input) {
    this.list.handle(input);
    if (input.tap('confirm')) {
      const slot = this.list.current.id;
      if (this.g.save(slot)) { sfx.save(); this.say(`Saved to slot ${slot}.`); }
      else { sfx.error(); this.say('Could not write the save.'); }
      this.openPage('save');
    }
  }

  // --- controls ----------------------------------------------------------
  updateControls(input) {
    const ROWS = 5; // touch mode, sfx volume, music volume, mute, battle speed
    if (input.tap('up')) { this.controlsIdx = (this.controlsIdx + ROWS - 1) % ROWS; sfx.move(); }
    if (input.tap('down')) { this.controlsIdx = (this.controlsIdx + 1) % ROWS; sfx.move(); }
    if (this.controlsIdx === 0) {
      if (input.tap('confirm')) { cycleTouchMode(); sfx.confirm(); }
    } else if (this.controlsIdx === 1) {
      if (input.tap('left')) { setSfxVolume(getSfxVolume() - 0.1); sfx.confirm(); }
      if (input.tap('right')) { setSfxVolume(getSfxVolume() + 0.1); sfx.confirm(); }
    } else if (this.controlsIdx === 2) {
      if (input.tap('left')) setMusicVolume(getMusicVolume() - 0.1);
      if (input.tap('right')) setMusicVolume(getMusicVolume() + 0.1);
    } else if (this.controlsIdx === 3) {
      if (input.tap('confirm')) { toggleMuted(); sfx.confirm(); }
    } else if (this.controlsIdx === 4) {
      if (input.tap('confirm') || input.tap('left') || input.tap('right')) { cycleBattleSpeed(); sfx.confirm(); }
    }
  }

  // --- draw ------------------------------------------------------------------
  draw(scr) {
    scr.setGrade('#6a86d0', 0.09);
    scr.bloom = 0.36;
    scr.vignette = 0.54;
    scr.clear('#080b14');
    for (let y = 0; y < H; y += 3) scr.rect(0, y, W, 1, 'rgba(255,255,255,0.012)');
    scr.light(W * 0.15, -30, 220, 'rgba(90,130,255,0.22)', 0.5);

    // the whole panel slides down and fades in the moment the menu opens —
    // a one-shot flourish on entry, not replayed when switching pages
    const openK = 1 - (1 - this.openT / 0.2) ** 3;
    scr.ctx.save();
    scr.ctx.globalAlpha = openK;
    scr.ctx.translate(0, (1 - openK) * -14);

    header(scr, 'PARTY', `${this.g.ngPlus ? `NG+${this.g.ngPlus}     ` : ''}${this.g.gold} G     ${formatTime(this.g.playtime)}`);

    scr.panel(NAV_X, TOP, NAV_W, BODY_H, { accent: true });
    this.root.draw(scr, { inactive: this.mode !== 'root' });

    scr.panel(BX, TOP, BW, BODY_H, { accent: this.mode !== 'root' });
    if (this.mode === 'root') this.drawRoster(scr);
    else {
      switch (this.mode) {
        case 'status': this.drawStatus(scr); break;
        case 'arts': this.drawArts(scr); break;
        case 'items': case 'itemTarget': this.drawItems(scr); break;
        case 'equip': case 'equipList': this.drawEquip(scr); break;
        case 'craft': this.drawCraft(scr); break;
        case 'formation': this.drawFormation(scr); break;
        case 'train': this.drawTrain(scr); break;
        case 'jobs': this.drawJobs(scr); break;
        case 'ladder': this.drawLadder(scr); break;
        case 'save': this.drawSave(scr); break;
        case 'controls': this.drawControls(scr); break;
        case 'quest': this.drawQuest(scr); break;
        case 'atlas': this.drawAtlas(scr); break;
        case 'bestiary': this.drawBestiary(scr); break;
        case 'trophies': this.drawTrophies(scr); break;
        default: break;
      }
    }

    scr.panel(NAV_X, H - 26, W - NAV_X * 2, 20, this.msg ? { accent: true } : {});
    scr.text(this.msg ?? 'Z select   ·   X back   ·   arrows move',
      NAV_X + 14, H - 20, this.msg ? PAL.accent : PAL.textFaint);
    scr.ctx.restore();
  }

  // --- roster ----------------------------------------------------------------
  drawRoster(scr) {
    // A party of 4 (creation's own size) always got the full, roomy card;
    // a fuller roster of up to 9 compresses row height a little first, and
    // only past what stays legible does it stop short and point at Status,
    // which can already cycle through every party member one at a time.
    const n = this.g.party.length;
    const minRowH = 32;
    const maxRows = Math.max(1, Math.floor((BODY_H - 16) / minRowH));
    const shown = Math.min(n, maxRows);
    const rowH = Math.floor((BODY_H - 16) / Math.max(1, shown));
    this.g.party.slice(0, shown).forEach((ch, i) => {
      const y = TOP + 10 + i * rowH;
      const s = stats(ch);
      const cls = CLASSES[ch.classId];
      const el = ELEMENT_BY_ID[ch.elementId];
      const race = raceInfo(ch);
      scr.light(IX + 22, y + 24, 26, el.color, 0.14);
      drawBust(scr, IX, y - 2, 30, Math.min(44, rowH - 6), ch);
      scr.text(ch.name, IX + 44, y + 2, PAL.text);
      scr.text(`Lv ${ch.level}   ${race.name} ${cls.name}`, IX + 44, y + 15, PAL.textDim);
      scr.rect(IX + 44, y + 29, 4, 6, el.color);
      scr.text(`${el.name}  ·  ${jobInfo(ch).name} ${jobInfo(ch).rank}`, IX + 52, y + 28, PAL.textFaint);

      const bx = IX + IW - 150;
      scr.text(`${ch.hp}`, bx, y + 2, hpColor(ch.hp / s.maxHp));
      scr.text(`/${s.maxHp}`, bx + scr.textWidth(`${ch.hp}`) + 2, y + 2, PAL.textFaint);
      scr.bar(bx, y + 15, 140, 4, ch.hp / s.maxHp, hpColor(ch.hp / s.maxHp));
      scr.bar(bx, y + 22, 140, 3, s.maxMp ? ch.mp / s.maxMp : 0, PAL.cyan);
      if (refreshPromotion(ch)) scr.textRight('PROMOTION READY', IX + IW, y + 28, PAL.accent);
      if (i < shown - 1) scr.rect(IX, y + rowH - 6, IW, 1, 'rgba(150,175,235,0.10)');
    });
    if (n > shown) {
      scr.text(`+${n - shown} more — open Status to browse everyone`, IX, TOP + 10 + shown * rowH + 4, PAL.textFaint);
    }
  }

  /** Portrait + identity strip every per-character page shares. */
  charHeader(scr) {
    const ch = this.ch;
    const cls = CLASSES[ch.classId];
    const el = ELEMENT_BY_ID[ch.elementId];
    const race = raceInfo(ch);
    scr.light(IX + 20, TOP + 32, 28, el.color, 0.16);
    drawBust(scr, IX, TOP + 5, HEAD_PORTRAIT_W, HEAD_PORTRAIT_H, ch);
    scr.text(ch.name, IX + 44, TOP + 8, PAL.accent);
    scr.text(`Lv ${ch.level}   ${race.name} ${cls.name}`, IX + 44, TOP + 22, PAL.text);
    scr.rect(IX + 44, TOP + 36, 4, 6, el.color);
    scr.text(el.name, IX + 52, TOP + 35, el.color);
    scr.textRight(`${TIER_NAME[cls.tier]} · tier ${cls.tier}/7`, IX + IW, TOP + 8, PAL.magenta);
    scr.textRight('← → switch member', IX + IW, TOP + 34, PAL.textFaint);
    scr.rect(IX, TOP + 44, IW, 1, PAL.line);
    return TOP + 50;
  }

  // --- status ----------------------------------------------------------------
  drawStatus(scr) {
    const ch = this.ch;
    const top = this.charHeader(scr);
    const s = stats(ch);
    const race = raceInfo(ch);
    const el = ELEMENT_BY_ID[ch.elementId];

    // left: the sheet, as two narrow columns so it fits the panel
    let y = top;
    scr.text('ATTRIBUTES', this.subX(0, 0), y, PAL.accent);
    scr.text('DERIVED', this.subX(0, 1), y, PAL.accent);
    y += 13;
    const attrs = [
      ['HP', `${ch.hp}/${s.maxHp}`], ['MP', `${ch.mp}/${s.maxMp}`],
      ['STR', s.str], ['VIT', s.vit], ['AGI', s.agi],
      ['INT', s.int], ['SPR', s.spr], ['LCK', s.lck],
    ];
    const derived = [
      ['ATK', s.power], ['DEF', s.armor], ['WRD', s.ward], ['RCH', s.reach],
      ['CRT', `${(s.crit * 100).toFixed(0)}%`], ['EVA', `${(s.evade * 100).toFixed(0)}%`],
    ];
    attrs.forEach(([k, v], i) => statRow(scr, k, v, this.subX(0, 0), y + i * 10, this.subW));
    derived.forEach(([k, v], i) => statRow(scr, k, v, this.subX(0, 1), y + i * 10, this.subW));
    y += 8 * 10 + 8;

    scr.rect(this.colX(0), y, CW, 1, PAL.line); y += 8;
    const next = ch.level >= MAX_LEVEL ? null : expForLevel(ch.level + 1) - ch.exp;
    statRow(scr, 'EXP to next', next === null ? 'max' : next, this.colX(0), y, CW); y += 13;
    const promo = refreshPromotion(ch);
    if (promo) {
      scr.textWrap(promo.branching ? 'PROMOTION READY — a choice of two' : 'PROMOTION READY',
        this.colX(0), y, CW, PAL.accent, { lineHeight: 10, maxLines: 2 });
    } else {
      const nextLv = PROMOTION_LEVELS.find((l) => l > ch.level);
      scr.textWrap(nextLv ? `Next promotion at level ${nextLv}` : 'Class ladder complete',
        this.colX(0), y, CW, PAL.textFaint, { lineHeight: 10, maxLines: 2 });
    }
    y += 22;
    const st = Object.keys(ch.statuses).filter((k) => STATUS[k]);
    if (st.length) {
      scr.textWrap(`Status: ${st.map((k) => STATUS[k].name).join(', ')}`,
        this.colX(0), y, CW, PAL.magenta, { lineHeight: 10, maxLines: 2 });
    }

    // right: what the race and element actually do
    let ry = top;
    scr.text(`RACE — ${race.name.toUpperCase()}`, this.colX(1), ry, PAL.accent); ry += 12;
    for (const t of race.traits) {
      scr.text(t.name, this.colX(1), ry, PAL.cyan); ry += 10;
      ry += scr.textWrap(t.text, this.colX(1), ry, CW, PAL.textDim, { lineHeight: 10, maxLines: 3 }) * 10 + 2;
    }
    const res = Object.entries(race.resist);
    if (res.length) {
      let cx = this.colX(1);
      for (const [e, m] of res) {
        const ee = ELEMENT_BY_ID[e];
        // See creation.js's identical arrow: colour alone (green/red) is a
        // classic red-green colourblind trap, so the arrow carries the same
        // "resisted vs. weak" meaning on its own.
        const arrow = m < 1 ? '▼' : m > 1 ? '▲' : '';
        const label = `${ee.name} ${arrow}${Math.round(m * 100)}%`;
        const wdt = scr.textWidth(label) + 8;
        if (cx + wdt > this.colX(1) + CW) { cx = this.colX(1); ry += 11; }
        scr.rect(cx, ry + 1, 3, 6, ee.color);
        scr.text(label, cx + 6, ry, m < 1 ? PAL.green : m > 1 ? PAL.red : PAL.textDim);
        cx += wdt + 6;
      }
      ry += 14;
    }
    scr.text(`ELEMENT — ${el.perk.toUpperCase()}`, this.colX(1), ry, PAL.accent); ry += 11;
    scr.textWrap(el.perkText, this.colX(1), ry, CW, PAL.textDim, { lineHeight: 10, maxLines: 3 });
  }

  // --- arts ------------------------------------------------------------------
  drawArts(scr) {
    const top = this.charHeader(scr);
    const cls = CLASSES[this.ch.classId];
    scr.text(cls.schools.map((s) => SCHOOLS[s].name).join('  ·  '), IX, top, PAL.cyan);
    this.list.x = IX + 12; this.list.y = top + 16;
    this.list.cellW = CW + 4; this.list.rows = 11; this.list.cellH = 13;
    this.list.draw(scr);

    const k = this.list.current?.skill;
    if (k) {
      const x = this.colX(1) + 8;
      scr.panel(x - 8, top + 12, CW + 8, 128, { alpha: 0.9 });
      scr.text(k.name, x, top + 22, PAL.accent);
      scr.rect(x, top + 34, CW - 8, 1, PAL.line);
      scr.textWrap(k.blurb ?? '', x, top + 42, CW - 8, PAL.textDim, { lineHeight: 11, maxLines: 3 });
      let yy = top + 82;
      statRow(scr, 'School', SCHOOLS[k.school].name, x, yy, CW - 8); yy += 12;
      statRow(scr, 'Cost', k.ip ? `${k.ip} IP` : `${k.mp} MP`, x, yy, CW - 8); yy += 12;
      statRow(scr, 'Reach', k.range, x, yy, CW - 8); yy += 12;
      statRow(scr, 'Targets', k.target, x, yy, CW - 8);
    }
    scr.textRight('SHIFT next member', IX + IW, TOP + BODY_H - 22, PAL.textFaint);
  }

  // --- items -----------------------------------------------------------------
  drawItems(scr) {
    scr.text('ITEMS', IX, TOP + 10, PAL.accent);
    scr.textRight(`${this.g.inventory.length} / ${this.g.carryLimit()} stacks`, IX + IW, TOP + 10, PAL.textDim);
    scr.rect(IX, TOP + 22, IW, 1, PAL.line);
    this.list.x = IX + 12; this.list.y = TOP + 32;
    this.list.cellW = CW + 4; this.list.rows = 12; this.list.cellH = 13;
    this.list.draw(scr, { inactive: this.mode === 'itemTarget' });

    const it = this.list.current?.item;
    if (it) {
      const x = this.colX(1) + 8;
      scr.panel(x - 8, TOP + 28, CW + 8, 92, { alpha: 0.9 });
      scr.text(it.name, x, TOP + 38, PAL.accent);
      scr.rect(x, TOP + 50, CW - 8, 1, PAL.line);
      const desc = it.heal ? `Restores ${it.heal} HP.` : it.healMp ? `Restores ${it.healMp} MP.`
        : it.cures ? `Cures ${it.cures.join(', ')}.` : it.camp ? 'Rest anywhere.'
          : it.kind === 'material' ? 'A crafting material.' : `Worth ${it.price} gold.`;
      scr.textWrap(desc, x, TOP + 58, CW - 8, PAL.textDim, { lineHeight: 11, maxLines: 3 });
    }

    if (this.mode === 'itemTarget') {
      const py = TOP + BODY_H - 62;
      scr.panel(IX, py, IW, 54, { accent: true });
      scr.text('USE ON', IX + 12, py + 8, PAL.accent);
      const cardW = Math.floor((IW - 24) / this.g.party.length);
      const nameChars = Math.max(3, Math.floor((cardW - 4) / 5));
      this.g.party.forEach((ch, i) => {
        const x = IX + 12 + i * cardW;
        const s = stats(ch);
        const sel = i === this.who;
        if (sel) scr.rect(x - 4, py + 20, cardW - 4, 26, 'rgba(120,155,235,0.20)');
        scr.text(ch.name.slice(0, nameChars), x, py + 24, sel ? PAL.white : PAL.textDim);
        scr.text(`${ch.hp}/${s.maxHp}`, x, py + 35, hpColor(ch.hp / s.maxHp));
      });
    }
  }

  // --- equipment -------------------------------------------------------------
  drawEquip(scr) {
    const ch = this.ch;
    const top = this.charHeader(scr);
    const s = stats(ch);

    let y = top;
    EQUIP_SLOTS.forEach((slot, i) => {
      const id = ch.equip[slot];
      const sel = i === this.equipSlot && this.mode === 'equip';
      if (sel) {
        scr.rect(this.colX(0) - 6, y - 3, CW + 12, 15, 'rgba(120,155,235,0.20)');
        scr.rect(this.colX(0) - 6, y - 3, 2, 15, PAL.accent);
      }
      scr.text(slot.toUpperCase(), this.colX(0), y, PAL.textDim);
      scr.text(id ? getItem(id).name : '—', this.colX(0) + 62, y, id ? PAL.text : PAL.grey);
      y += 15;
    });
    y += 6;
    scr.rect(this.colX(0), y, CW, 1, PAL.line); y += 8;
    for (const [k, v] of [['Attack', s.power], ['Defence', s.armor], ['Ward', s.ward], ['Reach', s.reach]]) {
      statRow(scr, k, v, this.colX(0), y, CW); y += 12;
    }

    if (this.mode === 'equipList') {
      const x = this.colX(1);
      scr.panel(x - 8, top - 6, CW + 16, BODY_H - (top - TOP) - 8, { accent: true });
      scr.text('FITS THIS SLOT', x, top + 4, PAL.accent);
      this.list.x = x + 12; this.list.y = top + 20;
      this.list.cellW = CW - 8; this.list.rows = 9; this.list.cellH = 13;
      this.list.draw(scr);
    } else {
      scr.textRight('SHIFT unequip', IX + IW, TOP + BODY_H - 22, PAL.textFaint);
    }
  }

  // --- formation -------------------------------------------------------------
  drawFormation(scr) {
    scr.text('FORMATION', IX, TOP + 10, PAL.accent);
    scr.textRight('column 0 is the front rank', IX + IW, TOP + 10, PAL.textDim);
    scr.rect(IX, TOP + 22, IW, 1, PAL.line);

    const gridActive = this.formSide !== 'bench';
    const ox = IX + 30, oy = TOP + 46, cw = 56, chh = 50;
    for (let c = 0; c < 3; c++) {
      scr.textCenter(`col ${c}`, ox + c * cw + 24, oy - 12, c === 0 ? PAL.accent : PAL.textFaint);
    }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = ox + c * cw, y = oy + r * chh;
        const sel = gridActive && this.formCursor.row === r && this.formCursor.col === c;
        scr.rect(x, y, cw - 6, chh - 6, c === 0 ? 'rgba(40,58,110,0.55)'
          : c === 1 ? 'rgba(28,38,72,0.5)' : 'rgba(20,26,50,0.45)');
        scr.outline(x, y, cw - 6, chh - 6, sel ? PAL.accent : 'rgba(150,175,235,0.16)');
        const occ = this.g.party.find((ch) => ch.grid.row === r && ch.grid.col === c);
        if (occ) {
          const picked = this.formPicked === occ ? 0.45 + 0.55 * Math.abs(Math.sin(this.t * 7)) : 1;
          drawBust(scr, x + 8, y - 4, 34, 38, occ, picked);
          scr.textCenter(occ.name.slice(0, 7), x + (cw - 6) / 2, y + chh - 17, PAL.text);
        }
      }
    }

    const occ = this.g.party.find((ch) => ch.grid.row === this.formCursor.row && ch.grid.col === this.formCursor.col);
    const x = this.colX(1) + 24;
    if (occ) {
      const s = stats(occ);
      scr.text(occ.name, x, TOP + 46, PAL.accent);
      scr.rect(x, TOP + 58, CW - 16, 1, PAL.line);
      statRow(scr, 'Reach', s.reach, x, TOP + 66, CW - 16);
      statRow(scr, 'Position', `row ${occ.grid.row}, col ${occ.grid.col}`, x, TOP + 78, CW - 16);
      scr.textWrap(s.reach >= 9 ? 'Reaches any cell from anywhere. Safe at the back.'
        : s.reach === 3 ? 'Reaches one column deeper than a sword does.'
          : 'Strikes the enemy front rank only.',
        x, TOP + 96, CW - 16, PAL.textDim, { lineHeight: 11, maxLines: 3 });
    } else {
      scr.text('Empty cell', x, TOP + 46, PAL.textFaint);
    }

    // --- the bench: everyone recruited but not currently fighting ----------
    const bench = this.g.benched();
    const by = TOP + 138;
    scr.text(`BENCH (${bench.length})`, x, by, this.formSide === 'bench' ? PAL.accent : PAL.textDim);
    scr.rect(x, by + 12, CW - 16, 1, PAL.line);
    if (!bench.length) {
      scr.text('Nobody waiting.', x, by + 20, PAL.textFaint);
    } else {
      bench.slice(0, 4).forEach((ch, i) => {
        const sel = this.formSide === 'bench' && this.benchCursor === i;
        const y = by + 20 + i * 13;
        if (sel) scr.rect(x - 4, y - 2, CW - 8, 12, 'rgba(120,155,235,0.16)');
        const heldByThis = this.formPicked === ch;
        scr.text(ch.name.slice(0, 14), x, y, heldByThis ? PAL.accent : sel ? PAL.text : PAL.textDim);
      });
    }

    if (this.formPicked && !this.g.party.includes(this.formPicked)) {
      scr.textRight(`Holding ${this.formPicked.name} · Z to place`, IX + IW, TOP + BODY_H - 22, PAL.accent);
    } else {
      scr.textRight(this.formPicked ? 'Z place / swap'
        : 'Z pick · SHIFT auto · MENU bench', IX + IW, TOP + BODY_H - 22, PAL.textFaint);
    }
  }

  // --- train (Learning Points) -------------------------------------------------
  drawTrain(scr) {
    const top = this.charHeader(scr);
    const ch = this.ch;
    const s = stats(ch);
    scr.text('LEARNING POINTS', IX, top, PAL.textDim);
    scr.textRight(`${this.g.lp} LP`, IX + IW, top, PAL.cyan);
    scr.rect(IX, top + 12, IW, 1, PAL.line);
    STAT_KEYS.forEach((k, i) => {
      const y = top + 22 + i * 13;
      const sel = this.trainIdx === i;
      if (sel) scr.rect(IX - 4, y - 2, IW + 8, 12, 'rgba(120,155,235,0.16)');
      scr.text(k.toUpperCase(), IX, y, sel ? PAL.accent : PAL.textDim);
      scr.text(`${s[k]}`, IX + 60, y, PAL.text);
      scr.textRight(`${TRAIN_COST} LP`, IX + IW, y, this.g.lp >= TRAIN_COST ? PAL.cyan : PAL.textFaint);
    });
    scr.textRight('Z train · ▲▼ choose stat', IX + IW, TOP + BODY_H - 22, PAL.textFaint);
  }

  // --- jobs ------------------------------------------------------------------
  drawJobs(scr) {
    const ch = this.ch;
    const top = this.charHeader(scr);
    const job = jobInfo(ch);
    const prog = jobProgress(ch);

    let y = top;
    scr.text(job.name.toUpperCase(), this.colX(0), y, PAL.accent);
    scr.textRight(`${RANK_TITLES[job.rank - 1]}  ${job.rank}/${MAX_JOB_RANK}`,
      this.colX(0) + CW, y, PAL.cyan);
    y += 14;
    scr.bar(this.colX(0), y, CW, 5, prog.ratio, PAL.cyan); y += 11;
    scr.text(prog.next === null ? 'Mastered.' : `${prog.next} more job actions to rank ${job.rank + 1}.`,
      this.colX(0), y, PAL.textFaint);
    y += 16;
    y += scr.textWrap(job.blurb, this.colX(0), y, CW, PAL.textDim, { lineHeight: 11, maxLines: 3 }) * 11 + 8;
    scr.text('BONUS AT THIS RANK', this.colX(0), y, PAL.accent); y += 13;
    for (const [k, v] of Object.entries(job.bonus)) {
      statRow(scr, k.toUpperCase(), `+${v}`, this.colX(0), y, CW, { color: PAL.green });
      y += 11;
    }

    let ry = top;
    scr.text(`FIELD — ${job.field.name.toUpperCase()}`, this.colX(1), ry, PAL.accent); ry += 13;
    ry += scr.textWrap(job.field.text, this.colX(1), ry, CW, PAL.text, { lineHeight: 11, maxLines: 4 }) * 11 + 8;
    scr.text('PASSIVE', this.colX(1), ry, PAL.accent); ry += 13;
    ry += scr.textWrap(job.passive.text, this.colX(1), ry, CW, PAL.text, { lineHeight: 11, maxLines: 4 }) * 11 + 8;
    scr.text('RANKS UP FASTER AS', this.colX(1), ry, PAL.accent); ry += 13;
    let cx = this.colX(1);
    for (const e of job.likes) {
      const el = ELEMENT_BY_ID[e];
      scr.rect(cx, ry + 1, 3, 6, el.color);
      scr.text(el.name, cx + 6, ry, el.color);
      cx += scr.textWidth(el.name) + 18;
    }
  }

  // --- ladder ----------------------------------------------------------------
  drawLadder(scr) {
    const ch = this.ch;
    const top = this.charHeader(scr);
    const path = promotionPath(ch);
    const cls = CLASSES[ch.classId];

    scr.text('CLASS LADDER', this.colX(0), top, PAL.accent);
    scr.textRight(`${path.length} of 8 tiers`, this.colX(0) + CW, top, PAL.textFaint);
    let y = top + 14;

    // One row per tier — eight at most, so the whole ladder fits without
    // scrolling. Rejected branches are collected on the right rather than
    // interleaved, which used to collide with the names beside them.
    const rejected = [];
    path.forEach((node, i) => {
      const taken = node.id === ch.classId;
      const lv = i === 0 ? 1 : PROMOTION_LEVELS[i - 1];
      if (taken) scr.rect(this.colX(0) - 6, y - 3, CW + 12, 13, 'rgba(240,180,76,0.12)');
      scr.text(String(lv).padStart(2), this.colX(0), y, PAL.textFaint);
      scr.rect(this.colX(0) + 20, y + 3, 3, 3, taken ? PAL.accent : 'rgba(148,162,192,0.45)');
      scr.text(node.name, this.colX(0) + 30, y, taken ? PAL.accent : PAL.text);
      scr.textRight(TIER_NAME[node.tier], this.colX(0) + CW, y,
        taken ? PAL.accent : PAL.textFaint);
      y += 13;
      const next = path[i + 1];
      if (next) {
        node.promotions.map((p) => CLASSES[p])
          .filter((p) => p.id !== next.id)
          .forEach((p) => rejected.push(p.name));
      }
    });

    // what is still ahead
    let ry = top;
    scr.text('AHEAD', this.colX(1), ry, PAL.accent); ry += 14;
    if (cls.promotions.length) {
      const at = cls.promoteLevel;
      const opts = cls.promotions.map((p) => CLASSES[p]);
      const ready = ch.level >= at;
      scr.text(`LEVEL ${at}`, this.colX(1), ry, ready ? PAL.accent : PAL.textDim); ry += 12;
      for (const o of opts) {
        scr.rect(this.colX(1), ry + 2, 3, 5, PAL.cyan);
        ry += scr.textWrap(o.name, this.colX(1) + 8, ry, CW - 8, PAL.cyan,
          { lineHeight: 11, maxLines: 1 }) * 11 + 1;
      }
      ry += 4;
      scr.textWrap(ready ? 'Ready now — visit a temple.' : `Reach level ${at} to choose.`,
        this.colX(1), ry, CW, ready ? PAL.green : PAL.textFaint, { lineHeight: 10, maxLines: 2 });
      ry += 22;
      const later = PROMOTION_LEVELS.filter((l) => l > at);
      if (later.length) {
        scr.text('BRANCHES AFTER THAT', this.colX(1), ry, PAL.accent); ry += 12;
        scr.text(later.join(',  '), this.colX(1), ry, PAL.magenta);
        ry += 18;
      }
    } else {
      scr.textWrap('The summit. This class has no further promotion.',
        this.colX(1), ry, CW, PAL.magenta, { lineHeight: 10, maxLines: 2 });
      ry += 26;
    }

    if (rejected.length) {
      scr.rect(this.colX(1), ry, CW, 1, PAL.line); ry += 8;
      scr.text('PATHS NOT TAKEN', this.colX(1), ry, PAL.accent); ry += 12;
      scr.textWrap(rejected.slice(-4).join(',  '), this.colX(1), ry, CW, PAL.grey,
        { lineHeight: 10, maxLines: 3 });
    }
  }

  // --- save ------------------------------------------------------------------
  drawSave(scr) {
    scr.text('SAVE', IX, TOP + 10, PAL.accent);
    scr.rect(IX, TOP + 22, IW, 1, PAL.line);
    this.list.x = IX + 24; this.list.y = TOP + 40;
    this.list.cellW = IW - 48; this.list.rows = 3; this.list.cellH = 26;
    this.list.draw(scr);
    scr.textWrap('Saves live in this browser. Clearing site data clears them.',
      IX, TOP + BODY_H - 30, IW, PAL.textFaint, { lineHeight: 11, maxLines: 2 });
  }

  // --- controls ----------------------------------------------------------
  drawControls(scr) {
    scr.text('CONTROLS', IX, TOP + 10, PAL.accent);
    scr.rect(IX, TOP + 22, IW, 1, PAL.line);

    const row = (i, label, y) => {
      const sel = this.controlsIdx === i;
      if (sel) {
        scr.rect(IX - 4, y - 3, IW + 8, 15, 'rgba(120,155,235,0.16)');
        scr.rect(IX - 4, y - 3, 2, 15, PAL.accent);
      }
      scr.text(label, IX, y, sel ? PAL.text : PAL.textDim);
      return sel;
    };

    const mode = getTouchMode();
    row(0, 'Touch controls', TOP + 38);
    scr.textRight(TOUCH_LABEL[mode].toUpperCase(), IX + IW, TOP + 38, PAL.accent);

    row(1, 'SFX volume', TOP + 56);
    scr.bar(IX + 140, TOP + 57, IW - 140, 6, getSfxVolume(), PAL.cyan);
    scr.textRight(`${Math.round(getSfxVolume() * 100)}%`, IX + IW, TOP + 56, PAL.text);

    row(2, 'Music volume', TOP + 74);
    scr.bar(IX + 140, TOP + 75, IW - 140, 6, getMusicVolume(), PAL.cyan);
    scr.textRight(`${Math.round(getMusicVolume() * 100)}%`, IX + IW, TOP + 74, PAL.text);

    row(3, 'Mute all audio', TOP + 92);
    scr.textRight(isMuted() ? 'ON' : 'OFF', IX + IW, TOP + 92, isMuted() ? PAL.red : PAL.textDim);

    row(4, 'Battle speed', TOP + 110);
    scr.textRight(`${getBattleSpeed()}x`, IX + IW, TOP + 110, PAL.accent);

    scr.rect(IX, TOP + 126, IW, 1, PAL.line);
    const desc = {
      auto: 'Shown automatically on a touchscreen, hidden otherwise.',
      on: 'Always shown — even with a mouse or keyboard attached.',
      off: "Always hidden. Use this on a touchscreen you'd rather drive with a keyboard.",
    }[mode];
    const hint = this.controlsIdx === 0 ? desc
      : this.controlsIdx === 3 ? 'Silences sound effects and music together.'
        : this.controlsIdx === 4 ? 'Speeds up windups, strikes and message dwell time in battle. '
          + 'Shift also toggles Auto-Battle mid-fight.'
          : '◀▶ adjusts the volume.';
    scr.textWrap(hint, IX, TOP + 138, IW, PAL.textDim, { lineHeight: 11, maxLines: 3 });
    scr.textWrap('▲▼ choose a row   ·   Z toggles   ·   ◀▶ adjusts',
      IX, TOP + BODY_H - 22, IW, PAL.textFaint, { lineHeight: 11, maxLines: 2 });
  }

  // --- quest -------------------------------------------------------------
  // A read-only log: the main story's one linear next step (see
  // nextStoryHint/MAIN_QUEST in data/story.js — the world itself stays open,
  // this just always names the one thing to do if you want to follow the
  // plot) above a scrollable list of every side quest, low to high by its
  // recommended level, so "a few per 10 levels" actually reads as that.
  refreshQuest() {
    this.list.x = IX + 12; this.list.y = QUEST_LIST_Y;
    this.list.cellW = IW - 24; this.list.cellH = 13; this.list.rows = QUEST_LIST_ROWS;
    const items = [];
    let band = null;
    for (const q of questsByLevel()) {
      const b = questBand(q.level);
      if (b !== band) {
        band = b;
        items.push({ label: `— LV ${band - 9}-${band} —`, disabled: true, color: PAL.textFaint });
      }
      const state = questState(this.g, q.id);
      let note;
      if (state === 'done') note = 'Done';
      else if (state === 'active') {
        if (q.type !== 'deliver' && questReady(this.g, q.id)) note = 'Ready!';
        else if (q.type === 'deliver') note = 'Carrying it';
        else { const p = questProgress(this.g, q.id); note = `${p.have}/${p.need}`; }
      } else note = `Lv ${q.level}`;
      items.push({
        label: q.title, note, q, state,
        color: state === 'done' ? PAL.textFaint : PAL.text,
        noteColor: state === 'done' ? PAL.textFaint : state === 'active' ? PAL.accent : PAL.textDim,
      });
    }
    this.list.setItems(items, true);
  }

  updateQuest(input) { this.list.handle(input); }

  drawQuest(scr) {
    scr.text('QUEST', IX, TOP + 10, PAL.accent);
    scr.rect(IX, TOP + 22, IW, 1, PAL.line);

    scr.text('MAIN STORY', IX, TOP + 34, PAL.textFaint);
    const step = nextStoryHint(this.g);
    if (step) {
      scr.textRight(`Lv ${step.level}  ·  ${step.region}`, IX + IW, TOP + 34, PAL.accentDim);
      scr.textWrap(step.hint, IX, TOP + 46, IW, PAL.text, { lineHeight: 11, maxLines: 2 });
    } else {
      scr.textWrap("The wheel is quiet. There's nothing left it's asking of you.",
        IX, TOP + 46, IW, PAL.text, { lineHeight: 11, maxLines: 2 });
    }

    scr.rect(IX, TOP + 70, IW, 1, PAL.line);
    const done = questsByLevel().filter((q) => questState(this.g, q.id) === 'done').length;
    scr.text('SIDE QUESTS', IX, TOP + 82, PAL.textFaint);
    scr.textRight(`${done}/${questsByLevel().length} done`, IX + IW, TOP + 82, PAL.textFaint);

    this.list.draw(scr);
    const sel = this.list.current;
    if (sel?.q) {
      const line = sel.state === 'done' ? sel.q.turnIn
        : sel.state === 'active' ? sel.q.reminder
          : `${sel.q.npc}: "${sel.q.hook}"`;
      scr.textWrap(line, IX, TOP + BODY_H - 22, IW, PAL.textDim, { lineHeight: 11, maxLines: 2 });
    }
  }

  // --- craft -------------------------------------------------------------
  // The Forge: spend gold plus specific monster-drop materials for an item
  // that exists nowhere else (see data/recipes.js) — a use for materials the
  // side quests don't already want, and an alternative to grinding gold.
  refreshCraft() {
    this.list.x = this.colX(0) + 12; this.list.y = CRAFT_LIST_Y;
    this.list.cellW = CW - 8; this.list.cellH = 13; this.list.rows = CRAFT_LIST_ROWS;
    this.list.setItems(RECIPES.map((r) => {
      const ok = canCraft(this.g, r);
      return {
        label: getItem(r.itemId).name, note: ok ? 'Ready' : `${r.gold}g`, r,
        color: ok ? PAL.text : PAL.textDim, noteColor: ok ? PAL.accent : PAL.textFaint,
      };
    }), true);
  }

  updateCraft(input) {
    this.list.handle(input);
    if (input.tap('confirm') && this.list.current?.r) {
      const r = this.list.current.r;
      if (!canCraft(this.g, r)) { sfx.error(); return; }
      craft(this.g, r);
      sfx.confirm();
      this.say(`Forged ${getItem(r.itemId).name}.`);
      this.refreshCraft();
    }
  }

  drawCraft(scr) {
    scr.text('CRAFT', IX, TOP + 10, PAL.accent);
    scr.rect(IX, TOP + 22, IW, 1, PAL.line);
    this.list.draw(scr);

    const r = this.list.current?.r;
    if (!r) return;
    const it = getItem(r.itemId);
    const rx = this.colX(1);
    let ry = CRAFT_LIST_Y;
    scr.text(it.name, rx, ry, PAL.accent); ry += 14;
    const kindLine = it.kind === 'weapon' ? `${WEAPON_TYPES[it.wtype].name}  ·  ${it.atk} ATK`
      : `${it.slot === 'accessory' ? 'Accessory' : `${ARMOR_CLASSES[it.aclass]?.name ?? ''} armour`}  ·  ${it.def ?? 0} DEF`;
    scr.text(kindLine, rx, ry, PAL.textDim); ry += 12;
    if (it.element && it.element !== 'none') { scr.text(`Element: ${ELEMENT_BY_ID[it.element].name}`, rx, ry, ELEMENT_BY_ID[it.element].color); ry += 12; }
    if (it.bonus) {
      const line = Object.entries(it.bonus).map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`).join('  ');
      ry += scr.textWrap(line, rx, ry, CW, PAL.cyan, { lineHeight: 11, maxLines: 2 }) * 11 + 4;
    }
    ry += 6;
    scr.rect(rx, ry, CW, 1, PAL.line); ry += 12;

    const goldOk = this.g.gold >= r.gold;
    scr.text('Gold', rx, ry, PAL.textDim);
    scr.textRight(`${this.g.gold} / ${r.gold}`, rx + CW, ry, goldOk ? PAL.green : PAL.red);
    ry += 14;
    for (const m of r.materials) {
      const have = this.g.countItem(m.id);
      const ok = have >= m.count;
      scr.text(getItem(m.id).name, rx, ry, PAL.textDim);
      scr.textRight(`${have} / ${m.count}`, rx + CW, ry, ok ? PAL.green : PAL.red);
      ry += 14;
    }
    scr.textWrap(canCraft(this.g, r) ? 'Z forges it.' : 'Short on gold or materials.',
      rx, TOP + BODY_H - 22, CW, PAL.textFaint, { lineHeight: 11, maxLines: 2 });
  }

  // --- atlas -----------------------------------------------------------------
  // Every region worth traveling to (see data/maps.js's REGIONS), named once
  // the field scene has actually entered it — the main story's next stop
  // (see the Quest page's own hint) is named too even unvisited, since the
  // hint's own prose already says where it is; every other unvisited region
  // stays "???", the same restraint the Bestiary and Quest pages use.
  refreshAtlas() {
    this.list.x = IX + 12; this.list.y = ATLAS_LIST_Y;
    this.list.cellW = IW - 24; this.list.cellH = 13; this.list.rows = ATLAS_LIST_ROWS;
    const step = nextStoryHint(this.g);
    this.list.setItems(REGIONS.map((id) => {
      const m = MAPS[id];
      const visited = !!this.g.visitedMaps[id];
      const isNext = step?.mapId === id;
      return {
        label: visited || isNext ? m.name : '???',
        note: isNext ? 'Next' : visited ? 'Visited' : '',
        id, visited, isNext,
        color: isNext ? PAL.accent : visited ? PAL.text : PAL.textFaint,
        noteColor: isNext ? PAL.accent : PAL.textDim,
      };
    }), true);
  }

  updateAtlas(input) { this.list.handle(input); }

  drawAtlas(scr) {
    scr.text('ATLAS', IX, TOP + 10, PAL.accent);
    const found = REGIONS.filter((id) => this.g.visitedMaps[id]).length;
    scr.textRight(`${found}/${REGIONS.length} found`, IX + IW, TOP + 10, PAL.textFaint);
    scr.rect(IX, TOP + 22, IW, 1, PAL.line);

    this.list.draw(scr);
    const sel = this.list.current;
    if (sel?.isNext) {
      scr.textWrap('The main story\'s next stop.', IX, TOP + BODY_H - 22, IW, PAL.accentDim,
        { lineHeight: 11, maxLines: 2 });
    } else if (sel?.visited === false) {
      scr.textWrap("Not yet on the map.", IX, TOP + BODY_H - 22, IW, PAL.textFaint,
        { lineHeight: 11, maxLines: 2 });
    }
  }

  // --- bestiary ------------------------------------------------------------
  // Every enemy the bestiary has ever counted a kill for (see battle.js's
  // victory handling) shows its real name, family, element and blurb; every
  // other enemy shows only its level, as "???" — a reason to fight something
  // new rather than a spoiler for it.
  refreshBestiary() {
    this.list.x = IX + 12; this.list.y = BESTIARY_LIST_Y;
    this.list.cellW = IW - 24; this.list.cellH = 13; this.list.rows = BESTIARY_LIST_ROWS;
    const sorted = [...ENEMIES].sort((a, b) => a.lv - b.lv);
    this.list.setItems(sorted.map((e) => {
      const count = this.g.bestiary[e.id] ?? 0;
      const seen = count > 0;
      return {
        label: seen ? e.name : '???',
        note: seen ? `x${count}` : `Lv ${e.lv}`,
        e, seen,
        color: !seen ? PAL.textFaint : e.ai === 'boss' ? PAL.gold : PAL.text,
        noteColor: seen ? PAL.textDim : PAL.textFaint,
      };
    }), true);
  }

  updateBestiary(input) { this.list.handle(input); }

  drawBestiary(scr) {
    scr.text('BESTIARY', IX, TOP + 10, PAL.accent);
    const seenCount = ENEMIES.filter((e) => (this.g.bestiary[e.id] ?? 0) > 0).length;
    scr.textRight(`${seenCount}/${ENEMIES.length} discovered`, IX + IW, TOP + 10, PAL.textFaint);
    scr.rect(IX, TOP + 22, IW, 1, PAL.line);

    this.list.draw(scr);
    const sel = this.list.current;
    if (sel?.seen) {
      const e = sel.e;
      const el = ELEMENT_BY_ID[e.element];
      scr.text(`Lv ${e.lv}   ${FAMILIES[e.family].name}   ${el.name}`, IX, TOP + BODY_H - 34, PAL.textDim);
      if (e.blurb) scr.textWrap(e.blurb, IX, TOP + BODY_H - 22, IW, PAL.text, { lineHeight: 11, maxLines: 2 });
    } else if (sel) {
      scr.textWrap('Not yet encountered.', IX, TOP + BODY_H - 22, IW, PAL.textFaint, { lineHeight: 11, maxLines: 2 });
    }
  }

  // --- trophies --------------------------------------------------------------
  // Every entry is derived straight from flags/bestiary/roster/gold GameState
  // already tracks (see data/achievements.js) — nothing here is itself saved.
  refreshTrophies() {
    this.list.x = IX + 12; this.list.y = TROPHY_LIST_Y;
    this.list.cellW = IW - 24; this.list.cellH = 13; this.list.rows = TROPHY_LIST_ROWS;
    this.list.setItems(ACHIEVEMENTS.map((a) => {
      const done = a.check(this.g);
      return {
        label: a.name, note: done ? 'Done' : '', a, done,
        color: done ? PAL.gold : PAL.textFaint,
      };
    }), true);
  }

  updateTrophies(input) { this.list.handle(input); }

  drawTrophies(scr) {
    scr.text('TROPHIES', IX, TOP + 10, PAL.accent);
    const done = ACHIEVEMENTS.filter((a) => a.check(this.g)).length;
    scr.textRight(`${done}/${ACHIEVEMENTS.length} earned`, IX + IW, TOP + 10, PAL.textFaint);
    scr.rect(IX, TOP + 22, IW, 1, PAL.line);

    this.list.draw(scr);
    const sel = this.list.current;
    if (sel?.a) {
      scr.textWrap(sel.a.desc, IX, TOP + BODY_H - 22, IW, sel.done ? PAL.textDim : PAL.textFaint,
        { lineHeight: 11, maxLines: 2 });
    }
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
