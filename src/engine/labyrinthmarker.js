// ============================================================================
//  LABYRINTHMARKER — the overworld's labyrinth-entrance icon: a tall dark
//  tower, deliberately unlike the cave mouth caves use, so a labyrinth reads
//  as its own kind of destination from a screen away rather than another
//  dungeon entrance in a different colour.
// ============================================================================

import { make } from './pixel.js';

const STONE = '#4a4658', STONE_D = '#2a2636', STONE_HI = '#6a6680';
const ROOF = '#241e30', ROOF_D = '#140f1c';
const GLOW = '#c88cf0', GLOW_D = '#7a4aa0';
const INK = '#0a0810';

export const TOWER_W = 28, TOWER_H = 62;

export function towerSprite() {
  return make('labyrinthmarker|tower', TOWER_W, TOWER_H, (P) => {
    const cx = TOWER_W / 2;
    const baseY = TOWER_H - 6;
    // tapered shaft, narrower toward the top
    for (let y = 14; y < baseY; y++) {
      const t = (y - 14) / (baseY - 14);
      const halfW = 5 + t * 4;
      P.rect(cx - halfW, y, halfW * 2, 1, STONE);
      P.rect(cx - halfW, y, 2, 1, STONE_HI);
      P.rect(cx + halfW - 2, y, 2, 1, STONE_D);
    }
    // banding, every few rows
    for (let y = 18; y < baseY; y += 7) {
      const t = (y - 14) / (baseY - 14);
      const halfW = 5 + t * 4;
      P.rect(cx - halfW, y, halfW * 2, 1, STONE_D);
    }
    // conical roof
    P.tri(cx - 9, 0, 18, 15, ROOF, 1);
    P.tri(cx - 9, 0, 10, 15, ROOF_D, 1);
    P.px(cx, 0, GLOW);
    // glowing window near the top
    P.rect(cx - 2, 22, 4, 5, GLOW_D);
    P.px(cx - 1, 23, GLOW);
    // base and doorway
    P.rect(cx - 9, baseY, 18, 6, STONE_D);
    P.rect(cx - 3, baseY + 1, 6, 5, INK);
    P.ellipse(cx, baseY + 8, 13, 3, 'rgba(10,8,6,0.35)');
  }, { outline: INK });
}
