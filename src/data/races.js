// ============================================================================
//  RACES — 12, chosen at creation alongside class, element and job.
//
//  A race is the only one of the four choices that touches every layer at once:
//
//    mod      flat stat modifiers, applied once
//    growth   per-level multipliers on whatever class growth you earn, so a
//             race compounds over eighty levels instead of washing out
//    resist   elemental damage multipliers taken (0.7 = takes 70%)
//    traits   named passives with real hooks in battle, the field and the shops
//    look     the features the sprite generator draws — ears, muzzle, tail,
//             wings, horns, build and palette
//
//  Class says how you fight, element says what you are made of, job says what
//  you do for a living. Race says what you are.
// ============================================================================

const R = (o) => o;

export const RACES = [
  R({
    id: 'human', name: 'Human', plural: 'Humans',
    blurb: 'Short-lived, quick to learn, and everywhere.',
    mod: { hp: 6, mp: 3, str: 1, vit: 1, agi: 1, int: 1, spr: 1, lck: 3 },
    growth: { hp: 1.0, mp: 1.0, str: 1.0, vit: 1.0, agi: 1.0, int: 1.0, spr: 1.0, lck: 1.08 },
    resist: {},
    traits: [
      { id: 'adaptable', name: 'Adaptable', text: 'Earns job EXP 35% faster and starts every job at rank 1 progress.' },
      { id: 'resolve', name: 'Resolve', text: 'Recovers from any status one turn sooner.' },
    ],
    likes: ['light', 'lightning'],
    look: {
      ears: 'round', muzzle: false, tail: null, wings: null, horns: null,
      build: 1.0, skins: ['#e8b890', '#c89068', '#a06848', '#7a4c30'],
      hairs: ['#3a2a20', '#7a4a20', '#c8a040', '#a02830', '#e8e8f0', '#204068'],
      eye: '#3a5a8a',
    },
  }),
  R({
    id: 'elf', name: 'Elf', plural: 'Elves',
    blurb: 'Remembers the forest before it was a forest.',
    mod: { hp: -8, mp: 14, int: 4, agi: 3, spr: 2, vit: -2 },
    growth: { hp: 0.86, mp: 1.30, str: 0.92, vit: 0.90, agi: 1.14, int: 1.22, spr: 1.10, lck: 1.0 },
    resist: { nature: 0.75, poison: 0.85 },
    traits: [
      { id: 'arcaneblood', name: 'Arcane Blood', text: 'Spells cost 15% less MP and deal 10% more damage.' },
      { id: 'longsight', name: 'Longsight', text: 'Bows and ranged Arts ignore the first point of enemy evasion.' },
    ],
    likes: ['nature', 'wind', 'spirit'],
    look: {
      ears: 'long', muzzle: false, tail: null, wings: null, horns: null,
      build: 1.0, skins: ['#f0d8c0', '#e0c0a0', '#c8a888', '#a88868'],
      hairs: ['#e8dcc0', '#c8b070', '#8a9a70', '#d8d8e8', '#6a5a3a'],
      eye: '#4a8a6a',
    },
  }),
  R({
    id: 'dwarf', name: 'Dwarf', plural: 'Dwarves',
    blurb: 'Built low and wide, on purpose, by people who thought about it.',
    mod: { hp: 22, mp: -4, vit: 5, str: 3, agi: -3 },
    growth: { hp: 1.22, mp: 0.86, str: 1.14, vit: 1.24, agi: 0.82, int: 0.96, spr: 1.04, lck: 1.0 },
    resist: { earth: 0.7, fire: 0.85, metal: 0.85 },
    traits: [
      { id: 'forgeborn', name: 'Forgeborn', text: 'Armour and shields give 20% more defence. Upgrades cost 25% less.' },
      { id: 'rooted', name: 'Rooted', text: 'Immune to knockback and to forced repositioning.' },
    ],
    likes: ['earth', 'metal', 'fire'],
    look: {
      ears: 'round', muzzle: false, tail: null, wings: null, horns: null,
      build: 0.86, beard: true, skins: ['#e0b088', '#c08c60', '#a06a44'],
      hairs: ['#8a4020', '#6a3a18', '#c8a040', '#d8d8e0'],
      eye: '#6a4a20',
    },
  }),
  R({
    id: 'fairy', name: 'Fairy', plural: 'Fairies',
    blurb: 'Very small, very fast, and extremely difficult to hit on purpose.',
    mod: { hp: -30, mp: 22, agi: 7, int: 3, lck: 3, str: -4, vit: -4 },
    growth: { hp: 0.55, mp: 1.55, str: 0.62, vit: 0.66, agi: 1.42, int: 1.20, spr: 1.12, lck: 1.16 },
    resist: { wind: 0.6, spirit: 0.8, earth: 1.3 },
    traits: [
      { id: 'flight', name: 'Flight', text: '+18% evasion, and your reach counts as one column longer.' },
      { id: 'glimmer', name: 'Glimmer', text: 'Restores 4 MP at the end of every battle turn.' },
    ],
    likes: ['wind', 'spirit', 'light'],
    look: {
      ears: 'long', muzzle: false, tail: null, wings: 'fairy', horns: null,
      build: 0.66, skins: ['#f8e0d8', '#e8c8d8', '#d8e8e0'],
      hairs: ['#f0a8d0', '#a8d8f0', '#f8f0a0', '#c0a0f0'],
      eye: '#c060c0', glow: '#a8f0e0',
    },
  }),
  R({
    id: 'saurian', name: 'Lizardfolk', plural: 'Lizardfolk',
    blurb: 'Patient, armoured, and unbothered by the weather.',
    mod: { hp: 18, mp: -2, vit: 4, str: 2, int: -2 },
    growth: { hp: 1.18, mp: 0.90, str: 1.10, vit: 1.20, agi: 0.98, int: 0.90, spr: 1.0, lck: 0.96 },
    resist: { poison: 0.5, water: 0.8, ice: 1.25 },
    traits: [
      { id: 'scaled', name: 'Scaled Hide', text: 'Takes 12% less physical damage. Immune to Poison.' },
      { id: 'regrow', name: 'Regrow', text: 'Recovers 3% of max HP at the end of every battle turn.' },
    ],
    likes: ['earth', 'water', 'poison'],
    look: {
      ears: 'none', muzzle: true, tail: 'lizard', wings: null, horns: 'small',
      build: 1.04, skins: ['#5a8a4a', '#4a7a7a', '#8a7a3a', '#7a4a5a'],
      hairs: ['#3a5a2a', '#2a4a4a', '#5a4a1a'],
      eye: '#e8c040', scaled: true,
    },
  }),
  R({
    id: 'lupine', name: 'Wolfkin', plural: 'Wolfkin',
    blurb: 'Hears the argument three rooms away and is already moving.',
    mod: { hp: 8, agi: 5, str: 3, spr: -1, int: -2 },
    growth: { hp: 1.08, mp: 0.92, str: 1.12, vit: 1.02, agi: 1.22, int: 0.90, spr: 0.96, lck: 1.04 },
    resist: { wind: 0.85, dark: 0.85, light: 1.15 },
    traits: [
      { id: 'keenscent', name: 'Keen Scent', text: '+8% critical rate, and the party is never surprised.' },
      { id: 'packborn', name: 'Packborn', text: 'Deals 12% more damage while an ally shares your row.' },
    ],
    likes: ['wind', 'nature', 'dark'],
    look: {
      ears: 'wolf', muzzle: true, tail: 'wolf', wings: null, horns: null,
      build: 1.02, skins: ['#8a7a68', '#5a5048', '#c8bca8', '#3a3230'],
      hairs: ['#6a5a48', '#3a3230', '#d0c4b0'],
      eye: '#e8a030', fur: true,
    },
  }),
  R({
    id: 'ogrekin', name: 'Ogrekin', plural: 'Ogrekin',
    blurb: 'Has to duck for most doorways and resents none of them.',
    mod: { hp: 40, mp: -12, str: 6, vit: 4, agi: -4, int: -4 },
    growth: { hp: 1.36, mp: 0.64, str: 1.28, vit: 1.18, agi: 0.80, int: 0.72, spr: 0.86, lck: 0.94 },
    resist: { earth: 0.85, metal: 0.85, spirit: 1.25 },
    traits: [
      { id: 'giant', name: 'Giant’s Frame', text: 'Physical damage +15%. Two-handed weapons never slow you.' },
      { id: 'thickskull', name: 'Thick Skull', text: 'Immune to Confusion and Fear. Magic damage taken +10%.' },
    ],
    likes: ['earth', 'fire'],
    look: {
      ears: 'round', muzzle: false, tail: null, wings: null, horns: 'small', tusks: true,
      build: 1.22, skins: ['#7a8a5a', '#8a7a5a', '#6a6a7a', '#9a6a5a'],
      hairs: ['#2a2a20', '#5a4a30', '#8a3a20'],
      eye: '#c05030',
    },
  }),
  R({
    id: 'gnome', name: 'Gnome', plural: 'Gnomes',
    blurb: 'Small, loud, and holding something that should not be assembled yet.',
    mod: { hp: -12, mp: 10, int: 4, lck: 5, agi: 2, str: -3 },
    growth: { hp: 0.80, mp: 1.26, str: 0.78, vit: 0.88, agi: 1.10, int: 1.20, spr: 1.02, lck: 1.24 },
    resist: { lightning: 0.75, metal: 0.85 },
    traits: [
      { id: 'tinker', name: 'Tinker', text: 'Items used in battle are 30% stronger. +25% damage to Constructs.' },
      { id: 'smallframe', name: 'Small Frame', text: 'Enemies target you 40% less often while an ally is further forward.' },
    ],
    likes: ['lightning', 'metal', 'fire'],
    look: {
      ears: 'long', muzzle: false, tail: null, wings: null, horns: null, goggles: true,
      build: 0.74, skins: ['#f0c8a0', '#d8a878', '#c09060'],
      hairs: ['#d8d0c0', '#c85830', '#e8c060', '#6a8ac0'],
      eye: '#3a7a8a',
    },
  }),
  R({
    id: 'merfolk', name: 'Merfolk', plural: 'Merfolk',
    blurb: 'Walks on land the way you would swim: competently, and not for long.',
    mod: { hp: 4, mp: 16, spr: 5, int: 2, str: -2 },
    growth: { hp: 0.96, mp: 1.34, str: 0.90, vit: 0.98, agi: 1.04, int: 1.10, spr: 1.24, lck: 1.02 },
    resist: { water: 0.55, ice: 0.8, fire: 0.85, lightning: 1.35 },
    traits: [
      { id: 'tidecall', name: 'Tidecall', text: 'Healing you give and receive is increased by 20%.' },
      { id: 'deeplung', name: 'Deep Lung', text: 'No encounters on water. Fishing always succeeds.' },
    ],
    likes: ['water', 'ice', 'spirit'],
    look: {
      ears: 'fin', muzzle: false, tail: null, wings: null, horns: null, fins: true,
      build: 0.98, skins: ['#a8d0d8', '#88b8c8', '#c8d8e0', '#6a98b0'],
      hairs: ['#3a8a9a', '#5ab0b0', '#a0d8d0', '#2a5a7a'],
      eye: '#40c0d8',
    },
  }),
  R({
    id: 'draconian', name: 'Draconian', plural: 'Draconians',
    blurb: 'A very old thing wearing a person-shaped amount of itself.',
    mod: { hp: 16, mp: 6, str: 3, vit: 3, int: 2, spr: 2, agi: -2, lck: -3 },
    growth: { hp: 1.16, mp: 1.08, str: 1.12, vit: 1.12, agi: 0.94, int: 1.08, spr: 1.08, lck: 0.86 },
    resist: { fire: 0.7, ice: 0.75, wind: 0.85 },
    traits: [
      { id: 'wyrmblood', name: 'Wyrmblood', text: 'Max HP +10%. Deals 20% more damage to Dragons.' },
      { id: 'breath', name: 'Breath', text: 'Once per battle, a free attack in your element that hits an entire row.' },
    ],
    likes: ['fire', 'ice', 'lightning'],
    look: {
      ears: 'none', muzzle: true, tail: 'dragon', wings: 'dragon', horns: 'dragon',
      build: 1.08, skins: ['#8a5a4a', '#4a6a8a', '#6a8a5a', '#8a7a4a', '#5a4a6a'],
      hairs: ['#3a2a28', '#2a3a4a', '#4a3a20'],
      eye: '#f0a020', scaled: true,
    },
  }),
  R({
    id: 'automaton', name: 'Automaton', plural: 'Automatons',
    blurb: 'Was built for something. Nobody left alive remembers what.',
    mod: { hp: 26, mp: -8, vit: 6, str: 2, agi: -2, spr: -3, lck: -4 },
    growth: { hp: 1.26, mp: 0.78, str: 1.08, vit: 1.26, agi: 0.90, int: 1.04, spr: 0.82, lck: 0.80 },
    resist: { metal: 0.7, poison: 0.0, lightning: 1.4, water: 1.2 },
    traits: [
      { id: 'clockwork', name: 'Clockwork', text: 'Immune to Poison, Burn, Sleep, Confusion and Charm.' },
      { id: 'norepair', name: 'No Repair', text: 'Potions restore only half. Repair kits and Artificers restore double.' },
    ],
    likes: ['metal', 'lightning', 'void'],
    look: {
      ears: 'none', muzzle: false, tail: null, wings: null, horns: null, plates: true,
      build: 1.06, skins: ['#9aa2b0', '#b8a878', '#8a8a92', '#6a7a88'],
      hairs: ['#5a6068', '#8a7040', '#3a4048'],
      eye: '#f06040', glow: '#f06040',
    },
  }),
  R({
    id: 'revenant', name: 'Revenant', plural: 'Revenants',
    blurb: 'Came back. Has not yet been told this is unusual.',
    mod: { hp: 10, mp: 8, int: 3, str: 2, spr: -5, lck: -2 },
    growth: { hp: 1.10, mp: 1.14, str: 1.06, vit: 1.04, agi: 1.0, int: 1.16, spr: 0.78, lck: 0.94 },
    resist: { dark: 0.5, poison: 0.6, ice: 0.85, light: 1.5 },
    traits: [
      { id: 'deathless', name: 'Deathless', text: 'The first time you fall in a battle, you rise again at 25% HP.' },
      { id: 'coldblood', name: 'Cold Blood', text: 'Immune to Instant Death and Doom. Healing received is reduced by 20%.' },
    ],
    likes: ['dark', 'void', 'spirit'],
    look: {
      ears: 'round', muzzle: false, tail: null, wings: null, horns: null, gaunt: true,
      build: 1.0, skins: ['#b8b0c0', '#98a0a8', '#c0b8b0', '#8a90a0'],
      hairs: ['#3a3448', '#5a5060', '#20202c'],
      eye: '#a860f0', glow: '#a860f0',
    },
  }),
];

export const RACE_BY_ID = Object.fromEntries(RACES.map((r) => [r.id, r]));
export const RACE_IDS = RACES.map((r) => r.id);

export function getRace(id) {
  const r = RACE_BY_ID[id];
  if (!r) throw new Error(`unknown race: ${id}`);
  return r;
}

export function hasTrait(raceId, traitId) {
  return getRace(raceId).traits.some((t) => t.id === traitId);
}

/** Damage multiplier this race takes from `element`; 1 when it has no opinion. */
export function raceResist(raceId, element) {
  if (!element || element === 'none') return 1;
  return getRace(raceId).resist[element] ?? 1;
}

/** A race ranks a job it favours 20% faster. */
export function raceJobAffinity(raceId, elementId) {
  return getRace(raceId).likes.includes(elementId) ? 1.2 : 1;
}
