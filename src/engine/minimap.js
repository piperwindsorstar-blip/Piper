// ============================================================================
//  MINIMAP — a small always-on overview of the overworld. The terrain read
//  and every town/dungeon dot are static map data, so they're baked once per
//  map into an offscreen canvas and cached; only the player's own blip moves,
//  and that's cheap enough to redraw every frame on top of the cached image.
// ============================================================================

import { tileAt, getMap, mapSize } from '../data/maps.js';

export const MM_W = 96, MM_H = 72;

const TERRAIN_COLOR = {
  water: '#1d3f72', bridge: '#7a5a34', sand: '#d6be88', grass: '#3f6b37',
  road: '#a08a62', tree: '#173f10', mountain: '#71665a',
};

const MARK_COLOR = { town: '#e8c860', tower: '#c88cf0', dungeon: '#e05648' };

function bake(m) {
  const { w, h } = mapSize(m);
  const cv = document.createElement('canvas');
  cv.width = MM_W; cv.height = MM_H;
  const ctx = cv.getContext('2d');

  // one sample per output pixel — plenty for a terrain overview this small,
  // and far cheaper than averaging every tile a pixel actually covers
  for (let py = 0; py < MM_H; py++) {
    const ty = Math.min(h - 1, Math.floor((py + 0.5) / MM_H * h));
    for (let px = 0; px < MM_W; px++) {
      const tx = Math.min(w - 1, Math.floor((px + 0.5) / MM_W * w));
      const name = tileAt(m, tx, ty)?.tile;
      ctx.fillStyle = TERRAIN_COLOR[name] ?? TERRAIN_COLOR.grass;
      ctx.fillRect(px, py, 1, 1);
    }
  }

  for (const wp of m.warps ?? []) {
    const dest = getMap(wp.to);
    if (!dest) continue;
    const kind = dest.town ? 'town' : dest.tower ? 'tower' : dest.encounter ? 'dungeon' : null;
    if (!kind) continue;
    const px = Math.round((wp.x + 0.5) / w * MM_W);
    const py = Math.round((wp.y + 0.5) / h * MM_H);
    ctx.fillStyle = MARK_COLOR[kind];
    ctx.fillRect(px - 1, py - 1, 3, 3);
  }
  return cv;
}

const cache = new Map();

/** The cached terrain+markers canvas for a map, baked on first use. */
export function minimapSprite(m) {
  let cv = cache.get(m.id);
  if (!cv) { cv = bake(m); cache.set(m.id, cv); }
  return cv;
}
