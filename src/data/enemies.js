// ============================================================================
//  ENEMIES & FORMATIONS
//
//  Enemies occupy the same 3x3 grid the party does, so a formation is a list of
//  {id,row,col}. Anything in column 0 is the enemy front rank; melee weapons of
//  reach 2 cannot touch column 2 until the ranks in front of it are gone.
//
//  `sprite` describes a body plan for the procedural pixel-art renderer rather
//  than pointing at an image file — see src/engine/sprites.js.
// ============================================================================

export const FAMILIES = {
  beast:     { name: 'Beast' },
  undead:    { name: 'Undead' },
  construct: { name: 'Construct' },
  humanoid:  { name: 'Humanoid' },
  dragon:    { name: 'Dragon' },
  plant:     { name: 'Plant' },
  aberration:{ name: 'Aberration' },
  spirit:    { name: 'Spirit' },
};

// e(id, name, family, element, lv, stats, extra)
// stats: [hp, mp, atk, def, mag, res, agi]
const e = (id, name, family, element, lv, stats, extra = {}) => ({
  id, name, family, element, lv,
  hp: stats[0], mp: stats[1], atk: stats[2], def: stats[3],
  mag: stats[4], res: stats[5], agi: stats[6],
  exp: extra.exp ?? Math.round(stats[0] * 0.5 + lv * 6),
  gold: extra.gold ?? Math.round(stats[0] * 0.35 + lv * 4),
  skills: extra.skills ?? [],
  drops: extra.drops ?? [],
  steal: extra.steal ?? null,
  ai: extra.ai ?? 'basic',
  reach: extra.reach ?? 2,
  sprite: extra.sprite,
  blurb: extra.blurb ?? '',
  tame: extra.tame ?? false,
});

const sp = (plan, c1, c2, c3, scale = 1) => ({ plan, palette: [c1, c2, c3], scale });

