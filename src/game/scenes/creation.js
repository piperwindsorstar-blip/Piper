// ============================================================================
//  PARTY CREATION — name, race, class, element and job for up to four members.
//
//  Five choices, each paired with a detail panel, because a list of twelve
//  names tells you nothing about what you are picking. The class panel draws
//  the whole promotion ladder including all five branch points; the race panel
//  spells out growth, resistances and traits; the element panel shows that
//  element's position on the wheel; the job panel names the field ability you
//  are actually buying.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu, header } from '../../engine/ui.js';
import { ROOT_CLASSES, CLASSES, STAT_KEYS, PROMOTION_LEVELS } from '../../data/classes.js';
import { ELEMENTS, ELEMENT_BY_ID } from '../../data/elements.js';
import { JOBS, JOB_BY_ID } from '../../data/jobs.js';
import { RACES, RACE_BY_ID } from '../../data/races.js';
import { SCHOOLS } from '../../data/skills.js';
import { actorSprite } from '../../engine/sprites.js';
import { GameState, MAX_PARTY } from '../state.js';

const NAME_ROWS = [
  'ABCDEFGHIJKLM',
  'NOPQRSTUVWXYZ',
  'abcdefghijklm',
  'nopqrstuvwxyz',
  "0123456789.-' ",
];
const NAME_POOL = [
  'Piper', 'Bram', 'Iris', 'Sela', 'Corvin', 'Mira', 'Toval', 'Elka', 'Rhys', 'Nara',
  'Osric', 'Wynn', 'Dara', 'Kell', 'Ivo', 'Sable', 'Fen', 'Marek', 'Thea', 'Juno',
];

const STAGES = ['name', 'race', 'class', 'element', 'job'];
const STAGE_LABEL = { name: 'NAME', race: 'RACE', class: 'CLASS', element: 'ELEMENT', job: 'JOB' };

// Layout: a list column on the left, a two-column detail panel on the right,
// and a portrait strip along the bottom. The detail panels carry a lot of
// numbers, and a single column cannot hold them without overflowing.
const LX = 20, LW = 140;              // list panel
const PX = 178, PW = W - PX - 18;     // detail panel inner width
const CW = Math.floor((PW - 14) / 2); // detail column width
const PANEL_Y = 38;
const STRIP_H = 40;
const PANEL_H = H - PANEL_Y - STRIP_H - 16;

export class CreationScene {
  constructor(app) { this.app = app; }

  enter() {
    this.slots = [null, null, null, null];
    this.slot = 0;
    this.stage = 'name';
    this.t = 0;
    this.draft = this.blankDraft();
    this.namePos = { r: 0, c: 0 };
    this.buildMenus();
    this.mode = 'edit';
  }

  blankDraft() {
    return {
      name: '', raceId: 'human', classId: 'warrior', elementId: 'fire',
      jobId: 'blacksmith', skin: 0, hair: 0,
    };
  }

  buildMenus() {
    const list = (items) => new Menu({ items, x: LX + 18, y: PANEL_Y + 14, cellW: LW - 30, cellH: 12, rows: 13 });
    this.raceMenu = list(RACES.map((r) => ({ label: r.name, id: r.id })));
    this.classMenu = list(ROOT_CLASSES.map((c) => ({ label: c.name, id: c.id })));
    this.elemMenu = list(ELEMENTS.map((e) => ({ label: e.name, id: e.id, color: e.color })));
    // Twenty jobs in two columns put "Cartographer" on top of "Locksmith" —
    // the list column is not wide enough to halve. One scrolling column instead.
    this.jobMenu = list(JOBS.map((j) => ({ label: j.name, id: j.id })));
    this.rosterMenu = new Menu({ items: [], x: 56, y: 60, cellW: W - 112, cellH: 30, rows: 6 });
  }

