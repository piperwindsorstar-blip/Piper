// ============================================================================
//  BATTLE — turn-based, fought on two facing 3x3 grids.
//
//  GRID & REACH (the Lufia: The Legend Returns idea)
//    Each side occupies a 3x3 grid. A unit's EFFECTIVE COLUMN is its column
//    minus the frontmost column its side still occupies — so when the enemy
//    front rank dies, the back rank becomes reachable. Distance between two
//    units is effCol(attacker) + effCol(target) + 1, and a weapon or skill
//    whose reach is lower than that distance either cannot be chosen (skills)
//    or lands at half power (basic attacks).
//
//  IP (also Lufia)
//    Every unit carries an IP gauge, 0-100, filled by dealing and taking
//    damage. Some class Arts cost IP instead of MP, which is what lets a
//    Berserker out of MP still do something frightening.
//
//  Turn order is straight AGI, Dragon Quest style — no ATB.
// ============================================================================

import {
  stats, canAct, tickStatuses, applyStatus, clearBadStatuses, revive, skillElement, jobRank,
  characterHasTrait, elementalResistance,
} from './character.js';
import { getSkill, STATUS } from '../data/skills.js';
import { elementMultiplier, ELEMENT_BY_ID } from '../data/elements.js';
import { getEnemy, FORMATION_BY_ID } from '../data/enemies.js';
import { getItem } from '../data/items.js';
import { RNG } from '../engine/rng.js';

export const PHASE = {
  INTRO: 'intro', INPUT: 'input', RESOLVE: 'resolve',
  VICTORY: 'victory', DEFEAT: 'defeat', FLED: 'fled',
};

let uidCounter = 0;

/** True when a PC unit's race carries `trait`. Enemies never have races. */
const trait = (u, id) => !!(u?.isPC && characterHasTrait(u.ref, id));

/** A unit's level, from either side of the field. */
const levelOf = (u) => (u.isPC ? u.ref.level : u.def.lv);

/**
 * Armour softening constant. A fixed constant makes mitigation collapse as the
 * numbers grow: by level 80 both sides have so much armour that nobody can hurt
 * anybody and fights stall out. Scaling it with the attacker's level keeps the
 * mitigation band roughly constant from level 1 to 99.
 */
const softening = (attackerLevel) => 110 + 13 * attackerLevel;

/**
 * Damage multiplier for how widely an action spreads. Without this a
 * whole-party nuke is strictly better than a single target at the same power:
 * trash dies before it acts, and a boss's group attack wipes the party in one
 * cast. Applies to both sides.
 */
function spread(target) {
  if (target === 'all') return 0.55;
  if (target === 'row' || target === 'col') return 0.78;
  if (target === 'random') return 0.7;
  return 1;
}

// ---------------------------------------------------------------------------
//  UNITS
// ---------------------------------------------------------------------------
// A fraction of a grid-adjacent ally's own element bias bleeds onto you —
// the Lufia: The Legend Returns "Spiritual Force" idea, folded into this
// game's own 13-element wheel instead of a second, disconnected stat
// system. The grid's center slot ends up strongest with no special-casing:
// it has up to 4 orthogonal neighbours where an edge has 3 and a corner
// has 2, so "the center is a battery" falls out of plain adjacency
// counting. Party-side only — extending this to enemies would multiply
// the rebalancing surface across every hand-tuned formation.
const GRID_SHARE = 0.3;

export function gridNeighbors(unit, battle) {
  if (!battle) return [];
  const allies = battle.party;
  return allies.filter((a) => {
    if (a === unit || !a.alive) return false;
    const dr = Math.abs(a.grid.row - unit.grid.row);
    const dc = Math.abs(a.grid.col - unit.grid.col);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  });
}

function gridBonus(unit, battle) {
  const out = {};
  for (const n of gridNeighbors(unit, battle)) {
    const el = ELEMENT_BY_ID[n.element];
    if (!el?.bias) continue;
    for (const [k, v] of Object.entries(el.bias)) out[k] = (out[k] ?? 0) + v * GRID_SHARE;
  }
  return out;
}

function pcUnit(ch, battle) {
  return {
    uid: `u${++uidCounter}`, side: 'party', ref: ch, name: ch.name,
    get hp() { return ch.hp; }, set hp(v) { ch.hp = v; },
    get mp() { return ch.mp; }, set mp(v) { ch.mp = v; },
    get ip() { return ch.ip; }, set ip(v) { ch.ip = v; },
    get statuses() { return ch.statuses; },
    get grid() { return ch.grid; },
    get alive() { return ch.hp > 0; },
    element: ch.elementId,
    isPC: true,
    defending: false,
    stats() { return stats(ch, gridBonus(this, battle)); },
  };
}

function enemyUnit(def, row, col, index) {
  // Enemies have no equipment, so their raw atk/mag are scaled harder than a
  // PC's to land in the same damage band as a geared party member.
  const boss = def.ai === 'boss';
  const s = {
    maxHp: def.hp, maxMp: def.mp,
    power: def.atk * (boss ? 3.4 : 3.0), magic: def.mag * (boss ? 3.2 : 2.8),
    armor: def.def * 2.2, ward: def.res * 2.2,
    speed: def.agi, crit: boss ? 0.10 : 0.04, evade: 0.03 + def.agi * 0.002,
    reach: def.reach, element: def.element,
  };
  return {
    uid: `e${++uidCounter}`, side: 'enemy', def, name: def.name,
    label: def.name, index,
    hp: def.hp, mp: def.mp, ip: 0,
    statuses: {}, grid: { row, col },
    get alive() { return this.hp > 0; },
    element: def.element,
    isPC: false,
    defending: false,
    stats() { return s; },
  };
}

