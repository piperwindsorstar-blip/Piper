// ============================================================================
//  ITEMS — weapons, armour, accessories, consumables, materials.
//
//  Weapons carry a `reach`, which is what makes the 3x3 grid matter:
//    reach 2  daggers, fists, swords, maces  — front-to-front only
//    reach 3  spears, whips                  — reaches one column deeper
//    reach 9  bows, staves (as casting foci) — anywhere on the grid
// ============================================================================

export const SLOTS = ['weapon', 'offhand', 'body', 'head', 'accessory'];

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
  W('woodshield', 'Wooden Shield', 'shield', 0, 120, { slot: 'offhand', def: 6 }),
  W('ironshield', 'Iron Shield', 'shield', 0, 520, { slot: 'offhand', def: 14 }),
  W('aegisshield', 'Aegis', 'shield', 0, 3800, { slot: 'offhand', def: 30, bonus: { spr: 6, vit: 4 } }),

  // --- armour --------------------------------------------------------------
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

  // --- accessories ---------------------------------------------------------
  ACC('powerband', 'Power Band', 700, { bonus: { str: 6 } }),
  ACC('swiftboots', 'Swift Boots', 700, { bonus: { agi: 7 } }),
  ACC('sagering', 'Sage Ring', 900, { bonus: { int: 6, mp: 15 } }),
  ACC('wardamulet', 'Ward Amulet', 900, { bonus: { spr: 6 } }),
  ACC('luckycoin', 'Lucky Coin', 1100, { bonus: { lck: 10 } }),
  ACC('bloodpact', 'Blood Pact', 2400, { bonus: { str: 10, hp: -30 } }),
  ACC('elemcharm', 'Element Charm', 2600, { resist: 'attuned', resistAmount: 0.35 }),
  ACC('voidring', 'Void Ring', 5000, { nullify: true, bonus: { lck: 6 } }),
  ACC('phoenixdown', 'Phoenix Pendant', 6000, { autoRevive: true }),
  ACC('ipband', 'Resonance Band', 3200, { ipGain: 1.5 }),

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
  return item.kind === 'weapon' || item.kind === 'armor' || item.kind === 'accessory';
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
  return true;
}
