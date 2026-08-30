// ============================================================================
//  BUILDINGS — houses drawn as whole structures, not as tiles.
//
//  A building in the map data is a block of cells: two rows of roof over two
//  rows of wall, with a door somewhere in the wall. Drawn per cell it came out
//  as a flat red rectangle sitting on a flat tan rectangle — which read fine
//  against the old blocky ground and reads badly against the new one.
//
//  The fix is the same idea the terrain uses: a cell renders its slice of a
//  larger object. Each cell counts how far the building runs in every direction,
//  so it knows where it sits inside the whole block, and the roof ridge, the
//  courses of tiles, the eaves and the cast shadow are all functions of position
//  within the *building* rather than within the cell.
//
//  Buildings stay rectangular, and should — architecture is square. What they
//  needed was depth: a ridge to catch the light, eaves that overhang and throw a
//  shadow on the wall below, and a shadow on the ground so they stop floating.
// ============================================================================

import { make, shade } from './pixel.js';

export const TS = 24;

const isDome = (n) => n === 'roofdome';
const isRoof = (n) => n === 'roof' || isDome(n);
// A sign is an ordinary wall cell that trades its window for a small painted
// plaque naming the trade behind it — placed one cell above a door in the map
// data, so a player can tell a smithy from an inn without walking up to read it.
const SIGN_KINDS = new Set(['sign_smithy', 'sign_pedlar', 'sign_inn', 'sign_temple', 'sign_guild', 'sign_store']);
const isSign = (n) => SIGN_KINDS.has(n);
const isWall = (n) => n === 'house' || n === 'door' || isSign(n);
const isBuilding = (n) => isRoof(n) || isWall(n);

export const isStructure = (name) => isBuilding(name);

/**
 * Two regional styles, same construction. 'green' is the FF6-ish countryside
 * cottage — terracotta tile, timber-and-plaster. 'desert' is adobe: sun-baked
 * mud-brick walls, a flatter clay roof, and turquoise-painted trim, which is
 * what lets a domed watchtower (drawn separately, see drawDome) sit on top of
 * an otherwise ordinary wall without looking like it wandered in from another
 * building style.
 */
const THEMES = {
  green: {
    // terracotta, light to dark; the last is the keyline
    TILE: ['#e08a62', '#c4603f', '#a4442c', '#82301f', '#511b12'],
    WALL: ['#e8d3ad', '#d4bb90', '#b89b70', '#8d7452'],
    BEAM: ['#7a5a38', '#5d4227'],
    GLASS: ['#3f5a86', '#6f96c8'],
    DOME: ['#e0c468', '#c49a3e', '#96712a', '#5f4518'],
    TRIM: '#8a5a2c',
  },
  desert: {
    // sun-baked clay, light to dark
    TILE: ['#d69a5c', '#c07f42', '#a3652e', '#7c4b1e', '#4a2c10'],
    WALL: ['#e6c99a', '#d4b17e', '#b8905e', '#8f6a42'],
    BEAM: ['#6b4a28', '#4a3018'],
    GLASS: ['#2f7a82', '#5cb0b8'],
    DOME: ['#e8b45c', '#c88f38', '#9c6a22', '#623f10'],
    TRIM: '#2f7a82',                          // turquoise paint, the regional accent
  },
};

const SHADOW = 'rgba(24,18,14,0.42)';
const SOFT = 'rgba(24,18,14,0.22)';
const CONTACT = 'rgba(20,14,10,0.55)';

/** How many cells the building runs in one direction, up to a sane limit. */
function run(sample, pred, dx, dy) {
  let n = 0;
  while (n < 10 && pred(sample(dx * (n + 1), dy * (n + 1)))) n++;
  return n;
}

/**
 * The roof. The ridge sits along the very top of the roof block and the courses
 * run down from it to an overhanging eave, so a two-row roof reads as one pitch
 * rather than as two bands of red.
 */
function drawRoof(P, sample, T) {
  const TILE = T.TILE;
  const up = run(sample, isRoof, 0, -1);
  const down = run(sample, isRoof, 0, 1);
  const left = run(sample, isBuilding, -1, 0);
  const right = run(sample, isBuilding, 1, 0);
  const blockH = (up + 1 + down) * TS;
  const yOff = up * TS;
  const xOff = left * TS;
  const blockW = (left + 1 + right) * TS;

  for (let py = 0; py < TS; py++) {
    const by = yOff + py;                      // position down the whole roof
    for (let px = 0; px < TS; px++) {
      const bx = xOff + px;
      let col;
      if (by < 2) {
        col = TILE[4];                         // the ridge's own keyline
      } else if (by < 5) {
        col = TILE[0];                         // ridge cap, catching the light
      } else if (by >= blockH - 3) {
        col = by >= blockH - 1 ? TILE[4] : TILE[3];   // eave lip
      } else {
        // courses of tiles, offset every other row like real tiling
        const course = Math.floor((by - 5) / 6);
        const inCourse = (by - 5) % 6;
        const stagger = (course % 2) * 4;
        const down01 = (by - 5) / Math.max(1, blockH - 8);
        col = down01 > 0.66 ? TILE[2] : down01 > 0.33 ? TILE[1] : TILE[1];
        if (inCourse === 0) col = TILE[0];             // the lit top of a course
        if (inCourse === 5) col = TILE[3];             // its shadowed underside
        if ((bx + stagger) % 8 === 0) col = TILE[3];   // the joints between tiles
      }
      // the gable ends fall away from the light
      if (bx < 2) col = TILE[4];
      else if (bx < 4) col = TILE[1];
      else if (bx >= blockW - 2) col = TILE[4];
      else if (bx >= blockW - 5) col = TILE[3];
      P.px(px, py, col);
    }
  }
}

