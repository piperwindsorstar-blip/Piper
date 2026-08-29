// ============================================================================
//  BATTLE SCENE — draws the two facing 3x3 grids and drives Battle.
//
//  The party sits on the right with column 0 nearest the enemy; the enemy sits
//  on the left with its column 0 nearest the party. Cells are drawn as a real
//  grid so the reach rules are visible rather than implied: when you pick a
//  target, everything out of reach for the chosen action is greyed out.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu, CommandWheel, hpColor } from '../../engine/ui.js';
import { actorSprite, actorPortraitSprite, monsterSprite } from '../../engine/sprites.js';
import { Particles } from '../../engine/particles.js';
import { Battle, PHASE } from '../battle.js';
import { stats, usableSkills, awardExp, refreshPromotion } from '../character.js';
import { getSkill, STATUS } from '../../data/skills.js';
import { getItem } from '../../data/items.js';
import { ELEMENT_BY_ID } from '../../data/elements.js';

// Two facing grids on a 480x270 stage. Rows are staggered rather than square:
// each row further from the centre is pushed outward, so three ranks in one
// column read as depth instead of a totem pole of overlapping sprites.
const CELL_W = 48, CELL_H = 40;
const GRID_Y = 26;
const ENEMY_X = 176, PARTY_X = 268;
const ROW_SHIFT = [-14, 0, 14];