// ---------------------------------------------------------------------------
//  BATTLE
// ---------------------------------------------------------------------------
export class Battle {
  constructor(party, formationId, opts = {}) {
    this.rng = new RNG(opts.seed ?? (Math.random() * 0xffffffff) >>> 0);
    this.formation = FORMATION_BY_ID[formationId];
    if (!this.formation) throw new Error(`unknown formation: ${formationId}`);
    this.isBoss = !!this.formation.boss;
    this.party = party.filter(Boolean).map((c) => pcUnit(c, this));
    // Front-rank wipe (the Lufia: The Legend Returns rule): losing every
    // unit that STARTED in the front column is instant defeat, even with a
    // healthy back line. Snapshotted once here rather than recomputed live,
    // since frontColumn() slides back automatically as the front dies —
    // recomputing it live would make this condition unreachable.
    const startFrontCol = this.party.length ? Math.min(...this.party.map((u) => u.grid.col)) : 0;
    const startFront = this.party.filter((u) => u.grid.col === startFrontCol);
    // Only a fully-staffed front rank (all 3 rows) carries the instant-loss
    // risk — with a 4-person party, 1-2 members caught forward of the rest
    // is just how formations shake out, not the "held the line and broke"
    // moment the rule is meant to punish.
    this.frontRankUids = startFront.length >= 3 ? startFront.map((u) => u.uid) : [];

    // name duplicate enemies "Slime A", "Slime B"
    const counts = {};
    this.enemies = this.formation.cells.map((c, i) => {
      const def = getEnemy(c.id);
      counts[c.id] = (counts[c.id] ?? 0) + 1;
      return enemyUnit(def, c.row, c.col, i);
    });
    for (const id of Object.keys(counts)) {
      if (counts[id] < 2) continue;
      let n = 0;
      for (const e of this.enemies) if (e.def.id === id) e.label = `${e.name} ${String.fromCharCode(65 + n++)}`;
    }

    this.log = [];
    this.phase = PHASE.INTRO;
    this.round = 0;
    this.order = [];
    this.turnIndex = 0;
    this.escapeAttempts = 0;
    this.guaranteedEscape = false;
    this.preemptive = opts.preemptive ?? false;
    this.ambushed = opts.ambushed ?? false;
    this.result = null;
    this.fx = [];         // visual effects queued for the renderer

    // party passives that fire at battle start
    for (const u of this.party) {
      const bard = u.ref.jobId === 'bard' ? jobRank(u.ref) : 0;
      if (bard) u.ip = Math.min(100, u.ip + 8 * bard);
    }
    if (this.preemptive) this.say('The party strikes first!');
    else if (this.ambushed) this.say('Ambushed from behind!');
    this.buildOrder();
  }

  say(msg) { this.log.push(msg); if (this.log.length > 60) this.log.shift(); return msg; }

  units() { return [...this.party, ...this.enemies]; }
  livingParty() { return this.party.filter((u) => u.alive); }
  livingEnemies() { return this.enemies.filter((u) => u.alive); }

  // --- grid ----------------------------------------------------------------
  frontColumn(side) {
    const list = side === 'party' ? this.livingParty() : this.livingEnemies();
    if (!list.length) return 0;
    return Math.min(...list.map((u) => u.grid.col));
  }

  effCol(unit) { return unit.grid.col - this.frontColumn(unit.side); }

  distance(a, b) {
    if (a.side === b.side) return 1;
    return this.effCol(a) + this.effCol(b) + 1;
  }

  inReach(attacker, target, reach) {
    return this.distance(attacker, target) <= reach;
  }

  /** Units a skill/attack could legally hit from `actor`. */
  validTargets(actor, spec) {
    const { target, range } = spec;
    if (target === 'self') return [actor];
    const allies = actor.side === 'party' ? this.livingParty() : this.livingEnemies();
    const foes = actor.side === 'party' ? this.livingEnemies() : this.livingParty();
    if (target === 'ally') return allies;
    if (target === 'allies') return allies;
    const reach = range ?? 9;
    if (target === 'all' || target === 'random') return foes;
    return foes.filter((t) => this.inReach(actor, t, reach));
  }

  /** Expand a chosen target into everything the action actually hits. */
  expandTargets(actor, spec, chosen) {
    const foes = actor.side === 'party' ? this.livingEnemies() : this.livingParty();
    const allies = actor.side === 'party' ? this.livingParty() : this.livingEnemies();
    switch (spec.target) {
      case 'self': return [actor];
      case 'ally': return chosen ? [chosen] : [actor];
      case 'allies': return allies;
      case 'all': return foes;
      case 'row': return foes.filter((t) => t.grid.row === (chosen?.grid.row ?? 1));
      case 'col': return foes.filter((t) => t.grid.col === (chosen?.grid.col ?? 0));
      case 'random': {
        const out = [];
        const n = spec.hits ?? 1;
        for (let i = 0; i < n; i++) if (foes.length) out.push(this.rng.pick(foes));
        return out;
      }
      default: return chosen ? [chosen] : (foes.length ? [foes[0]] : []);
    }
  }

