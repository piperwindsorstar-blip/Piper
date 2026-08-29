#!/usr/bin/env node
// Data integrity checks. Run with: npm test
//
// Everything here is a claim the game makes about its own content — the counts
// the design promises, the shape of the promotion tree, symmetry of the element
// wheel, and that no piece of data points at something that does not exist.

import { ELEMENTS, ELEMENT_BY_ID, PRIME_WHEEL, ARCANE_CYCLE, elementMultiplier }
  from '../src/data/elements.js';
import {
  CLASSES, CLASS_IDS, ROOT_CLASSES, PROMOTION_LEVELS, MAX_TIER, STAT_KEYS,
  ASCENT_TIERS, classLineage, classesAtTier, pendingPromotion,
} from '../src/data/classes.js';
import { RACES, RACE_IDS, RACE_BY_ID, raceJobAffinity } from '../src/data/races.js';
import { JOBS, JOB_IDS, jobBonus, jobRankFromExp, MAX_JOB_RANK } from '../src/data/jobs.js';
import { SKILLS, SKILL_BY_ID, SCHOOLS, SCHOOL_IDS, STATUS } from '../src/data/skills.js';
import { ITEMS, ITEM_BY_ID, canEquip, WEAPON_TYPES } from '../src/data/items.js';
import { ENEMIES, ENEMY_BY_ID, FORMATIONS } from '../src/data/enemies.js';
import { MAPS, LEGEND, SHOPS, BOSS_SLOTS, isSolid, mapSize } from '../src/data/maps.js';
import { createCharacter, awardExp, promote, refreshPromotion, stats, knownSkills, expForLevel }
  from '../src/game/character.js';

let pass = 0, fail = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) { pass++; return true; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return false;
}
function group(title) { console.log(`\n  ${title}`); }
function report(name, cond, detail) {
  const ok = check(name, cond, detail);
  console.log(`    ${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `  (${detail})`}`);
}

// --- elements ---------------------------------------------------------------
group('ELEMENTS');
report('13 elements exist', ELEMENTS.length === 13, `got ${ELEMENTS.length}`);
report('9 primes + 4 arcane', PRIME_WHEEL.length === 9 && ARCANE_CYCLE.length === 4);
report('every element has a unique id', new Set(ELEMENTS.map((e) => e.id)).size === 13);
report('every element has a colour, blurb, bias and perk',
  ELEMENTS.every((e) => e.color && e.blurb && e.bias && e.perk && e.perkText));
{
  const asym = [];
  for (const a of ELEMENTS) {
    for (const b of a.strongAgainst) {
      if (!ELEMENT_BY_ID[b].weakAgainst.includes(a.id)) asym.push(`${a.id}>${b}`);
    }
  }
  report('affinity table is symmetric', asym.length === 0, asym.join(','));
}
report('each prime beats exactly 2 and loses to exactly 2',
  ELEMENTS.filter((e) => e.group === 'prime')
    .every((e) => e.strongAgainst.length === 2 && e.weakAgainst.length === 2));
report('no element is strong against itself',
  ELEMENTS.every((e) => !e.strongAgainst.includes(e.id)));
report('multipliers resolve to 1.5 / 1.0 / 0.5',
  elementMultiplier('fire', 'nature') === 1.5 &&
  elementMultiplier('fire', 'water') === 0.5 &&
  elementMultiplier('fire', 'light') === 1);
report('void ignores resistance in both directions',
  elementMultiplier('void', 'light') === 1 && elementMultiplier('light', 'void') === 1);

// --- races ------------------------------------------------------------------
group('RACES');
report('12 races exist', RACES.length === 12, `got ${RACES.length}`);
report('race ids and names are unique',
  new Set(RACE_IDS).size === 12 && new Set(RACES.map((r) => r.name)).size === 12);
report('every race has exactly two named traits',
  RACES.every((r) => r.traits.length === 2 && r.traits.every((t) => t.id && t.name && t.text)));
report('every race has a complete eight-stat growth table',
  RACES.every((r) => STAT_KEYS.every((k) => typeof r.growth[k] === 'number' && r.growth[k] > 0)));
report('no race grows faster at everything',
  RACES.every((r) => STAT_KEYS.some((k) => r.growth[k] < 1) || r.id === 'human'));
report('race resistances name real elements (0 = immune)',
  RACES.every((r) => Object.entries(r.resist ?? {})
    .every(([id, v]) => ELEMENT_BY_ID[id] && v >= 0 && v < 2)));
report('race element affinities name real elements',
  RACES.every((r) => r.likes.length && r.likes.every((id) => ELEMENT_BY_ID[id])));