  refreshRoster() {
    const items = this.slots.map((s, i) => {
      if (!s) return { label: `${i + 1}.   — empty slot —`, slotIndex: i, color: PAL.textFaint };
      const cls = CLASSES[s.classId], el = ELEMENT_BY_ID[s.elementId];
      const job = JOB_BY_ID[s.jobId], race = RACE_BY_ID[s.raceId];
      return {
        label: `${i + 1}.   ${s.name}`,
        note: `${race.name} ${cls.name}  ·  ${el.name}  ·  ${job.name}`,
        slotIndex: i, color: PAL.text, noteColor: el.color,
      };
    });
    const filled = this.slots.filter(Boolean).length;
    items.push({ label: 'BEGIN THE QUEST', begin: true, disabled: filled === 0, color: PAL.accent });
    items.push({ label: 'BACK TO TITLE', quit: true, color: PAL.textDim });
    this.rosterMenu.setItems(items, true);
  }

  menuFor(stage) {
    return { race: this.raceMenu, class: this.classMenu, element: this.elemMenu, job: this.jobMenu }[stage];
  }

  keyFor(stage) {
    return { race: 'raceId', class: 'classId', element: 'elementId', job: 'jobId' }[stage];
  }

  // --- flow ------------------------------------------------------------------
  nextStage() {
    const i = STAGES.indexOf(this.stage);
    if (i < STAGES.length - 1) { this.stage = STAGES[i + 1]; this.syncMenu(); return; }
    this.slots[this.slot] = { ...this.draft };
    const nextEmpty = this.slots.findIndex((s) => !s);
    if (nextEmpty >= 0 && this.slots.filter(Boolean).length < MAX_PARTY) {
      this.slot = nextEmpty;
      this.draft = this.blankDraft();
      this.stage = 'name';
      this.syncMenu();
    } else {
      this.mode = 'roster';
      this.refreshRoster();
    }
  }

  prevStage() {
    const i = STAGES.indexOf(this.stage);
    if (i > 0) { this.stage = STAGES[i - 1]; this.syncMenu(); return; }
    if (this.slots.some(Boolean)) { this.mode = 'roster'; this.refreshRoster(); }
    else this.app.pop();
  }

  /** Point the current stage's menu at whatever the draft already holds. */
  syncMenu() {
    const m = this.menuFor(this.stage);
    const key = this.keyFor(this.stage);
    if (!m || !key) return;
    const i = m.items.findIndex((it) => it.id === this.draft[key]);
    if (i >= 0) { m.index = i; m.clamp(); }
  }

  editSlot(i) {
    this.slot = i;
    this.draft = this.slots[i] ? { ...this.slots[i] } : this.blankDraft();
    this.stage = 'name';
    this.mode = 'edit';
    this.syncMenu();
  }

  begin() {
    const g = new GameState();
    for (const s of this.slots) if (s) g.addMember(s);
    g.gold = 300;
    g.addItem('potion', 5);
    g.addItem('antidote', 2);
    g.addItem('tent', 1);
    for (const ch of g.party) {
      const cls = CLASSES[ch.classId];
      const starter = {
        sword: 'bronzesword', axe: 'handaxe', mace: 'club', dagger: 'bronzedagger',
        fist: 'wraps', spear: 'shortspear', whip: 'leatherwhip', bow: 'shortbow', staff: 'oakstaff',
      }[cls.weapons[0]];
      if (starter) ch.equip.weapon = starter;
      ch.equip.body = cls.armor.includes('heavy') || cls.armor.includes('medium')
        ? 'leatherarmor' : 'clothrobe';
    }
    g.autoFormation();
    g.restParty();
    this.app.game = g;
    this.app.replace('field');
  }

  // --- update ----------------------------------------------------------------
  update(dt, input) {
    this.t += dt;
    for (const m of [this.raceMenu, this.classMenu, this.elemMenu, this.jobMenu, this.rosterMenu]) m.update(dt);
    if (this.mode === 'roster') return this.updateRoster(input);
    if (this.stage === 'name') return this.updateName(input);
    return this.updateList(input, this.menuFor(this.stage), this.keyFor(this.stage));
  }

