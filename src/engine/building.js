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

import { make, shade, paintSoftened } from './pixel.js';

export const TS = 24;

const isDome = (n) => n === 'roofdome';
const isRoof = (n) => n === 'roof' || isDome(n);
// A sign is an ordinary wall cell that trades its window for a small painted
// plaque naming the trade behind it — placed one cell above a door in the map
// data, so a player can tell a smithy from an inn without walking up to read it.
const SIGN_KINDS = new Set([
  'sign_smithy', 'sign_pedlar', 'sign_inn', 'sign_temple', 'sign_guild', 'sign_store',
  'sign_castle', 'sign_treasury', 'sign_garrison',
]);
const isSign = (n) => SIGN_KINDS.has(n);
const isWall = (n) => n === 'house' || n === 'door' || isSign(n);
const isBuilding = (n) => isRoof(n) || isWall(n);

export const isStructure = (name) => isBuilding(name);

// A building's own trade shows in more than its sign now: the roof tile, the
// wall plaster and the door paint all shift per kind, so a smithy reads as a
// smithy — and a plain, unsigned home keeps the regional default it always
// had, unchanged. Each entry falls back to the regional THEME wherever it
// doesn't override — an inn's warm terracotta already reads "inn," so it
// isn't listed at all.
const KIND_TILE = {
  sign_smithy: ['#9296a0', '#767a84', '#585c66', '#3e4148', '#232529'],   // slate
  sign_pedlar: ['#5cab58', '#458c42', '#316b2e', '#234e21', '#132c12'],   // market green
  sign_store: ['#5cab58', '#458c42', '#316b2e', '#234e21', '#132c12'],
  sign_temple: ['#f2ecda', '#ddd1af', '#b9a878', '#8d7b51', '#5a4c31'],   // pale stone
  sign_guild: ['#6c74c2', '#545ca2', '#3e447a', '#2b2f58', '#191b36'],    // deep blue-violet
  sign_castle: ['#a83838', '#8a2c2c', '#6a2020', '#4a1616', '#2c0c0c'],   // royal red
  sign_treasury: ['#c8a848', '#a88838', '#846a28', '#5c4a1a', '#362c10'], // gold
  sign_garrison: ['#7a828c', '#626870', '#4a5058', '#363a40', '#202226'], // steel
};
const KIND_WALL = {
  sign_smithy: ['#c6c6cc', '#aaaab2', '#8c8c94', '#68686e'],
  sign_temple: ['#faf6ec', '#eee6d2', '#d2c6a2', '#aa9a7a'],
  sign_guild: ['#cad0f0', '#aab0e0', '#8a92c2', '#6870a2'],
  sign_castle: ['#e2caca', '#caa2a2', '#aa7a7a', '#825a5a'],
  sign_treasury: ['#ecdeb2', '#d6c28a', '#b29e62', '#8c7a46'],
  sign_garrison: ['#c2c6ca', '#a6aaae', '#8a8e92', '#6a6e72'],
};
const KIND_TRIM = {
  sign_smithy: '#3a3a42',
  sign_temple: '#e8c860',
  sign_guild: '#4a52a0',
  sign_castle: '#c83030',
  sign_treasury: '#e0b030',
  sign_garrison: '#5a6068',
};
// A castle's corner towers are gold against its red walls rather than the
// regional dome's default — a coronet, not a watchtower.
const KIND_DOME = {
  sign_castle: ['#e8c860', '#c8a040', '#9c7830', '#5a4818'],
};

/** How far a building's own footprint runs, in every direction from `sample`'s
 *  own cell — used by findKind below, which needs a bounding box to know
 *  where to stop looking for a sign. A plain left/right/up/down probe from
 *  the cell's own row and column is enough for a solid rectangle, but a
 *  castle's corner tower rises from a tip cell that has no building beside
 *  it on either side — only the tower shaft below connects it to the rest
 *  of the building — so the box is found by flooding outward through
 *  connected building cells instead of assuming the cell's own row and
 *  column span the whole thing. */
