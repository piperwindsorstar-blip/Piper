// ============================================================================
//  BATTLE SCENE — draws the two facing 3x3 grids and drives Battle.
//
//  The party sits on the right with column 0 nearest the enemy; the enemy sits
//  on the left with its column 0 nearest the party. Cells are drawn as a real
//  grid so the reach rules are visible rather than implied: when you pick a
//  target, everything out of reach for the chosen action is greyed out.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu, hpColor } from '../../engine/ui.js';
import { heroSprite, monsterSprite } from '../../engine/sprites.js';
import { Battle, PHASE } from '../battle.js';
import { stats, usableSkills, awardExp, refreshPromotion } from '../character.js';
import { getSkill, STATUS } from '../../data/skills.js';
import { getItem } from '../../data/items.js';
import { ELEMENT_BY_ID } from '../../data/elements.js';

const CELL_W = 30, CELL_H = 29;
const GRID_Y = 20;
const ENEMY_X = 92, PARTY_X = 148;
// Rows are staggered rather than square: each row further from the centre is
// pushed outward, so three ranks in one column read as depth instead of as a
// totem pole of overlapping sprites. FFVI lines its party up the same way.
const ROW_SHIFT = [-7, 0, 7];

// bottom bar geometry — a command box on the left, the party roster on the
// right, and a message/target strip above both
const BAR_Y = 152, BAR_H = 68;
const PANEL_X = 100;
const MSG_Y = 112, MSG_H = 34;

const MSG_TIME = 0.85;

export class BattleScene {
  constructor(app) { this.app = app; }

  enter(opts) {
    this.g = this.app.game;
    this.opts = opts;
    this.battle = new Battle(this.g.party, opts.formationId, {
      preemptive: opts.preemptive, ambushed: opts.ambushed,
    });
    this.state = 'intro';
    this.t = 0;
    this.msgT = 0;
    this.shownLog = [];
    this.pending = [];
    this.popups = [];
    this.actor = null;
    this.action = null;
    this.targetIndex = 0;
    this.targetPool = [];
    this.moveCursor = { row: 1, col: 0 };
    this.flash = 0;
    this.cmdMenu = new Menu({ items: [], x: 20, y: 158, cellW: 62, cellH: 12, rows: 3, columns: 2 });
    this.listMenu = new Menu({ items: [], x: 20, y: 152, cellW: 108, cellH: 11, rows: 5 });
    this.result = null;
    this.introT = 1.1;
    this.flushLog();
  }

  flushLog() {
    while (this.battle.log.length > this.shownLog.length) {
      this.pending.push(this.battle.log[this.shownLog.length]);
      this.shownLog.push(this.battle.log[this.shownLog.length]);
    }
    // capture damage popups
    for (const fx of this.battle.fx) {
      const u = this.battle.units().find((x) => x.uid === fx.uid);
      if (!u) continue;
      const p = this.unitPos(u);
      this.popups.push({
        x: p.x + 12, y: p.y, life: 0.9,
        text: fx.type === 'heal' ? `+${fx.amount}` : `${fx.amount}`,
        color: fx.type === 'heal' ? PAL.green : (fx.element && fx.element !== 'none'
          ? ELEMENT_BY_ID[fx.element]?.color ?? PAL.white : PAL.white),
      });
      if (fx.type === 'damage') { this.flash = 0.12; this.app.screen.addShake(3); }
    }
    this.battle.fx.length = 0;
  }

  // --- layout --------------------------------------------------------------
  cellPos(side, row, col) {
    const shift = ROW_SHIFT[row] * (side === 'enemy' ? -1 : 1);
    const x = side === 'enemy' ? ENEMY_X - col * CELL_W : PARTY_X + col * CELL_W;
    return { x: x + shift, y: GRID_Y + row * CELL_H };
  }

  unitPos(u) { return this.cellPos(u.side, u.grid.row, u.grid.col); }

  // --- update --------------------------------------------------------------
  update(dt, input) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.cmdMenu.update(dt);
    this.listMenu.update(dt);
    for (const p of this.popups) { p.life -= dt; p.y -= dt * 14; }
    this.popups = this.popups.filter((p) => p.life > 0);

    if (this.state === 'intro') {
      this.introT -= dt;
      if (this.introT <= 0 || input.tap('confirm')) { this.state = 'messages'; }
      return;
    }

    if (this.state === 'messages') return this.updateMessages(dt, input);
    if (this.state === 'done') return this.updateDone(dt, input);

