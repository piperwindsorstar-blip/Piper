// ============================================================================
//  PARTY CREATION — name, class, element and job for up to four characters.
//
//  This is the scene that has to make 12 classes, 13 elements and 20 jobs
//  legible, so every list is paired with a detail panel: the class panel draws
//  the whole promotion ladder (including both branch points), the element panel
//  draws that element's position on the wheel, and the job panel spells out the
//  field ability and passive you are actually buying.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu, header } from '../../engine/ui.js';
import { ROOT_CLASSES, CLASSES, STAT_KEYS } from '../../data/classes.js';
import { ELEMENTS, ELEMENT_BY_ID } from '../../data/elements.js';
import { JOBS, JOB_BY_ID } from '../../data/jobs.js';
import { SCHOOLS } from '../../data/skills.js';
import { heroSprite } from '../../engine/sprites.js';
import { GameState, MAX_PARTY } from '../state.js';

const NAME_ROWS = [
  'ABCDEFGHIJ',
  'KLMNOPQRST',
  'UVWXYZ.-\' ',
  'abcdefghij',
  'klmnopqrst',
  'uvwxyz0123',
];
const NAME_POOL = [
  'Piper', 'Bram', 'Iris', 'Sela', 'Corvin', 'Mira', 'Toval', 'Elka', 'Rhys', 'Nara',
  'Osric', 'Wynn', 'Dara', 'Kell', 'Ivo', 'Sable', 'Fen', 'Marek', 'Thea', 'Juno',
];

const STAGES = ['name', 'class', 'element', 'job'];

