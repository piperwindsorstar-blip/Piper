// ============================================================================
//  ITEMS — weapons, armour, accessories, consumables, materials.
//
//  Weapons carry a `reach`, which is what makes the 3x3 grid matter:
//    reach 2  daggers, fists, swords, maces  — front-to-front only
//    reach 3  spears, whips                  — reaches one column deeper
//    reach 9  bows, staves (as casting foci) — anywhere on the grid
// ============================================================================

export const SLOTS = ['weapon', 'offhand', 'body', 'head', 'accessory', 'rune'];

export const WEAPON_TYPES = {
  sword:  { name: 'Sword',  reach: 2, stat: 'str' },
  axe:    { name: 'Axe',    reach: 2, stat: 'str' },
  mace:   { name: 'Mace',   reach: 2, stat: 'str' },
  dagger: { name: 'Dagger', reach: 2, stat: 'str' },
  fist:   { name: 'Fist',   reach: 2, stat: 'str' },
  spear:  { name: 'Spear',  reach: 3, stat: 'str' },
  whip:   { name: 'Whip',   reach: 3, stat: 'str' },
  bow:    { name: 'Bow',    reach: 9, stat: 'str' },
  staff:  { name: 'Staff',  reach: 9, stat: 'int' },
  shield: { name: 'Shield', reach: 0, stat: 'vit' },
};

export const ARMOR_CLASSES = {
  heavy:  { name: 'Heavy',  weight: 3 },
  medium: { name: 'Medium', weight: 2 },
  light:  { name: 'Light',  weight: 1 },
  cloth:  { name: 'Cloth',  weight: 0 },
};

const W = (id, name, wtype, atk, price, extra = {}) => ({
  id, name, kind: 'weapon', wtype, reach: WEAPON_TYPES[wtype].reach,
  atk, price, element: 'none', ...extra,
});
const A = (id, name, slot, aclass, def, price, extra = {}) => ({
  id, name, kind: 'armor', slot, aclass, def, price, ...extra,
});
const ACC = (id, name, price, extra = {}) => ({ id, name, kind: 'accessory', slot: 'accessory', price, ...extra });
// A Rune grants its wearer one specific skill for as long as it's socketed —
// borrowed access to another school's tool, not tied to class or level (the
// item itself is the gate). See character.js's knownSkills for where the
// grant actually gets folded into a character's skill list.
const RUNE = (id, name, price, grantSkill, extra = {}) =>
  ({ id, name, kind: 'rune', slot: 'rune', price, grantSkill, ...extra });

// A rune bonds to whoever wears it and sharpens with use — see
// character.js's runeLevel/awardRuneExp, which track this per character per
// rune id, and battle.js's useSkill, which pays out the exp and applies the
// multiplier below whenever a rune's own granted Art is actually cast. The
// curve and shape deliberately mirror jobs.js's JOB_RANK_EXP/jobBonus: this
// game already has one "grows with use, not level" pattern, so runes reuse
// it instead of inventing a second one.
export const RUNE_LEVEL_EXP = [0, 40, 120, 280, 600];
export const MAX_RUNE_LEVEL = 5;

export function runeLevelFromExp(exp) {
  let lv = 1;
  for (let i = 0; i < RUNE_LEVEL_EXP.length; i++) if (exp >= RUNE_LEVEL_EXP[i]) lv = i + 1;
  return Math.min(lv, MAX_RUNE_LEVEL);
}

/** +15% per level past the first, capped at level 5 (+60%) — applied to the
 *  granted skill's own `power` only, the same shape as jobBonus's rank curve. */
export function runePowerMult(level) {
  return 1 + 0.15 * (Math.max(1, level) - 1);
}
const U = (id, name, price, extra = {}) => ({ id, name, kind: 'consumable', price, ...extra });
const M = (id, name, price, extra = {}) => ({ id, name, kind: 'material', price, ...extra });