  updateRoster(input) {
    this.rosterMenu.handle(input);
    if (input.tap('cancel')) { this.app.pop(); return; }
    if (input.tap('confirm')) {
      const cur = this.rosterMenu.current;
      if (cur.disabled) return;
      if (cur.begin) this.begin();
      else if (cur.quit) this.app.pop();
      else this.editSlot(cur.slotIndex);
    }
  }

  updateName(input) {
    const d = input.dir();
    if (d.y) this.namePos.r = (this.namePos.r + d.y + NAME_ROWS.length) % NAME_ROWS.length;
    if (d.x) {
      const row = NAME_ROWS[this.namePos.r];
      this.namePos.c = (this.namePos.c + d.x + row.length) % row.length;
    }
    this.namePos.c = Math.min(this.namePos.c, NAME_ROWS[this.namePos.r].length - 1);
    if (input.tap('confirm')) {
      const ch = NAME_ROWS[this.namePos.r][this.namePos.c];
      if (this.draft.name.length < 10) this.draft.name += ch;
    }
    if (input.tap('cancel')) {
      if (this.draft.name.length) this.draft.name = this.draft.name.slice(0, -1);
      else this.prevStage();
    }
    if (input.tap('shift')) {
      this.draft.name = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
      this.draft.skin = Math.floor(Math.random() * 4);
      this.draft.hair = Math.floor(Math.random() * 5);
    }
    if (input.tap('menu') && this.draft.name.trim().length) this.nextStage();
  }

  updateList(input, menu, key) {
    menu.handle(input);
    this.draft[key] = menu.current.id;
    if (input.tap('confirm')) this.nextStage();
    if (input.tap('cancel')) this.prevStage();
  }

  // --- draw ------------------------------------------------------------------
  draw(scr) {
    scr.setGrade('#6a86d0', 0.10);
    scr.bloom = 0.4;
    scr.vignette = 0.55;
    scr.clear('#080b14');
    // a slow diagonal weave behind the panels
    for (let y = 0; y < H; y += 3) scr.rect(0, y, W, 1, 'rgba(255,255,255,0.012)');
    scr.light(W * 0.2, -40, 260, 'rgba(90,130,255,0.30)', 0.5);
    scr.light(W * 0.85, H + 30, 220, 'rgba(240,140,80,0.20)', 0.4);

    if (this.mode === 'roster') return this.drawRoster(scr);

    const step = STAGES.indexOf(this.stage) + 1;
    header(scr, `MEMBER ${this.slot + 1}   ·   ${STAGE_LABEL[this.stage]}`, `STEP ${step} OF ${STAGES.length}`);
    this.drawStepDots(scr);

    if (this.stage === 'name') return this.drawName(scr);

    // list column
    scr.panel(LX, PANEL_Y, LW, PANEL_H, { accent: true });
    this.menuFor(this.stage).draw(scr);

    switch (this.stage) {
      case 'race': this.drawRace(scr); break;
      case 'class': this.drawClass(scr); break;
      case 'element': this.drawElement(scr); break;
      case 'job': this.drawJob(scr); break;
      default: break;
    }
    this.drawPortrait(scr);
  }

  drawStepDots(scr) {
    const at = STAGES.indexOf(this.stage);
    STAGES.forEach((_, i) => {
      const x = W / 2 - (STAGES.length * 12) / 2 + i * 12;
      scr.rect(x, 30, 8, 2, i <= at ? PAL.accent : 'rgba(148,162,192,0.28)');
    });
  }