report('every race carries anatomy the sprite generator can draw',
  RACES.every((r) => r.look && r.look.ears && r.look.build > 0
    && r.look.skins.length && r.look.hairs.length && r.look.eye));
report('race element affinity pays out',
  raceJobAffinity('dwarf', 'earth') > 1 && raceJobAffinity('dwarf', 'void') === 1);
{
  const mk = (raceId) => createCharacter({ name: raceId, raceId, classId: 'mage', elementId: 'fire', jobId: 'scribe' });
  const elf = mk('elf'), dwarf = mk('dwarf');
  report('race choice changes the stat line at level 1',
    stats(elf).mp !== stats(dwarf).mp && stats(elf).hp !== stats(dwarf).hp);
  // growth is a multiplier, so the gap must widen with levels rather than stay flat
  const gap1 = stats(elf).mp - stats(dwarf).mp;
  while (elf.level < 40) awardExp(elf, 5000);
  while (dwarf.level < 40) awardExp(dwarf, 5000);
  report('race growth compounds over levels', stats(elf).mp - stats(dwarf).mp > gap1 * 2,
    `gap ${gap1} at Lv1 vs ${stats(elf).mp - stats(dwarf).mp} at Lv40`);
}

// --- classes ----------------------------------------------------------------
group('CLASSES');
report('12 root classes', ROOT_CLASSES.length === 12, `got ${ROOT_CLASSES.length}`);
report('264 class nodes in total', CLASS_IDS.length === 264, `got ${CLASS_IDS.length}`);
report('class ids are unique', new Set(CLASS_IDS).size === CLASS_IDS.length);
report('class names are unique',
  new Set(CLASS_IDS.map((id) => CLASSES[id].name)).size === CLASS_IDS.length);
{
  const perTier = {};
  for (const id of CLASS_IDS) perTier[CLASSES[id].tier] = (perTier[CLASSES[id].tier] ?? 0) + 1;
  const want = [12, 12, 24, 24, 48, 48, 48, 48];
  report('tier shape is 12/12/24/24/48/48/48/48',
    want.every((n, t) => perTier[t] === n), JSON.stringify(perTier));
}
report('promotions happen at 5, 10, 15, 20, 40, 60, 80',
  PROMOTION_LEVELS.join() === '5,10,15,20,40,60,80');
{
  // tiers 0 and 2 are linear; every other non-terminal tier offers a choice
  const bad = [];
  for (const id of CLASS_IDS) {
    const c = CLASSES[id];
    const expect = c.tier === MAX_TIER ? 0 : (c.tier === 0 || c.tier === 2) ? 1 : 2;
    if (c.promotions.length !== expect) bad.push(`${id}:t${c.tier}:${c.promotions.length}!=${expect}`);
  }
  report('linear at tiers 0 and 2, a two-way branch at 1, 3, 4, 5 and 6, terminal at 7',
    bad.length === 0, bad.slice(0, 4).join(','));
}
{
  // each ascension tier is a ring of four per root: four nodes, each offered by
  // exactly two predecessors
  const bad = [];
  for (const tier of ASCENT_TIERS) {
    const nodes = classesAtTier(tier);
    if (nodes.length !== 48) { bad.push(`tier${tier}:${nodes.length}`); continue; }
    for (const root of ROOT_CLASSES) {
      const ring = nodes.filter((n) => n.root === root.id);
      if (ring.length !== 4) { bad.push(`${root.id}@${tier}:${ring.length}`); continue; }
      for (const n of ring) {
        const preds = CLASS_IDS.filter((id) => CLASSES[id].promotions.includes(n.id));
        if (preds.length !== 2) bad.push(`${n.id}:preds=${preds.length}`);
      }
    }
  }
  report('each ascension tier is a ring of 4 per root, every node reachable from exactly 2',
    bad.length === 0, bad.slice(0, 4).join(','));
}
report('every promotion target exists',
  CLASS_IDS.every((id) => CLASSES[id].promotions.every((p) => CLASSES[p])));
report('every node reaches its root through parents',
  CLASS_IDS.every((id) => classLineage(id)[0] === CLASSES[id].root));
report('every class node grants at least one school',
  CLASS_IDS.every((id) => CLASSES[id].schools.length > 0));
report('every class school is defined',
  CLASS_IDS.every((id) => CLASSES[id].schools.every((s) => SCHOOLS[s])));
