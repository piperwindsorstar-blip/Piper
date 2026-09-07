// ============================================================================
//  FILTERS — the compositor the sprites actually run on.
//
//  A character is three stamps, not a unique painting:
//
//    race filter   one wash + rim per race. Anatomy (ears, muzzle, horns)
//                  still comes from data/races.js `look`. The filter is the
//                  colour grade that makes an elf read as an elf even when
//                  the armour is a warrior's plate.
//    armour filter one silhouette per root class: plate / mail / leather /
//                  robe / vestments / gi / silk. Cape and helm live here.
//    weapon filter one shape per root class (or the item in the hand).
//
//  12 races × 12 classes stay cheap because nobody authors the product.
// ============================================================================

export const FILTER_VER = 2;

export const RACE_FILTER = {
  human:     { wash: '#e8b890', alpha: 0.00, rim: '#fff1c8', scale: 1.00 },
  elf:       { wash: '#8fbf8a', alpha: 0.16, rim: '#d8f4c8', scale: 1.00 },
  dwarf:     { wash: '#c47a38', alpha: 0.18, rim: '#f0c080', scale: 0.90 },
  fairy:     { wash: '#e8a0d8', alpha: 0.22, rim: '#ffe8ff', scale: 0.78, glow: '#f4b8e8' },
  saurian:   { wash: '#5a9a58', alpha: 0.24, rim: '#b8e070', scale: 1.04 },
  lupine:    { wash: '#b88858', alpha: 0.18, rim: '#f0d0a0', scale: 1.02 },
  ogrekin:   { wash: '#8a5a38', alpha: 0.20, rim: '#d8a070', scale: 1.16 },
  gnome:     { wash: '#d8b050', alpha: 0.16, rim: '#ffe8a0', scale: 0.84 },
  merfolk:   { wash: '#4a9aaa', alpha: 0.22, rim: '#a8f0f0', scale: 1.00 },
  draconian: { wash: '#c06040', alpha: 0.20, rim: '#ffc080', scale: 1.08, glow: '#ff8a40' },
  automaton: { wash: '#8a9aa8', alpha: 0.28, rim: '#e8f0ff', scale: 1.00 },
  revenant:  { wash: '#6a6a88', alpha: 0.26, rim: '#c8c8f0', scale: 1.00, glow: '#8878c8' },
};

export const ARMOR_FILTER = {
  warrior:   { kind: 'plate',     cape: '#2a4784', helm: 'open',    metal: true,  cloth: '#a8342c', trim: '#e0bc58' },
  guardian:  { kind: 'plate',     cape: '#1e2e52', helm: 'open',    metal: true,  cloth: '#3358ab', trim: '#cdd6e8' },
  monk:      { kind: 'gi',        cape: null,      helm: 'none',    metal: false, cloth: '#dcac52', trim: '#a84c2a' },
  lancer:    { kind: 'mail',      cape: '#24503a', helm: 'none',    metal: true,  cloth: '#2f7352', trim: '#dcc464' },
  thief:     { kind: 'leather',   cape: null,      helm: 'hood',    metal: false, cloth: '#4a4280', trim: '#8f7ec8' },
  archer:    { kind: 'leather',   cape: null,      helm: 'hood',    metal: false, cloth: '#436c3c', trim: '#adc576' },
  dancer:    { kind: 'silk',      cape: '#a03870', helm: 'none',    metal: false, cloth: '#c44a8c', trim: '#f4cee6' },
  jester:    { kind: 'silk',      cape: '#6a2880', helm: 'none',    metal: false, cloth: '#8c3aa6', trim: '#f4d44c' },
  mage:      { kind: 'robe',      cape: '#3a2468', helm: 'point',   metal: false, cloth: '#3c3c94', trim: '#ccb464' },
  cleric:    { kind: 'vestments', cape: '#d8d2c6', helm: 'circlet', metal: false, cloth: '#e4e4ee', trim: '#cca442' },
  summoner:  { kind: 'robe',      cape: '#4a1e62', helm: 'point',   metal: false, cloth: '#6e3c94', trim: '#dcbcf4' },
  spiritist: { kind: 'robe',      cape: '#1a4844', helm: 'point',   metal: false, cloth: '#2c6e6e', trim: '#a4e4d4' },
};

export const WEAPON_FILTER = {
  warrior:   { type: 'sword',  category: 'blade',  reach: 2 },
  guardian:  { type: 'shield', category: 'blade',  reach: 2 },
  monk:      { type: 'fist',   category: 'fist',   reach: 0 },
  lancer:    { type: 'spear',  category: 'pole',   reach: 3 },
  thief:     { type: 'dagger', category: 'blade',  reach: 2 },
  archer:    { type: 'bow',    category: 'bow',    reach: 9 },
  dancer:    { type: 'dagger', category: 'blade',  reach: 2 },
  jester:    { type: 'dagger', category: 'blade',  reach: 2 },
  mage:      { type: 'staff',  category: 'staff',  reach: 9 },
  cleric:    { type: 'mace',   category: 'blunt',  reach: 2 },
  summoner:  { type: 'staff',  category: 'staff',  reach: 9 },
  spiritist: { type: 'staff',  category: 'staff',  reach: 9 },
};

export function getRaceFilter(raceId) {
  return RACE_FILTER[raceId] ?? RACE_FILTER.human;
}

export function getArmorFilter(root) {
  return ARMOR_FILTER[root] ?? ARMOR_FILTER.warrior;
}

export function getWeaponFilter(root) {
  return WEAPON_FILTER[root] ?? WEAPON_FILTER.warrior;
}

/**
 * One pass. Tints only the pixels already drawn (source-atop), so the
 * background plate and the outline stay clean. Optional glow is a second
 * lighter wash, still clipped to the figure.
 */
export function applyRaceFilter(ctx, w, h, raceId) {
  const f = getRaceFilter(raceId);
  if (f.alpha > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.wash;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (f.glow) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.14;
    const g = ctx.createRadialGradient(w / 2, h * 0.42, 2, w / 2, h * 0.45, w * 0.7);
    g.addColorStop(0, f.glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