  /** The live draft, as a strip along the bottom of the screen. */
  drawPortrait(scr) {
    const y = H - STRIP_H - 8;
    scr.panel(LX, y, W - LX * 2, STRIP_H, { alpha: 0.98 });
    const el = ELEMENT_BY_ID[this.draft.elementId];
    const race = RACE_BY_ID[this.draft.raceId];
    const cls = CLASSES[this.draft.classId];
    const job = JOB_BY_ID[this.draft.jobId];
    const cv = actorSprite({
      classId: this.draft.classId, raceId: this.draft.raceId,
      elementId: this.draft.elementId, skin: this.draft.skin, hair: this.draft.hair,
      frame: Math.floor(this.t * 3) % 2,
    });
    scr.light(LX + 28, y + 24, 30, el.color, 0.18);
    scr.ctx.drawImage(cv, LX + 10, y - 6);
    // Five labelled fields plus a control hint, in a strip that a long draft
    // (Lizardfolk Spiritist, Provisioner) can fill on its own — so measure
    // first, tighten the gaps if it is close, and drop the hint if it is not.
    const fields = [
      ['NAME', this.draft.name || '???', PAL.accent],
      ['RACE', race.name, PAL.text],
      ['CLASS', cls.name, PAL.text],
      ['ELEMENT', el.name, el.color],
      ['JOB', job.name, PAL.text],
    ];
    const x0 = LX + 56, right = W - LX - 12;
    const widths = fields.map(([l, v]) => Math.max(scr.textWidth(v), scr.textWidth(l)));
    const span = (gap) => widths.reduce((a, w) => a + w + gap, 0) - gap;
    const hint = 'Z accept   ·   X back';
    const hintW = scr.textWidth(hint) + 16;
    const gap = x0 + span(20) <= right - hintW ? 20 : 12;
    const showHint = x0 + span(gap) <= right - hintW;
    let x = x0;
    fields.forEach(([label, value, color], i) => {
      scr.text(label, x, y + 8, PAL.textFaint);
      scr.text(value, x, y + 21, color);
      x += widths[i] + gap;
    });
    if (showHint) scr.textRight(hint, right, y + 21, PAL.textFaint);
  }

  panel(scr, title, right = null) {
    scr.panel(PX - 12, PANEL_Y, PW + 24, PANEL_H, { accent: true, accentWidth: 26 });
    scr.text(title, PX, PANEL_Y + 10, PAL.accent);
    if (right) scr.textRight(right, PX + PW, PANEL_Y + 10, PAL.textDim);
    scr.rect(PX, PANEL_Y + 21, PW, 1, PAL.line);
    // a vertical rule between the two content columns
    scr.rect(PX + CW + 7, PANEL_Y + 26, 1, PANEL_H - 34, 'rgba(150,175,235,0.10)');
    return PANEL_Y + 28;
  }

  colX(i) { return PX + i * (CW + 14); }

  /** Section label in a column; returns the y below it. */
  sect(scr, label, col, y, gap = 12) {
    scr.text(label, this.colX(col), y, PAL.accent);
    return y + gap;
  }

  para(scr, text, col, y, color, opts = {}) {
    const lh = opts.lineHeight ?? 11;
    return y + scr.textWrap(text, this.colX(col), y, CW, color, { ...opts, lineHeight: lh }) * lh + (opts.gap ?? 4);
  }

  /** A label/value list inside one column. */
  rows(scr, col, y, entries, colorFor) {
    const x = this.colX(col);
    entries.forEach(([k, v], i) => {
      const cy = y + i * 11;
      scr.text(k, x, cy, PAL.textDim);
      scr.textRight(String(v), x + CW, cy, colorFor ? colorFor(v) : PAL.text);
    });
    return y + entries.length * 11 + 5;
  }

  /** A label/value list folded into two half-width sub-columns. */
  rowsSplit(scr, col, y, entries) {
    const x = this.colX(col), half = Math.floor((CW - 12) / 2);
    const n = Math.ceil(entries.length / 2);
    entries.forEach(([k, v], i) => {
      const cx = x + (i < n ? 0 : half + 12), cy = y + (i % n) * 11;
      scr.text(k, cx, cy, PAL.textDim);
      scr.textRight(String(v), cx + half, cy, PAL.text);
    });
    return y + n * 11 + 5;
  }