// bottom bar — a command box on the left, the party roster on the right, and
// a message/target strip above both
const BAR_Y = 194, BAR_H = 66;
const PANEL_X = 168;
const MSG_Y = 148, MSG_H = 40;

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
    this.cmdWheel = new CommandWheel({ x: 34, y: BAR_Y + 10, cell: 22 });
    this.listMenu = new Menu({ items: [], x: 36, y: 120, cellW: 150, cellH: 13, rows: 7 });
    this.fxp = new Particles(360);
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
      const cx = p.x + CELL_W / 2 - 8, cy = p.y + CELL_H - 26;
      const col = fx.type === 'heal' ? PAL.green : (fx.element && fx.element !== 'none'
        ? ELEMENT_BY_ID[fx.element]?.color ?? PAL.white : PAL.white);
      this.popups.push({
        x: cx, y: cy, life: 1.0,
        text: fx.type === 'heal' ? `+${fx.amount}` : `${fx.amount}`, color: col,
      });
      if (fx.type === 'damage') {
        this.flash = 0.14;
        this.app.screen.addShake(4);
        this.fxp.burst(cx, cy + 10, col, 14, 80);
      } else {
        this.fxp.rise(cx, cy + 12, col, 12, 12);
      }
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
    this.fxp.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.cmdWheel.update(dt);
    this.listMenu.update(dt);
    for (const p of this.popups) { p.life -= dt; p.y -= dt * 22; }
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
    // A plus of five, Attack at centre where the cursor starts, with Move
    // filling the one corner a cross shape leaves spare.
    this.cmdWheel.setItems([
      { id: 'skill', label: 'Arts', icon: 'book', pos: [1, 0], disabled: skills.length === 0 },
      { id: 'defend', label: 'Guard', icon: 'shield', pos: [0, 1] },
      { id: 'attack', label: 'Attack', icon: 'sword', pos: [1, 1] },
      { id: 'item', label: 'Item', icon: 'bag', pos: [2, 1], disabled: this.g.usableInBattle().length === 0 },
      { id: 'flee', label: 'Flee', icon: 'boot', pos: [1, 2], disabled: this.battle.isBoss },
      { id: 'move', label: 'Move', icon: 'move', pos: [2, 2] },
    ], { defaultId: 'attack' });
    this.state = 'command';
  }

  updateCommand(input) {
    this.cmdWheel.handle(input);
    if (input.tap('confirm') && !this.cmdWheel.disabled()) {
      const id = this.cmdWheel.current.id;
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

    this.fxp.draw(scr);
    for (const p of this.popups) {
      const a = Math.min(1, p.life / 0.35);
      scr.ctx.save();
      scr.ctx.globalAlpha = a;
      const big = p.text.length <= 4 ? 12 : 8;
      scr.textCenter(p.text, p.x, p.y, p.color, { size: big });
      scr.ctx.restore();
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
      greenfield: { sky0: '#27406f', sky1: '#86a2c4', far: '#2c4a34', ground: '#4a7a3e', gdark: '#2f5029', speck: '#568c48', grade: '#a8d0ff' },
      caverns:    { sky0: '#0e0c18', sky1: '#241d34', far: '#1d1628', ground: '#5a5040', gdark: '#332d24', speck: '#6a5e4a', grade: '#7f9ad8' },
      ruins:      { sky0: '#150c26', sky1: '#3c2450', far: '#241531', ground: '#4e4860', gdark: '#2d2839', speck: '#5e5870', grade: '#b088ff' },
      abyss:      { sky0: '#0a0616', sky1: '#241040', far: '#170a28', ground: '#3a2c52', gdark: '#211838', speck: '#4e3c72', grade: '#a86cff' },
      boss:       { sky0: '#120818', sky1: '#3a1834', far: '#200f26', ground: '#403050', gdark: '#241a34', speck: '#4e3c60', grade: '#ff8ad0' },
    }[region] ?? { sky0: '#101020', sky1: '#28284a', far: '#1c1c34', ground: '#4a4458', gdark: '#2c2838', speck: '#5a5468', grade: '#9ab0e0' };
    scr.setGrade(T.grade, region === 'greenfield' ? 0.08 : 0.18);
    scr.vignette = region === 'greenfield' ? 0.48 : 0.68;
    scr.bloom = region === 'greenfield' ? 0.3 : 0.6;

    const HORIZON = 60;   // above the front rank's feet, so the ranks stand on it
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
    while (sy < H) { scr.rect(0, sy, W, 1, 'rgba(0,0,0,0.13)'); sy += step; step += 0.42; }
    // depth haze along the horizon, and a key light from the upper left
    scr.vgrad(0, HORIZON - 26, W, 34, 'rgba(0,0,0,0)', `${T.far}bb`);
    scr.light(W * 0.22, HORIZON - 30, 190, 'rgba(150,185,255,0.16)', 0.55);
  }

  drawGrid(scr, side) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const { x, y } = this.cellPos(side, row, col);
        const front = col === this.battle.frontColumn(side);
        // an oval of shadow marking the cell, brighter on the reachable
        // front rank so the reach rule is visible at a glance
        const cx = x + CELL_W / 2 - 4, cy = y + CELL_H - 4;
        scr.shade(cx, cy, 17, front ? 0.34 : 0.2);
        if (front) {
          scr.ctx.save();
          scr.ctx.globalAlpha = 0.30;
          scr.rect(cx - 14, cy - 3, 28, 1, '#9db4f0');
          scr.ctx.restore();
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

    const breathe = Math.round(Math.sin(this.t * 2.2 + p.x * 0.1) * 0.5);
    if (u.isPC) {
      const ch = u.ref;
      const hurtFrame = ch.hp / stats(ch).maxHp < 0.25 ? 2 : 0;
      const cv = actorSprite({
        classId: ch.classId, raceId: ch.raceId, elementId: ch.elementId,
        skin: ch.skin, hair: ch.hair,
        frame: isActor ? 3 : (hurtFrame || (breathe ? 1 : 0)),
      });
      scr.ctx.drawImage(cv, Math.round(p.x + CELL_W / 2 - cv.width / 2), Math.round(p.y + CELL_H - cv.height));
    } else {
      const cv = monsterSprite(u.def.sprite, Math.floor(this.t * 2.5) % 2);
      scr.ctx.drawImage(cv, Math.round(p.x + CELL_W / 2 - cv.width / 2), Math.round(p.y + CELL_H + 3 - cv.height));
    }
    scr.ctx.restore();

    if (isTarget) {
      const bob = Math.round(Math.sin(this.t * 8) * 2);
      scr.light(p.x + CELL_W / 2 - 4, p.y + CELL_H - 6, 22, 'rgba(240,180,76,0.55)', 0.5);
      scr.text('▼', p.x + CELL_W / 2 - 6, p.y - 6 + bob, PAL.accent);
    }
    if (isActor) scr.light(p.x + CELL_W / 2 - 4, p.y + CELL_H - 6, 22, 'rgba(92,210,240,0.55)', 0.45);

    // enemy HP pip and status icons
    if (!u.isPC && u.alive) {
      const s = u.stats();
      const showHp = this.g.hasJob('appraiser') || this.battle.revealed;
      if (showHp) scr.bar(p.x + CELL_W / 2 - 18, p.y + CELL_H + 4, 36, 3, u.hp / s.maxHp, PAL.red);
    }
    const st = Object.keys(u.statuses).filter((k) => STATUS[k]);
    st.slice(0, 3).forEach((k, i) => {
      scr.rect(p.x + CELL_W / 2 - 10 + i * 7, p.y + 2, 5, 5, STATUS[k].kind === 'bad' ? PAL.magenta : PAL.cyan);
    });
  }

  /**
   * The party roster, on the right: one card per member. During 'command' —
   * the state a player actually spends time reading this in — the panel
   * grows upward to make room for a small bust portrait per card, the same
   * sprite the field and menu scenes already generate, cropped to head and
   * shoulders and drawn at 2x rather than shown as plain text rows.
   */
  drawStatusBar(scr) {
    const b = this.battle;
    const tall = this.state === 'command';
    const px = PANEL_X, pw = W - PANEL_X - 12;
    const py = tall ? MSG_Y : BAR_Y;
    const ph = tall ? BAR_Y + BAR_H - MSG_Y : BAR_H;
    scr.panel(px, py, pw, ph);
    const cardW = Math.floor((pw - 16) / b.party.length);
    b.party.forEach((u, i) => {
      const x = px + 8 + i * cardW;
      const ch = u.ref;
      const s = u.stats();
      const active = this.actor?.uid === u.uid;
      const ratio = ch.hp / s.maxHp;
      const y = py + 9;
      if (active) {
        scr.rect(x - 3, y - 4, cardW - 4, ph - 12, 'rgba(120,155,235,0.16)');
        scr.rect(x - 3, y - 4, 2, ph - 12, PAL.accent);
      }
      let ty = y;
      if (tall) {
        const bust = actorPortraitSprite({
          classId: ch.classId, raceId: ch.raceId, elementId: ch.elementId,
          skin: ch.skin, hair: ch.hair,
        });
        const dh = Math.min(ph - 40, bust.height * 2);
        const dw = Math.min(cardW - 16, bust.width * (dh / bust.height));
        scr.ctx.save();
        if (!u.alive) scr.ctx.globalAlpha = 0.35;
        scr.ctx.drawImage(bust, 0, 0, bust.width, bust.height,
          x + (cardW - 12 - dw) / 2, ty, dw, dh);
        scr.ctx.restore();
        ty += dh + 3;
      }
      scr.text(ch.name.slice(0, 9), x, ty, !u.alive ? PAL.grey : active ? PAL.accent : PAL.text);
      scr.text(`${ch.hp}`, x, ty + 13, hpColor(ratio));
      scr.text(`/${s.maxHp}`, x + scr.textWidth(`${ch.hp}`) + 2, ty + 13, PAL.textFaint);
      scr.bar(x, ty + 25, cardW - 12, 4, ratio, hpColor(ratio));
      scr.bar(x, ty + 31, cardW - 12, 3, s.maxMp ? ch.mp / s.maxMp : 0, PAL.cyan);
      scr.bar(x, ty + 36, cardW - 12, 3, ch.ip / 100, PAL.magenta);
    });
  }

  /** A message strip above the bottom bar; used by every transient line. */
  msgBox(scr, text, color = PAL.text) {
    scr.panel(12, MSG_Y, W - 24, MSG_H, { accent: true, accentWidth: 22 });
    scr.textWrap(text, 24, MSG_Y + 11, W - 48, color, { maxLines: 2, lineHeight: 12 });
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

    // The compact, non-interactive wheel shown during target/move selection —
    // just enough to remember what was chosen. The active picker below is a
    // different, taller rendering entirely, not this box made bigger.
    const cmdBox = () => {
      scr.panel(12, BAR_Y, PANEL_X - 24, BAR_H);
      scr.text(this.actor?.name ?? '', 24, BAR_Y + 8, PAL.textDim);
      scr.rect(24, BAR_Y + 18, PANEL_X - 48, 1, PAL.line);
      const cell = 14;
      this.cmdWheel.cell = cell;
      this.cmdWheel.x = 12 + (PANEL_X - 24 - 3 * cell) / 2;
      this.cmdWheel.y = BAR_Y + 22;
      this.cmdWheel.draw(scr, { inactive: true });
    };

    if (this.state === 'command') {
      // One tall panel spanning what is normally the message strip and the
      // bar beneath it — the wheel needs the room, and HP/MP already live on
      // this character's own card in the status panel to the right, so the
      // header here only needs to name the actor and show IP.
      const y0 = MSG_Y, h0 = BAR_Y + BAR_H - MSG_Y;
      scr.panel(12, y0, PANEL_X - 24, h0, { accent: true });
      const ch = this.actor.ref;
      scr.text(this.actor.name, 24, y0 + 8, PAL.accent);
      scr.textRight(ELEMENT_BY_ID[ch.elementId].name, PANEL_X - 36, y0 + 8, ELEMENT_BY_ID[ch.elementId].color);
      scr.text('IP', 24, y0 + 19, PAL.magenta);
      scr.bar(38, y0 + 20, 62, 5, ch.ip / 100, PAL.magenta);
      scr.textRight(this.cmdWheel.current?.label ?? '', PANEL_X - 36, y0 + 19, PAL.text);
      scr.rect(24, y0 + 29, PANEL_X - 48, 1, PAL.line);
      const cell = 22;
      this.cmdWheel.cell = cell;
      this.cmdWheel.x = 12 + (PANEL_X - 24 - 3 * cell) / 2;
      this.cmdWheel.y = y0 + 34;
      this.cmdWheel.draw(scr);
      // the gold border on the chosen tile already says which one is selected
      scr.textCenter('Z select · X back', 12 + (PANEL_X - 24) / 2, y0 + h0 - 10, PAL.textFaint);
    } else if (this.state === 'skill' || this.state === 'item') {
      scr.panel(12, 104, 208, 152, { accent: true });
      scr.heading(this.state === 'skill' ? 'ARTS' : 'ITEMS', 26, 114, 180);
      scr.textRight(this.actor.name, 208, 114, PAL.textDim);
      this.listMenu.x = 36; this.listMenu.y = 132;
      this.listMenu.cellW = 172; this.listMenu.rows = 8; this.listMenu.cellH = 14;
      this.listMenu.draw(scr);
      if (this.listMenu.length) {
        scr.panel(228, 104, W - 240, 92, { accent: true });
        const bx = 242, bw = W - 268;
        if (this.state === 'skill') {
          const k = getSkill(this.listMenu.current.id);
          scr.text(k.name, bx, 114, PAL.accent);
          scr.rect(bx, 124, bw, 1, PAL.line);
          scr.textWrap(k.blurb ?? '', bx, 132, bw, PAL.textDim, { lineHeight: 11, maxLines: 3 });
          const el = k.element === 'attuned' ? this.actor.ref.elementId : k.element;
          scr.text(`reach ${k.range}`, bx, 170, PAL.text);
          scr.text(k.target, bx + 76, 170, PAL.text);
          if (el && el !== 'none') scr.textRight(ELEMENT_BY_ID[el].name, bx + bw, 170, ELEMENT_BY_ID[el].color);
        } else {
          const it = getItem(this.listMenu.current.id);
          scr.text(it.name, bx, 114, PAL.accent);
          scr.rect(bx, 124, bw, 1, PAL.line);
          const d = it.heal ? `Restores ${it.heal} HP.` : it.healMp ? `Restores ${it.healMp} MP.`
            : it.cures ? `Cures ${it.cures.join(', ')}.` : it.damage ? `${it.damage} damage.` : '';
          scr.textWrap(d, bx, 132, bw, PAL.textDim, { lineHeight: 11, maxLines: 3 });
        }
      }
    } else if (this.state === 'target') {
      const t = this.targetPool[this.targetIndex];
      scr.panel(12, MSG_Y, W - 24, MSG_H, { accent: true, accentWidth: 22 });
      scr.text('CHOOSE A TARGET', 24, MSG_Y + 9, PAL.accent);
      if (t) {
        scr.text(this.battle.label(t), 24, MSG_Y + 24, PAL.text);
        if (t.element && t.element !== 'none') {
          scr.rect(152, MSG_Y + 25, 4, 6, ELEMENT_BY_ID[t.element].color);
          scr.text(ELEMENT_BY_ID[t.element].name, 160, MSG_Y + 24, ELEMENT_BY_ID[t.element].color);
        }
        if (t.side !== this.actor.side) {
          const dist = this.battle.distance(this.actor, t);
          const reach = this.targetSpec.reach ?? this.targetSpec.range ?? 9;
          const ok = dist <= reach;
          scr.textRight(ok ? `range ${dist} / reach ${reach}`
            : `range ${dist} / reach ${reach} — half damage`,
            W - 24, MSG_Y + 24, ok ? PAL.green : PAL.red);
        }
      }
      cmdBox();
    } else if (this.state === 'move') {
      scr.panel(12, MSG_Y, W - 24, MSG_H, { accent: true, accentWidth: 22 });
      scr.text('REPOSITION', 24, MSG_Y + 9, PAL.accent);
      scr.text('Column 0 is the front rank: it reaches, and it is reached.', 24, MSG_Y + 24, PAL.textDim);
      scr.textRight(`row ${this.moveCursor.row}   column ${this.moveCursor.col}`, W - 24, MSG_Y + 24, PAL.text);
      cmdBox();
    }
  }
}