export const ENEMIES = [
  // --- Greenfield / early --------------------------------------------------
  e('slime', 'Slime', 'aberration', 'water', 1, [22, 0, 8, 3, 2, 2, 5], {
    sprite: sp('blob', '#3f8fd0', '#8fc6ee', '#1e4e78'), tame: true,
    drops: [['healherb', 0.4]], blurb: 'The traditional opening argument.',
  }),
  e('greenslime', 'Moss Slime', 'plant', 'nature', 2, [30, 0, 10, 5, 4, 3, 5], {
    sprite: sp('blob', '#5aa93f', '#a8d96a', '#2e6323'), tame: true,
    drops: [['healherb', 0.5], ['manaflower', 0.1]],
  }),
  e('rat', 'Sewer Rat', 'beast', 'poison', 2, [26, 0, 12, 4, 2, 2, 12], {
    sprite: sp('quadruped', '#7a5c3a', '#b08a5a', '#4a3420'), tame: true,
    skills: ['jinx'], drops: [['beastfang', 0.3]],
  }),
  e('boar', 'Bristle Boar', 'beast', 'earth', 4, [58, 0, 20, 10, 3, 4, 9], {
    sprite: sp('quadruped', '#6a5040', '#9c7a5c', '#3e2c20', 1.2), tame: true,
    drops: [['beastfang', 0.5], ['leather', 0.4]], blurb: 'Charges first, considers later.',
  }),
  e('bandit', 'Roadside Bandit', 'humanoid', 'none', 5, [64, 8, 22, 11, 6, 6, 14], {
    sprite: sp('humanoid', '#8a6a4a', '#c0a080', '#4a3a2a'),
    skills: ['steal', 'backstab'], steal: 'potion', gold: 90,
    drops: [['bronzedagger', 0.15], ['potion', 0.4]],
  }),
  e('wisp', 'Marsh Wisp', 'spirit', 'lightning', 5, [42, 30, 14, 6, 22, 16, 20], {
    sprite: sp('flyer', '#e6d24a', '#fff6a8', '#a08a10'),
    skills: ['spark'], ai: 'caster', reach: 9,
    drops: [['manaflower', 0.4], ['spiritglass', 0.05]],
  }),
  e('thornvine', 'Thornvine', 'plant', 'nature', 6, [80, 12, 24, 16, 10, 8, 6], {
    sprite: sp('plant', '#3f7a2f', '#7ab84a', '#22491a', 1.2), reach: 3,
    skills: ['trapset'], drops: [['healherb', 0.6], ['manaflower', 0.2]],
    blurb: 'Reaches the back rank without moving an inch.',
  }),

  // --- Caves / mid ---------------------------------------------------------
  e('bat', 'Cave Bat', 'beast', 'dark', 6, [48, 0, 20, 8, 8, 6, 24], {
    sprite: sp('flyer', '#5a4a6a', '#8a7a9a', '#2e2438'), tame: true,
    skills: ['jinx'], drops: [['beastfang', 0.4]],
  }),
  e('kobold', 'Kobold Miner', 'humanoid', 'earth', 7, [92, 6, 28, 18, 6, 8, 11], {
    sprite: sp('humanoid', '#7a6a4a', '#a89a70', '#3e3624', 0.9),
    skills: ['recklessblow'], drops: [['copperore', 0.6], ['ironore', 0.25]],
  }),
  e('skeleton', 'Rattling Skeleton', 'undead', 'dark', 8, [86, 0, 32, 20, 6, 10, 12], {
    sprite: sp('humanoid', '#d8d0b8', '#f4eeda', '#8a8270'),
    skills: ['slash'], drops: [['bronzesword', 0.12], ['holywater', 0.2]],
    blurb: 'Held together by grudge.',
  }),
  e('ghoul', 'Ghoul', 'undead', 'poison', 10, [130, 10, 40, 22, 12, 12, 10], {
    sprite: sp('humanoid', '#6a7a5a', '#9aae86', '#3a442e'),
    skills: ['poisonblade'], drops: [['venomcap', 0.4], ['antidote', 0.3]],
  }),
  e('golemshard', 'Shard Golem', 'construct', 'metal', 11, [190, 0, 46, 42, 8, 20, 5], {
    sprite: sp('construct', '#9fa8b4', '#dfe6ee', '#5a626c', 1.3),
    skills: ['guardstance'], ai: 'defensive',
    drops: [['ironore', 0.7], ['mythril', 0.1]],
    blurb: 'Very hard. Very slow. Choose a column and wait.',
  }),
  e('fireimp', 'Ember Imp', 'spirit', 'fire', 11, [104, 40, 34, 16, 34, 18, 22], {
    sprite: sp('flyer', '#e0522c', '#f8b04a', '#8a2810'),
    skills: ['spark', 'primebolt'], ai: 'caster', reach: 9,
    drops: [['firebomb', 0.3]],
  }),
  e('iceelemental', 'Rime Elemental', 'spirit', 'ice', 12, [140, 50, 30, 24, 40, 30, 14], {
    sprite: sp('blob', '#7fd3f0', '#d8f4ff', '#3a8ab0', 1.2),
    skills: ['primebolt', 'elemward'], ai: 'caster', reach: 9,
    drops: [['frostbomb', 0.3], ['spiritglass', 0.1]],
  }),
  e('direwolf', 'Dire Wolf', 'beast', 'wind', 12, [150, 0, 52, 24, 8, 14, 30], {
    sprite: sp('quadruped', '#6a6a7a', '#a0a0b4', '#3a3a48', 1.15), tame: true,
    skills: ['maul'], ai: 'aggressive', drops: [['beastfang', 0.7], ['leather', 0.5]],
  }),
  e('harpy', 'Cliff Harpy', 'beast', 'wind', 13, [138, 20, 46, 20, 20, 16, 34], {
    sprite: sp('flyer', '#8fd6b4', '#d6f5e6', '#3f8a68', 1.1),
    skills: ['aimshot', 'cripple'], reach: 9,
    drops: [['silkthread', 0.4]],
  }),

  // --- Ruins / late-mid ----------------------------------------------------
  e('wraith', 'Wraith', 'undead', 'spirit', 15, [180, 60, 48, 26, 46, 34, 26], {
    sprite: sp('flyer', '#c98fd6', '#efd0f5', '#6a4a8c', 1.1),
    skills: ['drain', 'wither'], ai: 'caster', reach: 9,
    drops: [['spiritglass', 0.25], ['holywater', 0.3]],
    blurb: 'Takes what it needs and remembers where it got it.',
  }),
  e('armoredknight', 'Fallen Knight', 'undead', 'metal', 16, [260, 20, 66, 52, 14, 26, 18], {
    sprite: sp('humanoid', '#8a8fa0', '#c8cdd8', '#4a4e5a', 1.15),
    skills: ['crossslash', 'guardstance'], ai: 'defensive',
    drops: [['ironsword', 0.15], ['chainmail', 0.15], ['mythril', 0.2]],
  }),
  e('basilisk', 'Basilisk', 'beast', 'earth', 17, [240, 30, 62, 40, 30, 24, 16], {
    sprite: sp('serpent', '#8a9a4a', '#c4d47a', '#4a5424', 1.2),
    skills: ['soulbind', 'rot'], drops: [['goldneedle', 0.4], ['dragonscale', 0.1]],
    blurb: 'Do not make eye contact. Do not make any contact.',
  }),
  e('sorcerer', 'Ruin Sorcerer', 'humanoid', 'dark', 18, [200, 120, 44, 30, 68, 40, 24], {
    sprite: sp('humanoid', '#6a4a8c', '#a888c8', '#3a2450'),
    skills: ['bonespear', 'phantasm', 'wither'], ai: 'caster', reach: 9,
    steal: 'ether', drops: [['runestaff', 0.12], ['ether', 0.4]],
  }),
  e('mimic', 'Mimic', 'construct', 'metal', 18, [300, 0, 78, 46, 10, 22, 20], {
    sprite: sp('construct', '#8a6a3a', '#c0a060', '#4a3418'),
    skills: ['maul'], ai: 'aggressive', gold: 900,
    drops: [['hipotion', 0.6], ['luckycoin', 0.08]],
    blurb: 'The chest was the encounter.',
  }),
  e('chimera', 'Chimera', 'beast', 'fire', 20, [340, 60, 82, 44, 50, 32, 28], {
    sprite: sp('quadruped', '#b04a2c', '#e08a5a', '#6a2a14', 1.35),
    skills: ['maul', 'cataclysm'], ai: 'aggressive',
    drops: [['beastfang', 0.8], ['dragonscale', 0.2]],
  }),
  e('lich', 'Lesser Lich', 'undead', 'dark', 22, [380, 200, 60, 44, 88, 56, 26], {
    sprite: sp('humanoid', '#4a4a5c', '#8c8ca4', '#26263a', 1.1),
    skills: ['bonespear', 'raise', 'doomhex'], ai: 'caster', reach: 9,
    drops: [['spiritglass', 0.5], ['holywater', 0.5]],
  }),
  e('ironsentinel', 'Iron Sentinel', 'construct', 'metal', 22, [520, 0, 92, 78, 12, 40, 12], {
    sprite: sp('construct', '#9fa8b4', '#dfe6ee', '#4a525c', 1.5),
    skills: ['shieldbash', 'ironwall'], ai: 'defensive',
    drops: [['adamantite', 0.25], ['ironshield', 0.2]],
  }),
  e('wyvern', 'Wyvern', 'dragon', 'wind', 24, [460, 80, 100, 56, 46, 40, 40], {
    sprite: sp('dragon', '#4a8a6a', '#8ec4a4', '#2a5240', 1.4),
    skills: ['dragondive', 'cripple'], ai: 'aggressive', reach: 9,
    drops: [['dragonscale', 0.5], ['wyvernlance', 0.08]],
  }),
  e('voidspawn', 'Void Spawn', 'aberration', 'void', 25, [420, 100, 88, 50, 76, 60, 34], {
    sprite: sp('blob', '#4a4a5c', '#8c8ca4', '#1e1e2c', 1.2),
    skills: ['unmake', 'phantasm'], ai: 'caster', reach: 9,
    drops: [['spiritglass', 0.4], ['voidring', 0.04]],
    blurb: 'Resistances do not apply. Nothing applies.',
  }),

  // --- Bosses --------------------------------------------------------------
  e('boss_brigand', 'Brigand Chief Volk', 'humanoid', 'fire', 9, [520, 40, 46, 28, 18, 16, 20], {
    sprite: sp('humanoid', '#a04a2c', '#d88a5a', '#5a240e', 1.3),
    skills: ['crossslash', 'warcry', 'recklessblow'], ai: 'boss', gold: 1200, exp: 900,
    drops: [['battleaxe', 1.0]], steal: 'hipotion',
    blurb: 'Runs the road between here and anywhere.',
  }),
  e('boss_golemking', 'The Anvil King', 'construct', 'earth', 16, [1400, 0, 84, 76, 20, 44, 10], {
    sprite: sp('construct', '#9a7042', '#c9a06a', '#5a4020', 1.7),
    skills: ['shieldbash', 'ironwall', 'stampede'], ai: 'boss', gold: 3000, exp: 3200,
    drops: [['adamantite', 1.0], ['ironshield', 1.0]],
    blurb: 'Was a mountain. Got up.',
  }),
  e('boss_shadow', 'The Hollow Choir', 'spirit', 'dark', 23, [2400, 300, 104, 62, 96, 68, 36], {
    sprite: sp('flyer', '#4a2a5c', '#9a6ab4', '#22122e', 1.7),
    skills: ['oblivion', 'anathemahex', 'phantasm', 'drain'], ai: 'boss', gold: 8000, exp: 12000,
    drops: [['crownofstars', 1.0]],
    blurb: 'Sings with every voice it has collected.',
  }),
  e('boss_wyrm', 'Aurelith, the Last Wyrm', 'dragon', 'light', 28, [4200, 400, 132, 88, 118, 84, 46], {
    sprite: sp('dragon', '#d8b850', '#f8e8a0', '#8a6a18', 2.0),
    skills: ['exalt', 'dragondive', 'primeforce', 'consecration'], ai: 'boss', gold: 20000, exp: 40000,
    drops: [['sunblade', 1.0], ['dragonscale', 1.0]],
    blurb: 'Remembers the wheel being made.',
  }),
];

