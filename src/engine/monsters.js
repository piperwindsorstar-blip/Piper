// ============================================================================
//  MONSTERS — eight body plans, drawn at 1:1 into a 64x52 canvas and then
//  blown up with nearest-neighbour, so `scale` genuinely makes a boss bigger
//  and gives it the thick keyline a large sprite needs. Painted by
//  engine/animemonster.js's bezier style, matching the party's own anime
//  look (engine/animeface.js) rather than pixel.js's blocky painter.
// ============================================================================

import { upscale } from './pixel.js';
import { paintAnimeMonster } from './animemonster.js';
import { BOSS_PAINTERS } from './bossart.js';

export const MW = 64, MH = 52;

// Painted at SS x the design footprint, then downsampled back to it in
// monsterSprite() below — cheap supersampled antialiasing so the bezier/arc
// linework and gradients resolve crisply instead of inheriting the plain
// single-pass AA a 64x52 canvas gets at native size.
const SS = 2;

const cache = new Map();

export function monsterSprite(sprite, frame = 0) {
  const sc = sprite.scale ?? 1;
  const base = monsterBase(sprite, frame);
  return upscale(base, sc / SS, `mon@${sc}|${sprite.plan}|${sprite.palette.join()}|${frame}`);
}

function monsterBase(sprite, frame) {
  const key = `mon|${sprite.plan}|${sprite.palette.join()}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = MW * SS; cv.height = MH * SS;
  const ctx = cv.getContext('2d');
  ctx.scale(SS, SS);
  const paint = BOSS_PAINTERS[sprite.plan] ?? paintAnimeMonster;
  paint(ctx, MW / 2, MH - 2, sprite, frame);

  // A single lit-upper-left/shadowed-lower-right wash over whatever got
  // painted, 'source-atop' so it only lands on already-opaque pixels — one
  // volume cue applied uniformly to every body plan and boss painter,
  // instead of hand-adding a highlight/shadow pass inside each of them.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, 0, MW * 0.25, MH);
  g.addColorStop(0, 'rgba(255,250,240,0.20)');
  g.addColorStop(0.5, 'rgba(255,250,240,0)');
  g.addColorStop(1, 'rgba(15,8,20,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, MW, MH);
  ctx.restore();

  cache.set(key, cv);
  return cv;
}