  // --- turn order ----------------------------------------------------------
  buildOrder() {
    const all = this.units().filter((u) => u.alive);
    // A boss is a whole encounter on its own, so it takes two turns a round.
    // The second is a FOLLOW-UP: single-target only, so a boss cannot open a
    // round by casting a party-wide nuke twice.
    const withBosses = all.flatMap((u) => (u.def?.ai === 'boss'
      ? [{ u, extra: false }, { u, extra: true }]
      : [{ u, extra: false }]));
    this.order = withBosses
      .map(({ u, extra }) => {
        let sp = u.stats().speed;
        if (u.statuses.haste) sp *= 1.5;
        if (u.statuses.slow) sp *= 0.6;
        return { u, extra, sp: sp + this.rng.float(0, sp * 0.15) };
      })
      .sort((a, b) => b.sp - a.sp);
    if (this.preemptive && this.round === 0) {
      this.order = [
        ...this.party.filter((u) => u.alive).map((u) => ({ u, extra: false })),
        ...this.enemies.filter((u) => u.alive).map((u) => ({ u, extra: false })),
      ];
    }
    if (this.ambushed && this.round === 0) {
      this.order = [
        ...this.enemies.filter((u) => u.alive).map((u) => ({ u, extra: false })),
        ...this.party.filter((u) => u.alive).map((u) => ({ u, extra: false })),
      ];
    }
    this.turnIndex = 0;
    this.round++;
  }

  current() {
    while (this.turnIndex < this.order.length) {
      const { u } = this.order[this.turnIndex];
      if (u.alive && canAct(u.ref ?? u)) return u;
      this.turnIndex++;
    }
    return null;
  }

  /** True when the current slot is a boss's single-target follow-up. */
  isFollowUp() {
    return !!this.order[this.turnIndex]?.extra;
  }

  /** Advance to the next actor, ticking statuses and rebuilding the order. */
  advance() {
    this.turnIndex++;
    if (this.turnIndex >= this.order.length) {
      for (const u of this.units()) {
        if (!u.alive) continue;
        u.defending = false;
        const lines = u.isPC ? tickStatuses(u.ref) : tickEnemyStatuses(u, this);
        lines.forEach((l) => this.say(l));
        // element and racial regeneration
        if (u.isPC) {
          const us = u.stats();
          if (u.element === 'spirit') u.mp = Math.min(us.maxMp, u.mp + 3);
          if (trait(u, 'glimmer')) u.mp = Math.min(us.maxMp, u.mp + 4);
          if (trait(u, 'regrow')) u.hp = Math.min(us.maxHp, u.hp + Math.max(1, Math.floor(us.maxHp * 0.03)));
        }
      }
      this.checkEnd();
      if (this.phase === PHASE.INPUT || this.phase === PHASE.INTRO) this.buildOrder();
    }
    this.checkEnd();
    return this.current();
  }

  checkEnd() {
    if (!this.livingEnemies().length) { this.phase = PHASE.VICTORY; this.result = 'victory'; }
    else if (!this.livingParty().length) { this.phase = PHASE.DEFEAT; this.result = 'defeat'; }
    else if (!this.result && this.frontRankUids.length
      && this.frontRankUids.every((uid) => !this.party.find((u) => u.uid === uid)?.alive)) {
      // front-rank wipe: instant defeat even with a healthy back line
      this.phase = PHASE.DEFEAT;
      this.result = 'defeat';
      this.defeatReason = 'front-rank';
      this.say('The front line has fallen — the party breaks.');
    }
    return this.phase;
  }

  // --- damage --------------------------------------------------------------
  gainIp(unit, amount) {
    const mult = unit.isPC && unit.ref.equip.accessory === 'ipband' ? 1.5 : 1;
    unit.ip = Math.min(100, unit.ip + amount * mult);
  }