export const ITEMS = [
  // --- weapons -------------------------------------------------------------
  W('bronzesword', 'Bronze Sword', 'sword', 12, 180),
  W('ironsword', 'Iron Sword', 'sword', 26, 620),
  W('knightblade', 'Knight Blade', 'sword', 44, 1900, { bonus: { vit: 3 } }),
  W('flametongue', 'Flametongue', 'sword', 58, 4200, { element: 'fire' }),
  W('frostbrand', 'Frostbrand', 'sword', 58, 4200, { element: 'ice' }),
  W('sunblade', 'Sunblade', 'sword', 82, 11000, { element: 'light', bonus: { spr: 6 } }),
  W('handaxe', 'Hand Axe', 'axe', 16, 240),
  W('battleaxe', 'Battleaxe', 'axe', 34, 900, { bonus: { str: 3, agi: -2 } }),
  W('ruinaxe', 'Ruin Axe', 'axe', 62, 4800, { bonus: { str: 8, vit: -3 } }),
  W('club', 'Oak Club', 'mace', 10, 120),
  W('warhammer', 'Warhammer', 'mace', 32, 850),
  W('holymace', 'Consecrated Mace', 'mace', 50, 2600, { element: 'light', bonus: { spr: 4 } }),
  W('bronzedagger', 'Bronze Dagger', 'dagger', 8, 90),
  W('mainGauche', 'Main-Gauche', 'dagger', 20, 480, { bonus: { agi: 3 } }),
  W('venomfang', 'Venomfang', 'dagger', 36, 1700, { element: 'poison' }),
  W('shadowedge', 'Shadow Edge', 'dagger', 54, 5200, { element: 'dark', bonus: { agi: 6, lck: 4 } }),
  W('wraps', 'Leather Wraps', 'fist', 9, 100),
  W('ironclaws', 'Iron Claws', 'fist', 24, 560),
  W('kaiserknuckle', 'Kaiser Knuckle', 'fist', 46, 2400, { bonus: { str: 5 } }),
  W('dragonfists', 'Dragon Fists', 'fist', 70, 7800, { bonus: { str: 8, agi: 5 } }),
  W('shortspear', 'Short Spear', 'spear', 14, 220),
  W('halberd', 'Halberd', 'spear', 30, 780),
  W('wyvernlance', 'Wyvern Lance', 'spear', 52, 3100, { element: 'wind' }),
  W('gungnir', 'Skypiercer', 'spear', 76, 9500, { element: 'lightning', bonus: { agi: 5 } }),
  W('leatherwhip', 'Leather Whip', 'whip', 11, 160),
  W('chainwhip', 'Chain Whip', 'whip', 27, 700, { bonus: { agi: 2 } }),
  W('serpentlash', 'Serpent Lash', 'whip', 48, 2900, { element: 'poison', bonus: { agi: 4 } }),
  W('shortbow', 'Short Bow', 'bow', 13, 200),
  W('longbow', 'Longbow', 'bow', 28, 720),
  W('windbow', 'Windsong Bow', 'bow', 47, 2700, { element: 'wind', bonus: { agi: 4 } }),
  W('artemisbow', 'Star Bow', 'bow', 68, 8600, { bonus: { lck: 8, agi: 4 } }),
  W('oakstaff', 'Oak Staff', 'staff', 10, 150, { bonus: { int: 3 } }),
  W('runestaff', 'Rune Staff', 'staff', 22, 640, { bonus: { int: 8, mp: 12 } }),
  W('stormrod', 'Storm Rod', 'staff', 38, 2300, { element: 'lightning', bonus: { int: 14 } }),
  W('worldstaff', 'Worldroot Staff', 'staff', 55, 9000, { bonus: { int: 22, spr: 12, mp: 40 } }),
  // --- Cinderreach / Drowned Vale / Glassfields — dropped, not sold --------
  W('emberrod', 'Emberreach Rod', 'staff', 46, 4800, { element: 'fire', bonus: { int: 16 } }),
  W('drownedcrozier', "The Drowned Crozier", 'mace', 68, 15000, { element: 'water', bonus: { spr: 10, mp: 20 } }),
  W('glasslance', 'Reliquary Spear', 'spear', 136, 42000, { element: 'light', bonus: { spr: 14, int: 10 } }),
  // --- endgame arms, dropped in the Hollow Between rather than sold ---------
  W('ruinblade', 'Ruinblade', 'sword', 124, 34000, { element: 'dark', bonus: { str: 14 } }),
  W('worldedge', 'Worldedge', 'sword', 168, 90000, { bonus: { str: 22, agi: 10 } }),
  W('titanmaul', 'Titan Maul', 'mace', 152, 62000, { bonus: { str: 26, agi: -6 } }),
  W('voidfang', 'Voidfang', 'dagger', 108, 48000, { element: 'void', bonus: { agi: 18, lck: 12 } }),
  W('godsfist', "God's Fist", 'fist', 138, 56000, { bonus: { str: 18, agi: 12 } }),
  W('aeonlance', 'Aeon Lance', 'spear', 146, 68000, { element: 'spirit', bonus: { agi: 12, int: 10 } }),
  W('starbow', 'Starfall Bow', 'bow', 132, 64000, { element: 'light', bonus: { lck: 20, agi: 12 } }),
  W('nullstaff', 'Null Staff', 'staff', 96, 88000, { element: 'void', bonus: { int: 40, spr: 22, mp: 90 } }),
  W('bulwarkshield', 'Bulwark of Ages', 'shield', 0, 52000, { slot: 'offhand', def: 62, bonus: { vit: 14, spr: 12 } }),
  // --- labyrinth-boss legendaries — a rare drop, not sold; each carries a
  // real passive rather than just a bigger stat block. See battle.js's
  // computeDamage/dealDamage/applyTo for where each of these is actually
  // read (by item id, the same way voidring/phoenixdown/ipband already are).
  W('cinderfang', 'Cinderfang', 'sword', 110, 46000,
    { element: 'fire', bonus: { str: 10 }, critBurns: true }),
  W('gravebinder', 'Gravebinder', 'mace', 116, 50000,
    { element: 'dark', bonus: { str: 8, vit: 6 }, killHealsRow: 0.12 }),
  W('sunderingfang', 'Sundering Fang', 'axe', 122, 54000,
    { bonus: { str: 12, agi: -4 }, executeBonus: 1.5 }),
  ACC('widowslattice', "Widow's Lattice", 48000, { bonus: { agi: 6, spr: 6 }, reflect: 0.22 }),
  // --- the Shifting Depths' own capstone (floor 50) — its one guaranteed
  // drop, a step above the labyrinth legendaries above it. --------------------
  ACC('endlesscrown', 'The Endless Crown', 260000,
    { bonus: { str: 10, vit: 10, int: 10, spr: 10, lck: 10 }, statusShield: true }),
  W('woodshield', 'Wooden Shield', 'shield', 0, 120, { slot: 'offhand', def: 6 }),
  W('ironshield', 'Iron Shield', 'shield', 0, 520, { slot: 'offhand', def: 14 }),
  W('aegisshield', 'Aegis', 'shield', 0, 3800, { slot: 'offhand', def: 30, bonus: { spr: 6, vit: 4 } }),

  // --- armour --------------------------------------------------------------
  A('voidweave', 'Voidweave Robe', 'body', 'cloth', 62, 58000, { bonus: { int: 26, spr: 20, mp: 70 } }),
  A('dragonmail', 'Dragonscale Mail', 'body', 'medium', 86, 66000, { bonus: { vit: 18, spr: 14 } }),
  A('titanplate', 'Titanplate', 'body', 'heavy', 124, 82000, { bonus: { vit: 30, agi: -4 } }),
  A('crownvoid', 'Circlet of the Hollow', 'head', 'cloth', 34, 54000, { bonus: { int: 22, spr: 22, mp: 40 } }),
  A('titanhelm', 'Titan Helm', 'head', 'heavy', 48, 46000, { bonus: { vit: 16, str: 8 } }),
  A('clothrobe', 'Traveller\'s Robe', 'body', 'cloth', 5, 90),
  A('silkrobe', 'Silk Robe', 'body', 'cloth', 14, 480, { bonus: { int: 4, mp: 10 } }),
  A('magerobe', 'Archmage Robe', 'body', 'cloth', 28, 3200, { bonus: { int: 12, spr: 8, mp: 30 } }),
  A('leatherarmor', 'Leather Armour', 'body', 'light', 10, 200),
  A('studded', 'Studded Vest', 'body', 'light', 20, 620, { bonus: { agi: 2 } }),
  A('shadowgarb', 'Shadow Garb', 'body', 'light', 36, 3400, { bonus: { agi: 8, lck: 4 } }),
  A('chainmail', 'Chain Mail', 'body', 'medium', 18, 540),
  A('scalemail', 'Scale Mail', 'body', 'medium', 30, 1500),
  A('bishopvest', 'Bishop\'s Vestment', 'body', 'medium', 42, 4000, { bonus: { spr: 12 } }),
  A('ironplate', 'Iron Plate', 'body', 'heavy', 26, 900, { bonus: { agi: -2 } }),
  A('knightplate', 'Knight Plate', 'body', 'heavy', 42, 2600, { bonus: { vit: 5, agi: -3 } }),
  A('adamantplate', 'Adamant Plate', 'body', 'heavy', 64, 9800, { bonus: { vit: 12, agi: -3 } }),
  A('leathercap', 'Leather Cap', 'head', 'light', 4, 70),
  A('ironhelm', 'Iron Helm', 'head', 'heavy', 12, 380),
  A('circlet', 'Silver Circlet', 'head', 'cloth', 8, 460, { bonus: { int: 5, mp: 8 } }),
  A('greathelm', 'Great Helm', 'head', 'heavy', 22, 1800, { bonus: { vit: 4 } }),
  A('crownofstars', 'Crown of Stars', 'head', 'cloth', 16, 6400, { bonus: { int: 10, spr: 10 } }),

  // --- forged — crafted only, at the Forge (menu's Craft page); never sold
  // or dropped, so ore/leather/petal drops that quests don't already want
  // have somewhere to go. Priced above the shop weapon of the same tier
  // they're clearly stronger than, since gold alone can't buy them. -------
  W('ridgeforgesword', 'Ridgeforge Sword', 'sword', 36, 1400, { bonus: { str: 4 } }),
  W('quarrycleaver', 'Quarry Cleaver', 'axe', 40, 1500, { bonus: { str: 5, vit: 2 } }),
  W('sunfiremace', 'Sunfire Mace', 'mace', 34, 1500, { element: 'fire', bonus: { int: 4 } }),
  W('silentfang', 'Silent Fang', 'dagger', 30, 1300, { element: 'poison', bonus: { agi: 5 } }),
  W('thornweavewraps', 'Thornweave Wraps', 'fist', 32, 1300, { bonus: { str: 3, agi: 3 } }),
  W('ridgebacklance', 'Ridgeback Lance', 'spear', 42, 3800, { bonus: { str: 6, vit: 3 } }),
  W('whisperingcord', 'Whispering Cord', 'whip', 34, 3400, { bonus: { agi: 6, lck: 3 } }),
  W('riverglassbow', 'Riverglass Bow', 'bow', 36, 3200, { element: 'water', bonus: { agi: 5 } }),
  W('emberweaverod', 'Emberweave Rod', 'staff', 26, 1900, { element: 'fire', bonus: { int: 8 } }),
  A('alloyweavevest', 'Alloyweave Vest', 'body', 'light', 24, 1300, { bonus: { agi: 2, vit: 2 } }),
  A('mythrilcirclet', 'Mythril Circlet', 'head', 'cloth', 20, 2600, { bonus: { int: 6, spr: 6 } }),
  // --- forged, tier two — rarer materials, one recipe per weapon type the
  // first wave didn't cover plus the Forge's first shield, armour and
  // accessory, so a well-farmed party has somewhere to keep spending drops
  // instead of outgrowing the Craft page right after unlocking it. --------
  W('stormcleaver', 'Stormcleaver', 'axe', 58, 4200, { element: 'lightning', bonus: { str: 6 } }),
  W('moonlitblade', 'Moonlit Blade', 'sword', 56, 4000, { element: 'ice', bonus: { agi: 4 } }),
  W('frostmace', 'Frost Mace', 'mace', 54, 3900, { element: 'ice', bonus: { int: 5 } }),
  W('nightfang', 'Nightfang', 'dagger', 52, 4100, { element: 'dark', bonus: { agi: 6, lck: 2 } }),
  W('stonefistguard', 'Stonefist Guard', 'fist', 60, 4300, { bonus: { str: 6, vit: 4 } }),
  W('stormlance', 'Stormlance', 'spear', 62, 5200, { element: 'lightning', bonus: { agi: 5 } }),
  W('thornlash', 'Thornlash', 'whip', 50, 4600, { element: 'nature', bonus: { agi: 4, spr: 3 } }),
  W('stormfletcher', 'Stormfletcher Bow', 'bow', 58, 4700, { element: 'wind', bonus: { agi: 6 } }),
  W('tidalstaff', 'Tidal Staff', 'staff', 44, 4400, { element: 'water', bonus: { int: 12, mp: 15 } }),
  W('wardenshield', "Warden's Shield", 'shield', 0, 4800, { slot: 'offhand', def: 40, bonus: { vit: 6 } }),
  A('duskweavevest', 'Duskweave Vest', 'body', 'medium', 46, 4500, { bonus: { vit: 6, spr: 4 } }),
  ACC('smithssignet', "Smith's Signet", 3800, { bonus: { str: 4, vit: 4, agi: 4 } }),

  // --- accessories ---------------------------------------------------------
  ACC('powerband', 'Power Band', 700, { bonus: { str: 6 } }),
  ACC('swiftboots', 'Swift Boots', 700, { bonus: { agi: 7 } }),
  ACC('sagering', 'Sage Ring', 900, { bonus: { int: 6, mp: 15 } }),
  ACC('wardamulet', 'Ward Amulet', 900, { bonus: { spr: 6 } }),
  ACC('luckycoin', 'Lucky Coin', 1100, { bonus: { lck: 10 } }),
  ACC('bloodpact', 'Blood Pact', 2400, { bonus: { str: 10, hp: -30 } }),
  ACC('elemcharm', 'Element Charm', 2600, { resist: 'attuned', resistAmount: 0.35 }),
  ACC('voidring', 'Void Ring', 5000, { nullify: true, bonus: { lck: 6 } }),
  ACC('phoenixdown', 'Phoenix Pendant', 24000, { autoRevive: true }),
  ACC('titanring', 'Titan Ring', 40000, { bonus: { str: 28, vit: 20 } }),
  ACC('aeonpendant', 'Aeon Pendant', 44000, { bonus: { int: 24, spr: 24, mp: 60 } }),
  ACC('quicksilver', 'Quicksilver Band', 38000, { bonus: { agi: 30, lck: 14 } }),
  ACC('ipband', 'Resonance Band', 3200, { ipGain: 1.5 }),
  // --- Cinderreach / Drowned Vale / Glassfields — dropped, not sold --------
  ACC('cindercrown', 'Cinder Crown', 8500, { bonus: { int: 10, spr: 8 } }),
  ACC('vicarlocket', "The Vicar's Locket", 19000, { bonus: { spr: 14, mp: 30 } }),
  ACC('glasshalo', 'Glass Halo', 54000, { bonus: { int: 16, spr: 16, lck: 8 } }),
  // --- postgame — the Seam's own drop, a step above everything else here ---
  ACC('seamring', 'The Missing Seam', 400000,
    { bonus: { str: 20, vit: 20, agi: 20, int: 20, spr: 20, lck: 20 } }),
  // --- New Game+ only: the Seam's second drop once the wheel has actually
  // turned at least once — see battle.js's spoils() for the ngPlus gate.
  // A smaller stat spread than seamring itself (it's a bonus on top of
  // that, not a replacement) plus a faster-learning edge for a character
  // who's genuinely been through this more than once.
  ACC('wheelturnercoin', "The Wheel-Turner's Coin", 450000,
    { bonus: { str: 8, vit: 8, agi: 8, int: 8, spr: 8, lck: 8 }, ipGain: 1.3 }),
  // --- the Colosseum's own gauntlet rewards — never sold or dropped in the
  // wild, only granted for clearing that tier (see data/arena.js) ----------
  ACC('brawlersband', "Brawler's Band", 750, { bonus: { str: 5, agi: 3 } }),
  ACC('gladiatorsigil', 'Gladiator Sigil', 2800, { bonus: { str: 8, vit: 5 } }),
  ACC('vanguardcrest', 'Vanguard Crest', 9500, { bonus: { str: 14, vit: 10, agi: 4 } }),
  ACC('championscrown', "Champion's Crown", 62000, { bonus: { str: 22, vit: 16, agi: 10, lck: 8 } }),

  // --- runes -----------------------------------------------------------------
  // One rune's worth of another school's toolkit, sold at the same four arms
  // shops that carry the gear power curve — see data/maps.js's SHOPS. Kept to
  // low-to-mid-tier skills on purpose: breadth of access is the reward here,
  // not a shortcut to a class's own late-game signature move.
  RUNE('sparkrune', 'Spark Rune', 480, 'spark'),
  RUNE('mercyrune', 'Mercy Rune', 620, 'heal'),
  RUNE('aegisrune', 'Aegis Rune', 1200, 'cover'),
  RUNE('emberrune', 'Ember Rune', 1900, 'primebolt'),
  RUNE('umbralrune', 'Umbral Rune', 3400, 'bonespear'),
  RUNE('solarrune', 'Solar Rune', 4600, 'judgement'),
  RUNE('chorusrune', 'Chorus Rune', 9000, 'healall'),
  RUNE('reliquaryrune', 'Reliquary Rune', 15000, 'revive'),
  // A second wave, reaching into every school the first eight never touched
  // — one cheap, early rune per school for breadth, and a pricier mid-tier
  // rune for eight of those schools for a real reason to trade back up.
  RUNE('crossrune', 'Cross Rune', 900, 'crossslash'),
  RUNE('furyrune', 'Fury Rune', 550, 'recklessblow'),
  RUNE('piercerune', 'Pierce Rune', 500, 'thrust'),
  RUNE('stonefistrune', 'Stonefist Rune', 600, 'jab'),
  RUNE('breathrune', 'Breath Rune', 550, 'breathe'),
  RUNE('shadowfangrune', 'Shadowfang Rune', 650, 'backstab'),
  RUNE('thiefrune', 'Thief Rune', 900, 'steal'),
  RUNE('huntersrune', "Hunter's Rune", 550, 'aimshot'),
  RUNE('snarerune', 'Snare Rune', 500, 'trapset'),
  RUNE('quickrune', 'Quickstep Rune', 1400, 'stepdance'),
  RUNE('marchrune', 'March Rune', 1400, 'marchsong'),
  RUNE('gamblersrune', "Gambler's Rune", 700, 'coinflip'),
  RUNE('mistrune', 'Mist Rune', 600, 'blindmist'),
  RUNE('wisprune', 'Wisp Rune', 1600, 'lesser'),
  RUNE('houndrune', 'Hound Rune', 550, 'houndcall'),
  RUNE('jinxrune', 'Jinx Rune', 500, 'jinx'),
  RUNE('linkrune', 'Link Rune', 900, 'spiritlink'),
  RUNE('parryrune', 'Parry Rune', 4200, 'riposte'),
  RUNE('crimsonrune', 'Crimson Rune', 5200, 'bloodrush'),
  RUNE('skewerrune', 'Skewer Rune', 4600, 'impale'),
  RUNE('galerune', 'Gale Rune', 5400, 'whirlkick'),
  RUNE('phantomrune', 'Phantom Rune', 3200, 'vanish'),
  RUNE('brigandrune', 'Brigand Rune', 2200, 'mug'),
  RUNE('stormshotrune', 'Stormshot Rune', 4800, 'volley'),
  RUNE('echorune', 'Echo Rune', 5600, 'mirrordance'),

  // --- ultra runes -----------------------------------------------------------
  // Never sold — each is the guaranteed drop from exactly one labyrinth's
  // floor-5 boss (see maps.js's labyrinth1..6) and nowhere else. Unlike a
  // regular rune, an ultra rune also carries a stat bonus far past anything
  // sold at that point in the game, on top of the one-of-a-kind art it grants.
  RUNE('bramblecrown', 'Bramblecrown Rune', 20000, 'thornbindrequiem', { bonus: { str: 8, vit: 8, mag: 8 } }),
  RUNE('coilcrown', 'Coilcrown Rune', 45000, 'coilofruin', { bonus: { str: 14, vit: 12, mag: 14 } }),
  RUNE('cindercrownrune', 'Cindercrown Rune', 95000, 'cinderspiralnova', { bonus: { str: 20, vit: 18, mag: 20 } }),
  RUNE('vaultcrown', 'Vaultcrown Rune', 160000, 'stormvaultjudgment', { bonus: { str: 28, vit: 24, mag: 28 } }),
  RUNE('tidecrown', 'Tidecrown Rune', 260000, 'tideworndeluge', { bonus: { str: 36, vit: 30, mag: 36 } }),
  RUNE('lastcoilcrown', 'Last Coil Rune', 400000, 'thelastcoil', { bonus: { str: 46, vit: 38, mag: 46, lck: 10 } }),

  // --- consumables ---------------------------------------------------------
  U('potion', 'Potion', 30, { heal: 80, target: 'ally' }),
  U('hipotion', 'Hi-Potion', 150, { heal: 320, target: 'ally' }),
  U('xpotion', 'X-Potion', 600, { heal: 1200, target: 'ally' }),
  U('ether', 'Ether', 200, { healMp: 60, target: 'ally' }),
  U('elixir', 'Elixir', 1500, { heal: 9999, healMp: 999, target: 'ally' }),
  U('antidote', 'Antidote', 20, { cures: ['poison'], target: 'ally' }),
  U('eyedrops', 'Eye Drops', 20, { cures: ['blind'], target: 'ally' }),
  U('echoherb', 'Echo Herb', 30, { cures: ['silence'], target: 'ally' }),
  U('goldneedle', 'Gold Needle', 90, { cures: ['stone', 'paralyze'], target: 'ally' }),
  U('holywater', 'Holy Water', 120, { cures: ['curse', 'doom'], target: 'ally' }),
  U('revivalleaf', 'Revival Leaf', 400, { revives: true, heal: 200, target: 'ally' }),
  U('firebomb', 'Fire Flask', 120, { damage: 200, element: 'fire', target: 'row' }),
  U('frostbomb', 'Frost Flask', 120, { damage: 200, element: 'ice', target: 'row' }),
  U('boltbomb', 'Bolt Flask', 120, { damage: 200, element: 'lightning', target: 'row' }),
  U('smokebomb', 'Smoke Bomb', 80, { escape: true, target: 'allies' }),
  U('tent', 'Tent', 250, { camp: true, target: 'allies' }),
  U('wingfeather', 'Wing Feather', 100, { warpTown: true }),

  // --- materials -----------------------------------------------------------
  M('copperore', 'Copper Ore', 25),
  M('ironore', 'Iron Ore', 60),
  M('mythril', 'Mythril Ore', 400),
  M('adamantite', 'Adamantite', 1200),
  M('leather', 'Cured Leather', 40),
  M('silkthread', 'Silk Thread', 70),
  M('healherb', 'Heal Herb', 15),
  M('manaflower', 'Mana Flower', 45),
  M('venomcap', 'Venom Cap', 55),
  M('sunpetal', 'Sun Petal', 220),
  M('riverpearl', 'River Pearl', 180),
  M('beastfang', 'Beast Fang', 90),
  M('dragonscale', 'Dragon Scale', 900),
  M('spiritglass', 'Spirit Glass', 650),
];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const ITEM_IDS = ITEMS.map((i) => i.id);

