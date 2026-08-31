#!/usr/bin/env node
// Headless battle simulation. Runs the real engine with no renderer so combat
// balance and rule bugs surface without a browser.
//
//   node tools/simulate.js [--runs N] [--level L] [--formation ID] [--verbose]

import { createCharacter, awardExp, promote, refreshPromotion, stats, usableSkills, fullRestore }
  from '../src/game/character.js';
import { Battle, PHASE } from '../src/game/battle.js';
import { FORMATIONS } from '../src/data/enemies.js';
import { ITEMS, canEquip } from '../src/data/items.js';
import { getClass } from '../src/data/classes.js';
import { RNG } from '../src/engine/rng.js';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const RUNS = +arg('--runs', 40);
const LEVEL = +arg('--level', 1);
const VERBOSE = argv.includes('--verbose');
const ONLY = arg('--formation', null);

function buildParty(level, rng) {
  const roster = [
    { name: 'Piper', classId: 'warrior', raceId: 'human', elementId: 'fire', jobId: 'blacksmith', row: 1, col: 0 },
    { name: 'Bram', classId: 'guardian', raceId: 'dwarf', elementId: 'earth', jobId: 'armorer', row: 0, col: 0 },
    { name: 'Iris', classId: 'mage', raceId: 'elf', elementId: 'lightning', jobId: 'scribe', row: 1, col: 2 },
    { name: 'Sela', classId: 'cleric', raceId: 'merfolk', elementId: 'light', jobId: 'herbalist', row: 2, col: 1 },
  ];
  return roster.map((r) => {
    const ch = createCharacter(r);
    // level up honestly, taking promotions as they come
    let guard = 0;
    while (ch.level < level && guard++ < 500) {
      awardExp(ch, Math.max(30, ch.level * 40));
      const p = refreshPromotion(ch);
      if (p) promote(ch, p.choices[rng.int(0, p.choices.length - 1)].id);
    }
    equipBest(ch);
    fullRestore(ch);
    return ch;
  });
}

// Gear the character in the best thing they can use whose price fits the
// spending power a party would plausibly have at their level.
function equipBest(ch) {
  const cls = getClass(ch.classId);
  // Roughly the gold a party actually accumulates per character by this level,
  // derived from encounter gold values rather than picked out of the air.
  const budget = 50 + Math.pow(ch.level, 2.2) * 5.5;
  for (const slot of ['weapon', 'offhand', 'body', 'head', 'accessory']) {
    const slotBudget = slot === 'weapon' ? budget : budget * 0.55;
    const pool = ITEMS.filter((it) => {
      if (it.price > slotBudget) return false;
      if (!canEquip(cls, it)) return false;
      if (slot === 'weapon') return it.kind === 'weapon' && it.wtype !== 'shield';
      if (slot === 'offhand') return it.kind === 'weapon' && it.wtype === 'shield';
      if (slot === 'accessory') return it.kind === 'accessory';
      return it.kind === 'armor' && it.slot === slot;
    }).sort((a, z) => z.price - a.price);
    if (pool.length) ch.equip[slot] = pool[0].id;
  }
}

function autoAction(b, unit) {
  const ch = unit.ref;
  const s = unit.stats();
  const foes = b.livingEnemies();
  const allies = b.livingParty();
  const hurt = allies.filter((a) => a.hp / a.stats().maxHp < 0.5);
  const skills = usableSkills(ch);

  // heal if someone is badly hurt
  const heals = skills.filter((k) => k.type === 'heal' && k.power > 0);
  if (hurt.length && heals.length && b.rng.chance(0.8)) {
    const k = heals[heals.length - 1];
    return { kind: 'skill', skillId: k.id, target: hurt.sort((x, y) => x.hp - y.hp)[0] };
  }
  // otherwise the strongest offensive skill that has a legal target
  const off = skills.filter((k) => (k.type === 'phys' || k.type === 'mag'))
    .sort((a, z) => (z.power * (z.hits ?? 1)) - (a.power * (a.hits ?? 1)));
  for (const k of off) {
    const legal = b.validTargets(unit, k);
    if (legal.length && b.rng.chance(0.7)) {
      return { kind: 'skill', skillId: k.id, target: b.rng.pick(legal) };
    }
  }
  const reachable = foes.filter((f) => b.inReach(unit, f, s.reach));
  if (!reachable.length) {
    if (unit.grid.col > 0) return { kind: 'move', row: unit.grid.row, col: unit.grid.col - 1 };
    return { kind: 'attack', target: foes[0] };
  }
  return { kind: 'attack', target: b.rng.pick(reachable) };
}

function runBattle(party, formationId, seed) {
  const b = new Battle(party, formationId, { seed });
  b.phase = PHASE.INPUT;
  let turns = 0;
  while (b.phase === PHASE.INPUT && turns < 400) {
    const u = b.current();
    if (!u) { b.advance(); continue; }
    const action = u.isPC ? autoAction(b, u) : b.enemyAction(u);
    b.act(u, action);
    b.checkEnd();
    if (b.phase !== PHASE.INPUT) break;
    b.advance();
    turns++;
  }
  return { result: b.result ?? 'timeout', turns, rounds: b.round, battle: b };
}

const rng = new RNG(12345);
const groups = ONLY ? FORMATIONS.filter((f) => f.id === ONLY) : FORMATIONS;
const byRegion = {};
for (const f of groups) (byRegion[f.region] ??= []).push(f);

const REGION_LEVEL = {
  greenfield: 4, caverns: 11, ruins: 20, abyss: 55, boss: 0,
  cinder: 35, drowned: 53, glass: 73,
};
const BOSS_LEVEL = {
  boss_volk: 9, boss_anvil: 16, boss_choir: 24, boss_aurelith: 30,
  boss_kharos: 37, boss_gate: 45, boss_nerith: 55, boss_worldheart: 65,
  boss_vessia: 75, boss_thirteenth: 85,
};

console.log(`\n  QUEST OF THE THIRTEEN — battle simulation (${RUNS} runs each)\n`);
let fails = 0;

for (const [region, forms] of Object.entries(byRegion)) {
  console.log(`  ${region.toUpperCase()}`);
  for (const f of forms) {
    const lvl = LEVEL > 1 ? LEVEL : (BOSS_LEVEL[f.id] ?? REGION_LEVEL[region] ?? 5);
    let win = 0, lose = 0, flee = 0, timeout = 0, totalTurns = 0;
    for (let i = 0; i < RUNS; i++) {
      const party = buildParty(lvl, new RNG(1000 + i));
      const r = runBattle(party, f.id, 7000 + i);
      totalTurns += r.turns;
      if (r.result === 'victory') win++;
      else if (r.result === 'defeat') lose++;
      else if (r.result === 'fled') flee++;
      else timeout++;
      if (VERBOSE && i === 0) r.battle.log.slice(-14).forEach((l) => console.log('      | ' + l));
    }
    const rate = (win / RUNS * 100).toFixed(0);
    const flag = timeout > 0 ? ' <-- TIMEOUT' : (win === 0 ? ' <-- never won' : '');
    if (timeout > 0) fails++;
    console.log(`    ${f.id.padEnd(14)} Lv${String(lvl).padStart(2)}  win ${String(rate).padStart(3)}%  ` +
      `lose ${String(lose).padStart(2)}  avg ${(totalTurns / RUNS).toFixed(0)} turns${flag}`);
  }
  console.log('');
}
process.exit(fails ? 1 : 0);
