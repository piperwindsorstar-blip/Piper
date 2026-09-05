// ============================================================================
//  RECIPES — the Forge (menu's Craft page) turns monster-drop materials plus
//  gold into the "forged" items in items.js, which exist nowhere else (no
//  shop stocks them, no boss drops them). Gives materials quests don't
//  already want somewhere to go, and gives a well-farmed but under-geared
//  party an alternative to grinding for gold.
// ============================================================================

export const RECIPES = [
  { itemId: 'ridgeforgesword', gold: 500, materials: [{ id: 'ironore', count: 3 }, { id: 'leather', count: 2 }] },
  { itemId: 'quarrycleaver', gold: 600, materials: [{ id: 'ironore', count: 4 }, { id: 'beastfang', count: 2 }] },
  { itemId: 'sunfiremace', gold: 700, materials: [{ id: 'copperore', count: 3 }, { id: 'sunpetal', count: 2 }] },
  { itemId: 'silentfang', gold: 550, materials: [{ id: 'silkthread', count: 3 }, { id: 'venomcap', count: 2 }] },
  { itemId: 'thornweavewraps', gold: 500, materials: [{ id: 'leather', count: 3 }, { id: 'silkthread', count: 2 }] },
  { itemId: 'ridgebacklance', gold: 1800, materials: [{ id: 'ironore', count: 3 }, { id: 'dragonscale', count: 1 }] },
  { itemId: 'whisperingcord', gold: 1600, materials: [{ id: 'silkthread', count: 4 }, { id: 'spiritglass', count: 1 }] },
  { itemId: 'riverglassbow', gold: 1500, materials: [{ id: 'riverpearl', count: 2 }, { id: 'spiritglass', count: 1 }] },
  { itemId: 'emberweaverod', gold: 900, materials: [{ id: 'manaflower', count: 3 }, { id: 'sunpetal', count: 2 }] },
  { itemId: 'alloyweavevest', gold: 600, materials: [{ id: 'copperore', count: 3 }, { id: 'leather', count: 3 }] },
  { itemId: 'mythrilcirclet', gold: 1200, materials: [{ id: 'mythril', count: 2 }, { id: 'silkthread', count: 2 }] },
];

export function canCraft(g, recipe) {
  return g.gold >= recipe.gold && recipe.materials.every((m) => g.countItem(m.id) >= m.count);
}

/** Mutates state only — spends gold and materials, grants the item. Callers
 *  show their own confirmation around this. */
export function craft(g, recipe) {
  g.spend(recipe.gold);
  for (const m of recipe.materials) g.removeItem(m.id, m.count);
  g.addItem(recipe.itemId);
}