// detail-panel origin and inner width
const PX = 128;
const PW = W - PX - 12;

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
    return { name: '', classId: 'warrior', elementId: 'fire', jobId: 'blacksmith', skin: 0, hair: 0 };
  }

  buildMenus() {
    this.classMenu = new Menu({
      items: ROOT_CLASSES.map((c) => ({ label: c.name, id: c.id })),
      x: 24, y: 34, cellW: 88, cellH: 11, rows: 11, columns: 1,
    });
    this.elemMenu = new Menu({
      items: ELEMENTS.map((e) => ({ label: e.name, id: e.id, color: e.color })),
      x: 24, y: 34, cellW: 88, cellH: 11, rows: 11, columns: 1,
    });
    this.jobMenu = new Menu({
      items: JOBS.map((j) => ({ label: j.name, id: j.id })),
      x: 24, y: 34, cellW: 88, cellH: 11, rows: 11, columns: 1,
    });
    this.rosterMenu = new Menu({
      items: [], x: 20, y: 40, cellW: 200, cellH: 24, rows: 5,
    });
  }

  refreshRoster() {
    const items = this.slots.map((s, i) => {
      if (!s) return { label: `${i + 1}.  — empty —`, slotIndex: i, color: PAL.textDim };
      const cls = CLASSES[s.classId], el = ELEMENT_BY_ID[s.elementId], job = JOB_BY_ID[s.jobId];
      return {
        label: `${i + 1}.  ${s.name}`,
        note: `${cls.name} / ${el.name} / ${job.name}`,
        slotIndex: i, color: PAL.text, noteColor: el.color,
      };
    });
    const filled = this.slots.filter(Boolean).length;
    items.push({ label: 'BEGIN THE QUEST', begin: true, disabled: filled === 0, color: PAL.gold });
    items.push({ label: 'BACK TO TITLE', quit: true, color: PAL.textDim });
    this.rosterMenu.setItems(items, true);
  }

  // --- flow ----------------------------------------------------------------
  nextStage() {
    const i = STAGES.indexOf(this.stage);
    if (i < STAGES.length - 1) { this.stage = STAGES[i + 1]; return; }
    this.slots[this.slot] = { ...this.draft };
    const nextEmpty = this.slots.findIndex((s) => !s);
    if (nextEmpty >= 0 && this.slots.filter(Boolean).length < MAX_PARTY) {
      this.slot = nextEmpty;
      this.draft = this.blankDraft();
      this.stage = 'name';
    } else {
      this.mode = 'roster';
      this.refreshRoster();
    }
  }

  prevStage() {
    const i = STAGES.indexOf(this.stage);
    if (i > 0) { this.stage = STAGES[i - 1]; return; }
    if (this.slots.some(Boolean)) { this.mode = 'roster'; this.refreshRoster(); }
    else this.app.pop();
  }

  editSlot(i) {
    this.slot = i;
    this.draft = this.slots[i] ? { ...this.slots[i] } : this.blankDraft();
    this.stage = 'name';
    this.mode = 'edit';
  }

  begin() {
    const g = new GameState();
    for (const s of this.slots) if (s) g.addMember(s);
    // starting kit, sized to the party
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
      if (starter) { g.addItem(starter); ch.equip.weapon = starter; g.removeItem(starter); }
      const body = cls.armor.includes('heavy') || cls.armor.includes('medium') ? 'leatherarmor' : 'clothrobe';
      ch.equip.body = body;
    }
    g.restParty();
    this.app.game = g;
    this.app.replace('field');
  }

  // --- update --------------------------------------------------------------
  update(dt, input) {
    this.t += dt;
    for (const m of [this.classMenu, this.elemMenu, this.jobMenu, this.rosterMenu]) m.update(dt);

    if (this.mode === 'roster') return this.updateRoster(input);

    switch (this.stage) {
      case 'name': return this.updateName(input);
      case 'class': return this.updateList(input, this.classMenu, 'classId');
      case 'element': return this.updateList(input, this.elemMenu, 'elementId');
      case 'job': return this.updateList(input, this.jobMenu, 'jobId');
      default: break;
    }
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
    if (input.tap('confirm')) {
      const ch = NAME_ROWS[this.namePos.r][this.namePos.c];
      if (this.draft.name.length < 9) this.draft.name += ch;
    }
    if (input.tap('cancel')) {
      if (this.draft.name.length) this.draft.name = this.draft.name.slice(0, -1);
      else this.prevStage();
    }
    if (input.tap('shift')) {
      this.draft.name = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
      this.draft.skin = Math.floor(Math.random() * 4);
      this.draft.hair = Math.floor(Math.random() * 6);
    }
    if (input.tap('menu') && this.draft.name.trim().length) this.nextStage();
  }

  updateList(input, menu, key) {
    menu.handle(input);
    this.draft[key] = menu.current.id;
    if (input.tap('confirm')) this.nextStage();
    if (input.tap('cancel')) this.prevStage();
  }

  // --- draw ----------------------------------------------------------------
  draw(scr) {
    scr.clear('#0c0f1e');
    for (let y = 0; y < H; y += 4) scr.rect(0, y, W, 1, '#0e1224');

    if (this.mode === 'roster') return this.drawRoster(scr);

    const step = STAGES.indexOf(this.stage) + 1;
    header(scr, `MEMBER ${this.slot + 1}  ·  ${this.stage.toUpperCase()}`, `${step}/4`);

    switch (this.stage) {
      case 'name': this.drawName(scr); break;
      case 'class': this.drawClass(scr); break;
      case 'element': this.drawElement(scr); break;
      case 'job': this.drawJob(scr); break;
      default: break;
    }
  }

  /** The live sprite, in its own box under the list rather than over the text. */
  drawPreview(scr) {
    scr.window(6, 172, 112, 46);
    const cv = heroSprite({
      classId: this.draft.classId, elementId: this.draft.elementId,
      skin: this.draft.skin, hair: this.draft.hair,
      frame: Math.floor(this.t * 3) % 2,
    });
    scr.ctx.drawImage(cv, 18, 178);
    const cls = CLASSES[this.draft.classId];
    const el = ELEMENT_BY_ID[this.draft.elementId];
    scr.text(this.draft.name || '???', 48, 178, PAL.gold);
    scr.text(cls.name, 48, 189, PAL.text);
    scr.rect(48, 201, 4, 5, el.color);
    scr.text(el.name, 55, 200, el.color);
  }

  drawName(scr) {
    scr.window(20, 26, 216, 34);
    scr.text('NAME', 28, 32, PAL.gold);
    const name = this.draft.name || '';
    scr.text(name, 28, 44, PAL.text, { size: 12 });
    // cursor
    if (Math.floor(this.t * 2) % 2 === 0 && name.length < 9) {
      scr.rect(28 + name.length * 7, 44, 6, 12, PAL.gold);
    }

    scr.window(20, 64, 216, 96);
    NAME_ROWS.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const sel = r === this.namePos.r && c === this.namePos.c;
        const x = 32 + c * 18, y = 72 + r * 14;
        if (sel) scr.rect(x - 4, y - 2, 14, 12, PAL.frame1);
        scr.text(row[c], x, y, sel ? PAL.white : PAL.text, { size: 10 });
      }
    });

    scr.window(20, 164, 216, 44);
    scr.text('Z  add letter        X  backspace / back', 28, 172, PAL.textDim);
    scr.text('SHIFT  random name   TAB  accept name', 28, 184, PAL.textDim);
    const ok = this.draft.name.trim().length > 0;
    scr.text(ok ? 'Press TAB to continue.' : 'Give this one a name.', 28, 196, ok ? PAL.gold : PAL.grey);
  }

  // right-hand detail panel geometry
  panel(scr, title) {
    scr.window(PX - 6, 26, W - PX, 192);
    scr.text(title, PX, 32, PAL.gold);
    scr.rect(PX, 42, PW, 1, PAL.frame1);
    return 46;
  }

  /** Wrap `text` and return the y after it, so sections cannot overlap. */
  para(scr, text, y, color, opts = {}) {
    const lh = opts.lineHeight ?? 9;
    return y + scr.textWrap(text, PX, y, PW, color, { ...opts, lineHeight: lh }) * lh + (opts.gap ?? 3);
  }

  drawClass(scr) {
    scr.window(6, 26, 112, 142);
    this.classMenu.draw(scr);
    this.drawPreview(scr);

    const cls = CLASSES[this.draft.classId];
    let y = this.panel(scr, cls.name.toUpperCase());
    y = this.para(scr, cls.role, y, PAL.cyan, { maxLines: 1 });
    y = this.para(scr, cls.blurb, y, PAL.textDim, { maxLines: 2, gap: 4 });

    scr.text('GROWTH / LEVEL', PX, y, PAL.gold); y += 10;
    const maxG = Math.max(...STAT_KEYS.map((k) => cls.growth[k]));
    for (const k of ['hp', 'mp', 'str', 'vit', 'agi', 'int', 'spr', 'lck']) {
      scr.text(k.toUpperCase(), PX, y, PAL.textDim);
      scr.bar(PX + 26, y + 1, PW - 52, 5, cls.growth[k] / maxG, PAL.cyan);
      scr.textRight(cls.growth[k].toFixed(1), PX + PW, y, PAL.text);
      y += 8;
    }
    y += 3;
    scr.text('SCHOOLS', PX, y, PAL.gold); y += 10;
    y = this.para(scr, cls.schools.map((s) => SCHOOLS[s].name).join(', '), y, PAL.text, { maxLines: 2, gap: 4 });

    // the ladder, showing both branch points
    scr.text('PROMOTION LADDER', PX, y, PAL.gold); y += 10;
    const t1 = CLASSES[cls.promotions[0]];
    const [a, b] = t1.promotions.map((p) => CLASSES[p]);
    scr.text('5', PX, y, PAL.textDim); scr.text(t1.name, PX + 14, y, PAL.text); y += 9;
    scr.text('10', PX, y, PAL.textDim); scr.text(a.name, PX + 14, y, PAL.cyan); y += 9;
    scr.text('or', PX + 2, y, PAL.textDim); scr.text(b.name, PX + 14, y, PAL.cyan); y += 9;
    scr.text('20', PX, y, PAL.textDim); scr.text('four masteries', PX + 14, y, PAL.magenta);
  }

  drawElement(scr) {
    scr.window(6, 26, 112, 142);
    this.elemMenu.draw(scr);
    this.drawPreview(scr);

    const el = ELEMENT_BY_ID[this.draft.elementId];
    let y = this.panel(scr, el.name.toUpperCase());
    scr.textRight(el.rune, PX + PW, 32, PAL.textDim);
    scr.rect(PX, y, PW, 5, el.color);
    scr.rect(PX, y, PW, 2, el.color2);
    y += 9;
    y = this.para(scr, el.blurb, y, PAL.textDim, { maxLines: 2, gap: 4 });
    scr.text(el.group === 'prime' ? 'PRIME — on the wheel' : 'ARCANE — beside it',
      PX, y, el.group === 'prime' ? PAL.cyan : PAL.magenta);
    y += 12;

    scr.text('BIAS', PX, y, PAL.gold);
    const bias = Object.entries(el.bias)
      .map(([k, v]) => `${k.toUpperCase()}${v > 0 ? '+' : ''}${v}`).join(' ');
    y += 10;
    y = this.para(scr, bias, y, PAL.green, { maxLines: 2, gap: 4 });

    scr.text('STRONG', PX, y, PAL.gold); y += 9;
    y = drawElemList(scr, el.strongAgainst, PX, y);
    scr.text('WEAK', PX, y, PAL.gold); y += 9;
    y = drawElemList(scr, el.weakAgainst, PX, y);
    y += 2;

    scr.text(el.perk.toUpperCase(), PX, y, PAL.gold); y += 10;
    scr.textWrap(el.perkText, PX, y, PW, PAL.text, { lineHeight: 9, maxLines: 5 });
  }

  drawJob(scr) {
    scr.window(6, 26, 112, 142);
    this.jobMenu.draw(scr);
    this.drawPreview(scr);

    const job = JOB_BY_ID[this.draft.jobId];
    let y = this.panel(scr, job.name.toUpperCase());
    y = this.para(scr, job.blurb, y, PAL.textDim, { maxLines: 2, gap: 4 });

    scr.text('BONUS (rank 1)', PX, y, PAL.gold); y += 10;
    y = this.para(scr, Object.entries(job.bonus)
      .map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' '), y, PAL.green, { maxLines: 2, gap: 4 });

    scr.text(`FIELD · ${job.field.name}`, PX, y, PAL.gold); y += 10;
    y = this.para(scr, job.field.text, y, PAL.text, { maxLines: 4, gap: 4 });

    scr.text('PASSIVE', PX, y, PAL.gold); y += 10;
    y = this.para(scr, job.passive.text, y, PAL.text, { maxLines: 4, gap: 4 });

    scr.text('RANKS UP FASTER AS', PX, y, PAL.gold); y += 9;
    scr.text(job.likes.map((e) => ELEMENT_BY_ID[e].name).join(', '), PX, y, PAL.cyan);
  }

  drawRoster(scr) {
    header(scr, 'YOUR PARTY', `${this.slots.filter(Boolean).length}/${MAX_PARTY}`);
    scr.window(12, 28, W - 24, 132);
    this.rosterMenu.x = 30; this.rosterMenu.y = 36; this.rosterMenu.cellW = 200; this.rosterMenu.cellH = 20;
    this.rosterMenu.draw(scr);

    // sprites of everyone chosen so far
    this.slots.forEach((s, i) => {
      if (!s) return;
      const cv = heroSprite({
        classId: s.classId, elementId: s.elementId, skin: s.skin, hair: s.hair,
        frame: Math.floor(this.t * 3 + i) % 2,
      });
      scr.ctx.drawImage(cv, 30 + i * 52, 166);
    });
    scr.window(6, 196, W - 12, 24);
    scr.text('Z  edit / begin      X  back to title', 14, 204, PAL.textDim);
  }
}

/** Draw element chips, wrapping inside `PW`; returns the y below them. */
function drawElemList(scr, ids, x, y) {
  let cx = x;
  for (const id of ids) {
    const e = ELEMENT_BY_ID[id];
    const w = 7 + scr.textWidth(e.name);
    if (cx + w > x + PW) { cx = x; y += 9; }
    scr.rect(cx, y + 1, 4, 5, e.color);
    scr.text(e.name, cx + 6, y, PAL.text);
    cx += w + 6;
  }
  return y + 11;
}