report('growth is positive for every stat on every node',
  CLASS_IDS.every((id) => STAT_KEYS.every((k) => CLASSES[id].growth[k] > 0)));
{
  const notGrowing = CLASS_IDS.filter((id) => {
    const c = CLASSES[id];
    if (!c.parent) return false;
    const p = CLASSES[c.parent];
    const sum = STAT_KEYS.reduce((s, k) => s + c.growth[k], 0);
    const psum = STAT_KEYS.reduce((s, k) => s + p.growth[k], 0);
    return sum <= psum;
  });
  report('every promotion is a net growth increase', notGrowing.length === 0,
    notGrowing.slice(0, 3).join(','));
}
{
  // every root must own exactly four distinct tier-4 Masteries
  const bad = [];
  for (const root of ROOT_CLASSES) {
    const m = classesAtTier(4).filter((c) => c.root === root.id);
    if (m.length !== 4 || new Set(m.map((c) => c.id)).size !== 4) bad.push(`${root.id}:${m.length}`);
  }
  report('every root class reaches 4 distinct masteries', bad.length === 0, bad.join(','));
}
{
  // and every node must stay inside its own root's family
  const bad = CLASS_IDS.filter((id) =>
    CLASSES[id].promotions.some((p) => CLASSES[p].root !== CLASSES[id].root));
  report('no promotion ever crosses into another root class', bad.length === 0, bad.slice(0, 3).join(','));
}

// --- jobs -------------------------------------------------------------------
group('JOBS');
report('20 jobs exist', JOBS.length === 20, `got ${JOBS.length}`);
report('job ids are unique', new Set(JOB_IDS).size === 20);
report('job names are unique', new Set(JOBS.map((j) => j.name)).size === 20);
report('every job has a stat bonus, a field ability and a passive',
  JOBS.every((j) => Object.keys(j.bonus).length && j.field?.id && j.field?.text && j.passive?.text));
report('field ability ids are unique', new Set(JOBS.map((j) => j.field.id)).size === 20);
report('every job likes only real elements',
  JOBS.every((j) => j.likes.every((e) => ELEMENT_BY_ID[e])));
report('job rank thresholds are ascending and cap at 5',
  jobRankFromExp(0) === 1 && jobRankFromExp(600) === MAX_JOB_RANK && jobRankFromExp(1e6) === MAX_JOB_RANK);
report('rank 5 bonus is larger than rank 1',
  JOBS.every((j) => {
    const k = Object.keys(j.bonus)[0];
    return jobBonus(j.id, 5)[k] > jobBonus(j.id, 1)[k];
  }));

// --- skills -----------------------------------------------------------------
group('SKILLS');
report('skill ids are unique', new Set(SKILLS.map((s) => s.id)).size === SKILLS.length);
report('every skill belongs to a defined school', SKILLS.every((s) => SCHOOLS[s.school]));
report('every school has at least 4 skills',
  SCHOOL_IDS.every((s) => SKILLS.filter((k) => k.school === s).length >= 4),
  SCHOOL_IDS.filter((s) => SKILLS.filter((k) => k.school === s).length < 4).join(','));
report('every school is granted by at least one class',
  SCHOOL_IDS.every((s) => CLASS_IDS.some((id) => CLASSES[id].schools.includes(s))),
  SCHOOL_IDS.filter((s) => !CLASS_IDS.some((id) => CLASSES[id].schools.includes(s))).join(','));
report('every referenced status exists',
  SKILLS.every((s) => (!s.status || STATUS[s.status]) && (!s.extraStatus || STATUS[s.extraStatus])));
report('every skill has a sane range and target',
  SKILLS.every((s) => s.range >= 0 && s.range <= 9 &&
    ['one', 'row', 'col', 'all', 'self', 'ally', 'allies', 'random'].includes(s.target)));
{
  // no skill may cost more MP than a caster at its learn level can actually
  // hold — checked against a real character of the class that grants it
  const bad = [];
  for (const k of SKILLS) {
    if (!k.mp) continue;
    const owner = CLASS_IDS.find((id) => CLASSES[id].schools.includes(k.school) && CLASSES[id].tier >= 1);
    if (!owner) continue;
    const ch = createCharacter({
      name: 'T', classId: owner, elementId: 'spirit', jobId: 'scribe', level: Math.max(2, k.lv),
    });
    if (k.mp > stats(ch).maxMp) bad.push(`${k.id}:${k.mp}>${stats(ch).maxMp}`);
  }
  report('every skill is affordable by a caster at its learn level', bad.length === 0, bad.slice(0, 4).join(','));
}
report('damaging skills have positive power',
  SKILLS.filter((s) => s.type === 'phys' || s.type === 'mag').every((s) => s.power > 0));

// --- items ------------------------------------------------------------------
group('ITEMS');
report('item ids are unique', new Set(ITEMS.map((i) => i.id)).size === ITEMS.length);
report('every weapon has a known type', ITEMS.filter((i) => i.kind === 'weapon')
  .every((i) => WEAPON_TYPES[i.wtype]));
