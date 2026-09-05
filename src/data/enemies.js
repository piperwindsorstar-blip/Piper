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

  // --- The Hollow Between / endgame (Lv30-80) ------------------------------
  e('frostcolossus', 'Frost Colossus', 'construct', 'ice', 32, [1862, 60, 147, 104, 71, 74, 20], {
    sprite: sp('construct', '#8fc4e0', '#d8f0ff', '#4a7a9a', 1.5),
    skills: ['primebolt', 'ironwall', 'shieldbash'], ai: 'defensive',
    drops: [['adamantite', 0.4], ['spiritglass', 0.3], ['titanhelm', 0.06]],
    blurb: 'Walked out of a glacier and kept walking.',
  }),
  e('abyssalmaw', 'Abyssal Maw', 'aberration', 'void', 36, [1672, 120, 161, 82, 133, 88, 44], {
    sprite: sp('blob', '#3a2a52', '#7a5a9a', '#180f28', 1.4),
    skills: ['unmake', 'phantasm', 'drain'], ai: 'caster', reach: 9,
    drops: [['spiritglass', 0.5], ['voidring', 0.08], ['voidfang', 0.05]],
    blurb: 'Resistance is a property of things that exist.',
  }),
  e('stormdjinn', 'Storm Djinn', 'spirit', 'lightning', 40, [1938, 200, 174, 88, 170, 96, 62], {
    sprite: sp('flyer', '#e8dc6a', '#fffcc8', '#8a7a10', 1.4),
    skills: ['cataclysm', 'primeforce', 'elemward'], ai: 'caster', reach: 9,
    drops: [['stormrod', 0.12], ['spiritglass', 0.4], ['quicksilver', 0.05]],
  }),
  e('bonedragon', 'Bone Dragon', 'undead', 'dark', 46, [3135, 180, 213, 122, 174, 112, 52], {
    sprite: sp('dragon', '#d8d0b8', '#f4eeda', '#6a6250', 1.6),
    skills: ['oblivion', 'bonespear', 'dragondive'], ai: 'aggressive', reach: 9,
    drops: [['dragonscale', 0.7], ['holywater', 0.6], ['dragonmail', 0.08]],
    blurb: 'Died a very long time ago and has not slowed down much.',
  }),
  e('seraph', 'Fallen Seraph', 'spirit', 'light', 54, [3610, 300, 227, 134, 220, 148, 70], {
    sprite: sp('flyer', '#f8f0c8', '#ffffff', '#c8a860', 1.7),
    skills: ['exalt', 'judgement', 'consecration', 'fullrestore'], ai: 'caster', reach: 9,
    drops: [['crownofstars', 0.1], ['sunpetal', 0.6], ['starbow', 0.06]],
    blurb: 'Still following an order nobody remembers giving.',
  }),
  e('deepwarden', 'Warden of the Deep', 'aberration', 'water', 60, [4560, 260, 250, 156, 213, 162, 58], {
    sprite: sp('serpent', '#2a6a8a', '#6ab0c8', '#12384a', 1.7),
    skills: ['leviathan', 'soulbind', 'rot'], ai: 'boss', reach: 9,
    drops: [['riverpearl', 0.8], ['aegisshield', 0.15], ['aeonlance', 0.07]],
  }),
  e('ashtitan', 'Titan of Ash', 'construct', 'fire', 66, [6080, 160, 289, 190, 193, 158, 40], {
    sprite: sp('construct', '#a04030', '#e07850', '#4a1a10', 1.9),
    skills: ['cataclysm', 'stampede', 'primalroar'], ai: 'aggressive',
    drops: [['adamantite', 0.8], ['ruinaxe', 0.12], ['titanmaul', 0.07]],
    blurb: 'What is left standing after a city stops.',
  }),
  e('nullweaver', 'Null Weaver', 'aberration', 'void', 72, [6840, 420, 308, 178, 299, 208, 84], {
    sprite: sp('serpent', '#4a4a5c', '#9a9ab4', '#1a1a26', 1.8),
    skills: ['unmaking', 'starfall', 'timeslip', 'soulbind'], ai: 'caster', reach: 9,
    drops: [['voidring', 0.3], ['spiritglass', 0.9], ['nullstaff', 0.07]],
    blurb: 'Pulls the thread and watches what unravels.',
  }),

  // --- Cinderreach (Lv33-40, between the Ruins and the Hollow Between) -----
  e('cinderhound', 'Cinderhound', 'beast', 'fire', 33, [1480, 0, 142, 96, 58, 66, 46], {
    sprite: sp('quadruped', '#c0442a', '#f0985a', '#5c1c0e', 1.3),
    skills: ['maul'], ai: 'aggressive', drops: [['beastfang', 0.6], ['sunpetal', 0.2]],
    blurb: 'Runs on coals it left behind an hour ago.',
  }),
  e('ashwraith', 'Ash Wraith', 'spirit', 'fire', 34, [1380, 160, 108, 74, 152, 92, 55], {
    sprite: sp('flyer', '#7a5060', '#c48a70', '#3a2028', 1.2),
    skills: ['bonespear', 'wither'], ai: 'caster', reach: 9,
    drops: [['spiritglass', 0.3], ['sunpetal', 0.15]],
  }),
  e('moltenguard', 'Moltenguard', 'construct', 'earth', 36, [1920, 0, 156, 132, 68, 88, 30], {
    sprite: sp('construct', '#8a5030', '#d08850', '#3a2010', 1.5),
    skills: ['shieldbash', 'guardstance'], ai: 'defensive',
    drops: [['ironore', 0.5], ['adamantite', 0.2]],
    blurb: 'Slow the way lava is slow — right up until it isn\'t.',
  }),
  e('sparkhawk', 'Sparkhawk', 'beast', 'lightning', 38, [1660, 0, 168, 100, 122, 96, 88], {
    sprite: sp('flyer', '#e0d840', '#fff8a0', '#7a7010', 1.15),
    skills: ['aimshot', 'cripple'], reach: 9,
    drops: [['silkthread', 0.4], ['spiritglass', 0.2]],
  }),

  // --- The Drowned Vale (Lv50-58, between the Gatekeeper and the World Heart)
  e('tidewraith', 'Tidewraith', 'undead', 'water', 50, [3320, 260, 196, 132, 212, 152, 60], {
    sprite: sp('flyer', '#2a6a8a', '#7ac0d8', '#12384a', 1.3),
    skills: ['bonespear', 'wither', 'drain'], ai: 'caster', reach: 9,
    drops: [['riverpearl', 0.4], ['spiritglass', 0.3]],
    blurb: 'Drowned so long ago it forgot to notice.',
  }),
  e('drownedknight', 'Drowned Knight', 'undead', 'water', 52, [3900, 0, 232, 176, 100, 132, 44], {
    sprite: sp('humanoid', '#3a5a68', '#7a9aa8', '#1a2a30', 1.25),
    skills: ['crossslash', 'guardstance'], ai: 'defensive',
    drops: [['chainmail', 0.2], ['riverpearl', 0.35]],
  }),
  e('krakenspawn', 'Krakenspawn', 'beast', 'water', 54, [3720, 0, 216, 150, 140, 140, 68], {
    sprite: sp('serpent', '#1e4a5c', '#4a8898', '#0c2028', 1.5),
    skills: ['maul', 'rot'], ai: 'aggressive',
    drops: [['riverpearl', 0.5], ['dragonscale', 0.1]],
  }),
  e('stormsiren', 'Storm Siren', 'spirit', 'wind', 56, [3500, 300, 182, 120, 232, 166, 82], {
    sprite: sp('flyer', '#8fd6c8', '#d6f5ee', '#3f8a78', 1.3),
    skills: ['cataclysm', 'elemward'], ai: 'caster', reach: 9,
    drops: [['spiritglass', 0.45], ['silkthread', 0.3]],
    blurb: 'Sings the exact note a hull cannot survive.',
  }),

  // --- The Glassfields (Lv70-78, between the World Heart and the Thirteenth)
  e('glasswraith', 'Glass Wraith', 'aberration', 'light', 70, [7100, 420, 258, 174, 286, 206, 76], {
    sprite: sp('flyer', '#e8e0f8', '#ffffff', '#a89ac0', 1.3),
    skills: ['bonespear', 'phantasm'], ai: 'caster', reach: 9,
    drops: [['spiritglass', 0.5], ['sunpetal', 0.3]],
    blurb: 'Shattered once. Kept moving anyway.',
  }),
  e('radiantguard', 'Radiant Guard', 'construct', 'light', 72, [8300, 0, 278, 224, 154, 194, 56], {
    sprite: sp('construct', '#f0e8c0', '#ffffff', '#b8a860', 1.6),
    skills: ['shieldbash', 'ironwall'], ai: 'defensive',
    drops: [['adamantite', 0.5], ['titanhelm', 0.08]],
  }),
  e('duskstalker', 'Duskstalker', 'spirit', 'dark', 74, [7700, 260, 296, 182, 204, 214, 98], {
    sprite: sp('quadruped', '#2a1c3a', '#5a4278', '#120a1c', 1.4),
    skills: ['maul', 'wither'], ai: 'aggressive',
    drops: [['spiritglass', 0.4], ['voidring', 0.05]],
    blurb: 'Walks in the gap between one lit moment and the next.',
  }),
  e('starweaver', 'Starweaver', 'aberration', 'void', 76, [7900, 460, 246, 194, 306, 234, 88], {
    sprite: sp('serpent', '#241a40', '#5a4a8a', '#0e0a1c', 1.5),
    skills: ['unmaking', 'starfall', 'timeslip'], ai: 'caster', reach: 9,
    drops: [['voidring', 0.15], ['spiritglass', 0.6]],
    blurb: 'Weaves with a thread that was never really there.',
  }),

  // --- Bosses --------------------------------------------------------------
  e('boss_brigand', 'Brigand Chief Volk', 'humanoid', 'fire', 9, [760, 40, 52, 30, 20, 18, 20], {
    sprite: sp('humanoid', '#a04a2c', '#d88a5a', '#5a240e', 1.3),
    skills: ['crossslash', 'warcry', 'recklessblow'], ai: 'boss', gold: 1200, exp: 900,
    drops: [['battleaxe', 1.0]], steal: 'hipotion',
    blurb: 'Runs the road between here and anywhere.',
  }),
  e('boss_golemking', 'The Anvil King', 'construct', 'earth', 16, [2400, 0, 96, 80, 24, 48, 12], {
    sprite: sp('construct', '#9a7042', '#c9a06a', '#5a4020', 1.7),
    skills: ['shieldbash', 'ironwall', 'stampede'], ai: 'boss', gold: 3000, exp: 3200,
    drops: [['adamantite', 1.0], ['ironshield', 1.0]],
    blurb: 'Was a mountain. Got up.',
  }),
  e('boss_shadow', 'The Hollow Choir', 'spirit', 'dark', 23, [4200, 300, 132, 68, 122, 74, 38], {
    sprite: sp('flyer', '#4a2a5c', '#9a6ab4', '#22122e', 1.7),
    skills: ['oblivion', 'anathemahex', 'phantasm', 'drain'], ai: 'boss', gold: 8000, exp: 12000,
    drops: [['crownofstars', 1.0]],
    blurb: 'Sings with every voice it has collected.',
  }),
  e('boss_wyrm', 'Aurelith, the Last Wyrm', 'dragon', 'light', 28, [7000, 400, 148, 96, 130, 92, 48], {
    sprite: sp('dragon', '#d8b850', '#f8e8a0', '#8a6a18', 2.0),
    skills: ['exalt', 'dragondive', 'primeforce', 'consecration'], ai: 'boss', gold: 20000, exp: 40000,
    drops: [['sunblade', 1.0], ['dragonscale', 1.0]],
    blurb: 'Remembers the wheel being made.',
  }),
  e('boss_kharos', 'Kharos, the Cinder Sovereign', 'spirit', 'fire', 37, [9800, 500, 205, 135, 178, 128, 52], {
    sprite: sp('flyer', '#c0442a', '#f0985a', '#5c1c0e', 1.8),
    skills: ['cataclysm', 'primeforce', 'elemward', 'warcry'], ai: 'boss', gold: 28000, exp: 75000,
    drops: [['emberrod', 1.0], ['cindercrown', 1.0]],
    blurb: 'Ruled the reach by never once letting it cool.',
  }),
  e('boss_gate', 'The Gatekeeper', 'construct', 'metal', 46, [13000, 400, 268, 178, 232, 168, 56], {
    sprite: sp('construct', '#b8bcc8', '#eef2fa', '#5a606c', 2.2),
    skills: ['unyielding', 'breakpoint', 'grandsigil', 'shieldbash'], ai: 'boss',
    gold: 40000, exp: 120000,
    drops: [['titanplate', 1.0], ['bulwarkshield', 1.0], ['titanring', 1.0]],
    blurb: 'Was told to let nobody through. Nobody has been through.',
  }),
  e('boss_nerith', 'Nerith, the Drowned Vicar', 'undead', 'water', 55, [15000, 700, 295, 195, 270, 198, 60], {
    sprite: sp('flyer', '#2a5a70', '#6aa8c0', '#122a38', 1.9),
    skills: ['leviathan', 'soulbind', 'rot', 'drain'], ai: 'boss', gold: 60000, exp: 230000,
    drops: [['drownedcrozier', 1.0], ['vicarlocket', 1.0]],
    blurb: 'Kept preaching long after the congregation stopped surfacing.',
  }),
  e('boss_worldheart', 'The World Heart', 'spirit', 'nature', 66, [18000, 900, 330, 220, 325, 238, 68], {
    sprite: sp('plant', '#4a9a4a', '#9ae07a', '#1e4a1c', 2.4),
    skills: ['worldvoice', 'finalhour', 'mendworld', 'anathemahex', 'stampede'], ai: 'boss',
    gold: 90000, exp: 380000,
    drops: [['voidweave', 1.0], ['aeonpendant', 1.0], ['godsfist', 1.0]],
    blurb: 'Everything green has been waiting for you to arrive.',
  }),
  e('boss_vessia', 'Vessia, the Glass Warden', 'construct', 'light', 75, [19500, 1150, 336, 237, 324, 258, 78], {
    sprite: sp('construct', '#f0e8c0', '#ffffff', '#a89ac0', 2.1),
    skills: ['consecration', 'judgement', 'ironwall', 'breakpoint'], ai: 'boss', gold: 150000, exp: 750000,
    drops: [['glasslance', 1.0], ['glasshalo', 1.0]],
    blurb: 'Stands where the reliquary asked her to stand. Has not been relieved.',
  }),
  e('boss_thirteenth', 'The Thirteenth', 'aberration', 'void', 88, [22000, 1600, 345, 262, 320, 288, 92], {
    sprite: sp('humanoid', '#3a3450', '#8a82ac', '#16121f', 2.6),
    skills: ['worldsend', 'lastword', 'unmaking', 'everguard', 'rebirth', 'soulbind'], ai: 'boss',
    gold: 250000, exp: 1400000,
    drops: [['worldedge', 1.0], ['nullstaff', 1.0], ['crownvoid', 1.0]],
    blurb: 'The element that was left off the wheel, and has not forgiven it.',
  }),

  // --- The Colosseum's Champion Gauntlet — a mortal record nobody's beaten,
  // not a cosmic horror like the rest of this tier's company. Reward comes
  // straight from data/arena.js on clearing the tier, not from this drop
  // table, so it's left empty. ------------------------------------------
  e('boss_arenachampion', 'The Undefeated', 'humanoid', 'none', 82, [21000, 700, 315, 235, 70, 205, 75], {
    sprite: sp('humanoid', '#8a1c1c', '#e0a030', '#3a0808', 2.0),
    skills: ['crossslash', 'warcry', 'breakpoint', 'recklessblow'], ai: 'boss',
    gold: 170000, exp: 900000,
    blurb: "Nobody remembers a name. Everybody remembers losing.",
  }),

  // --- postgame — a locked room in the Hollow Between, open only once the
  // Thirteenth is counted, per the epilogue's own last line about the wheel
  // turning "like something is missing from it now, on purpose" -----------
  e('boss_seam', 'The Seam', 'aberration', 'void', 96, [40000, 2500, 460, 340, 430, 380, 105], {
    sprite: sp('humanoid', '#050208', '#3a3450', '#000000', 2.9),
    skills: ['worldsend', 'lastword', 'unmaking', 'everguard', 'rebirth', 'soulbind'], ai: 'boss',
    gold: 500000, exp: 3000000,
    drops: [['seamring', 1.0]],
    blurb: "Not a fourteenth element. The gap a good ring keeps, so it still has room to turn.",
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

  f('ab1', 'abyss', [at('frostcolossus', 1, 0), at('abyssalmaw', 0, 2), at('abyssalmaw', 2, 2)]),
  f('ab2', 'abyss', [at('stormdjinn', 1, 2), at('frostcolossus', 0, 0), at('frostcolossus', 2, 0)]),
  f('ab3', 'abyss', [at('bonedragon', 1, 1), at('abyssalmaw', 0, 0), at('abyssalmaw', 2, 0)]),
  f('ab4', 'abyss', [at('seraph', 1, 2), at('bonedragon', 1, 0), at('stormdjinn', 0, 1)]),
  f('ab5', 'abyss', [at('deepwarden', 1, 1), at('nullweaver', 0, 2), at('seraph', 2, 2)]),
  f('ab6', 'abyss', [at('ashtitan', 1, 0), at('nullweaver', 1, 2), at('bonedragon', 0, 1), at('bonedragon', 2, 1)]),
  f('ab7', 'abyss', [at('nullweaver', 1, 2), at('ashtitan', 0, 0), at('ashtitan', 2, 0), at('seraph', 1, 1)]),

  f('cd1', 'cinder', [at('cinderhound', 1, 0), at('cinderhound', 0, 0), at('ashwraith', 1, 2)]),
  f('cd2', 'cinder', [at('moltenguard', 1, 1), at('cinderhound', 0, 0)]),
  f('cd3', 'cinder', [at('sparkhawk', 0, 2), at('sparkhawk', 2, 2), at('ashwraith', 1, 0)]),
  f('cd4', 'cinder', [at('moltenguard', 1, 0), at('moltenguard', 0, 1), at('sparkhawk', 2, 2)]),

  f('dv1', 'drowned', [at('drownedknight', 1, 0), at('drownedknight', 0, 0), at('tidewraith', 1, 2)]),
  f('dv2', 'drowned', [at('krakenspawn', 1, 1), at('tidewraith', 0, 0)]),
  f('dv3', 'drowned', [at('stormsiren', 0, 2), at('stormsiren', 2, 2), at('drownedknight', 1, 0)]),
  f('dv4', 'drowned', [at('krakenspawn', 1, 0), at('krakenspawn', 0, 1), at('stormsiren', 2, 2)]),

  f('gl1', 'glass', [at('radiantguard', 1, 0), at('radiantguard', 0, 0), at('glasswraith', 1, 2)]),
  f('gl2', 'glass', [at('duskstalker', 1, 1), at('glasswraith', 0, 0)]),
  f('gl3', 'glass', [at('starweaver', 0, 2), at('starweaver', 2, 2), at('duskstalker', 1, 0)]),
  f('gl4', 'glass', [at('radiantguard', 1, 0), at('duskstalker', 0, 1), at('starweaver', 2, 2)]),

  f('boss_volk', 'boss', [at('boss_brigand', 1, 0), at('bandit', 0, 0), at('bandit', 2, 0)], { boss: true }),
  f('boss_anvil', 'boss', [at('boss_golemking', 1, 0), at('golemshard', 0, 1), at('golemshard', 2, 1)], { boss: true }),
  f('boss_choir', 'boss', [at('boss_shadow', 1, 1), at('wraith', 0, 0), at('wraith', 2, 0)], { boss: true }),
  f('boss_aurelith', 'boss', [at('boss_wyrm', 1, 1)], { boss: true }),
  f('boss_kharos', 'boss', [at('boss_kharos', 1, 1), at('cinderhound', 0, 0), at('cinderhound', 2, 0)], { boss: true }),
  f('boss_gate', 'boss', [at('boss_gate', 1, 1)], { boss: true }),
  f('boss_nerith', 'boss', [at('boss_nerith', 1, 1), at('drownedknight', 0, 0), at('drownedknight', 2, 0)], { boss: true }),
  f('boss_worldheart', 'boss', [at('boss_worldheart', 1, 1), at('seraph', 0, 2), at('seraph', 2, 2)], { boss: true }),
  f('boss_vessia', 'boss', [at('boss_vessia', 1, 1), at('radiantguard', 0, 0), at('radiantguard', 2, 0)], { boss: true }),
  f('boss_thirteenth', 'boss', [at('boss_thirteenth', 1, 1), at('nullweaver', 0, 0), at('nullweaver', 2, 0)], { boss: true }),
  f('boss_seam', 'boss', [at('boss_seam', 1, 1), at('starweaver', 0, 0), at('starweaver', 2, 0)], { boss: true }),
  f('boss_arenachampion', 'boss', [at('boss_arenachampion', 1, 1)], { boss: true }),
];

export const FORMATION_BY_ID = Object.fromEntries(FORMATIONS.map((x) => [x.id, x]));

export function formationsForRegion(region) {
  return FORMATIONS.filter((x) => x.region === region && !x.boss && !x.rare);
}
