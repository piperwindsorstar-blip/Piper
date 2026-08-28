// ============================================================================
//  ELEMENTS — 13 total.
//
//  Nine PRIME elements sit on a wheel. Each Prime is strong against the TWO
//  that follow it on the wheel and weak against the TWO that precede it. This
//  makes the whole table symmetric by construction (validated in tools/validate.js).
//
//      Fire -> Ice -> Nature -> Earth -> Metal -> Lightning -> Wind -> Poison -> Water -> (Fire)
//
//  Four ARCANE elements sit off the wheel in their own short cycle:
//
//      Light -> Dark -> Spirit -> Void -> (Light)
//
//  Primes and Arcane deal neutral damage to one another: the Arcane "strives
//  apart from the Wheel". VOID is the exception in the other direction — Void
//  damage ignores resistance entirely, and resistance never applies to it.
// ============================================================================

export const PRIME_WHEEL = [
  'fire', 'ice', 'nature', 'earth', 'metal', 'lightning', 'wind', 'poison', 'water',
];

export const ARCANE_CYCLE = ['light', 'dark', 'spirit', 'void'];

export const MULT_STRONG = 1.5;
export const MULT_WEAK = 0.5;

// Every character picks one element at creation. It colours their magic, grants
// a permanent stat bias, an innate resistance, and a passive perk.
const DEF = [
  {
    id: 'fire', name: 'Fire', rune: 'Ignis', group: 'prime',
    color: '#e0522c', color2: '#f8b04a',
    blurb: 'The hungry flame. Burns bright, burns short.',
    bias: { str: 3, int: 2, vit: -1, spr: -1 },
    perk: 'Blaze', perkText: 'Attacks have a 12% chance to inflict Burn (damage over time).',
  },
  {
    id: 'ice', name: 'Ice', rune: 'Glacies', group: 'prime',
    color: '#7fd3f0', color2: '#d8f4ff',
    blurb: 'Stillness sharpened to an edge.',
    bias: { int: 3, spr: 2, agi: -2 },
    perk: 'Rime', perkText: 'Attacks have a 12% chance to inflict Slow.',
  },
  {
    id: 'nature', name: 'Nature', rune: 'Silva', group: 'prime',
    color: '#5aa93f', color2: '#a8d96a',
    blurb: 'Patient green things that outlive empires.',
    bias: { hp: 12, vit: 2, spr: 1, agi: -1 },
    perk: 'Verdant', perkText: 'Recover 1% max HP after every step outdoors and 5% after each battle.',
  },
  {
    id: 'earth', name: 'Earth', rune: 'Terra', group: 'prime',
    color: '#9a7042', color2: '#c9a06a',
    blurb: 'The oldest answer to every question.',
    bias: { hp: 18, vit: 4, agi: -3 },
    perk: 'Bedrock', perkText: 'Immune to Knockback; takes 10% less damage while in the front column.',
  },
  {
    id: 'metal', name: 'Metal', rune: 'Ferrum', group: 'prime',
    color: '#9fa8b4', color2: '#dfe6ee',
    blurb: 'Ore, edge and discipline.',
    bias: { str: 2, vit: 3, agi: -1, lck: -1 },
    perk: 'Keen Edge', perkText: 'Weapon and armour upgrades cost 25% less; +5% critical rate.',
  },
  {
    id: 'lightning', name: 'Lightning', rune: 'Fulgur', group: 'prime',
    color: '#e6d24a', color2: '#fff6a8',
    blurb: 'A decision made faster than thought.',
    bias: { agi: 4, int: 2, vit: -2 },
    perk: 'Arc', perkText: 'Single-target attacks chain to one adjacent enemy for 25% damage.',
  },
  {
    id: 'wind', name: 'Wind', rune: 'Ventus', group: 'prime',
    color: '#8fd6b4', color2: '#d6f5e6',
    blurb: 'Never where you left it.',
    bias: { agi: 5, lck: 1, str: -2 },
    perk: 'Gale Step', perkText: '+10% evasion and free repositioning on the battle grid once per battle.',
  },
  {
    id: 'poison', name: 'Poison', rune: 'Venenum', group: 'prime',
    color: '#8a5ac4', color2: '#c69ef0',
    blurb: 'Patience, distilled.',
    bias: { agi: 2, int: 2, spr: -1 },
    perk: 'Virulence', perkText: 'Immune to Poison; your damage-over-time effects last 2 extra turns.',
  },
  {
    id: 'water', name: 'Water', rune: 'Aqua', group: 'prime',
    color: '#3f8fd0', color2: '#8fc6ee',
    blurb: 'It wins by refusing to fight.',
    bias: { mp: 10, spr: 3, int: 1, str: -1 },
    perk: 'Tidal', perkText: 'Healing you give or receive is increased by 15%.',
  },
  {
    id: 'light', name: 'Light', rune: 'Lumen', group: 'arcane',
    color: '#f5e6a8', color2: '#fffbe0',
    blurb: 'Not kindness. Clarity.',
    bias: { spr: 4, int: 2, agi: -1 },
    perk: 'Radiance', perkText: 'Revival effects restore full HP; +25% damage against Undead.',
  },
  {
    id: 'dark', name: 'Dark', rune: 'Umbra', group: 'arcane',
    color: '#6a4a8c', color2: '#a888c8',
    blurb: 'Everything the light refuses to name.',
    bias: { str: 2, int: 3, spr: -2 },
    perk: 'Devour', perkText: 'Killing blows restore 10% of your max HP and MP.',
  },
  {
    id: 'spirit', name: 'Spirit', rune: 'Anima', group: 'arcane',
    color: '#c98fd6', color2: '#efd0f5',
    blurb: 'The part of a thing that remembers being alive.',
    bias: { mp: 16, spr: 3, int: 1, hp: -8 },
    perk: 'Communion', perkText: 'Regenerate 3 MP per turn in battle; summon costs reduced by 20%.',
  },
  {
    id: 'void', name: 'Void', rune: 'Nihil', group: 'arcane',
    color: '#4a4a5c', color2: '#8c8ca4',
    blurb: 'The space where an element should have been.',
    bias: { lck: 4, int: 2, hp: -10, mp: -5 },
    perk: 'Nullity', perkText: 'Your damage ignores all elemental resistance — and never benefits from weakness.',
  },
];