  /** Core damage roll. Returns {damage, crit, mult, missed}. */
  computeDamage(actor, target, opts) {
    const a = actor.stats();
    const d = target.stats();
    const magical = opts.magical;
    let base = (magical ? a.magic : a.power) * (opts.power ?? 1);

    // status modifiers on the attacker
    if (actor.statuses.might && !magical) base *= 1.3;
    if (actor.statuses.focus && magical) base *= 1.3;
    if (actor.statuses.burn && !magical) base *= 0.85;
    if (actor.statuses.fear) base *= 0.75;

    // racial offence
    if (magical && trait(actor, 'arcaneblood')) base *= 1.1;
    if (!magical && trait(actor, 'giant')) base *= 1.15;
    if (!magical && trait(actor, 'packborn')) {
      const side = actor.side === 'party' ? this.livingParty() : this.livingEnemies();
      if (side.some((u) => u.uid !== actor.uid && u.grid.row === actor.grid.row)) base *= 1.12;
    }

    // accuracy
    let evade = d.evade;
    if (trait(actor, 'longsight') && (opts.reach ?? 9) >= 9) evade = Math.max(0, evade - 0.05);
    if (target.statuses.evade) evade += 0.35;
    if (actor.statuses.blind && !magical) evade += 0.5;
    if (target.statuses.sleep || target.statuses.stone || target.statuses.paralyze) evade = 0;
    if (opts.missChance && this.rng.chance(opts.missChance)) return { damage: 0, missed: true, mult: 1, crit: false };
    if (!magical && this.rng.chance(Math.min(0.75, evade))) return { damage: 0, missed: true, mult: 1, crit: false };

    // reach penalty for basic attacks that overreach
    let reachPenalty = 1;
    if (opts.reachCheck) {
      const dist = this.distance(actor, target);
      if (dist > (opts.reach ?? a.reach)) reachPenalty = 0.5;
    }

    // mitigation
    let armor = magical ? d.ward : d.armor;
    if (opts.pierce) armor *= (1 - opts.pierce);
    if (target.defending) armor *= 1.6;
    if (target.statuses.protect && !magical) armor *= 1.45;
    if (target.statuses.shell && magical) armor *= 1.45;
    if (target.element === 'earth' && this.effCol(target) === 0) armor *= 1.11;   // Bedrock
    const K = softening(levelOf(actor));
    const mitig = K / (K + Math.max(0, armor));

    // elemental wheel
    let mult = 1;
    const atkEl = opts.element ?? 'none';
    if (atkEl !== 'none') {
      const nullify = (actor.isPC && actor.ref.equip.accessory === 'voidring') || atkEl === 'void';
      mult = nullify ? 1 : elementMultiplier(atkEl, target.element);
      // a defender's RACE resists on top of the elemental wheel
      if (!nullify && target.isPC) mult *= elementalResistance(target.ref, atkEl);
      if (opts.undeadBonus && target.def?.family === 'undead') mult *= opts.undeadBonus;
      if (actor.isPC && actor.element === 'light' && target.def?.family === 'undead') mult *= 1.25;
    }
    if (actor.isPC && actor.ref.jobId === 'hunter' && target.def?.family === 'beast') {
      mult *= 1 + 0.05 * jobRank(actor.ref);
    }
    if (actor.isPC && actor.ref.jobId === 'artificer' && target.def?.family === 'construct') {
      mult *= 1 + 0.10 * jobRank(actor.ref);
    }
    if (target.statuses.curse) mult *= 1.2;
    if (trait(actor, 'wyrmblood') && target.def?.family === 'dragon') mult *= 1.2;
    if (trait(actor, 'tinker') && target.def?.family === 'construct') mult *= 1.25;

    // racial defence
    if (!magical && trait(target, 'scaled')) mult *= 0.88;
    if (magical && trait(target, 'thickskull')) mult *= 1.1;

    // crit
    let critRate = (opts.crit ?? 0) + a.crit;
    if (actor.statuses.lucky) critRate += 0.15;
    const crit = this.rng.chance(Math.min(0.85, critRate));

    let dmg = base * mitig * mult * reachPenalty * this.rng.float(0.92, 1.08);
    if (crit) dmg *= 1.8;
    dmg = Math.max(1, Math.round(dmg));
    return { damage: dmg, crit, mult, missed: false };
  }

  dealDamage(actor, target, amount, { silent = false, element = 'none', crit = false } = {}) {
    if (target.statuses.barrier) {
      delete target.statuses.barrier;
      if (!silent) this.say(`${this.label(target)}'s barrier absorbs the hit.`);
      return 0;
    }
    target.hp = Math.max(0, target.hp - amount);
    this.fx.push({ type: 'damage', uid: target.uid, amount, element, crit });
    if (target.statuses.sleep) delete target.statuses.sleep;
    if (target.statuses.freeze && element !== 'ice') delete target.statuses.freeze;
    this.gainIp(target, Math.min(24, 6 + amount * 40 / Math.max(1, target.stats().maxHp)));
    if (actor) this.gainIp(actor, Math.min(16, 4 + amount * 20 / Math.max(1, target.stats().maxHp)));
    if (target.hp <= 0) {
      target.hp = 0;
      if (target.isPC) {
        target.ref.alive = false;
        if (trait(target, 'deathless') && !target.usedDeathless) {
          target.usedDeathless = true;
          revive(target.ref, 0.25);
          this.say(`${target.name} will not stay down.`);
          return amount;
        }
        if (target.ref.equip.accessory === 'phoenixdown') {
          target.ref.equip.accessory = null;
          revive(target.ref, 1);
          this.say(`${target.name}'s pendant shatters — and ${target.name} stands back up.`);
        } else this.say(`${target.name} falls.`);
      } else this.say(`${this.label(target)} is defeated.`);
      // Devour: dark-element killers recover on a kill
      if (actor?.isPC && actor.element === 'dark' && target.hp <= 0) {
        const s = actor.stats();
        actor.hp = Math.min(s.maxHp, actor.hp + Math.floor(s.maxHp * 0.1));
        actor.mp = Math.min(s.maxMp, actor.mp + Math.floor(s.maxMp * 0.1));
      }
    }
    return amount;
  }

  healUnit(target, amount) {
    const s = target.stats();
    let amt = amount;
    if (target.isPC && target.element === 'water') amt *= 1.15;            // Tidal
    if (trait(target, 'tidecall')) amt *= 1.2;                             // Merfolk
    if (trait(target, 'coldblood')) amt *= 0.8;                            // Revenant
    if (target.statuses.curse) amt *= 0.6;
    amt = Math.round(amt);
    const before = target.hp;
    target.hp = Math.min(s.maxHp, target.hp + amt);
    this.fx.push({ type: 'heal', uid: target.uid, amount: target.hp - before });
    return target.hp - before;
  }

  label(u) { return u.isPC ? u.name : (u.label ?? u.name); }