  /**
   * A race's whole stat contribution in one table: the flat modifier applied at
   * creation, and the growth multiplier applied at every level-up. Two separate
   * lists overflowed the panel — eight stats twice over is more rows than the
   * column has — and the pairing is what a player actually wants to compare.
   */
  statTable(scr, col, y, race) {
    const x = this.colX(col);
    const c1 = x + CW - 46, c2 = x + CW;
    scr.textRight('MOD', c1, y, PAL.textFaint);
    scr.textRight('/LV', c2, y, PAL.textFaint);
    y += 12;
    for (const k of STAT_KEYS) {
      const m = race.mod[k] ?? 0;
      const g = Math.round(((race.growth[k] ?? 1) - 1) * 100);
      scr.text(k.toUpperCase(), x, y, PAL.textDim);
      if (m) scr.textRight(m > 0 ? `+${m}` : `${m}`, c1, y, m > 0 ? PAL.green : PAL.red);
      else scr.textRight('·', c1, y, PAL.textFaint);
      if (g) scr.textRight(`${g > 0 ? '+' : ''}${g}%`, c2, y, g > 0 ? PAL.green : PAL.red);
      else scr.textRight('·', c2, y, PAL.textFaint);
      y += 11;
    }
    return y + 5;
  }

  /** How many `lh`-tall lines are still inside the detail panel below `y`. */
  room(y, lh = 11) { return Math.max(1, Math.floor((PANEL_Y + PANEL_H - 8 - y) / lh)); }

  /** Element chips, wrapped inside one column. */
  chips(scr, col, y, ids, color) {
    let cx = this.colX(col);
    const x0 = cx;
    for (const id of ids) {
      const e = ELEMENT_BY_ID[id];
      const wdt = scr.textWidth(e.name) + 8;
      if (cx + wdt > x0 + CW) { cx = x0; y += 11; }
      scr.rect(cx, y + 1, 3, 6, e.color);
      scr.text(e.name, cx + 6, y, color ?? e.color);
      cx += wdt + 6;
    }
    return y + 15;
  }