function buildingExtent(sample) {
  const seen = new Set(['0,0']);
  const queue = [[0, 0]];
  let left = 0, right = 0, up = 0, down = 0;
  while (queue.length && seen.size < 400) {
    const [dx, dy] = queue.shift();
    left = Math.max(left, -dx); right = Math.max(right, dx);
    up = Math.max(up, -dy); down = Math.max(down, dy);
    for (const [ndx, ndy] of [[dx - 1, dy], [dx + 1, dy], [dx, dy - 1], [dx, dy + 1]]) {
      const key = `${ndx},${ndy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isBuilding(sample(ndx, ndy))) queue.push([ndx, ndy]);
    }
  }
  return { left, right, up, down };
}

/** Which trade this building is, found by scanning its own footprint for a
 *  sign cell — so a roof cell two rows above the door still knows what's
 *  below it, without the map data needing to repeat the kind on every tile.
 *  Null for an unsigned building (a plain home), which keeps the regional
 *  default look it always had. */
function findKind(sample) {
  const { left, right, up, down } = buildingExtent(sample);
  for (let dy = -up; dy <= down; dy++) {
    for (let dx = -left; dx <= right; dx++) {
      const n = sample(dx, dy);
      if (isSign(n)) return n;
    }
  }
  return null;
}

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

const SHADOW = 'rgba(24,18,14,0.28)';
const SOFT = 'rgba(24,18,14,0.14)';
const CONTACT = 'rgba(20,14,10,0.35)';

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
function drawRoof(P, sample, T, kind) {
  const TILE = KIND_TILE[kind] ?? T.TILE;
  const up = run(sample, isRoof, 0, -1);
  const down = run(sample, isRoof, 0, 1);
  const left = run(sample, isBuilding, -1, 0);
  const right = run(sample, isBuilding, 1, 0);
  const blockH = (up + 1 + down) * TS;
  const yOff = up * TS;
  const xOff = left * TS;
  const blockW = (left + 1 + right) * TS;
  const trim = KIND_TRIM[kind];

  for (let py = 0; py < TS; py++) {
    const by = yOff + py;                      // position down the whole roof
    for (let px = 0; px < TS; px++) {
      const bx = xOff + px;
      let col;
      const corrugated = kind === 'sign_smithy';
      if (by < 2) {
        col = TILE[4];                         // the ridge's own keyline
      } else if (by < 5) {
        col = TILE[0];                         // ridge cap, catching the light
      } else if (by >= blockH - 3) {
        col = by >= blockH - 1 ? TILE[4] : TILE[3];   // eave lip
      } else if (corrugated) {
        // corrugated tin, not clay tile — a mechanic's shop, not a cottage
        const ridge = bx % 4;
        col = ridge === 0 ? TILE[3] : ridge < 3 ? TILE[1] : TILE[2];
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

      // a trade-specific silhouette, layered on last so it always shows: a
      // smithy's chimney, a temple's gilded finial, bunting along a guild's
      // ridge, an awning striping a store's eave, crenellations on a castle.
      if (kind === 'sign_smithy') {
        const cx0 = blockW - 8;
        if (bx >= cx0 && bx < cx0 + 3 && by < 10) {
          col = by < 2 ? '#1c1c20' : bx === cx0 + 2 ? '#4a4a52' : '#2c2c32';
        }
      } else if (kind === 'sign_temple' && by < 4 && Math.abs(bx - Math.floor(blockW / 2)) <= 1) {
        col = '#f8d868';
      } else if (kind === 'sign_guild' && by < 5 && bx % 10 < 4) {
        col = trim;
      } else if (kind === 'sign_castle' && by < 6) {
        // a crenellated parapet: solid merlons standing on a continuous
        // ledge, with open notches between them left unpainted so the grass
        // behind the building shows through — a real break in the roofline,
        // not just a texture, the one silhouette in this file that isn't a
        // pitched roof underneath
        if (by < 4) {
          const merlon = Math.floor(bx / 4) % 2 === 0;
          col = merlon ? (by < 2 ? TILE[4] : TILE[0]) : null;
        } else {
          col = TILE[3];
        }
      } else if ((kind === 'sign_store' || kind === 'sign_pedlar')
        && by >= blockH - 7 && by < blockH - 3 && Math.floor(bx / 3) % 2 === 0) {
        col = '#e8e0d0';
      }
      if (col) P.px(px, py, col);
    }
  }
}

/**
 * A domed watchtower cap — a rounded silhouette rather than a pitch, the
 * regional marker from the desert reference. Unlike the pitched roof this
 * never spans multiple columns: a dome tops one narrow tower, so only the
 * vertical run matters and the shape stays centred in its own TS-wide column.
 */
function drawDome(P, sample, T, kind) {
  const D = KIND_DOME[kind] ?? T.DOME;
  const up = run(sample, isDome, 0, -1);
  const down = run(sample, isDome, 0, 1);
  const blockH = (up + 1 + down) * TS;
  const yOff = up * TS;
  const cx = TS / 2;
  const r = TS / 2 - 1;
  const turret = kind === 'sign_castle';
  // A dome reads as a dome only if its cap is roughly as tall as it is wide —
  // stretch that cap over the whole block and a hemisphere becomes a spike.
  // The cap sits on a cylindrical drum that takes up whatever height is left,
  // however tall the tower itself is. A castle's corner tower skips the dome
  // entirely for a flat, crenellated top — the same battlement motif as the
  // main roof, so the tower reads as part of the same fortress.
  const domeH = turret ? 7 : r * 1.15;

  for (let py = 0; py < TS; py++) {
    const by = yOff + py;
    for (let px = 0; px < TS; px++) {
      const dx = px - cx;
      let col = null;
      if (turret && by < domeH) {
        if (Math.abs(dx) < 2 && by < 2) {
          col = '#c83030';                          // a pennant on a pole above the wall
        } else if (by >= 2 && Math.abs(dx) <= r) {
          const merlon = Math.floor((px + 1) / 3) % 2 === 0;
          if (merlon) col = by < 4 ? D[0] : D[1];   // solid tooth; the gaps stay open
        }
      } else if (!turret && by < domeH) {
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
    case 'sign_castle':                                 // a small crown
      P.rect(cx - 6, cy, 12, 5, '#c83030');
      P.rect(cx - 6, cy - 4, 3, 5, '#e0b030');
      P.rect(cx - 2, cy - 6, 4, 7, '#e0b030');
      P.rect(cx + 3, cy - 4, 3, 5, '#e0b030');
      P.px(cx, cy - 6, '#fff0b0');
      break;
    case 'sign_treasury':                               // stacked coins
      P.rect(cx - 5, cy + 2, 10, 3, '#e0b030');
      P.rect(cx - 4, cy - 1, 8, 3, '#e8c860');
      P.rect(cx - 3, cy - 4, 6, 3, '#f0d878');
      P.px(cx, cy - 3, '#fff4c0');
      break;
    case 'sign_garrison':                               // a shield behind crossed spears
      P.rect(cx - 4, cy - 3, 8, 9, '#7a828c');
      P.rect(cx - 4, cy - 3, 8, 1, '#9ea4ac');
      P.rect(cx - 1, cy - 6, 2, 13, '#8a6a3e');
      P.rect(cx - 6, cy - 1, 12, 2, '#8a6a3e');
      break;
  }
}

/** Plaster wall with a timber frame, in shadow under the eaves. */
function drawWall(P, sample, isDoor, T, self, kind) {
  const WALL = KIND_WALL[kind] ?? T.WALL, BEAM = T.BEAM;
  const trim = KIND_TRIM[kind] ?? T.TRIM;
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
  // The Ford Inn reads as two storeys, not one: a window in the wall row
  // below the sign row too, and a lit floor ledge dividing them — everyone
  // else still gets exactly the one row of windows they always had.
  const twoStorey = kind === 'sign_inn';
  const shopfront = kind === 'sign_store' || kind === 'sign_pedlar';
  const hasWindow = !isDoor && !sign && blockH > TS && (twoStorey ? true : (yOff % TS === 0 && up === 0));
  if (hasWindow) {
    if (shopfront) {
      // full-width glass, edge to edge, so neighbouring cells' panes read as
      // one continuous shopfront window broken only by its own thin mullions
      // — not another cottage with a bigger square cut into the wall
      P.rect(0, 9, TS, 8, BEAM[1]);
      P.rect(1, 10, TS - 2, 6, T.GLASS[0]);
      P.rect(1, 10, TS - 2, 2, T.GLASS[1]);
      P.rect(1, 13, TS - 2, 1, BEAM[1]);
      P.rect(0, 8, TS, 1, trim);
      P.speck([[4, 12], [9, 11], [14, 12], [19, 11]], '#e8c860');   // goods on display
    } else {
      P.rect(8, 9, 9, 8, BEAM[1]);
      P.rect(9, 10, 7, 6, T.GLASS[0]);
      P.rect(9, 10, 7, 2, T.GLASS[1]);
      P.rect(12, 10, 1, 6, BEAM[1]);
      P.rect(9, 13, 7, 1, BEAM[1]);
      P.rect(7, 8, 11, 1, trim);                        // painted lintel — the accent that reads the trade
    }
  }
  if (twoStorey && up > 0) {
    // the floor ledge between storeys, on the ground-floor cell only
    P.rect(0, 0, TS, 1, BEAM[0]);
    P.rect(0, 1, TS, 1, BEAM[1]);
  }
  if (sign) drawSign(P, self, T);
  if (isDoor) {
    if (kind === 'sign_smithy') {
      // a wide garage-style door, not a household one — this is a working shop
      P.rect(2, 5, TS - 4, TS - 5, BEAM[1]);
      P.rect(3, 6, TS - 6, TS - 7, trim);
      P.rect(3, 6, TS - 6, 1, shade(trim, 0.3));
      for (let gy = 9; gy < TS - 2; gy += 4) P.rect(3, gy, TS - 6, 1, shade(trim, -0.35));
    } else {
      const top = up === 0 ? 6 : 0;
      P.rect(6, top, 12, TS - top, BEAM[1]);
      P.rect(7, top + 1, 10, TS - top - 1, trim);            // a painted door, the trade's own accent
      P.rect(7, top + 1, 2, TS - top - 1, shade(trim, 0.35));
      P.rect(14, top + 9, 2, 2, '#e8c860');
      if (kind === 'sign_treasury') {
        // a reinforced, barred door — the one building worth locking twice
        P.rect(7, top + 5, 10, 1, '#4a3a1a');
        P.rect(7, top + 11, 10, 1, '#4a3a1a');
      }
    }
  }
}

/**
 * What a building throws onto its neighbours: the roof overhangs past the wall
 * on both sides, and the whole structure drops a shadow down and to the right.
 * Drawn by the neighbouring cell, since a cell's canvas cannot reach outside it.
 */
function drawCast(P, sample, T) {
  // the roof's overhang, from a building one cell to the left or right — a
  // dome has no sideways overhang in this model, it is drawn self-contained.
  // Colored to match that neighbour's own trade, found the same way a roof
  // cell finds its own — otherwise a smithy's slate roof would overhang onto
  // the grass in the regional terracotta it just stopped being.
  if (sample(-1, 0) === 'roof') {
    const TILE = KIND_TILE[findKind((dx, dy) => sample(dx - 1, dy))] ?? T.TILE;
    for (let py = 0; py < TS; py++) {
      P.px(0, py, TILE[3]);
      P.px(1, py, TILE[4]);
    }
  }
  if (sample(1, 0) === 'roof') {
    const TILE = KIND_TILE[findKind((dx, dy) => sample(dx + 1, dy))] ?? T.TILE;
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

/** The unblurred building content for exactly one cell — cached under its
 *  own absolute position so a neighbouring cell's softened pass can reuse
 *  it instead of redrawing (see terrain.js's groundSpriteRaw for why). */
function buildingSpriteRaw(mapId, x, y, sample, theme) {
  const T = THEMES[theme] ?? THEMES.green;
  return make(`bldraw|${theme}|${mapId}|${x}|${y}`, TS, TS, (P) => {
    const self = sample(0, 0);
    if (isDome(self)) drawDome(P, sample, T, findKind(sample));
    else if (isRoof(self)) drawRoof(P, sample, T, findKind(sample));
    else if (isWall(self)) drawWall(P, sample, self === 'door', T, self, findKind(sample));
    else drawCast(P, sample, T);
  });
}

/** `key` is `${mapId}|${x}|${y}` (see field.js's renderWorldTexture). */
export function buildingSprite(key, sample, theme = 'green') {
  const [mapId, cxs, cys] = key.split('|');
  const cx = Number(cxs), cy = Number(cys);
  return make(`bld|${theme}|${key}`, TS, TS, (P) => {
    paintSoftened(TS, P, sample, (dx, dy, nSample) =>
      buildingSpriteRaw(mapId, cx + dx, cy + dy, nSample, theme));
  });
}