  // --- actions -------------------------------------------------------------
  /**
   * Perform an action. `action` is
   *   {kind:'attack', target}
   *   {kind:'skill', skillId, target}
   *   {kind:'item', itemId, target}
   *   {kind:'defend'} | {kind:'move', row, col} | {kind:'flee'}
   */
  act(actor, action) {
    this.fx.length = 0;
    if (actor.statuses.confuse && this.rng.chance(0.5)) {
      const pool = this.units().filter((u) => u.alive && u.uid !== actor.uid);
      if (pool.length) {
        const t = this.rng.pick(pool);
        this.say(`${this.label(actor)} is confused and lashes out!`);
        return this.basicAttack(actor, t);
      }
    }
    switch (action.kind) {
      case 'attack': return this.basicAttack(actor, action.target);
      case 'skill': return this.useSkill(actor, getSkill(action.skillId), action.target);
      case 'item': return this.useItem(actor, action.itemId, action.target);
      case 'defend':
        actor.defending = true;
        this.gainIp(actor, 10);
        return this.say(`${this.label(actor)} takes a defensive stance.`);
      case 'move': {
        const occupied = (actor.side === 'party' ? this.party : this.enemies)
          .some((u) => u.alive && u.uid !== actor.uid && u.grid.row === action.row && u.grid.col === action.col);
        if (occupied) return this.say('That cell is taken.');
        actor.grid.row = action.row;
        actor.grid.col = action.col;
        return this.say(`${this.label(actor)} shifts position.`);
      }
      case 'flee': return this.tryFlee(actor);
      default: return this.say('...');
    }
  }

  basicAttack(actor, target) {
    if (!target || !target.alive) {
      const foes = actor.side === 'party' ? this.livingEnemies() : this.livingParty();
      if (!foes.length) return this.say('Nothing to strike.');
      target = foes[0];
    }
    const a = actor.stats();
    const el = actor.isPC && actor.ref.equip.weapon
      ? (getItem(actor.ref.equip.weapon).element ?? 'none') : 'none';
    const r = this.computeDamage(actor, target, {
      power: 1, element: el, reachCheck: true, reach: a.reach,
    });
    if (r.missed) {
      this.fx.push({ type: 'miss', uid: target.uid });
      return this.say(`${this.label(actor)} misses ${this.label(target)}.`);
    }
    this.dealDamage(actor, target, r.damage, { element: el, crit: r.crit });
    let msg = `${this.label(actor)} hits ${this.label(target)} for ${r.damage}.`;
    if (r.crit) msg = `Critical! ${msg}`;
    if (r.mult > 1) msg += ' It bites deep.';
    if (r.mult < 1) msg += ' It barely registers.';
    this.say(msg);
    // element perks that ride on basic attacks
    if (actor.isPC) this.elementOnHit(actor, target, r.damage);
    return msg;
  }

  elementOnHit(actor, target, damage) {
    const el = actor.element;
    if (el === 'fire' && this.rng.chance(0.12)) {
      this.applyTo(target, 'burn');
      this.say(`${this.label(target)} catches fire.`);
    } else if (el === 'ice' && this.rng.chance(0.12)) {
      this.applyTo(target, 'slow');
      this.say(`${this.label(target)} slows in the cold.`);
    } else if (el === 'lightning') {
      const foes = (actor.side === 'party' ? this.livingEnemies() : this.livingParty())
        .filter((u) => u.uid !== target.uid && Math.abs(u.grid.row - target.grid.row) <= 1);
      if (foes.length) {
        const t2 = this.rng.pick(foes);
        const chain = Math.max(1, Math.round(damage * 0.25));
        this.dealDamage(actor, t2, chain, { element: 'lightning' });
        this.say(`The arc jumps to ${this.label(t2)} for ${chain}.`);
      }
    }
  }

  applyTo(unit, statusId, turns = null) {
    if (unit.isPC) return applyStatus(unit.ref, statusId, turns);
    const def = STATUS[statusId];
    if (!def) return false;
    let t = turns ?? def.turns;
    if (unit.def?.family === 'undead' && ['poison', 'sleep', 'fear'].includes(statusId)) return false;
    if (unit.def?.family === 'construct' && ['poison', 'sleep', 'confuse', 'charm'].includes(statusId)) return false;
    unit.statuses[statusId] = Math.max(unit.statuses[statusId] ?? 0, t);
    return true;
  }

  /** MP this actor pays for `skill` after racial discounts. */
  mpCost(actor, skill) {
    if (!skill.mp) return 0;
    const magical = ['mag', 'heal', 'buff', 'debuff'].includes(skill.type);
    return magical && trait(actor, 'arcaneblood')
      ? Math.max(1, Math.round(skill.mp * 0.85)) : skill.mp;
  }