report('every item has a non-negative price', ITEMS.every((i) => i.price >= 0));
report('every class can equip at least one weapon',
  CLASS_IDS.every((id) => ITEMS.some((i) => i.kind === 'weapon' && i.wtype !== 'shield' && canEquip(CLASSES[id], i))));
report('every class can equip at least one body armour',
  CLASS_IDS.every((id) => ITEMS.some((i) => i.kind === 'armor' && i.slot === 'body' && canEquip(CLASSES[id], i))));
report('shop stock all resolves to real items',
  Object.values(SHOPS).every((s) => s.stock.every((id) => ITEM_BY_ID[id])));

// --- enemies ----------------------------------------------------------------
group('ENEMIES');
report('enemy ids are unique', new Set(ENEMIES.map((e) => e.id)).size === ENEMIES.length);
report('every enemy skill exists', ENEMIES.every((e) => e.skills.every((s) => SKILL_BY_ID[s])));
report('every enemy drop exists', ENEMIES.every((e) => e.drops.every(([id]) => ITEM_BY_ID[id])));
report('every stealable item exists', ENEMIES.every((e) => !e.steal || ITEM_BY_ID[e.steal]));
report('every enemy element is real',
  ENEMIES.every((e) => e.element === 'none' || ELEMENT_BY_ID[e.element]));
report('every enemy has positive HP and a sprite plan',
  ENEMIES.every((e) => e.hp > 0 && e.sprite?.plan && e.sprite.palette?.length === 3));
report('every formation places real enemies inside the 3x3 grid',
  FORMATIONS.every((f) => f.cells.every((c) =>
    ENEMY_BY_ID[c.id] && c.row >= 0 && c.row < 3 && c.col >= 0 && c.col < 3)));
report('no formation puts two enemies in the same cell',
  FORMATIONS.every((f) => new Set(f.cells.map((c) => `${c.row},${c.col}`)).size === f.cells.length));
report('every region has at least 4 normal formations',
  ['greenfield', 'caverns', 'ruins', 'abyss'].every((r) =>
    FORMATIONS.filter((f) => f.region === r && !f.boss && !f.rare).length >= 4));