export const ENEMY_BY_ID = Object.fromEntries(ENEMIES.map((x) => [x.id, x]));

export function getEnemy(id) {
  const x = ENEMY_BY_ID[id];
  if (!x) throw new Error(`unknown enemy: ${id}`);
  return x;
}

// --- formations -------------------------------------------------------------
// g(...) places ids into grid cells reading front-column first.
const f = (id, region, cells, extra = {}) => ({ id, region, cells, ...extra });
const at = (id, row, col) => ({ id, row, col });

export const FORMATIONS = [
  f('gf1', 'greenfield', [at('slime', 1, 0), at('slime', 0, 0)]),
  f('gf2', 'greenfield', [at('greenslime', 1, 0), at('rat', 0, 0), at('rat', 2, 0)]),
  f('gf3', 'greenfield', [at('boar', 1, 0), at('greenslime', 0, 1)]),
  f('gf4', 'greenfield', [at('bandit', 1, 0), at('bandit', 0, 0), at('rat', 2, 1)]),
  f('gf5', 'greenfield', [at('thornvine', 1, 1), at('greenslime', 0, 0), at('greenslime', 2, 0)]),
  f('gf6', 'greenfield', [at('wisp', 1, 2), at('bandit', 1, 0), at('boar', 0, 0)]),

  f('cv1', 'caverns', [at('bat', 0, 0), at('bat', 2, 0), at('kobold', 1, 0)]),
  f('cv2', 'caverns', [at('skeleton', 1, 0), at('skeleton', 0, 0), at('bat', 2, 1)]),
  f('cv3', 'caverns', [at('kobold', 0, 0), at('kobold', 2, 0), at('golemshard', 1, 1)]),
  f('cv4', 'caverns', [at('ghoul', 1, 0), at('ghoul', 0, 0), at('fireimp', 1, 2)]),
  f('cv5', 'caverns', [at('iceelemental', 1, 1), at('direwolf', 0, 0), at('direwolf', 2, 0)]),
  f('cv6', 'caverns', [at('harpy', 0, 2), at('harpy', 2, 2), at('direwolf', 1, 0)]),

  f('rn1', 'ruins', [at('wraith', 1, 2), at('skeleton', 0, 0), at('skeleton', 2, 0), at('armoredknight', 1, 0)]),
  f('rn2', 'ruins', [at('armoredknight', 0, 0), at('armoredknight', 2, 0), at('sorcerer', 1, 2)]),
  f('rn3', 'ruins', [at('basilisk', 1, 0), at('ghoul', 0, 1), at('ghoul', 2, 1)]),
  f('rn4', 'ruins', [at('mimic', 1, 0)], { rare: true }),
  f('rn5', 'ruins', [at('chimera', 1, 0), at('harpy', 0, 2), at('harpy', 2, 2)]),
  f('rn6', 'ruins', [at('lich', 1, 2), at('ironsentinel', 1, 0), at('wraith', 0, 1), at('wraith', 2, 1)]),
  f('rn7', 'ruins', [at('wyvern', 1, 1), at('voidspawn', 0, 2), at('voidspawn', 2, 2)]),

  f('boss_volk', 'boss', [at('boss_brigand', 1, 0), at('bandit', 0, 0), at('bandit', 2, 0)], { boss: true }),
  f('boss_anvil', 'boss', [at('boss_golemking', 1, 0), at('golemshard', 0, 1), at('golemshard', 2, 1)], { boss: true }),
  f('boss_choir', 'boss', [at('boss_shadow', 1, 1), at('wraith', 0, 0), at('wraith', 2, 0)], { boss: true }),
  f('boss_aurelith', 'boss', [at('boss_wyrm', 1, 1)], { boss: true }),
];

export const FORMATION_BY_ID = Object.fromEntries(FORMATIONS.map((x) => [x.id, x]));

export function formationsForRegion(region) {
  return FORMATIONS.filter((x) => x.region === region && !x.boss && !x.rare);
}