  // --- panels ----------------------------------------------------------------
  drawName(scr) {
    scr.panel(LX, PANEL_Y, W - LX * 2, 52, { accent: true });
    scr.text('NAME', LX + 16, PANEL_Y + 10, PAL.accent);
    const name = this.draft.name || '';
    scr.text(name, LX + 16, PANEL_Y + 24, PAL.text, { size: 16 });
    if (Math.floor(this.t * 2) % 2 === 0 && name.length < 10) {
      scr.rect(LX + 16 + scr.textWidth(name, 16), PANEL_Y + 24, 8, 14, PAL.accent);
    }
    const cv = actorSprite({
      classId: this.draft.classId, raceId: this.draft.raceId, elementId: this.draft.elementId,
      skin: this.draft.skin, hair: this.draft.hair, frame: Math.floor(this.t * 3) % 2,
    });
    scr.ctx.drawImage(cv, W - LX - 60, PANEL_Y + 4, cv.width * 1.0, cv.height * 1.0);

    const gy = PANEL_Y + 64;
    scr.panel(LX, gy, W - LX * 2, 108, { accent: true });
    NAME_ROWS.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const sel = r === this.namePos.r && c === this.namePos.c;
        const x = LX + 22 + c * 30, y = gy + 14 + r * 18;
        if (sel) {
          scr.rect(x - 7, y - 4, 22, 16, 'rgba(120,155,235,0.24)');
          scr.rect(x - 7, y - 4, 2, 16, PAL.accent);
        }
        scr.text(row[c], x, y, sel ? PAL.white : PAL.text, { size: 12 });
      }
    });

    scr.panel(LX, H - 58, W - LX * 2, 34);
    scr.text('Z  add letter', LX + 16, H - 48, PAL.textDim);
    scr.text('X  backspace', LX + 130, H - 48, PAL.textDim);
    scr.text('SHIFT  random', LX + 244, H - 48, PAL.textDim);
    const ok = this.draft.name.trim().length > 0;
    // right-aligned: the prompt is longer than the hint and overran the panel
    scr.textRight(ok ? 'TAB  continue →' : 'Give this one a name.',
      W - LX - 16, H - 48, ok ? PAL.accent : PAL.grey);
  }

  drawRace(scr) {
    const race = RACE_BY_ID[this.draft.raceId];
    const top = this.panel(scr, race.name.toUpperCase(), race.plural);

    // left: what it does to the sheet
    let y = this.para(scr, race.blurb, 0, top, PAL.textDim, { maxLines: 3, gap: 6 });
    y = this.sect(scr, 'MODIFIER / GROWTH', 0, y);
    this.statTable(scr, 0, y, race);

    // right: how it behaves
    let ry = top;
    const res = Object.entries(race.resist);
    if (res.length) {
      // wrapped chips rather than a row each: four resistances plus two traits
      // do not both fit in this column as lists, and the traits are the part
      // worth reading in full.
      ry = this.sect(scr, 'ELEMENTAL', 1, ry, 10);
      let cx = this.colX(1);
      const x0 = cx;
      for (const [e, m] of res) {
        const el = ELEMENT_BY_ID[e];
        const pct = `${Math.round(m * 100)}%`;
        const wdt = scr.textWidth(`${el.name} ${pct}`) + 8;
        if (cx + wdt > x0 + CW) { cx = x0; ry += 10; }
        scr.rect(cx, ry + 1, 3, 6, el.color);
        scr.text(el.name, cx + 6, ry, PAL.textDim);
        scr.text(pct, cx + 6 + scr.textWidth(`${el.name} `), ry, m < 1 ? PAL.green : PAL.red);
        cx += wdt + 6;
      }
      ry += 11;
    }
    for (const t of race.traits) {
      ry = this.sect(scr, t.name.toUpperCase(), 1, ry, 10);
      ry = this.para(scr, t.text, 1, ry, PAL.text,
        { maxLines: Math.min(5, this.room(ry, 10)), gap: 5, lineHeight: 10 });
    }
  }

  drawClass(scr) {
    const cls = CLASSES[this.draft.classId];
    const top = this.panel(scr, cls.name.toUpperCase(), cls.role);

    let y = this.para(scr, cls.blurb, 0, top, PAL.textDim, { maxLines: 3, gap: 6 });
    y = this.sect(scr, 'GROWTH / LEVEL', 0, y);
    // eight stats stacked pushed SCHOOLS out through the bottom of the panel
    y = this.rowsSplit(scr, 0, y,
      STAT_KEYS.map((k) => [k.toUpperCase(), cls.growth[k].toFixed(1)]));
    y = this.sect(scr, 'SCHOOLS', 0, y);
    this.para(scr, cls.schools.map((k) => SCHOOLS[k].name).join(', '), 0, y, PAL.cyan,
      { maxLines: Math.min(3, this.room(y)) });

    let ry = this.sect(scr, 'PROMOTION LADDER', 1, top);
    const t1 = CLASSES[cls.promotions[0]];
    const [a, b] = t1.promotions.map((q) => CLASSES[q]);
    const x = this.colX(1);
    const row = (lv, text, color, branch) => {
      scr.text(String(lv), x, ry, PAL.textFaint);
      scr.rect(x + 18, ry + 3, 3, 3, branch ? PAL.accent : 'rgba(148,162,192,0.4)');
      ry += scr.textWrap(text, x + 26, ry, CW - 26, color, { lineHeight: 10, maxLines: 2 }) * 10 + 1;
    };
    row(5, t1.name, PAL.text, false);
    row(10, `${a.name} / ${b.name}`, PAL.cyan, true);
    row(20, 'four Masteries', PAL.cyan, true);
    row(40, 'Ascendant — a ring of four', PAL.magenta, true);
    row(60, 'Exalted — Transcendent Arts', PAL.magenta, true);
    row(80, 'Mythic — the Apex school', PAL.magenta, true);
    ry += 4;
    scr.text('·  = a choice of two', x, ry, PAL.textFaint);
  }

  drawElement(scr) {
    const el = ELEMENT_BY_ID[this.draft.elementId];
    const top = this.panel(scr, el.name.toUpperCase(), el.rune);
    scr.rect(PX, top, PW, 4, el.color);
    scr.rect(PX, top, PW / 3, 4, el.color2);

    let y = top + 10;
    y = this.para(scr, el.blurb, 0, y, PAL.textDim, { maxLines: 3, gap: 6 });
    scr.textWrap(el.group === 'prime' ? 'PRIME — one of the nine on the wheel'
      : 'ARCANE — one of the four beside it', this.colX(0), y, CW,
      el.group === 'prime' ? PAL.cyan : PAL.magenta, { lineHeight: 11, maxLines: 2 });
    y += 26;
    y = this.sect(scr, 'BIAS', 0, y);
    this.rows(scr, 0, y,
      Object.entries(el.bias).map(([k, v]) => [k.toUpperCase(), v > 0 ? `+${v}` : `${v}`]),
      (v) => (String(v).startsWith('+') ? PAL.green : PAL.red));

    let ry = top + 10;
    ry = this.sect(scr, 'STRONG AGAINST', 1, ry);
    ry = this.chips(scr, 1, ry, el.strongAgainst, PAL.green);
    ry = this.sect(scr, 'WEAK AGAINST', 1, ry);
    ry = this.chips(scr, 1, ry, el.weakAgainst, PAL.red);
    ry = this.sect(scr, `PERK — ${el.perk.toUpperCase()}`, 1, ry);
    this.para(scr, el.perkText, 1, ry, PAL.text, { maxLines: 5 });
  }

  drawJob(scr) {
    const job = JOB_BY_ID[this.draft.jobId];
    const top = this.panel(scr, job.name.toUpperCase());

    let y = this.para(scr, job.blurb, 0, top, PAL.textDim, { maxLines: 3, gap: 6 });
    y = this.sect(scr, 'BONUS AT RANK 1', 0, y);
    y = this.rows(scr, 0, y,
      Object.entries(job.bonus).map(([k, v]) => [k.toUpperCase(), `+${v}`]), () => PAL.green);
    y = this.sect(scr, 'RANKS UP FASTER AS', 0, y);
    this.chips(scr, 0, y, job.likes);

    let ry = this.sect(scr, `FIELD — ${job.field.name.toUpperCase()}`, 1, top);
    ry = this.para(scr, job.field.text, 1, ry, PAL.text, { maxLines: 5, gap: 6 });
    ry = this.sect(scr, 'PASSIVE', 1, ry);
    this.para(scr, job.passive.text, 1, ry, PAL.text, { maxLines: 5 });
  }

  drawRoster(scr) {
    header(scr, 'YOUR PARTY', `${this.slots.filter(Boolean).length} / ${MAX_PARTY}`);
    scr.panel(40, 46, W - 80, 132, { accent: true });
    this.rosterMenu.x = 62; this.rosterMenu.y = 58;
    this.rosterMenu.cellW = W - 124; this.rosterMenu.cellH = 20; this.rosterMenu.rows = 6;
    this.rosterMenu.draw(scr);

    scr.panel(40, 186, W - 80, 60);
    this.slots.forEach((s, i) => {
      if (!s) return;
      const x = 66 + i * 106;
      const cv = actorSprite({
        classId: s.classId, raceId: s.raceId, elementId: s.elementId,
        skin: s.skin, hair: s.hair, frame: Math.floor(this.t * 3 + i) % 2,
      });
      const el = ELEMENT_BY_ID[s.elementId];
      scr.light(x + 18, 218, 30, el.color, 0.14);
      scr.ctx.drawImage(cv, x, 194);
      scr.text(s.name.slice(0, 9), x + 40, 200, PAL.text);
      scr.text(RACE_BY_ID[s.raceId].name, x + 40, 212, PAL.textDim);
      scr.text(CLASSES[s.classId].name, x + 40, 224, PAL.textDim);
    });
    scr.textCenter('Z  edit / begin      X  back to title', W / 2, H - 20, PAL.textFaint);
  }
}