// --- maps -------------------------------------------------------------------
group('MAPS');
{
  const bad = [];
  for (const m of Object.values(MAPS)) {
    const { w } = mapSize(m);
    if (!m.tiles.every((r) => r.length === w)) bad.push(`${m.id}:ragged`);
    for (const row of m.tiles) for (const ch of row) if (!LEGEND[ch]) bad.push(`${m.id}:'${ch}'`);
  }
  report('every map is rectangular and uses known tiles', bad.length === 0, [...new Set(bad)].join(','));
}
{
  const bad = [];
  for (const m of Object.values(MAPS)) {
    for (const wp of m.warps ?? []) {
      if (!MAPS[wp.to]) { bad.push(`${m.id}->${wp.to}`); continue; }
      if (isSolid(m, wp.x, wp.y)) bad.push(`${m.id}: warp tile is solid`);
      if (isSolid(MAPS[wp.to], wp.tx, wp.ty)) bad.push(`${m.id}->${wp.to}: lands in a wall`);
    }
  }
  report('every warp is walkable on both sides', bad.length === 0, [...new Set(bad)].join(','));
}
{
  // flood fill: nothing placed on a map may be walled off from its entrance.
  // A town's entrance is wherever another map's warp actually lands you —
  // not a fixed point, since not every town shares Wren's Ford's layout.
  const entranceTo = (id) => {
    for (const other of Object.values(MAPS)) {
      const wp = (other.warps ?? []).find((w) => w.to === id);
      if (wp) return [wp.tx, wp.ty];
    }
    return null;
  };
  const bad = [];
  for (const m of Object.values(MAPS)) {
    const entry = m.id === 'world' ? [9, 18]
      : m.town ? (entranceTo(m.id) ?? [12, 18]) : [m.warps[0].x, m.warps[0].y];
    const { w, h } = mapSize(m);
    const seen = new Set();
    const q = [entry];
    while (q.length) {
      const [x, y] = q.pop();
      const k = `${x},${y}`;
      if (seen.has(k) || x < 0 || y < 0 || x >= w || y >= h || isSolid(m, x, y)) continue;
      seen.add(k);
      q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    const at = (label, x, y) => { if (!seen.has(`${x},${y}`)) bad.push(`${m.id}:${label}`); };
    (m.warps ?? []).forEach((p) => at(`warp->${p.to}`, p.x, p.y));
    (m.npcs ?? []).forEach((p) => at(`npc ${p.name}`, p.x, p.y));
    (m.chests ?? []).forEach((p) => at(`chest ${p.id}`, p.x, p.y));
    (m.signs ?? []).forEach((p) => at('sign', p.x, p.y));
    for (const k of BOSS_SLOTS) if (m[k]) at(`boss ${m[k].flag}`, m[k].x, m[k].y);
  }
  report('every npc, chest, sign, boss and exit is reachable', bad.length === 0, bad.join(','));
}
report('every shop referenced by an npc exists',
  Object.values(MAPS).every((m) => (m.npcs ?? []).every((n) => n.kind !== 'shop' || SHOPS[n.shop])));
report('every boss references a real formation',
  Object.values(MAPS).every((m) => BOSS_SLOTS.every((k) => !m[k] || FORMATIONS.some((f) => f.id === m[k].formation))));
report('every gated boss names a flag another boss actually sets',
  Object.values(MAPS).every((m) => BOSS_SLOTS.every((k) => {
    const b = m[k];
    if (!b?.requires) return true;
    return Object.values(MAPS).some((o) => BOSS_SLOTS.some((j) => o[j]?.flag === b.requires));
  })));

// --- the systems working together -------------------------------------------
group('INTEGRATION');
{
  // every root class must be able to walk the full ladder to the summit on
  // either branch preference, all the way to the Lv80 Mythic tier
  const bad = [];
  for (const root of ROOT_CLASSES) {
    for (const branchSeed of [0, 1]) {
      const ch = createCharacter({ name: 'T', classId: root.id, elementId: 'fire', jobId: 'blacksmith' });
      let guard = 0;
      while (ch.level < 80 && guard++ < 4000) {
        awardExp(ch, 30000);
        const p = refreshPromotion(ch);
        if (p) promote(ch, p.choices[Math.min(branchSeed, p.choices.length - 1)].id);
      }
      const c = CLASSES[ch.classId];
      if (c.tier !== MAX_TIER) bad.push(`${root.id}/${branchSeed}:tier${c.tier}@Lv${ch.level}`);
    }
  }
  report('every root reaches tier 7 by level 80 on both branch preferences',
    bad.length === 0, bad.join(','));
}
{
  const bad = [];
  for (const id of CLASS_IDS) {
    const ch = createCharacter({ name: 'T', classId: id, elementId: 'fire', jobId: 'blacksmith', level: 20 });
    if (!knownSkills(ch).length) bad.push(id);
  }
  report('every class knows at least one skill by level 20', bad.length === 0, bad.slice(0, 5).join(','));
}
{
  const ch = createCharacter({ name: 'T', classId: 'warrior', elementId: 'fire', jobId: 'blacksmith' });
  const before = stats(ch).maxHp;
  awardExp(ch, expForLevel(10));
  report('EXP curve levels a character up', ch.level >= 9, `level ${ch.level}`);
  report('levelling raises max HP', stats(ch).maxHp > before);
}
{
  // the element bias must actually reach the sheet
  const a = createCharacter({ name: 'A', classId: 'mage', elementId: 'earth', jobId: 'miner' });
  const b = createCharacter({ name: 'B', classId: 'mage', elementId: 'wind', jobId: 'miner' });
  report('element choice changes the stat line', stats(a).vit !== stats(b).vit && stats(a).agi !== stats(b).agi);
}
{
  const a = createCharacter({ name: 'A', classId: 'mage', elementId: 'fire', jobId: 'blacksmith' });
  const b = createCharacter({ name: 'B', classId: 'mage', elementId: 'fire', jobId: 'scribe' });
  report('job choice changes the stat line', stats(a).vit !== stats(b).vit || stats(a).int !== stats(b).int);
}
{
  const early = createCharacter({ name: 'E', classId: 'warrior', elementId: 'fire', jobId: 'blacksmith' });
  const late = createCharacter({ name: 'L', classId: 'warrior', elementId: 'fire', jobId: 'blacksmith' });
  // promote early at exactly level 5; leave the other unpromoted to level 10
  while (early.level < 5) awardExp(early, 100);
  promote(early, refreshPromotion(early).choices[0].id);
  while (early.level < 10) awardExp(early, 100);
  while (late.level < 10) awardExp(late, 100);
  report('promoting on time beats promoting late', stats(early).str > stats(late).str,
    `${stats(early).str} vs ${stats(late).str}`);
}

// --- summary ----------------------------------------------------------------
console.log(`\n  ${pass} passed, ${fail} failed\n`);
if (fail) {
  for (const f of failures) console.log(`    ! ${f}`);
  console.log('');
  process.exit(1);
}
