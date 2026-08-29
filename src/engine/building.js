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

import { make } from './pixel.js';

export const TS = 24;

const isRoof = (n) => n === 'roof';
const isWall = (n) => n === 'house' || n === 'door';
const isBuilding = (n) => isRoof(n) || isWall(n);

export const isStructure = (name) => isBuilding(name);

// terracotta, light to dark; the last is the keyline
const TILE = ['#e08a62', '#c4603f', '#a4442c', '#82301f', '#511b12'];
// plaster and its timber frame
const WALL = ['#e8d3ad', '#d4bb90', '#b89b70', '#8d7452'];
const BEAM = ['#7a5a38', '#5d4227'];
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
function drawRoof(P, sample) {
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

/** Plaster wall with a timber frame, in shadow under the eaves. */
function drawWall(P, sample, isDoor) {
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

  // a window per wall cell, except where the door is
  if (!isDoor && yOff % TS === 0 && up === 0 && blockH > TS) {
    P.rect(8, 9, 9, 8, BEAM[1]);
    P.rect(9, 10, 7, 6, '#3f5a86');
    P.rect(9, 10, 7, 2, '#6f96c8');
    P.rect(12, 10, 1, 6, BEAM[1]);
    P.rect(9, 13, 7, 1, BEAM[1]);
  }
  if (isDoor) {
    const top = up === 0 ? 6 : 0;
    P.rect(6, top, 12, TS - top, BEAM[1]);
    P.rect(7, top + 1, 10, TS - top - 1, '#6b4622');
    P.rect(7, top + 1, 2, TS - top - 1, '#8a6032');
    P.rect(14, top + 9, 2, 2, '#e8c860');
  }
}

/**
 * What a building throws onto its neighbours: the roof overhangs past the wall
 * on both sides, and the whole structure drops a shadow down and to the right.
 * Drawn by the neighbouring cell, since a cell's canvas cannot reach outside it.
 */
function drawCast(P, sample) {
  // the roof's overhang, from a building one cell to the left or right
  if (isRoof(sample(-1, 0))) {
    for (let py = 0; py < TS; py++) {
      P.px(0, py, TILE[3]);
      P.px(1, py, TILE[4]);
    }
  }
  if (isRoof(sample(1, 0))) {
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

export function buildingSprite(key, sample) {
  return make(`bld|${key}`, TS, TS, (P) => {
    const self = sample(0, 0);
    if (isRoof(self)) drawRoof(P, sample);
    else if (isWall(self)) drawWall(P, sample, self === 'door');
    else drawCast(P, sample);
  });
}
