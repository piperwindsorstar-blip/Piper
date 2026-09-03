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
import { actorSprite, monsterSprite } from '../../engine/sprites.js';
import { Particles } from '../../engine/particles.js';
import { Battle, PHASE, gridNeighbors } from '../battle.js';
import { stats, usableSkills, awardExp, refreshPromotion, skillElement } from '../character.js';
import { getSkill, STATUS } from '../../data/skills.js';
import { getItem } from '../../data/items.js';
import { ELEMENT_BY_ID } from '../../data/elements.js';
import { sfx, playMusic } from '../../engine/audio.js';
import { BATTLE_THEME, BOSS_THEME, VICTORY_THEME } from '../../data/music.js';

// Two stacked bands on a 480x270 stage: the enemy formation across the top
// 39%, the party's own 3x3 grid across the bottom 60% (the leftover 1% is
// the horizon seam between them). Column 0 is still "the front rank" for
// both sides — it just now reads as *nearest the seam* rather than nearest
// the middle of the screen, so the two front ranks face each other directly
// across the divide instead of down a shared horizontal lane.
const CELL_W = 48, CELL_H = 40;
const SEAM_TOP = Math.round(H * 0.39), SEAM_BOTTOM = H - Math.round(H * 0.60);
const CENTER_X = W / 2, FILE_STEP = 108;
const ENEMY_GROUND = [95, 71, 47];      // ground-line y per column, front to back
const PARTY_GROUND = [156, 198, 240];

// a message/status strip straddling the seam, used for turn narration
const MSG_Y = SEAM_TOP - 11, MSG_H = 40;

const MSG_TIME = 0.85;