// --- build the affinity table from the wheel rules -------------------------

function buildAffinities() {
  const strong = {};
  for (const e of DEF) strong[e.id] = [];

  // Primes: each beats the next two clockwise.
  const n = PRIME_WHEEL.length;
  for (let i = 0; i < n; i++) {
    strong[PRIME_WHEEL[i]].push(PRIME_WHEEL[(i + 1) % n], PRIME_WHEEL[(i + 2) % n]);
  }
  // Arcane: each beats the next one in its own cycle.
  const m = ARCANE_CYCLE.length;
  for (let i = 0; i < m; i++) {
    strong[ARCANE_CYCLE[i]].push(ARCANE_CYCLE[(i + 1) % m]);
  }
  return strong;
}

const STRONG = buildAffinities();

export const ELEMENTS = DEF.map((e) => ({
  ...e,
  strongAgainst: STRONG[e.id].slice(),
  weakAgainst: DEF.filter((o) => STRONG[o.id].includes(e.id)).map((o) => o.id),
}));

export const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));
export const ELEMENT_IDS = ELEMENTS.map((e) => e.id);

/**
 * Damage multiplier for `atk` element striking a defender whose element is `def`.
 * `null` / 'none' on either side is neutral.
 */
export function elementMultiplier(atk, def) {
  if (!atk || atk === 'none' || !def || def === 'none') return 1;
  if (atk === 'void' || def === 'void') return 1; // Nullity: the Void does not bargain.
  const a = ELEMENT_BY_ID[atk];
  if (!a) return 1;
  if (a.strongAgainst.includes(def)) return MULT_STRONG;
  if (a.weakAgainst.includes(def)) return MULT_WEAK;
  return 1;
}

export function elementColor(id) {
  return ELEMENT_BY_ID[id]?.color ?? '#c8c8d8';
}