  useSkill(actor, skill, chosen) {
    const s = actor.stats();
    const cost = this.mpCost(actor, skill);
    if (cost > actor.mp) return this.say(`${this.label(actor)} lacks the MP.`);
    if (skill.ip && actor.ip < skill.ip) return this.say(`${this.label(actor)} lacks the IP.`);
    actor.mp -= cost;
    if (skill.ip) actor.ip -= skill.ip;
    if (skill.hpCost) {
      const cost = Math.max(1, Math.floor(s.maxHp * skill.hpCost));
      actor.hp = Math.max(1, actor.hp - cost);
    }
    this.say(`${this.label(actor)} uses ${skill.name}!`);
    const element = actor.isPC ? skillElement(actor.ref, skill)
      : (skill.element === 'attuned' ? actor.element : skill.element);
    const targets = this.expandTargets(actor, skill, chosen);

    switch (skill.type) {
      case 'phys':
      case 'mag': {
        const hits = skill.hits ?? 1;
        for (const t of targets) {
          if (!t.alive) continue;
          for (let i = 0; i < hits; i++) {
            if (!t.alive) break;
            let el = element;
            if (skill.adaptive) el = this.weakestElementFor(t) ?? element;
            const r = this.computeDamage(actor, t, {
              power: skill.power * spread(skill.target),
              element: el, magical: skill.type === 'mag',
              pierce: skill.pierce, crit: skill.crit, missChance: skill.missChance,
              undeadBonus: skill.undeadBonus,
              reachCheck: skill.type === 'phys', reach: skill.range,
            });
            if (r.missed) { this.fx.push({ type: 'miss', uid: t.uid }); this.say(`  ...misses ${this.label(t)}.`); continue; }
            let dmg = r.damage;
            if (skill.execute) dmg = Math.round(dmg * (1 + (1 - t.hp / t.stats().maxHp) * 0.8));
            this.dealDamage(actor, t, dmg, { element: el, crit: r.crit });
            this.say(`  ${this.label(t)} takes ${dmg}${r.crit ? ' (critical!)' : ''}${r.mult > 1 ? ' — weakness!' : ''}`);
            if (skill.drain) {
              const back = Math.round(dmg * skill.drain);
              this.healUnit(actor, back);
              this.say(`  ${this.label(actor)} drains ${back}.`);
            }
            if (skill.status && this.rng.chance(0.6)) {
              if (this.applyTo(t, skill.status)) this.say(`  ${this.label(t)}: ${STATUS[skill.status].name}.`);
            }
            if (skill.sunder) t.statuses.sundered = 3;
            if (skill.knockback && t.grid.col < 2) t.grid.col++;
            if (skill.instantChance && this.rng.chance(skill.instantChance) && !t.def?.boss) {
              t.hp = 0;
              this.say(`  ${this.label(t)} is struck down instantly.`);
            }
          }
        }
        if (skill.steals) this.doSteal(actor, targets[0]);
        break;
      }
      case 'heal': {
        for (const t of targets) {
          if (skill.revives && !t.alive) {
            if (t.isPC) { revive(t.ref, skill.power || 0.5); this.say(`  ${t.name} returns to the fight.`); }
            continue;
          }
          if (!t.alive) continue;
          if (skill.power > 0) {
            const amount = Math.round(actor.stats().magic * skill.power + t.stats().maxHp * skill.power * 0.35);
            const done = this.healUnit(t, amount);
            this.say(`  ${this.label(t)} recovers ${done}.`);
          }
          if (skill.cleanse) {
            if (t.isPC) clearBadStatuses(t.ref);
            else for (const k of Object.keys(t.statuses)) if (STATUS[k]?.kind === 'bad') delete t.statuses[k];
            this.say(`  ${this.label(t)} is cleansed.`);
          }
        }
        break;
      }
      case 'buff': {
        for (const t of targets) {
          if (!t.alive) continue;
          for (const st of [skill.status, skill.extraStatus].filter(Boolean)) {
            this.applyTo(t, st);
            this.say(`  ${this.label(t)}: ${STATUS[st].name}.`);
          }
          if (skill.grants) { t.statuses[skill.grants] = 4; this.say(`  ${this.label(t)}: ${skill.grants}.`); }
          if (skill.shiftsElement && t.isPC) { t.ref.battleElement = actor.element; }
          this.fx.push({ type: 'buff', uid: t.uid });
        }
        break;
      }
      case 'debuff': {
        for (const t of targets) {
          if (!t.alive) continue;
          if (skill.dispel) {
            for (const k of Object.keys(t.statuses)) if (STATUS[k]?.kind === 'good') delete t.statuses[k];
            this.say(`  ${this.label(t)} is stripped of its blessings.`);
          }
          if (skill.status) {
            const resist = t.def?.boss ? 0.35 : 0.75;
            if (this.rng.chance(resist)) {
              if (this.applyTo(t, skill.status)) this.say(`  ${this.label(t)}: ${STATUS[skill.status].name}.`);
            } else this.say(`  ${this.label(t)} resists.`);
          }
          if (skill.sunder) { t.statuses.sundered = 4; this.say(`  ${this.label(t)} is weakened.`); }
          if (skill.reveals) this.revealed = true;
          this.fx.push({ type: 'debuff', uid: t.uid });
        }
        break;
      }
      case 'special':
        this.specialSkill(actor, skill, targets);
        break;
      default: break;
    }
    return this.log[this.log.length - 1];
  }

  weakestElementFor(unit) {
    const el = ELEMENT_BY_ID[unit.element];
    if (!el || !el.weakAgainst.length) return null;
    return el.weakAgainst[0];
  }