// Attack animation: a small pull-back, a lunge toward the foe timed to land
// exactly when the hit resolves (so shake/particles/sfx land on the impact
// frame instead of a beat before it), then a settle back to formation.
const ATK_WINDUP = 0.12, ATK_STRIKE = 0.08, ATK_RECOIL = 0.14;

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
    this.cmdWheel = new CommandWheel({ cell: 32 });
    this.listMenu = new Menu({ items: [], x: 36, y: 120, cellW: 150, cellH: 13, rows: 7 });
    this.fxp = new Particles(360);
    this.projectiles = [];
    this.deathAnims = new Map();
    this.statusFxT = 0;
    this.leveledUids = new Set();
    this.result = null;
    this.introDur = 1.1;
    this.introT = this.introDur;
    this.hitPause = 0;
    playMusic(this.battle.isBoss ? 'boss' : 'battle', this.battle.isBoss ? BOSS_THEME : BATTLE_THEME);
    // a small impact as the fight opens: a jolt, a white flash, and both
    // sides slide in from off-screen (see unitPos) instead of just appearing
    this.app.screen.addShake(6);
    this.flash = 0.16;
    sfx.encounter();
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
      if (fx.type === 'damage' || fx.type === 'heal') {
        if (!u) continue;
        const p = this.unitPos(u);
        const cx = p.x + CELL_W / 2 - 8, cy = p.y + CELL_H - 26;
        const col = fx.type === 'heal' ? PAL.green : (fx.element && fx.element !== 'none'
          ? ELEMENT_BY_ID[fx.element]?.color ?? PAL.white : PAL.white);
        this.popups.push({
          x: cx, y: cy, life: 1.0,
          text: fx.type === 'heal' ? `+${fx.amount}` : `${fx.amount}`, color: col,
          big: !!fx.crit,
        });
        if (fx.type === 'damage') {
          this.flash = fx.crit ? 0.22 : 0.14;
          this.app.screen.addShake(fx.crit ? 9 : 4);
          this.fxp.burst(cx, cy + 10, col, fx.crit ? 26 : 14, fx.crit ? 130 : 80);
          sfx.hit(fx.crit);
          if (fx.crit) this.hitPause = 0.08;
        } else {
          this.fxp.rise(cx, cy + 12, col, 12, 12);
          sfx.heal();
        }
      } else if (fx.type === 'miss') {
        if (u) {
          const p = this.unitPos(u);
          this.popups.push({
            x: p.x + CELL_W / 2 - 8, y: p.y + CELL_H - 26, life: 1.0, text: 'MISS', color: PAL.textDim,
          });
        }
        sfx.miss();
      } else if (fx.type === 'buff') {
        sfx.buff();
      } else if (fx.type === 'debuff') {
        sfx.debuff();
      } else if (fx.type === 'death') {
        if (u) {
          const p = this.unitPos(u);
          const col = ELEMENT_BY_ID[fx.element]?.color ?? PAL.white;
          this.deathAnims.set(fx.uid, { t: 0, dur: 0.55 });
          this.fxp.burst(p.x + CELL_W / 2 - 4, p.y + CELL_H - 20, col, 22, 70);
        }
      }
    }
    this.battle.fx.length = 0;
  }

  // --- layout --------------------------------------------------------------
  cellPos(side, row, col) {
    const ground = (side === 'enemy' ? ENEMY_GROUND : PARTY_GROUND)[col];
    const fileCenterX = CENTER_X + (row - 1) * FILE_STEP;
    return { x: fileCenterX - CELL_W / 2, y: ground - CELL_H };
  }

  unitPos(u) {
    const p = this.cellPos(u.side, u.grid.row, u.grid.col);
    if (this.state === 'intro') {
      // both ranks slide in from off-screen — enemies down from above the
      // top edge, the party up from below the bottom edge — and settle as
      // the intro banner reads, rather than simply appearing in formation
      const k = (this.introT / this.introDur) ** 2;
      const dir = u.side === 'enemy' ? -1 : 1;
      return { x: p.x, y: p.y + dir * 90 * k };
    }
    if (this.attackAnim && this.attackAnim.uid === u.uid && this.attackAnim.foe) {
      const a = this.attackAnim;
      const dir = u.side === 'party' ? -1 : 1;   // lunge toward the opposing side, across the seam
      let k = 0;
      if (a.phase === 'windup') k = -0.35 * (a.t / ATK_WINDUP);
      else if (a.phase === 'strike') k = -0.35 + 1.35 * (a.t / ATK_STRIKE);   // continues from windup's -0.35 up to a full 1.0 lunge
      else k = 1 - (a.t / ATK_RECOIL);
      return { x: p.x, y: p.y + dir * 11 * k };
    }
    return p;
  }

  // --- update --------------------------------------------------------------
  update(dt, input) {
    if (this.hitPause > 0) {
      this.hitPause = Math.max(0, this.hitPause - dt);
      dt = 0;   // a brief freeze-frame on a critical hit, for punch
    }
    this.t += dt;
    this.fxp.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.cmdWheel.update(dt);
    this.listMenu.update(dt);
    for (const p of this.popups) { p.life -= dt; p.y -= dt * 22; }
    this.popups = this.popups.filter((p) => p.life > 0);
    for (const pr of this.projectiles) {
      pr.t += dt;
      // a faint trail along the flight path
      const k = Math.min(1, pr.t / pr.dur);
      const x = pr.x0 + (pr.x1 - pr.x0) * k;
      const y = pr.y0 + (pr.y1 - pr.y0) * k - Math.sin(k * Math.PI) * 9;
      this.fxp.spawn({ x, y, life: 0.18, size: 1, color: pr.color, glow: true });
    }
    this.projectiles = this.projectiles.filter((pr) => pr.t < pr.dur);
    for (const [uid, d] of this.deathAnims) {
      d.t += dt;
      if (d.t >= d.dur) this.deathAnims.delete(uid);
    }
    this.updateStatusFx(dt);

    if (this.state === 'intro') {
      this.introT -= dt;
      if (this.introT <= 0 || input.tap('confirm')) { this.state = 'messages'; }
      return;
    }

    if (this.state === 'messages') return this.updateMessages(dt, input);
    if (this.state === 'done') return this.updateDone(dt, input);
    if (this.state === 'attacking') return this.updateAttacking(dt);
    if (this.state === 'victoryPose') return this.updateVictoryPose(dt, input);

    switch (this.state) {
      case 'command': return this.updateCommand(input);
      case 'skill': return this.updateSkillList(input);
      case 'item': return this.updateItemList(input);
      case 'target': return this.updateTarget(input);
      case 'move': return this.updateMove(input);
      default: break;
    }
  }

  /** A slow bubble/ember/frost drift off any unit carrying that status —
   *  cheap, additive, and reuses the same particle language as everything
   *  else in this scene rather than tinting the (cached, shared) sprites. */
  updateStatusFx(dt) {
    this.statusFxT += dt;
    if (this.statusFxT < 0.22) return;
    this.statusFxT = 0;
    for (const u of this.battle.units()) {
      if (!u.alive) continue;
      const p = this.unitPos(u);
      const cx = p.x + CELL_W / 2 - 4, cy = p.y + CELL_H - 16;
      if (u.statuses.poison) {
        this.fxp.spawn({
          x: cx + (Math.random() - 0.5) * 10, y: cy, vx: (Math.random() - 0.5) * 4, vy: -14 - Math.random() * 8,
          life: 0.7, color: '#7ee08a', glow: true, size: 1,
        });
      }
      if (u.statuses.burn) {
        this.fxp.spawn({
          x: cx + (Math.random() - 0.5) * 10, y: cy, vx: (Math.random() - 0.5) * 10, vy: -22 - Math.random() * 14,
          life: 0.4, color: Math.random() < 0.5 ? '#ff8a3c' : '#ffd24a', glow: true, size: 1,
        });
      }
      if (u.statuses.freeze) {
        this.fxp.spawn({
          x: cx + (Math.random() - 0.5) * 14, y: cy + (Math.random() - 0.5) * 10, vx: 0, vy: -4,
          life: 0.5, color: '#bfe8ff', glow: true, size: 1, fade: true,
        });
      }
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
        this.runAction(u, b.enemyAction(u));
      }
    }
  }

  updateAttacking(dt) {
    const a = this.attackAnim;
    a.t += dt;
    if (a.phase === 'windup' && a.t >= ATK_WINDUP) {
      a.phase = 'strike';
      a.t = 0;
      // resolve right on the strike frame, so the hit fx land on the lunge
      this.battle.act(this.pendingUnit, this.pendingAction);
      this.flushLog();
    } else if (a.phase === 'strike' && a.t >= ATK_STRIKE) {
      a.phase = 'recoil';
      a.t = 0;
    } else if (a.phase === 'recoil' && a.t >= ATK_RECOIL) {
      this.attackAnim = null;
      this.pendingUnit = null;
      this.pendingAction = null;
      this.needsAdvance = true;
      this.state = 'messages';
      this.msgT = 0;
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
    const confirmed = input.tap('confirm');
    if (confirmed && this.cmdWheel.disabled()) { sfx.error(); return; }
    if (confirmed) {
      sfx.confirm();
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
    if (input.tap('cancel')) { sfx.cancel(); this.state = 'command'; return; }
    if (input.tap('confirm') && this.listMenu.length) {
      sfx.confirm();
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
    if (input.tap('cancel')) { sfx.cancel(); this.state = 'command'; return; }
    if (input.tap('confirm') && this.listMenu.length) {
      sfx.confirm();
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
    if (input.tap('cancel')) { sfx.cancel(); this.state = 'command'; return; }
    const d = input.dir();
    if (d.x || d.y) {
      const step = (d.x > 0 || d.y > 0) ? 1 : -1;
      this.targetIndex = (this.targetIndex + step + this.targetPool.length) % this.targetPool.length;
      sfx.move();
    }
    if (input.tap('confirm')) {
      sfx.confirm();
      const t = this.targetPool[this.targetIndex];
      const cb = this.onPickTarget;
      this.onPickTarget = null;
      cb(t);
    }
  }

  updateMove(input) {
    const d = input.dir();
    if (d.y) { this.moveCursor.row = Math.max(0, Math.min(2, this.moveCursor.row + d.y)); sfx.move(); }
    if (d.x) { this.moveCursor.col = Math.max(0, Math.min(2, this.moveCursor.col + d.x)); sfx.move(); }
    if (input.tap('cancel')) { sfx.cancel(); this.state = 'command'; return; }
    if (input.tap('confirm')) {
      sfx.confirm();
      this.perform({ kind: 'move', row: this.moveCursor.row, col: this.moveCursor.col });
    }
  }

  perform(action) { this.runAction(this.actor, action); }

  /**
   * Resolve one action for `unit`. Attack/skill/item actions get a brief
   * windup-strike-recoil animation first (see updateAttacking) so the sprite
   * visibly closes the distance before the hit lands; anything else (guard,
   * move, flee) resolves immediately as it always did.
   */
  runAction(unit, action) {
    if (['attack', 'skill', 'item'].includes(action.kind)) {
      const t = action.target;
      const foe = !!t && t !== unit && t.side !== unit.side;
      this.attackAnim = { uid: unit.uid, phase: 'windup', t: 0, foe };
      this.pendingUnit = unit;
      this.pendingAction = action;
      this.state = 'attacking';
      if (foe) this.spawnProjectile(unit, t, action);
      return;
    }
    this.battle.act(unit, action);
    this.flushLog();
    this.needsAdvance = true;
    this.state = 'messages';
    this.msgT = 0;
  }

  /**
   * What an action should look like closing the distance: a bow shot, a cast
   * spell or a thrown item flies across the field as a coloured bolt; a
   * weapon swing just lands where the lunge already carried the attacker.
   * `reach >= 9` is this game's own shorthand for "hits from anywhere" (see
   * the how-to-play text), which is exactly the set of things that should
   * read as ranged rather than melee.
   */
  actionVisual(unit, action) {
    if (action.kind === 'attack') {
      const weapon = unit.isPC && unit.ref.equip?.weapon ? getItem(unit.ref.equip.weapon) : null;
      const element = weapon?.element && weapon.element !== 'none' ? weapon.element : null;
      return { element, ranged: unit.stats().reach >= 9 };
    }
    if (action.kind === 'skill') {
      const skill = getSkill(action.skillId);
      const element = unit.isPC ? skillElement(unit.ref, skill)
        : (skill.element === 'attuned' ? unit.element : skill.element);
      return { element, ranged: skill.type !== 'phys' || (skill.range ?? 0) >= 9 };
    }
    if (action.kind === 'item') {
      const it = getItem(action.itemId);
      return { element: it.element && it.element !== 'none' ? it.element : null, ranged: !!it.damage };
    }
    return { element: null, ranged: false };
  }

  /** A small bolt travelling attacker -> target, timed to arrive right
   *  around when the hit resolves. Purely cosmetic — the fixed windup timer
   *  still drives the actual resolution, so a slow bolt never delays a turn. */
  spawnProjectile(unit, target, action) {
    const vis = this.actionVisual(unit, action);
    if (!vis.ranged) return;
    const from = this.unitPos(unit), to = this.unitPos(target);
    const color = vis.element ? (ELEMENT_BY_ID[vis.element]?.color ?? PAL.white) : PAL.white;
    this.projectiles.push({
      x0: from.x + CELL_W / 2 - 8, y0: from.y + CELL_H - 26,
      x1: to.x + CELL_W / 2 - 8, y1: to.y + CELL_H - 26,
      t: 0, dur: 0.2, color,
    });
  }

  // --- resolution ----------------------------------------------------------
  finish() {
    if (this.state === 'done' || this.state === 'victoryPose') return;
    const b = this.battle;
    const msgs = [];
    if (b.result === 'victory') {
      playMusic('victory', VICTORY_THEME);
      sfx.victory();
      const spoils = b.spoils();
      msgs.push(`Victory! ${spoils.exp} EXP, ${spoils.gold} gold and ${spoils.lp} LP.`);
      this.g.earn(spoils.gold);
      this.g.lp += spoils.lp;
      for (const id of spoils.items) {
        if (this.g.addItem(id)) msgs.push(`Found ${getItem(id).name}.`);
      }
      const promos = [];
      const leveledRefs = new Set();
      for (const ch of this.g.party) {
        const r = awardExp(ch, spoils.exp);
        if (r.levels) { msgs.push(`${ch.name} reaches level ${ch.level}!`); leveledRefs.add(ch); }
        if (refreshPromotion(ch)) promos.push(ch);
      }
      if (leveledRefs.size) sfx.levelUp();
      this.leveledUids = new Set(b.party.filter((u) => leveledRefs.has(u.ref)).map((u) => u.uid));
      msgs.push(...this.g.jobTickAll(6));
      // record the bestiary
      for (const e of b.enemies) this.g.bestiary[e.def.id] = (this.g.bestiary[e.def.id] ?? 0) + 1;
      if (promos.length) {
        msgs.push(`${promos.map((c) => c.name).join(', ')} ${promos.length > 1 ? 'are' : 'is'} ready for a promotion.`);
      }
      this.readyPromotions = promos.length > 0;
    } else if (b.result === 'fled') {
      sfx.flee();
      msgs.push('Got away.');
    } else if (b.result === 'defeat') {
      sfx.defeat();
    }
    this.result = {
      outcome: b.result,
      bossFlag: this.opts.bossFlag ?? null,
    };
    this.doneMsgs = msgs;
    this.doneIndex = 0;
    if (b.result === 'victory') {
      this.state = 'victoryPose';
      this.victoryT = 0;
      for (const u of b.livingParty()) {
        const p = this.unitPos(u);
        const leveledUp = this.leveledUids.has(u.uid);
        this.fxp.burst(p.x + CELL_W / 2 - 4, p.y + CELL_H - 20,
          ELEMENT_BY_ID[u.element]?.color ?? PAL.gold, leveledUp ? 30 : 14, leveledUp ? 95 : 55);
        if (leveledUp) this.fxp.rise(p.x + CELL_W / 2 - 4, p.y + CELL_H - 30, PAL.gold, 10, 14);
      }
    } else {
      this.state = 'done';
      this.doneT = 0;
    }
  }

  updateVictoryPose(dt, input) {
    this.victoryT += dt;
    if (this.victoryT > 0.7 || input.tap('confirm')) {
      this.state = 'done';
      this.doneT = 0;
    }
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

    this.drawProjectiles(scr);
    this.fxp.draw(scr);
    for (const p of this.popups) {
      const a = Math.min(1, p.life / 0.35);
      scr.ctx.save();
      scr.ctx.globalAlpha = a;
      const big = p.big ? 16 : (p.text.length <= 4 ? 12 : 8);
      scr.textCenter(p.text, p.x, p.y, p.color, { size: big });
      scr.ctx.restore();
    }

    if (this.flash > 0) scr.fade(this.flash * 1.4, '#ffffff');

    this.drawUi(scr);

    if (this.state === 'intro') {
      const names = [...new Set(b.enemies.map((e) => e.name))].join(', ');
      this.msgBox(scr, `${names} ${b.enemies.length > 1 ? 'block the way!' : 'blocks the way!'}`);
    } else if (this.state === 'victoryPose') {
      this.msgBox(scr, 'Victory!', PAL.gold);
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

    const HORIZON = SEAM_TOP;   // the sky/ground line matches the enemy/party seam exactly
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
    const isActor = (this.actor?.uid === u.uid && ['command', 'skill', 'item', 'target', 'move'].includes(this.state))
      || this.attackAnim?.uid === u.uid;

    // a boss winding up telegraphs the coming hit with a pulsing red glow and
    // a warning glyph, so a big attack reads as threat before it lands, not
    // just as a number after the fact
    if (this.attackAnim?.uid === u.uid && this.attackAnim.phase === 'windup' && !u.isPC && u.def?.ai === 'boss') {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 26);
      scr.light(p.x + CELL_W / 2 - 4, p.y + CELL_H - 12, 26 + pulse * 6, 'rgba(255,60,70,0.6)', 0.4 + pulse * 0.3);
      scr.textCenter('!', p.x + CELL_W / 2 - 4, p.y - 10, PAL.red, { size: 12 });
    }

    // reach shading while choosing a target
    let dim = false;
    if (this.state === 'target' && this.targetSpec && u.side !== this.actor.side) {
      const reach = this.targetSpec.reach ?? this.targetSpec.range ?? 9;
      dim = !this.battle.inReach(this.actor, u, reach);
    }

    // a defeated unit staggers and dissolves over half a second rather than
    // instantly snapping to its resting "already dead" look
    const dying = this.deathAnims.get(u.uid);
    let offsetX = 0, offsetY = 0;
    if (dying) {
      const k = dying.t / dying.dur;
      offsetY = k * 7;
      offsetX = Math.sin(dying.t * 46) * (1 - k) * 3;
    } else if (this.state === 'victoryPose' && u.isPC && u.alive) {
      // a little hop for everyone still standing, staggered per unit so the
      // whole party doesn't bounce in lockstep
      offsetY = -Math.abs(Math.sin(this.victoryT * 9 + p.x * 0.05)) * 4;
    }

    scr.ctx.save();
    if (dying) scr.ctx.globalAlpha = 1 - dying.t / dying.dur;
    else if (dead) scr.ctx.globalAlpha = 0.25;
    else if (dim) scr.ctx.globalAlpha = 0.4;

    const breathe = Math.round(Math.sin(this.t * 2.2 + p.x * 0.1) * 0.5);
    if (u.isPC) {
      const ch = u.ref;
      const hurtFrame = ch.hp / stats(ch).maxHp < 0.25 ? 2 : 0;
      const cv = actorSprite({
        classId: ch.classId, raceId: ch.raceId, elementId: ch.elementId,
        skin: ch.skin, hair: ch.hair, equip: ch.equip,
        frame: isActor ? 3 : (hurtFrame || (breathe ? 1 : 0)),
      });
      scr.ctx.drawImage(cv, Math.round(p.x + CELL_W / 2 - cv.width / 2 + offsetX), Math.round(p.y + CELL_H - cv.height + offsetY));
    } else {
      const cv = monsterSprite(u.def.sprite, Math.floor(this.t * 2.5) % 2);
      scr.ctx.drawImage(cv, Math.round(p.x + CELL_W / 2 - cv.width / 2 + offsetX), Math.round(p.y + CELL_H + 3 - cv.height + offsetY));
    }
    scr.ctx.restore();

    if (this.state === 'victoryPose' && u.alive && this.leveledUids.has(u.uid)) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 12);
      scr.light(p.x + CELL_W / 2 - 4, p.y + CELL_H - 18, 24 + pulse * 4, 'rgba(240,200,80,0.55)', 0.45 + pulse * 0.25);
      scr.textCenter('LEVEL UP!', p.x + CELL_W / 2 - 4, p.y - 14, PAL.gold, { size: 8 });
    }

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

    // party stat card: name, HP, MP and IP, pinned beside each member's own
    // sprite (leaning outward, away from the centre file, so it never runs
    // off the side of the screen) — replaces the old side roster panel, so
    // the numbers that matter live wherever that character is standing,
    // not off in a corner the player has to glance away to read.
    if (u.isPC) {
      const ch = u.ref;
      const s = u.stats();
      const ratio = ch.hp / s.maxHp;
      const outward = u.grid.row < 1 ? -1 : 1;
      const cardW = 42;
      const cx = outward > 0 ? p.x + CELL_W + 8 : p.x - 8 - cardW;
      const cy = p.y + CELL_H - 32;
      scr.ctx.save();
      if (!u.alive) scr.ctx.globalAlpha = 0.4;
      // a grid-adjacent ally shares a fraction of its own element bias with
      // this unit — a thin tint names which element is currently helping
      const boosters = gridNeighbors(u, this.battle);
      if (boosters.length) {
        scr.rect(cx, cy - 2, cardW, 2, ELEMENT_BY_ID[boosters[0].element]?.color ?? PAL.accent);
      }
      scr.text(ch.name.slice(0, 7), cx, cy, isActor ? PAL.accent : PAL.text);
      scr.bar(cx, cy + 9, cardW, 3, ratio, hpColor(ratio));
      scr.bar(cx, cy + 13, cardW, 2, s.maxMp ? ch.mp / s.maxMp : 0, PAL.cyan);
      scr.bar(cx, cy + 16, cardW, 2, ch.ip / 100, PAL.magenta);
      scr.ctx.restore();
    }
  }

  /** A travelling bolt — an arced streak with a bright glowing head — for
   *  every ranged or magic action currently in flight. */
  drawProjectiles(scr) {
    for (const pr of this.projectiles) {
      const k = Math.min(1, pr.t / pr.dur);
      const x = pr.x0 + (pr.x1 - pr.x0) * k;
      const y = pr.y0 + (pr.y1 - pr.y0) * k - Math.sin(k * Math.PI) * 9;
      scr.light(x, y, 9, pr.color, 0.6);
      scr.rect(Math.round(x) - 1, Math.round(y) - 1, 2, 2, '#ffffff');
    }
  }

  /** A message strip straddling the seam; used by every transient line. */
  msgBox(scr, text, color = PAL.text) {
    scr.panel(12, MSG_Y, W - 24, MSG_H, { accent: true, accentWidth: 22 });
    scr.textWrap(text, 24, MSG_Y + 11, W - 48, color, { maxLines: 2, lineHeight: 12 });
  }

  /**
   * Where the command wheel should sit for whoever is acting: right beside
   * their own sprite, on whichever side of it has room, clamped so it never
   * runs off the edge of the screen. `size` is the wheel's full width/height
   * (three cells square) at the cell size the caller is about to draw it at.
   */
  wheelPosNearActor(size) {
    const p = this.unitPos(this.actor);
    const cx = p.x + CELL_W / 2, cy = p.y + CELL_H / 2;
    let x = cx + 26;
    if (x + size > W - 6) x = cx - 26 - size;
    x = Math.max(6, Math.min(W - 6 - size, x));
    let y = cy - size / 2;
    y = Math.max(6, Math.min(H - 6 - size, y));
    return { x, y };
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
    // different, bigger rendering entirely, not this box made bigger.
    const cmdBox = () => {
      const cell = 15, size = cell * 3;
      const { x, y } = this.wheelPosNearActor(size);
      scr.panel(x - 6, y - 18, size + 12, size + 24);
      scr.text(this.actor?.name ?? '', x - 2, y - 12, PAL.textDim);
      this.cmdWheel.cell = cell;
      this.cmdWheel.x = x;
      this.cmdWheel.y = y;
      this.cmdWheel.draw(scr, { inactive: true });
    };

    if (this.state === 'command') {
      // The wheel opens right beside whoever's turn it is, at a noticeably
      // bigger size than the reminder box above — this is the picker a
      // player actually spends time reading, so it gets the room.
      const cell = 32, size = cell * 3;
      const { x, y } = this.wheelPosNearActor(size);
      const ch = this.actor.ref;
      scr.panel(x - 8, y - 24, size + 16, size + 34, { accent: true });
      scr.text(this.actor.name, x - 2, y - 18, PAL.accent);
      scr.textRight(ELEMENT_BY_ID[ch.elementId].name, x + size + 6, y - 18, ELEMENT_BY_ID[ch.elementId].color);
      scr.textRight(this.cmdWheel.current?.label ?? '', x + size + 6, y - 6, PAL.text);
      this.cmdWheel.cell = cell;
      this.cmdWheel.x = x;
      this.cmdWheel.y = y;
      this.cmdWheel.draw(scr);
      scr.textCenter('Z select · X back', x + size / 2, y + size + 10, PAL.textFaint);
    } else if (this.state === 'skill' || this.state === 'item') {
      scr.panel(12, 90, 208, 152, { accent: true });
      scr.heading(this.state === 'skill' ? 'ARTS' : 'ITEMS', 26, 100, 180);
      scr.textRight(this.actor.name, 208, 100, PAL.textDim);
      this.listMenu.x = 36; this.listMenu.y = 118;
      this.listMenu.cellW = 172; this.listMenu.rows = 8; this.listMenu.cellH = 14;
      this.listMenu.draw(scr);
      if (this.listMenu.length) {
        scr.panel(228, 90, W - 240, 92, { accent: true });
        const bx = 242, bw = W - 268;
        if (this.state === 'skill') {
          const k = getSkill(this.listMenu.current.id);
          scr.text(k.name, bx, 100, PAL.accent);
          scr.rect(bx, 110, bw, 1, PAL.line);
          scr.textWrap(k.blurb ?? '', bx, 118, bw, PAL.textDim, { lineHeight: 11, maxLines: 3 });
          const el = k.element === 'attuned' ? this.actor.ref.elementId : k.element;
          scr.text(`reach ${k.range}`, bx, 156, PAL.text);
          scr.text(k.target, bx + 76, 156, PAL.text);
          if (el && el !== 'none') scr.textRight(ELEMENT_BY_ID[el].name, bx + bw, 156, ELEMENT_BY_ID[el].color);
        } else {
          const it = getItem(this.listMenu.current.id);
          scr.text(it.name, bx, 100, PAL.accent);
          scr.rect(bx, 110, bw, 1, PAL.line);
          const d = it.heal ? `Restores ${it.heal} HP.` : it.healMp ? `Restores ${it.healMp} MP.`
            : it.cures ? `Cures ${it.cures.join(', ')}.` : it.damage ? `${it.damage} damage.` : '';
          scr.textWrap(d, bx, 118, bw, PAL.textDim, { lineHeight: 11, maxLines: 3 });
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