export function getItem(id) {
  const i = ITEM_BY_ID[id];
  if (!i) throw new Error(`unknown item: ${id}`);
  return i;
}

export function itemSlot(item) {
  if (item.slot) return item.slot;
  if (item.kind === 'weapon') return 'weapon';
  return null;
}

export function isEquippable(item) {
  return item.kind === 'weapon' || item.kind === 'armor' || item.kind === 'accessory' || item.kind === 'rune';
}

/** Can `cls` (a class node) equip `item`? */
export function canEquip(cls, item) {
  if (item.kind === 'weapon') {
    if (item.wtype === 'shield') return cls.weapons.includes('shield') || cls.armor.includes('heavy');
    return cls.weapons.includes(item.wtype);
  }
  if (item.kind === 'armor') {
    const order = ['cloth', 'light', 'medium', 'heavy'];
    const best = Math.max(...cls.armor.map((a) => order.indexOf(a)));
    return order.indexOf(item.aclass) <= best;
  }
  return true; // accessories and runes: always equippable by any class
}

// ---------------------------------------------------------------------------
//  FORGE / REFIT — the Blacksmith and Armorer field abilities, worked at the
//  'anvil' tile every smithy already has sitting in its floor (see
//  data/maps.js's LEGEND and field.js's openForge). Each entry names the
//  next item one step up the same weapon type or armour class, its ore
//  (and, for armour, leather) cost, and the resulting item's `tier` — the
//  Blacksmith/Armorer's own rank must meet or beat `tier`, which is what
//  "+1 tier per upgrade, up to rank" actually gates: a rank-1 smith can
//  still make the first upgrade on anything, but needs rank 2 to push an
//  already-upgraded piece a second step.
// ---------------------------------------------------------------------------
export const WEAPON_UPGRADE = {
  bronzesword: { to: 'ironsword', ore: 3, tier: 1 },
  ironsword: { to: 'knightblade', ore: 6, tier: 2 },
  handaxe: { to: 'battleaxe', ore: 3, tier: 1 },
  battleaxe: { to: 'ruinaxe', ore: 6, tier: 2 },
  club: { to: 'warhammer', ore: 3, tier: 1 },
  bronzedagger: { to: 'mainGauche', ore: 3, tier: 1 },
  mainGauche: { to: 'shadowedge', ore: 6, tier: 2 },
  wraps: { to: 'ironclaws', ore: 3, tier: 1 },
  ironclaws: { to: 'kaiserknuckle', ore: 6, tier: 2 },
  kaiserknuckle: { to: 'dragonfists', ore: 9, tier: 3 },
  shortspear: { to: 'halberd', ore: 3, tier: 1 },
  halberd: { to: 'wyvernlance', ore: 6, tier: 2 },
  leatherwhip: { to: 'chainwhip', ore: 3, tier: 1 },
  chainwhip: { to: 'serpentlash', ore: 6, tier: 2 },
  shortbow: { to: 'longbow', ore: 3, tier: 1 },
  longbow: { to: 'windbow', ore: 6, tier: 2 },
  windbow: { to: 'artemisbow', ore: 9, tier: 3 },
  oakstaff: { to: 'runestaff', ore: 3, tier: 1 },
  runestaff: { to: 'stormrod', ore: 6, tier: 2 },
  woodshield: { to: 'ironshield', ore: 3, tier: 1 },
  ironshield: { to: 'aegisshield', ore: 6, tier: 2 },
};

export const ARMOR_UPGRADE = {
  clothrobe: { to: 'silkrobe', ore: 2, leather: 1, tier: 1 },
  silkrobe: { to: 'magerobe', ore: 4, leather: 2, tier: 2 },
  leatherarmor: { to: 'studded', ore: 2, leather: 2, tier: 1 },
  studded: { to: 'shadowgarb', ore: 4, leather: 3, tier: 2 },
  chainmail: { to: 'scalemail', ore: 3, leather: 2, tier: 1 },
  scalemail: { to: 'bishopvest', ore: 5, leather: 3, tier: 2 },
  ironplate: { to: 'knightplate', ore: 4, leather: 2, tier: 1 },
  knightplate: { to: 'adamantplate', ore: 7, leather: 3, tier: 2 },
  circlet: { to: 'crownofstars', ore: 3, leather: 1, tier: 1 },
};

/** The next step for `itemId`, or null if it has none — weapons and armour
 *  share one lookup since Forge and Refit each only ever query their own
 *  half (weapon slots vs. body/head/offhand), never both. */
export function forgeUpgrade(itemId) {
  return WEAPON_UPGRADE[itemId] ?? ARMOR_UPGRADE[itemId] ?? null;
}
