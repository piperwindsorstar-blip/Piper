// ============================================================================
//  MONSTERS — eight body plans, drawn at 1:1 into a 64x52 canvas and then
//  blown up with nearest-neighbour, so `scale` genuinely makes a boss bigger
//  and gives it the thick keyline a large sprite needs. Painted by
//  engine/animemonster.js's bezier style, matching the party's own anime
//  look (engine/animeface.js) rather than pixel.js's blocky painter.
// ============================================================================

import { upscale } from './pixel.js';
import { paintAnimeMonster } from './animemonster.js';

export const MW = 64, MH = 52;

const cache = new Map();

export function monsterSprite(sprite, frame = 0) {
  const sc = sprite.scale ?? 1;
  const base = monsterBase(sprite, frame);
  return upscale(base, sc, `mon@${sc}|${sprite.plan}|${sprite.palette.join()}|${frame}`);
}

function monsterBase(sprite, frame) {
  const key = `mon|${sprite.plan}|${sprite.palette.join()}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = MW; cv.height = MH;
  const ctx = cv.getContext('2d');
  paintAnimeMonster(ctx, MW / 2, MH - 2, sprite, frame);
  cache.set(key, cv);
  return cv;
}