  specialSkill(actor, skill, targets) {
    switch (skill.id) {
      case 'steal': case 'grandtheft':
        this.doSteal(actor, targets[0], skill.id === 'grandtheft');
        break;
      case 'pilfer': {
        const t = targets[0];
        if (!t) break;
        const gold = Math.round((t.def?.gold ?? 20) * this.rng.float(0.3, 0.7));
        this.stolenGold = (this.stolenGold ?? 0) + gold;
        this.say(`  Lifted ${gold} gold from ${this.label(t)}.`);
        break;
      }
      case 'escape':
        this.guaranteedEscape = true;
        this.say('  The way out is clear.');
        break;
      case 'jackpot': {
        const roll = this.rng.int(0, 4);
        const foes = this.livingEnemies();
        if (roll === 0) { foes.forEach((f) => this.dealDamage(actor, f, Math.round(f.stats().maxHp * 0.25), {})); this.say('  Jackpot! Everything takes a quarter.'); }
        else if (roll === 1) { this.party.forEach((p) => this.healUnit(p, 200)); this.say('  Jackpot! The party is restored.'); }
        else if (roll === 2) { foes.forEach((f) => this.applyTo(f, 'confuse')); this.say('  Jackpot! Nobody knows where they are.'); }
        else if (roll === 3) { this.party.forEach((p) => this.applyTo(p, 'haste')); this.say('  Jackpot! Everyone speeds up.'); }
        else { this.dealDamage(null, actor, Math.round(actor.stats().maxHp * 0.2), {}); this.say('  ...that one went badly.'); }
        break;
      }
      case 'fatesdice': {
        for (const u of this.units()) {
          if (!u.alive) continue;
          const r = this.rng.int(0, 2);
          if (r === 0) this.healUnit(u, Math.round(u.stats().maxHp * 0.4));
          else if (r === 1) this.dealDamage(null, u, Math.round(u.hp * 0.35), {});
          else this.applyTo(u, this.rng.pick(['haste', 'might', 'focus']));
        }
        this.say('  The dice land. Everything is different.');
        break;
      }
      case 'raise': case 'bondbeast': {
        this.say(`  ${this.label(actor)} calls a companion to the fifth cell.`);
        this.thrall = { owner: actor.uid, hp: Math.round(actor.stats().magic * 3) };
        break;
      }
      default:
        this.say('  Nothing happens.');
    }
  }

  doSteal(actor, target, rare = false) {
    if (!target || target.isPC) return;
    const luck = actor.isPC ? actor.stats().lck : 10;
    const chance = Math.min(0.9, 0.35 + luck * 0.012 - (rare ? 0.2 : 0));
    if (!this.rng.chance(chance)) { this.say('  ...nothing to take.'); return; }
    const pool = rare
      ? target.def.drops.filter((d) => d[1] < 0.3).map((d) => d[0])
      : [target.def.steal, ...target.def.drops.map((d) => d[0])].filter(Boolean);
    if (!pool.length) { this.say('  ...nothing to take.'); return; }
    const item = this.rng.pick(pool);
    this.stolen = this.stolen ?? [];
    this.stolen.push(item);
    this.say(`  Stole ${getItem(item).name}!`);
  }

  useItem(actor, itemId, chosen) {
    const it = getItem(itemId);
    this.say(`${this.label(actor)} uses ${it.name}.`);
    let alch = actor.isPC && actor.ref.jobId === 'alchemist' ? 1.5 : 1;
    if (trait(actor, 'tinker')) alch *= 1.3;
    const targets = it.target === 'allies'
      ? (actor.side === 'party' ? this.party : this.enemies)
      : it.target === 'row'
        ? this.expandTargets(actor, { target: 'row' }, chosen)
        : [chosen ?? actor];
    for (const t of targets) {
      if (it.revives && !t.alive) { if (t.isPC) revive(t.ref, 0.5); this.healUnit(t, Math.round((it.heal ?? 0) * alch)); continue; }
      if (!t.alive) continue;
      if (it.heal) {
        // an Automaton is not repaired by drinking things
        const potency = alch * (trait(t, 'norepair') ? 0.5 : 1);
        this.say(`  ${this.label(t)} recovers ${this.healUnit(t, Math.round(it.heal * potency))}.`);
      }
      if (it.healMp) { t.mp = Math.min(t.stats().maxMp, t.mp + it.healMp); this.say(`  ${this.label(t)} recovers MP.`); }
      if (it.cures) for (const c of it.cures) { if (t.isPC) delete t.ref.statuses[c]; else delete t.statuses[c]; }
      if (it.damage) {
        const r = this.computeDamage(actor, t, { power: 0, element: it.element });
        const dmg = Math.round(it.damage * (alch === 1.5 ? 1.25 : 1) * (r.mult ?? 1));
        this.dealDamage(actor, t, dmg, { element: it.element });
        this.say(`  ${this.label(t)} takes ${dmg}.`);
      }
      if (it.escape) this.guaranteedEscape = true;
    }
    return this.log[this.log.length - 1];
  }

  tryFlee(actor) {
    if (this.isBoss) return this.say('There is no leaving this one.');
    this.escapeAttempts++;
    const partySpeed = this.livingParty().reduce((s, u) => s + u.stats().speed, 0) / Math.max(1, this.livingParty().length);
    const foeSpeed = this.livingEnemies().reduce((s, u) => s + u.stats().speed, 0) / Math.max(1, this.livingEnemies().length);
    const chance = this.guaranteedEscape ? 1
      : Math.min(0.92, 0.35 + (partySpeed - foeSpeed) * 0.02 + this.escapeAttempts * 0.15);
    if (this.rng.chance(chance)) {
      this.phase = PHASE.FLED;
      this.result = 'fled';
      return this.say('The party breaks away.');
    }
    return this.say('Blocked — no way through.');
  }