/**
 * A domed watchtower cap — a rounded silhouette rather than a pitch, the
 * regional marker from the desert reference. Unlike the pitched roof this
 * never spans multiple columns: a dome tops one narrow tower, so only the
 * vertical run matters and the shape stays centred in its own TS-wide column.
 */
function drawDome(P, sample, T) {
  const D = T.DOME;
  const up = run(sample, isDome, 0, -1);
  const down = run(sample, isDome, 0, 1);
  const blockH = (up + 1 + down) * TS;
  const yOff = up * TS;
  const cx = TS / 2;
  const r = TS / 2 - 1;
  // A dome reads as a dome only if its cap is roughly as tall as it is wide —
  // stretch that cap over the whole block and a hemisphere becomes a spike.
  // The cap sits on a cylindrical drum that takes up whatever height is left,
  // however tall the tower itself is.
  const domeH = r * 1.15;

  for (let py = 0; py < TS; py++) {
    const by = yOff + py;
    for (let px = 0; px < TS; px++) {
      const dx = px - cx;
      let col = null;
      if (by < domeH) {
        // a hemisphere: at height `by`, the dome's half-width shrinks toward the apex
        const t = by / domeH;                  // 0 at apex, 1 at the springline
        const hw = r * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
        if (Math.abs(dx) <= hw) {
          const edge = hw - Math.abs(dx);
          if (edge < 1.1) col = D[3];                          // outline
          else if (dx < -hw * 0.15) col = t < 0.3 ? D[0] : D[1]; // lit face
          else col = t < 0.5 ? D[1] : D[2];                     // shadow face
          if (by < 2 && Math.abs(dx) < 2) col = D[3];           // finial
        }
      } else if (by < blockH - 3) {
        // a short cylindrical drum below the dome
        if (Math.abs(dx) <= r) {
          col = dx < -r * 0.2 ? D[1] : D[2];
          if (Math.abs(dx) > r - 1.2) col = D[3];
        }
      } else if (Math.abs(dx) <= r + 1) {
        col = by >= blockH - 1 ? D[3] : D[2];   // the base lip
      }
      if (col) P.px(px, py, col);
    }
  }
}

/** A small hanging plaque with a pictogram naming the trade behind the wall. */
function drawSign(P, kind, T) {
  P.rect(9, 2, 2, 6, T.BEAM[1]);                      // bracket hanging it from the eave
  P.rect(13, 2, 2, 6, T.BEAM[1]);
  P.rect(4, 7, 16, 12, shade(T.BEAM[1], -0.3));       // plaque frame/shadow
  P.rect(5, 8, 14, 10, '#e6d3a2');                    // parchment face
  P.rect(5, 8, 14, 1, '#f6ecc8');                     // lit top edge

  const cx = 12, cy = 13;
  switch (kind) {
    case 'sign_smithy':                                 // an anvil
      P.rect(cx - 5, cy, 10, 3, '#3a3a42');
      P.rect(cx - 5, cy - 1, 10, 1, '#6a6a76');
      P.rect(cx + 2, cy - 3, 4, 3, '#3a3a42');
      P.rect(cx - 2, cy + 3, 4, 3, '#241f28');
      break;
    case 'sign_pedlar':                                 // a flask of something green
      P.rect(cx - 1, cy - 5, 2, 3, '#8a6a3e');
      P.rect(cx - 3, cy - 2, 6, 7, '#c8d8f0');
      P.rect(cx - 3, cy + 1, 6, 4, '#5cc088');
      P.px(cx - 2, cy - 1, '#f0f8ff');
      break;
    case 'sign_inn':                                    // a bed
      P.rect(cx - 6, cy + 1, 12, 4, '#8a5a2c');
      P.rect(cx - 5, cy - 2, 4, 4, '#f0e6d0');
      P.rect(cx - 1, cy - 1, 7, 3, '#c85050');
      break;
    case 'sign_temple':                                 // a four-point star
      P.rect(cx - 1, cy - 6, 2, 12, '#f8d048');
      P.rect(cx - 6, cy - 1, 12, 2, '#f8d048');
      P.rect(cx - 2, cy - 2, 4, 4, '#fff0b0');
      break;
    case 'sign_guild':                                  // a rolled scroll
      P.rect(cx - 6, cy - 2, 12, 5, '#e6d3a2');
      P.rect(cx - 6, cy - 2, 2, 5, '#8a6a3e');
      P.rect(cx + 4, cy - 2, 2, 5, '#8a6a3e');
      P.rect(cx - 4, cy - 1, 8, 1, '#8a7050');
      P.rect(cx - 4, cy + 1, 6, 1, '#8a7050');
      break;
    case 'sign_store':                                  // a tied sack of goods
      P.rect(cx - 4, cy - 2, 8, 7, '#a3652e');
      P.rect(cx - 5, cy - 3, 10, 2, '#7c4b1e');
      P.rect(cx - 1, cy - 5, 2, 3, '#4a2c10');
      break;
  }
}

