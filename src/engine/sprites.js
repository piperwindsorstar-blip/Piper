// ============================================================================
//  SPRITES — the art system's public surface.
//
//  Everything is generated at load; there are no image assets. The pieces live
//  in focused modules: pixel.js (drawing kit, outline / AO / rim passes),
//  actor.js (party and townsfolk, class x race x element), monsters.js (eight
//  body plans) and tiles.js (24x24 world tiles).
// ============================================================================

export { make, shade, mix, clearCache as clearSpriteCache } from './pixel.js';
export { actorSprite, npcSprite, AW, AH, NW, NH } from './actor.js';
export { monsterSprite, MW, MH } from './monsters.js';
export { tileSprite, TILE_NAMES, TILE_DRAW, TS } from './tiles.js';

import { actorSprite } from './actor.js';

/** Back-compatible alias: the party sprite used to be called heroSprite. */
export function heroSprite(o) { return actorSprite(o); }