  // --- enemy AI ------------------------------------------------------------
  enemyAction(unit, followUp = this.isFollowUp()) {
    const foes = this.livingParty();
    if (!foes.length) return { kind: 'defend' };
    const skills = (unit.def.skills ?? []).map(getSkill).filter((k) => k.mp <= unit.mp);
    const ai = unit.def.ai;
    const hpRatio = unit.hp / unit.stats().maxHp;

    // pick a target: front column is far more likely to be chosen
    const weights = foes.map((f) => {
      let w = 1 / (this.effCol(f) + 1);
      if (f.statuses.taunted) w *= 4;
      if (f.hp / f.stats().maxHp < 0.3) w *= 1.6;      // finish the wounded
      if (f.statuses.vanished) w *= 0.05;
      // a Gnome is hard to notice while somebody larger stands in front
      if (trait(f, 'smallframe') && foes.some((o) => this.effCol(o) < this.effCol(f))) w *= 0.6;
      return [f, w];
    });
    const target = this.rng.weighted(weights);

    const wantsSkill =
      ai === 'caster' ? 0.75 :
      ai === 'boss' ? 0.6 :
      ai === 'defensive' ? 0.4 : 0.28;

    if (skills.length && this.rng.chance(wantsSkill)) {
      // a follow-up may not reach the whole party
      let pool = followUp ? skills.filter((k) => k.target !== 'all') : skills;
      if (!pool.length) pool = skills.filter((k) => k.target !== 'all');
      if (!pool.length) return { kind: 'attack', target };
      if (ai === 'defensive' && hpRatio < 0.5) {
        const def = pool.filter((k) => k.type === 'buff' || k.type === 'heal');
        if (def.length) pool = def;
      }
      const skill = this.rng.pick(pool);
      const legal = this.validTargets(unit, skill);
      if (legal.length || ['self', 'allies', 'ally'].includes(skill.target)) {
        const t = ['self', 'allies'].includes(skill.target) ? unit
          : skill.target === 'ally' ? this.rng.pick(this.livingEnemies())
            : (legal.includes(target) ? target : this.rng.pick(legal));
        return { kind: 'skill', skillId: skill.id, target: t };
      }
    }

    // reposition when nothing is in reach
    if (!this.inReach(unit, target, unit.stats().reach)) {
      const front = this.frontColumn('enemy');
      if (unit.grid.col > front) {
        const free = !this.enemies.some((e) => e.alive && e.grid.row === unit.grid.row && e.grid.col === unit.grid.col - 1);
        if (free) return { kind: 'move', row: unit.grid.row, col: unit.grid.col - 1 };
      }
    }
    return { kind: 'attack', target };
  }

  // --- spoils --------------------------------------------------------------
  spoils() {
    const defeated = this.enemies;
    const scribe = this.party.filter((u) => u.isPC && u.ref.jobId === 'scribe')
      .reduce((m, u) => Math.max(m, jobRank(u.ref)), 0);
    const merchant = this.party.filter((u) => u.isPC && u.ref.jobId === 'merchant')
      .reduce((m, u) => Math.max(m, jobRank(u.ref)), 0);
    const hunter = this.party.filter((u) => u.isPC && u.ref.jobId === 'hunter')
      .reduce((m, u) => Math.max(m, jobRank(u.ref)), 0);

    let exp = 0, gold = 0, lp = 0;
    const items = [...(this.stolen ?? [])];
    for (const e of defeated) {
      exp += e.def.exp;
      gold += e.def.gold;
      // Learning Points: no per-enemy data to author, so this rides on the
      // EXP an enemy already carries rather than a whole new 41-entry field.
      lp += Math.max(1, Math.round(e.def.exp * 0.1));
      for (const [id, chance] of e.def.drops) {
        let c = chance;
        if (hunter && e.def.family === 'beast') c += 0.05 * hunter;
        if (this.rng.chance(c)) items.push(id);
      }
      if (hunter && e.def.family === 'beast') for (let i = 0; i < hunter; i++) if (this.rng.chance(0.25)) items.push('beastfang');
    }
    exp = Math.round(exp * (1 + 0.05 * scribe));
    gold = Math.round(gold * (1 + 0.15 * merchant)) + (this.stolenGold ?? 0);
    return { exp, gold, items, lp };
  }
}

function tickEnemyStatuses(unit, battle) {
  const log = [];
  const s = unit.stats();
  for (const id of Object.keys(unit.statuses)) {
    if (id === 'poison') { const d = Math.max(1, Math.floor(s.maxHp * 0.08)); unit.hp -= d; log.push(`${battle.label(unit)} takes ${d} from poison.`); }
    if (id === 'burn') { const d = Math.max(1, Math.floor(s.maxHp * 0.06)); unit.hp -= d; log.push(`${battle.label(unit)} takes ${d} from burns.`); }
    if (id === 'regen') { unit.hp = Math.min(s.maxHp, unit.hp + Math.floor(s.maxHp * 0.07)); }
    if (id === 'doom') {
      unit.statuses[id] -= 1;
      if (unit.statuses[id] <= 0) { unit.hp = 0; log.push(`${battle.label(unit)} falls as the count reaches zero.`); }
      continue;
    }
    unit.statuses[id] -= 1;
    if (unit.statuses[id] <= 0) delete unit.statuses[id];
  }
  if (unit.hp < 0) unit.hp = 0;
  return log;
}
