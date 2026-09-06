// ============================================================================
//  TOWNMARKER — the overworld's town-entrance icons, bigger and more
//  legible than a plain ground tile so a town reads as a destination from
//  a screen away, not just another prop underfoot. Two styles: a grand
//  gated arch for the full cities, a plain roadside signpost for the
//  smaller pitstop towns — same idea as a real map legend distinguishing
//  a capital from a waypoint.
// ============================================================================

import { make } from './pixel.js';

const STONE = '#9a8f7c', STONE_D = '#6a6152', STONE_HI = '#c4bba8';
const GOLD = '#e8c860', GOLD_D = '#a8843a';
const WOOD = '#8a6032', WOOD_D = '#5c4020';
const CLOTH = '#c85a4a', CLOTH_D = '#943c30';
const INK = '#20180f';

export const CITY_W = 40, CITY_H = 52;
export const PITSTOP_W = 22, PITSTOP_H = 32;

/** A grand gated arch: two stone pillars and a raised banner between them. */
export function citySprite() {
  return make('townmarker|city', CITY_W, CITY_H, (P) => {
    const baseY = CITY_H - 6;
    // pillars
    for (const px of [4, CITY_W - 10]) {
      P.rect(px, 14, 6, baseY - 14, STONE);
      P.rect(px, 14, 2, baseY - 14, STONE_HI);
      P.rect(px + 4, 14, 2, baseY - 14, STONE_D);
      P.rect(px - 1, 10, 8, 5, STONE_HI);
      P.rect(px - 1, baseY, 8, 4, STONE_D);
    }
    // arch crossbeam
    P.rect(6, 8, CITY_W - 12, 4, STONE_D);
    P.rect(6, 8, CITY_W - 12, 1, STONE_HI);
    // banner hanging from the crossbeam
    P.rect(CITY_W / 2 - 7, 0, 14, 12, CLOTH);
    P.rect(CITY_W / 2 - 7, 0, 3, 12, CLOTH_D);
    P.tri(CITY_W / 2 - 7, 12, 14, 5, CLOTH, -1);
    P.px(CITY_W / 2, 5, GOLD);
    // ground shadow
    P.ellipse(CITY_W / 2, baseY + 5, 15, 3, 'rgba(10,8,6,0.35)');
  }, { outline: INK });
}

/** A plain roadside signpost — a waypoint, not a destination in itself. */
export function pitstopSprite() {
  return make('townmarker|pitstop', PITSTOP_W, PITSTOP_H, (P) => {
    const baseY = PITSTOP_H - 5;
    P.rect(PITSTOP_W / 2 - 1, 10, 2, baseY - 10, WOOD_D);
    P.rect(PITSTOP_W / 2 - 5, 3, 10, 9, WOOD);
    P.rect(PITSTOP_W / 2 - 5, 3, 10, 2, WOOD_D);
    P.rect(PITSTOP_W / 2 - 4, 5, 8, 5, '#d8c8a0');
    P.px(PITSTOP_W / 2 - 4, 5, GOLD_D);
    P.ellipse(PITSTOP_W / 2, baseY + 3, 8, 2, 'rgba(10,8,6,0.3)');
  }, { outline: INK });
}
