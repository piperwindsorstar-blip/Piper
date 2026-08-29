// ============================================================================
//  ICONS — small glyphs for the battle command wheel.
//
//  Same technique as every other sprite in the engine: drawn with the painter
//  primitives from pixel.js and cached by make(), not stored as image assets.
//  At 18x18 there is only room for a silhouette, so each icon is built from
//  two or three shapes and one accent colour rather than shaded like a full
//  sprite.
// ============================================================================

import { make } from './pixel.js';

export const IS = 18;

const STEEL = '#c8d2e4', STEEL_D = '#8a94a8';
const GOLD = '#e8c860', GOLD_D = '#a8843a';
const WOOD = '#8a6032', WOOD_D = '#5c4020';
const LEATHER = '#9c6a3c', LEATHER_D = '#6a4626';
const CLOTH = '#d8dce8';
const INK = '#241f2e';

const ICONS = {
  sword: (P) => {
    P.rect(8, 1, 2, 10, STEEL);
    P.rect(9, 1, 1, 10, STEEL_D);
    P.px(8, 0, STEEL);
    P.rect(5, 11, 8, 2, WOOD_D);
    P.rect(8, 12, 2, 5, WOOD);
    P.px(8, 16, GOLD);
  },
  book: (P) => {
    P.rect(2, 3, 14, 12, LEATHER_D);
    P.rect(3, 4, 6, 10, CLOTH);
    P.rect(9, 4, 6, 10, CLOTH);
    P.rect(8, 4, 1, 10, LEATHER_D);
    for (const y of [6, 8, 10, 12]) { P.rect(4, y, 4, 1, LEATHER); P.rect(10, y, 4, 1, LEATHER); }
    P.rect(2, 3, 14, 1, LEATHER);
  },
  shield: (P) => {
    P.rect(3, 2, 12, 8, STEEL);                 // flat-topped body
    P.tri(3, 10, 12, 7, STEEL, 1);               // tapers to a single point at the base
    P.rect(8, 2, 1, 15, STEEL_D);                // the boss line down the centre
    P.px(8, 6, GOLD);
  },
  bag: (P) => {
    P.rect(4, 6, 10, 10, LEATHER);
    P.rect(4, 6, 3, 10, LEATHER_D);
    P.rect(4, 6, 10, 1, WOOD_D);
    P.rect(6, 2, 6, 5, WOOD_D);
    P.rect(7, 3, 4, 3, LEATHER);
    P.px(9, 10, GOLD);
  },
  boot: (P) => {
    P.rect(6, 1, 5, 9, LEATHER);
    P.rect(6, 1, 2, 9, LEATHER_D);
    P.rect(5, 10, 10, 3, LEATHER);
    P.rect(5, 12, 10, 2, WOOD_D);
    for (const y of [2, 4, 6]) P.px(9, y, GOLD_D);
  },
  move: (P) => {
    // a compass of four hand-drawn arrowheads (P.tri only tapers vertically,
    // so east/west are built the same way turned on their side) around a hub
    const cx = 9, cy = 9;
    const vArrow = (tipY, grow, size, col) => {
      for (let i = 0; i < size; i++) { const w = i + 1; P.rect(cx - (w >> 1), tipY + i * grow, w, 1, col); }
    };
    const hArrow = (tipX, grow, size, col) => {
      for (let i = 0; i < size; i++) { const w = i + 1; P.rect(tipX + i * grow, cy - (w >> 1), 1, w, col); }
    };
    vArrow(0, 1, 4, CLOTH);                     // north: tip at the top, widening down
    vArrow(17, -1, 4, CLOTH);                    // south: tip at the bottom, widening up
    hArrow(0, 1, 4, CLOTH);                      // west
    hArrow(17, -1, 4, CLOTH);                    // east
    P.rect(cx - 2, cy - 2, 4, 4, INK);
    P.rect(cx - 1, cy - 1, 2, 2, GOLD);
  },
};

export function iconSprite(name) {
  return make(`icon|${name}`, IS, IS, ICONS[name] ?? ICONS.sword,
    { outline: INK, rim: 'tl', rimAlpha: 0.22 });
}