/** Plaster wall with a timber frame, in shadow under the eaves. */
function drawWall(P, sample, isDoor, T, self) {
  const WALL = T.WALL, BEAM = T.BEAM;
  const up = run(sample, isWall, 0, -1);
  const down = run(sample, isWall, 0, 1);
  const left = run(sample, isBuilding, -1, 0);
  const right = run(sample, isBuilding, 1, 0);
  const blockH = (up + 1 + down) * TS;
  const yOff = up * TS;
  const xOff = left * TS;
  const blockW = (left + 1 + right) * TS;

  for (let py = 0; py < TS; py++) {
    const by = yOff + py;
    for (let px = 0; px < TS; px++) {
      const bx = xOff + px;
      let col = WALL[1];
      if (by < 4) col = WALL[3];                       // under the eaves
      else if (by < 6) col = WALL[2];
      else if (by >= blockH - 3) col = WALL[3];        // foundation course
      else if ((by + bx) % 23 === 0) col = WALL[0];    // a little relief
      // corner posts
      if (bx < 3 || bx >= blockW - 3) col = by < 4 ? BEAM[1] : BEAM[0];
      P.px(px, py, col);
    }
  }

  const sign = isSign(self);
  // a window per wall cell, except where the door or a sign is
  if (!isDoor && !sign && yOff % TS === 0 && up === 0 && blockH > TS) {
    P.rect(8, 9, 9, 8, BEAM[1]);
    P.rect(9, 10, 7, 6, T.GLASS[0]);
    P.rect(9, 10, 7, 2, T.GLASS[1]);
    P.rect(12, 10, 1, 6, BEAM[1]);
    P.rect(9, 13, 7, 1, BEAM[1]);
    P.rect(7, 8, 11, 1, T.TRIM);                        // painted lintel — the accent that reads regional
  }
  if (sign) drawSign(P, self, T);
  if (isDoor) {
    const top = up === 0 ? 6 : 0;
    P.rect(6, top, 12, TS - top, BEAM[1]);
    P.rect(7, top + 1, 10, TS - top - 1, T.TRIM);            // a painted door, the regional accent
    P.rect(7, top + 1, 2, TS - top - 1, shade(T.TRIM, 0.35));
    P.rect(14, top + 9, 2, 2, '#e8c860');
  }
}

/**
 * What a building throws onto its neighbours: the roof overhangs past the wall
 * on both sides, and the whole structure drops a shadow down and to the right.
 * Drawn by the neighbouring cell, since a cell's canvas cannot reach outside it.
 */
function drawCast(P, sample, T) {
  const TILE = T.TILE;
  // the roof's overhang, from a building one cell to the left or right — a
  // dome has no sideways overhang in this model, it is drawn self-contained
  if (sample(-1, 0) === 'roof') {
    for (let py = 0; py < TS; py++) {
      P.px(0, py, TILE[3]);
      P.px(1, py, TILE[4]);
    }
  }
  if (sample(1, 0) === 'roof') {
    for (let py = 0; py < TS; py++) {
      P.px(TS - 1, py, TILE[3]);
      P.px(TS - 2, py, TILE[4]);
    }
  }
  // The ground shadow, cast down and a little to the right. Without it a house
  // floats on the grass no matter how well the roof is drawn.
  if (isBuilding(sample(0, -1))) {
    for (let px = 0; px < TS; px++) {
      const reach = px < 3 ? 4 : 8;
      P.px(px, 0, CONTACT);                    // a hard line where wall meets ground
      for (let py = 1; py < reach; py++) P.px(px, py, py < 4 ? SHADOW : SOFT);
    }
  }
  if (isBuilding(sample(-1, 0)) && isBuilding(sample(-1, -1))) {
    for (let py = 0; py < 8; py++) for (let px = 0; px < 4; px++) P.px(px, py, py < 4 ? SHADOW : SOFT);
  }
}

/** True when this cell has any building content of its own or from a neighbour. */
export function hasStructure(sample) {
  if (isBuilding(sample(0, 0))) return true;
  return isRoof(sample(-1, 0)) || isRoof(sample(1, 0)) || isBuilding(sample(0, -1));
}

export function buildingSprite(key, sample, theme = 'green') {
  const T = THEMES[theme] ?? THEMES.green;
  return make(`bld|${theme}|${key}`, TS, TS, (P) => {
    const self = sample(0, 0);
    if (isDome(self)) drawDome(P, sample, T);
    else if (isRoof(self)) drawRoof(P, sample, T);
    else if (isWall(self)) drawWall(P, sample, self === 'door', T, self);
    else drawCast(P, sample, T);
  });
}