    switch (this.state) {
      case 'command': return this.updateCommand(input);
      case 'skill': return this.updateSkillList(input);
      case 'item': return this.updateItemList(input);
      case 'target': return this.updateTarget(input);
      case 'move': return this.updateMove(input);
      default: break;
    }
  }

  updateMessages(dt, input) {
    if (this.pending.length) {
      this.msgT += dt;
      if (input.tap('confirm')) this.msgT = MSG_TIME;
      if (this.msgT >= MSG_TIME) { this.pending.shift(); this.msgT = 0; }
      return;
    }
    // messages drained — resolve battle state or hand the turn on
    const b = this.battle;
    b.checkEnd();
    if (b.phase === PHASE.VICTORY || b.phase === PHASE.DEFEAT || b.phase === PHASE.FLED) {
      this.finish();
      return;
    }
    if (this.needsAdvance) { this.needsAdvance = false; b.advance(); this.flushLog(); }
    b.checkEnd();
    if (b.phase === PHASE.VICTORY || b.phase === PHASE.DEFEAT || b.phase === PHASE.FLED) {
      this.finish();
      return;
    }
    if (this.pending.length) return;
    const u = b.current();
    if (!u) { this.needsAdvance = true; return; }
    this.actor = u;
    if (u.isPC) { this.openCommand(); }
    else {
      this.enemyDelay = (this.enemyDelay ?? 0) + dt;
      if (this.enemyDelay > 0.35) {
        this.enemyDelay = 0;
        b.act(u, b.enemyAction(u));
        this.flushLog();
        this.needsAdvance = true;
      }
    }
  }

  openCommand() {
    const ch = this.actor.ref;
    const skills = usableSkills(ch);
    this.cmdMenu.setItems([
      { label: 'Attack', id: 'attack' },
      { label: 'Arts', id: 'skill', disabled: skills.length === 0 },
      { label: 'Item', id: 'item', disabled: this.g.usableInBattle().length === 0 },
      { label: 'Move', id: 'move' },
      { label: 'Guard', id: 'defend' },
      { label: 'Flee', id: 'flee', disabled: this.battle.isBoss },
    ]);
    this.state = 'command';
  }

  updateCommand(input) {
    this.cmdMenu.handle(input);
    if (input.tap('confirm') && !this.cmdMenu.disabled()) {
      const id = this.cmdMenu.current.id;
      if (id === 'attack') {
        const a = this.actor.stats();
        this.beginTarget({ target: 'one', range: 9 }, (t) => this.perform({ kind: 'attack', target: t }),
          { reach: a.reach });
      } else if (id === 'skill') {
        this.listMenu.setItems(usableSkills(this.actor.ref).map((k) => ({
          label: k.name, id: k.id,
          note: k.ip ? `${k.ip}IP` : (k.mp ? `${k.mp}MP` : '-'),
        })));
        this.state = 'skill';
      } else if (id === 'item') {
        this.listMenu.setItems(this.g.usableInBattle().map((s) => ({
          label: getItem(s.id).name, id: s.id, note: `x${s.count}`,
        })));
        this.state = 'item';
      } else if (id === 'move') {
        this.moveCursor = { ...this.actor.grid };
        this.state = 'move';
      } else if (id === 'defend') {
        this.perform({ kind: 'defend' });
      } else if (id === 'flee') {
        this.perform({ kind: 'flee' });
      }
    }
  }

  updateSkillList(input) {
    this.listMenu.handle(input);
    if (input.tap('cancel')) { this.state = 'command'; return; }
    if (input.tap('confirm') && this.listMenu.length) {
      const skill = getSkill(this.listMenu.current.id);
      if (['self', 'allies'].includes(skill.target)) {
        this.perform({ kind: 'skill', skillId: skill.id, target: this.actor });
      } else {
        this.beginTarget(skill, (t) => this.perform({ kind: 'skill', skillId: skill.id, target: t }));
      }
    }
  }

  updateItemList(input) {
    this.listMenu.handle(input);
    if (input.tap('cancel')) { this.state = 'command'; return; }
    if (input.tap('confirm') && this.listMenu.length) {
      const id = this.listMenu.current.id;
      const it = getItem(id);
      const spec = it.target === 'allies' ? { target: 'allies' }
        : it.target === 'row' ? { target: 'row', range: 9 }
          : { target: 'ally', range: 9 };
      if (spec.target === 'allies') {
        this.g.removeItem(id);
        this.perform({ kind: 'item', itemId: id, target: this.actor });
      } else {
        this.beginTarget(spec, (t) => { this.g.removeItem(id); this.perform({ kind: 'item', itemId: id, target: t }); });
      }
    }
  }

  beginTarget(spec, onPick, extra = {}) {
    const b = this.battle;
    let pool = b.validTargets(this.actor, spec);
    if (spec.target === 'ally' || spec.target === 'allies') {
      pool = this.actor.side === 'party' ? this.battle.party : this.battle.enemies;
      pool = pool.filter((u) => u.alive || spec.revives);
    }
    if (!pool.length) { this.state = 'command'; return; }
    this.targetPool = pool;
    this.targetIndex = 0;
    this.targetSpec = { ...spec, ...extra };
    this.onPickTarget = onPick;
    this.state = 'target';
  }

  updateTarget(input) {
    if (input.tap('cancel')) { this.state = 'command'; return; }
    const d = input.dir();
    if (d.x || d.y) {
      const step = (d.x > 0 || d.y > 0) ? 1 : -1;
      this.targetIndex = (this.targetIndex + step + this.targetPool.length) % this.targetPool.length;
    }
    if (input.tap('confirm')) {
      const t = this.targetPool[this.targetIndex];
      const cb = this.onPickTarget;
      this.onPickTarget = null;
      cb(t);
    }
  }

  updateMove(input) {
    const d = input.dir();
    if (d.y) this.moveCursor.row = Math.max(0, Math.min(2, this.moveCursor.row + d.y));
    if (d.x) this.moveCursor.col = Math.max(0, Math.min(2, this.moveCursor.col + d.x));
    if (input.tap('cancel')) { this.state = 'command'; return; }
    if (input.tap('confirm')) {
      this.perform({ kind: 'move', row: this.moveCursor.row, col: this.moveCursor.col });
    }
  }

  perform(action) {
    this.battle.act(this.actor, action);
    this.flushLog();
    this.needsAdvance = true;
    this.state = 'messages';
    this.msgT = 0;
  }

  // --- resolution ----------------------------------------------------------
  finish() {
    if (this.state === 'done') return;
    const b = this.battle;
    this.state = 'done';
    this.doneT = 0;
    const msgs = [];
    if (b.result === 'victory') {
      const spoils = b.spoils();
      msgs.push(`Victory! ${spoils.exp} EXP and ${spoils.gold} gold.`);
      this.g.earn(spoils.gold);
      for (const id of spoils.items) {
        if (this.g.addItem(id)) msgs.push(`Found ${getItem(id).name}.`);
      }
      const promos = [];
      for (const ch of this.g.party) {
        const r = awardExp(ch, spoils.exp);
        if (r.levels) msgs.push(`${ch.name} reaches level ${ch.level}!`);
        if (refreshPromotion(ch)) promos.push(ch);
      }
      msgs.push(...this.g.jobTickAll(6));
      // record the bestiary
      for (const e of b.enemies) this.g.bestiary[e.def.id] = (this.g.bestiary[e.def.id] ?? 0) + 1;
      if (promos.length) {
        msgs.push(`${promos.map((c) => c.name).join(', ')} ${promos.length > 1 ? 'are' : 'is'} ready for a promotion.`);
      }
      this.readyPromotions = promos.length > 0;
    } else if (b.result === 'fled') {
      msgs.push('Got away.');
    }
    this.result = {
      outcome: b.result,
      messages: msgs,
      bossFlag: this.opts.bossFlag ?? null,
    };
    this.doneMsgs = msgs;
    this.doneIndex = 0;
  }

  updateDone(dt, input) {
    this.doneT += dt;
    if (this.doneIndex < (this.doneMsgs?.length ?? 0)) {
      if (this.doneT > MSG_TIME || input.tap('confirm')) { this.doneIndex++; this.doneT = 0; }
      return;
    }
    if (this.doneT < 0.35 && !input.tap('confirm')) return;
    this.app.pop(this.result);
    if (this.result.outcome === 'victory' && this.readyPromotions) {
      this.app.push('promotion', { auto: true });
    }
  }

  // --- draw ----------------------------------------------------------------
  draw(scr) {
    const b = this.battle;
    this.drawBackdrop(scr);

    this.drawGrid(scr, 'enemy');
    this.drawGrid(scr, 'party');

    // units, back column first so front overlaps
    const all = [...b.enemies, ...b.party].sort((a, z) => z.grid.col - a.grid.col);
    for (const u of all) this.drawUnit(scr, u);

    for (const p of this.popups) {
      scr.textCenter(p.text, p.x, p.y, p.color, { size: 8 });
    }

    if (this.flash > 0) scr.fade(this.flash * 1.4, '#ffffff');

    this.drawStatusBar(scr);
    this.drawUi(scr);

    if (this.state === 'intro') {
      const names = [...new Set(b.enemies.map((e) => e.name))].join(', ');
      this.msgBox(scr, `${names} ${b.enemies.length > 1 ? 'block the way!' : 'blocks the way!'}`);
    }
  }

  /**
   * Battle backdrop: a sky gradient, a distant treeline or ridge silhouette,
   * and a textured ground plane. The palette follows the region the encounter
   * came from, so a cave fight does not happen under open sky.
   */
  drawBackdrop(scr) {
    const region = this.battle.formation.region;
    const T = {
      greenfield: { sky0: '#2e4a86', sky1: '#7b93b8', far: '#2c4a34', ground: '#4a7a3e', gdark: '#3a6232', speck: '#568c48' },
      caverns:    { sky0: '#141020', sky1: '#2a2238', far: '#241c30', ground: '#5a5040', gdark: '#443c30', speck: '#6a5e4a' },
      ruins:      { sky0: '#1c1030', sky1: '#432a52', far: '#2a1a38', ground: '#4e4860', gdark: '#3a3448', speck: '#5e5870' },
      boss:       { sky0: '#180c22', sky1: '#3c1c38', far: '#25122c', ground: '#403050', gdark: '#2e2240', speck: '#4e3c60' },
    }[region] ?? { sky0: '#141428', sky1: '#2a2a48', far: '#20203a', ground: '#4a4458', gdark: '#38344a', speck: '#5a5468' };

    const HORIZON = 44;   // above the front rank's feet, so the ranks stand on it
    scr.clear(T.gdark);
    scr.vgrad(0, 0, W, HORIZON, T.sky0, T.sky1);
    if (region === 'caverns' || region === 'ruins' || region === 'boss') {
      for (let i = 0; i < 34; i++) scr.px((i * 97) % W, (i * 53) % HORIZON, 'rgba(190,190,240,0.16)');
    }

    // far silhouette: rolling hills outdoors, a jagged ceiling underground
    for (let x = 0; x < W; x++) {
      const h = region === 'caverns' || region === 'boss'
        ? 16 + Math.round(9 * Math.sin(x * 0.11) + 5 * Math.sin(x * 0.31 + 1.7))
        : 18 + Math.round(11 * Math.sin(x * 0.035) + 6 * Math.sin(x * 0.09 + 2));
      scr.rect(x, HORIZON - h, 1, h, T.far);
    }
    scr.rect(0, HORIZON - 1, W, 1, scr.lighten(T.far, 0.1));

    // ground plane, lit at the horizon and falling into shadow at the front
    scr.vgrad(0, HORIZON, W, H - HORIZON, scr.lighten(T.ground, 0.08), T.gdark);
    for (let i = 0; i < 190; i++) {
      const x = (i * 71 + 13) % W;
      const y = HORIZON + 2 + ((i * 37) % (H - HORIZON - 2));
      scr.px(x, y, i % 3 === 0 ? T.gdark : T.speck);
    }
    // receding scanlines: tight at the horizon, open at the front
    let sy = HORIZON + 3, step = 2;
    while (sy < H) { scr.rect(0, sy, W, 1, 'rgba(0,0,0,0.12)'); sy += step; step += 0.5; }
  }

  drawGrid(scr, side) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const { x, y } = this.cellPos(side, row, col);
        const front = col === this.battle.frontColumn(side);
        // an oval of shadow marking the cell, brighter on the reachable
        // front rank so the reach rule is visible at a glance
        const cx = x + (CELL_W - 6) / 2, cy = y + CELL_H - 4;
        scr.ctx.save();
        scr.ctx.globalAlpha = front ? 0.5 : 0.28;
        scr.rect(cx - 9, cy, 18, 1, '#000000');
        scr.rect(cx - 7, cy - 1, 14, 1, '#000000');
        scr.rect(cx - 7, cy + 1, 14, 1, '#000000');
        scr.ctx.restore();
        if (front) {
          scr.rect(cx - 9, cy - 2, 18, 1, 'rgba(170,190,250,0.30)');
        }
        if (this.state === 'move' && side === this.actor?.side
          && this.moveCursor.row === row && this.moveCursor.col === col) {
          scr.outline(x - 2, y + CELL_H - 9, CELL_W - 2, 9, PAL.gold);
        }
      }
    }
  }

  drawUnit(scr, u) {
    const p = this.unitPos(u);
    const dead = !u.alive;
    const isTarget = this.state === 'target' && this.targetPool[this.targetIndex]?.uid === u.uid;
    const isActor = this.actor?.uid === u.uid && ['command', 'skill', 'item', 'target', 'move'].includes(this.state);

    // reach shading while choosing a target
    let dim = false;
    if (this.state === 'target' && this.targetSpec && u.side !== this.actor.side) {
      const reach = this.targetSpec.reach ?? this.targetSpec.range ?? 9;
      dim = !this.battle.inReach(this.actor, u, reach);
    }

    scr.ctx.save();
    if (dead) scr.ctx.globalAlpha = 0.25;
    else if (dim) scr.ctx.globalAlpha = 0.4;

    if (u.isPC) {
      const ch = u.ref;
      const hurtFrame = ch.hp / stats(ch).maxHp < 0.25 ? 2 : 0;
      const cv = heroSprite({
        classId: ch.classId, elementId: ch.elementId, skin: ch.skin, hair: ch.hair,
        frame: isActor ? 3 : hurtFrame,
      });
      scr.ctx.drawImage(cv, p.x, p.y + CELL_H - cv.height);
    } else {
      const cv = monsterSprite(u.def.sprite, Math.floor(this.t * 2.5) % 2);
      scr.ctx.drawImage(cv, Math.round(p.x + 13 - cv.width / 2), Math.round(p.y + CELL_H + 2 - cv.height));
    }
    scr.ctx.restore();

    if (isTarget) {
      const bob = Math.round(Math.sin(this.t * 8) * 1.5);
      scr.text('◀', p.x + CELL_W - 8, p.y + CELL_H - 22 + bob, PAL.gold);
      scr.outline(p.x - 1, p.y + CELL_H - 8, CELL_W - 4, 7, PAL.gold);
    }
    if (isActor) scr.outline(p.x - 1, p.y + CELL_H - 8, CELL_W - 4, 7, PAL.cyan);

    // enemy HP pip and status icons
    if (!u.isPC && u.alive) {
      const s = u.stats();
      const showHp = this.g.hasJob('appraiser') || this.battle.revealed;
      if (showHp) scr.bar(p.x, p.y + CELL_H + 2, 24, 3, u.hp / s.maxHp, PAL.red);
    }
    const st = Object.keys(u.statuses).filter((k) => STATUS[k]);
    st.slice(0, 3).forEach((k, i) => {
      scr.rect(p.x + i * 5, p.y + 10, 4, 4, STATUS[k].kind === 'bad' ? PAL.magenta : PAL.cyan);
    });
  }

  /** The party roster, stacked on the right the way FFVI lists it. */
  drawStatusBar(scr) {
    const b = this.battle;
    scr.window(PANEL_X, BAR_Y, W - PANEL_X - 4, BAR_H);
    b.party.forEach((u, i) => {
      const y = BAR_Y + 5 + i * 15;
      const ch = u.ref;
      const s = u.stats();
      const active = this.actor?.uid === u.uid;
      const ratio = ch.hp / s.maxHp;
      if (active) scr.rect(PANEL_X + 3, y - 2, W - PANEL_X - 10, 13, 'rgba(120,150,230,0.28)');
      scr.text(ch.name.slice(0, 7), PANEL_X + 6, y, !u.alive ? PAL.grey : active ? PAL.gold : PAL.text);
      scr.textRight(`${ch.hp}`, W - 44, y, hpColor(ratio));
      scr.bar(W - 40, y + 1, 34, 5, ratio, hpColor(ratio));
      scr.bar(W - 40, y + 7, 34, 2, s.maxMp ? ch.mp / s.maxMp : 0, PAL.cyan);
      scr.bar(W - 40, y + 10, 34, 2, ch.ip / 100, PAL.magenta);
    });
  }

  /** A message strip above the bottom bar; used by every transient line. */
  msgBox(scr, text, color = PAL.text) {
    scr.window(4, MSG_Y, W - 8, MSG_H);
    scr.textWrap(text, 12, MSG_Y + 7, W - 24, color, { maxLines: 2, lineHeight: 11 });
  }

  drawUi(scr) {
    if (this.state === 'messages' && this.pending.length) {
      this.msgBox(scr, this.pending[0]);
      return;
    }
    if (this.state === 'done') {
      const msg = this.doneMsgs?.[this.doneIndex] ??
        (this.result?.outcome === 'defeat' ? 'The party has fallen...' : 'Press Z.');
      this.msgBox(scr, msg, this.result?.outcome === 'defeat' ? PAL.red : PAL.gold);
      return;
    }

    if (this.state === 'command') {
      scr.window(4, BAR_Y, PANEL_X - 8, BAR_H);
      this.cmdMenu.x = 20; this.cmdMenu.y = BAR_Y + 6;
      this.cmdMenu.cellW = 40; this.cmdMenu.cellH = 10;
      this.cmdMenu.columns = 2; this.cmdMenu.rows = 3;
      this.cmdMenu.draw(scr);
      const ch = this.actor.ref;
      scr.text('IP', 12, BAR_Y + 44, PAL.magenta);
      scr.bar(28, BAR_Y + 45, 54, 4, ch.ip / 100, PAL.magenta);
      scr.text(`reach ${this.actor.stats().reach}   col ${ch.grid.col}`, 12, BAR_Y + 54, PAL.textDim);
    } else if (this.state === 'skill' || this.state === 'item') {
      // the list takes the left column; the party roster stays readable
      scr.window(4, 92, PANEL_X + 20, 126);
      scr.text(this.state === 'skill' ? 'ARTS' : 'ITEMS', 12, 96, PAL.gold);
      scr.textRight(this.actor.name, PANEL_X + 16, 96, PAL.textDim);
      this.listMenu.x = 22; this.listMenu.y = 110;
      this.listMenu.cellW = PANEL_X - 4; this.listMenu.rows = 8; this.listMenu.cellH = 11;
      this.listMenu.draw(scr);
      if (this.listMenu.length) {
        scr.window(PANEL_X + 28, 92, W - PANEL_X - 32, 54);
        const bx = PANEL_X + 34, bw = W - PANEL_X - 44;
        if (this.state === 'skill') {
          const k = getSkill(this.listMenu.current.id);
          scr.text(k.name, bx, 96, PAL.gold);
          scr.textWrap(k.blurb ?? '', bx, 108, bw, PAL.textDim, { lineHeight: 9, maxLines: 2 });
          const el = k.element === 'attuned' ? this.actor.ref.elementId : k.element;
          scr.text(`reach ${k.range}  ${k.target}`, bx, 128, PAL.text);
          if (el && el !== 'none') scr.text(ELEMENT_BY_ID[el].name, bx, 137, ELEMENT_BY_ID[el].color);
        } else {
          const it = getItem(this.listMenu.current.id);
          scr.text(it.name, bx, 96, PAL.gold);
          const d = it.heal ? `Restores ${it.heal} HP.` : it.healMp ? `Restores ${it.healMp} MP.`
            : it.cures ? `Cures ${it.cures.join(', ')}.` : it.damage ? `${it.damage} damage.` : '';
          scr.textWrap(d, bx, 108, bw, PAL.textDim, { lineHeight: 9, maxLines: 3 });
        }
      }
    } else if (this.state === 'target') {
      const t = this.targetPool[this.targetIndex];
      scr.window(4, MSG_Y, W - 8, MSG_H);
      scr.text('Choose a target', 12, MSG_Y + 6, PAL.gold);
      if (t) {
        scr.text(this.battle.label(t), 12, MSG_Y + 19, PAL.text);
        if (t.element && t.element !== 'none') {
          scr.text(ELEMENT_BY_ID[t.element].name, 108, MSG_Y + 19, ELEMENT_BY_ID[t.element].color);
        }
        if (t.side !== this.actor.side) {
          const dist = this.battle.distance(this.actor, t);
          const reach = this.targetSpec.reach ?? this.targetSpec.range ?? 9;
          const ok = dist <= reach;
          scr.textRight(ok ? `range ${dist}/${reach}` : `range ${dist}/${reach} — half damage`,
            W - 12, MSG_Y + 19, ok ? PAL.green : PAL.red);
        }
      }
      // keep the command box drawn so the layout does not jump
      scr.window(4, BAR_Y, PANEL_X - 8, BAR_H);
      this.cmdMenu.draw(scr, { inactive: true });
    } else if (this.state === 'move') {
      scr.window(4, MSG_Y, W - 8, MSG_H);
      scr.text('Reposition — column 0 reaches, and is reached.', 12, MSG_Y + 6, PAL.gold);
      scr.text(`row ${this.moveCursor.row}   column ${this.moveCursor.col}`, 12, MSG_Y + 19, PAL.text);
      scr.window(4, BAR_Y, PANEL_X - 8, BAR_H);
      this.cmdMenu.draw(scr, { inactive: true });
    }
  }
}
