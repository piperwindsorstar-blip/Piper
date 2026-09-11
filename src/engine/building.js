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
// Muted ~32% off these trades' original saturation, same treatment and same
// reason as THEMES below — a smithy's slate and a castle's ashlar were
// already close to neutral so barely move, but the guild's blue-violet,
// the treasury's gold and the temple's pale stone all read as duller,
// more mineral versions of themselves now rather than a paint swatch.
const KIND_TILE = {
  sign_smithy: ['#94979e', '#787b82', '#5a5d64', '#404246', '#242528'],   // slate
  sign_pedlar: ['#689e65', '#50804e', '#3a6138', '#2a4728', '#172816'],   // market green
  sign_store: ['#689e65', '#50804e', '#3a6138', '#2a4728', '#172816'],
  sign_temple: ['#eeeade', '#d6cdb6', '#afa382', '#83775b', '#534a38'],   // pale stone
  sign_guild: ['#7a7fb4', '#606696', '#484c70', '#323551', '#1e1f31'],    // deep blue-violet
  sign_castle: ['#93989f', '#797e85', '#5f6369', '#42464a', '#25272a'],  // fortress ashlar
  sign_treasury: ['#b49e5c', '#96804a', '#756437', '#514525', '#302916'], // gold ashlar, a vault built of coin-colored stone
  sign_garrison: ['#7d8289', '#64686e', '#4c5056', '#383a3e', '#212225'], // steel-grey ashlar
  sign_inn: ['#cab989', '#b2a06c', '#968352', '#7b693d', '#524628'],    // bundled straw thatch
};
const KIND_WALL = {
  sign_smithy: ['#8c6152', '#6f4a3f', '#53372f', '#38241e'],    // soot-stained brick, not plaster
  sign_temple: ['#f8f5ee', '#eae4d6', '#cac2aa', '#a29782'],    // marble, fluted into a colonnade
  sign_guild: ['#656895', '#52557c', '#404364', '#2e304a'],     // dark indigo brick
  sign_castle: ['#93989f', '#797e85', '#5f6369', '#42464a'],    // the same stone as the rampart above
  sign_treasury: ['#e3d9bb', '#cabc96', '#a5986f', '#817551'],  // pale gold ashlar — the same stone as its roof
  sign_garrison: ['#c3c6c9', '#a7aaad', '#8b8e91', '#6b6e71'],  // grey ashlar
};
const KIND_TRIM = {
  sign_smithy: '#3b3b41',
  sign_temple: '#d2bc76',
  sign_guild: '#585d92',
  sign_castle: '#9a3e3e',   // banners and the gate's ironwork — the only warm color on a grey keep
  sign_treasury: '#c4a34c',
  sign_garrison: '#5c6066',
};
// A castle's corner towers are built of the same stone as everything else —
// a fortress, not a gilded folly.
const KIND_DOME = {
  sign_castle: ['#93989f', '#797e85', '#5f6369', '#42464a'],
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
// Muted ~32% off these materials' original saturation — the same treatment
// and the same reason as terrain.js's MAT_THEMES: real clay tile and
// plaster read as duller versions of their hue than a bright game palette
// defaults to. GLASS is left alone; window glass tinted by sky reflection
// is already a fairly natural blue.
const THEMES = {
  green: {
    // terracotta, light to dark; the last is the keyline
    TILE: ['#cc9176', '#af6b54', '#91503f', '#723a2f', '#47221c'],
    WALL: ['#dfd0b6', '#c9b89b', '#ac997c', '#84735b'],
    BEAM: ['#6f5a43', '#544230'],
    GLASS: ['#3f5a86', '#6f96c8'],
    DOME: ['#cdba7b', '#af9253', '#856c3b', '#544223'],
    TRIM: '#7b5a3b',
  },
  desert: {
    // sun-baked clay, light to dark
    TILE: ['#c29a70', '#ac8056', '#906641', '#6d4c2d', '#412c19'],
    WALL: ['#dac6a6', '#c6ae8c', '#aa8e6c', '#836a4e'],
    BEAM: ['#604a33', '#423020'],
    GLASS: ['#2f7a82', '#5cb0b8'],
    DOME: ['#d2ae72', '#b18a4f', '#886636', '#553d1d'],
    TRIM: '#3c6f75',                          // turquoise paint, the regional accent
  },
};

const SHADOW = 'rgba(24,18,14,0.28)';
const SOFT = 'rgba(24,18,14,0.14)';
const CONTACT = 'rgba(20,14,10,0.35)';

// A fine per-pixel weathering jitter for wall plaster and roof tile — the
// same idea as terrain.js's grain(), reimplemented locally since it takes
// world-pixel coordinates and these callers only have position within the
// building block. Deterministic in (bx, by) so a building never re-jitters
// between frames or redraws. Kept small enough to read as worn stucco and
// sun-baked tile rather than as noise fighting the material's own bands.
function wallHash(bx, by) {
  let n = (bx * 374761393 + by * 668265263) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function weather(col, bx, by, amt = 0.05) {
  return shade(col, (wallHash(bx, by) - 0.5) * amt);
}

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

  // Three trades get a whole different roof material, not just a different
  // color of the cottage's clay tile: a smithy's corrugated tin, a fortress's
  // coursed stone (shared by the castle, its garrison, and the treasury
  // vault — three buildings that are all, structurally, the same kind of
  // blockhouse), and an inn's bundled straw thatch. A market stall gets
  // striped canvas instead — a tent, not a roof at all.
  const corrugated = kind === 'sign_smithy';
  const crenellated = kind === 'sign_castle' || kind === 'sign_garrison';
  const masonry = crenellated || kind === 'sign_treasury';
  const thatch = kind === 'sign_inn';
  const tentroof = kind === 'sign_store' || kind === 'sign_pedlar';

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
      } else if (corrugated) {
        // corrugated tin, not clay tile — a mechanic's shop, not a cottage
        const ridge = bx % 4;
        col = ridge === 0 ? TILE[3] : ridge < 3 ? TILE[1] : TILE[2];
      } else if (masonry) {
        // coursed ashlar stone, climbing straight up from the wall below —
        // a blockhouse's rampart, not a pitched roof wearing its colors
        const course = Math.floor((by - 5) / 5);
        const inCourse = (by - 5) % 5;
        const stagger = (course % 2) * 5;
        col = TILE[1];
        if (inCourse === 0) col = TILE[0];              // the lit top of a course
        if ((bx + stagger) % 10 === 0) col = TILE[3];    // the joints between blocks
      } else if (thatch) {
        // bundled straw, overlapped course on course — a travellers' inn,
        // not a tile roof painted straw-colored
        const row = Math.floor((by - 5) / 3);
        const inRow = (by - 5) % 3;
        const stagger = (row % 2) * 3;
        col = inRow === 0 ? TILE[0] : TILE[1];
        if ((bx + stagger) % 6 < 1) col = TILE[3];      // where one bundle overlaps the next
      } else if (tentroof) {
        // canvas stretched over a stall's frame, striped and stitched —
        // a market tent, not a shingled roof in market colors
        const stripe = Math.floor(bx / 4) % 2 === 0;
        col = stripe ? TILE[1] : '#e8e0d0';
        if ((by - 5) % 7 === 0) col = TILE[3];          // a seam between canvas panels
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
      // smithy's chimney, an inn's own chimney, a temple's pediment, bunting
      // along a guild's ridge, crenellations on a fortress, a scalloped
      // valance over a market stall.
      if (kind === 'sign_smithy' || kind === 'sign_inn') {
        const cx0 = blockW - 8;
        const lit = kind === 'sign_smithy' ? '#4a4a52' : '#8a7058';
        const mid = kind === 'sign_smithy' ? '#2c2c32' : '#6e5844';
        const dark = kind === 'sign_smithy' ? '#1c1c20' : '#5c4a3a';
        if (bx >= cx0 && bx < cx0 + 3 && by < 10) {
          col = by < 2 ? dark : bx === cx0 + 2 ? lit : mid;
        }
      } else if (kind === 'sign_temple') {
        // a pediment: a pale triangular gable rising to the ridge, with a
        // gilded finial at its peak — not a plain pitched roof
        const mid = Math.floor(blockW / 2);
        const spread = Math.min(6, Math.floor(by / 1.5));
        if (Math.abs(bx - mid) <= spread && by < 9) col = '#f8f2e0';
        if (by < 4 && Math.abs(bx - mid) <= 1) col = '#f8d868';
      } else if (kind === 'sign_guild' && by < 5 && bx % 10 < 4) {
        col = trim;
      } else if (crenellated && by < 8) {
        // a crenellated parapet: solid merlons standing on a continuous
        // ledge, with open notches between them left unpainted so the grass
        // behind the building shows through — a real break in the roofline,
        // not just a texture, the one silhouette in this file that isn't a
        // pitched roof underneath
        if (by < 6) {
          const merlon = Math.floor(bx / 4) % 2 === 0;
          col = merlon ? (by < 2 ? TILE[4] : TILE[0]) : null;
        } else {
          col = TILE[3];
        }
      } else if ((kind === 'sign_store' || kind === 'sign_pedlar') && by >= blockH - 3 && by < blockH - 1) {
        // a scalloped valance along the eave, the edge of the canvas itself
        if (bx % 6 < 3) col = shade(trim, -0.2);
      }
      if (col) P.px(px, py, weather(col, bx, by, 0.10));
    }
  }
}

/**
 * A tower cap. The regional default is a rounded dome, a rounded silhouette
 * rather than a pitch; a castle's corner tower instead gets a flat,
 * crenellated top — the same battlement motif as the main rampart, so the
 * tower reads as part of the same fortress rather than a decoration bolted
 * onto it. Either way the cap can span more than one column now — a castle's
 * towers are two cells wide, wide enough to read as a tower rather than a
 * turret stuck on the corner — so width is measured the same way the roof
 * measures its own, not assumed to be exactly one cell.
 */
function drawDome(P, sample, T, kind) {
  const D = KIND_DOME[kind] ?? T.DOME;
  const up = run(sample, isDome, 0, -1);
  const down = run(sample, isDome, 0, 1);
  const left = run(sample, isDome, -1, 0);
  const right = run(sample, isDome, 1, 0);
  const blockH = (up + 1 + down) * TS;
  const blockW = (left + 1 + right) * TS;
  const yOff = up * TS;
  const xOff = left * TS;
  const cx = blockW / 2;
  const r = blockW / 2 - 1;
  const turret = kind === 'sign_castle';
  // A dome reads as a dome only if its cap is roughly as tall as it is wide —
  // stretch that cap over the whole block and a hemisphere becomes a spike.
  // The cap sits on a cylindrical drum that takes up whatever height is left,
  // however tall the tower itself is.
  const domeH = turret ? 8 : r * 1.15;

  for (let py = 0; py < TS; py++) {
    const by = yOff + py;
    for (let px = 0; px < TS; px++) {
      const bx = xOff + px;              // position across the whole tower
      const dx = bx - cx;
      let col = null;
      if (turret && by < domeH) {
        if (Math.abs(dx) < 2 && by < 2) {
          col = '#b02828';                          // a pennant on a pole above the wall
        } else if (by >= 2 && Math.abs(dx) <= r) {
          const merlon = Math.floor((bx + 1) / 3) % 2 === 0;
          if (merlon) col = by < 5 ? D[0] : D[1];   // solid tooth; the gaps stay open
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
        // a cylindrical (or, for a wide castle tower, a squared) drum below the cap
        if (Math.abs(dx) <= r) {
          col = dx < -r * 0.2 ? D[1] : D[2];
          if (Math.abs(dx) > r - 1.2) col = D[3];
          if (turret) {
            // coursed stone banding, so the tower's shaft reads as the same
            // ashlar as the rest of the keep instead of a smooth cylinder
            const inCourse = (by - Math.ceil(domeH)) % 5;
            if (inCourse === 0) col = D[0];
          }
        }
      } else if (Math.abs(dx) <= r + 1) {
        col = by >= blockH - 1 ? D[3] : D[2];   // the base lip
      }
      if (col) P.px(px, py, weather(col, bx, by, 0.10));
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

/** Plaster wall with a timber frame, in shadow under the eaves — or coursed
 *  fortress stone, soot-brick, or a fluted marble colonnade, depending on
 *  what the building actually is. */
function drawWall(P, sample, isDoor, T, self, kind) {
  const WALL = KIND_WALL[kind] ?? T.WALL, BEAM = T.BEAM;
  const trim = KIND_TRIM[kind] ?? T.TRIM;
  const masonry = kind === 'sign_castle' || kind === 'sign_garrison' || kind === 'sign_treasury';
  const brick = kind === 'sign_smithy' || kind === 'sign_guild';
  const colonnade = kind === 'sign_temple';
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
      if (masonry) {
        // coursed ashlar, straight up from the ground with no eaves to
        // shade it — a curtain wall, not a plastered cottage face
        const course = Math.floor(by / 5);
        const inCourse = by % 5;
        const stagger = (course % 2) * 5;
        col = (inCourse === 0) ? WALL[0] : ((bx + stagger) % 10 === 0) ? WALL[2] : WALL[1];
        if (by >= blockH - 3) col = WALL[3];             // foundation course
        if (bx < 3 || bx >= blockW - 3) col = inCourse < 2 ? WALL[0] : WALL[3];  // a squared quoin, not a timber post
      } else if (brick) {
        // a running bond of fired brick — a working smithy or an arcane
        // tower, either way not a plastered wall
        const course = Math.floor(by / 4);
        const inCourse = by % 4;
        const stagger = (course % 2) * 4;
        col = inCourse === 0 ? WALL[3] : ((bx + stagger) % 8 === 0) ? WALL[3] : WALL[1];
        if (by >= blockH - 3) col = WALL[3];
      } else if (colonnade) {
        // fluted marble pilasters at regular intervals, not a plastered
        // wall with a smithy's speckle of relief on it
        const period = 6, within = bx % period;
        col = within < 2 ? WALL[0] : within === 2 ? WALL[3] : WALL[1];
        if (by >= blockH - 3) col = WALL[3];              // a stone plinth underfoot
      } else {
        if (by < 4) col = WALL[3];                       // under the eaves
        else if (by < 6) col = WALL[2];
        else if (by >= blockH - 3) col = WALL[3];        // foundation course
        else if ((by + bx) % 23 === 0) col = WALL[0];    // a little relief
        // corner posts
        if (bx < 3 || bx >= blockW - 3) col = by < 4 ? BEAM[1] : BEAM[0];
      }
      P.px(px, py, weather(col, bx, by, 0.09));
    }
  }

  const sign = isSign(self);
  // The Ford Inn reads as two storeys, not one: a window in the wall row
  // below the sign row too, and a lit floor ledge dividing them — everyone
  // else still gets exactly the one row of windows they always had.
  const twoStorey = kind === 'sign_inn';
  const shopfront = kind === 'sign_store' || kind === 'sign_pedlar';
  const arched = kind === 'sign_temple' || kind === 'sign_guild';
  const hasWindow = !isDoor && !sign && blockH > TS && (twoStorey ? true : (yOff % TS === 0 && up === 0));
  if (hasWindow) {
    if (masonry) {
      // an arrow slit, not a glazed window — a fortress doesn't let a
      // cottage window into a wall built to stop something. The vault gets
      // no window at all: the stone above just keeps going.
      if (kind !== 'sign_treasury') {
        P.rect(10, 5, 4, 17, WALL[3]);
        P.rect(11, 6, 2, 15, '#161719');
        P.rect(9, 10, 6, 2, WALL[3]);                     // the cross-slit
        P.rect(10, 10, 4, 2, '#161719');
      }
    } else if (arched) {
      // a tall pointed-arch window, stained glass instead of a cottage's
      // small square pane — a shrine or an arcane tower, either way
      // something taller than a house
      const glow = kind === 'sign_guild' ? '#8a6cf0' : '#f8d868';
      const glow2 = kind === 'sign_guild' ? '#c8b0ff' : '#fff0b0';
      P.rect(9, 4, 7, 13, BEAM[1]);
      P.rect(10, 6, 5, 11, glow);
      P.rect(10, 6, 5, 3, glow2);
      P.rect(12, 4, 1, 2, BEAM[1]);                       // the arch's peak
      P.rect(11, 3, 3, 1, trim);
    } else if (shopfront) {
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
      if (twoStorey) {
        // shutters — a travellers' inn dresses its windows, a plain cottage doesn't
        P.rect(5, 9, 3, 8, trim);
        P.rect(16, 9, 3, 8, trim);
        P.rect(6, 10, 1, 6, shade(trim, 0.3));
        P.rect(17, 10, 1, 6, shade(trim, 0.3));
      }
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
    } else if (kind === 'sign_castle') {
      // a fortified gate: iron-braced double doors set into a deep stone
      // archway, wide and dark enough to look like the way an army would
      // actually come in — not a cottage door painted a different color
      const top = up === 0 ? 4 : 0;
      P.rect(2, top, TS - 4, TS - top, '#100b06');           // the archway's black recess
      P.rect(3, top + 1, TS - 6, TS - top - 1, '#4a3620');    // iron-bound oak
      for (let gy = top + 2; gy < TS - 2; gy += 4) P.rect(3, gy, TS - 6, 1, '#241c12');
      P.rect(TS / 2 - 1, top + 1, 2, TS - top - 1, '#100b06'); // the seam between the two leaves
      P.rect(6, top + 8, 2, 2, '#c8a848');                     // a ring pull on each leaf
      P.rect(TS - 8, top + 8, 2, 2, '#c8a848');
      if (up === 0) {
        P.rect(2, 0, TS - 4, 2, WALL[0]);                      // the arch's stone lintel
        P.rect(TS / 2 - 2, 2, 4, 3, trim);                     // a small crest above the gate
      }
    } else if (kind === 'sign_treasury') {
      // a vault door: a slab of banded iron with a locking wheel at its
      // center, not a house door with bars nailed across it
      const top = up === 0 ? 6 : 0;
      P.rect(4, top, TS - 8, TS - top, '#3a3226');
      P.rect(5, top + 1, TS - 10, TS - top - 1, '#4e4534');
      const wcx = TS / 2, wcy = top + 9;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        P.px(Math.round(wcx + Math.cos(ang) * 3), Math.round(wcy + Math.sin(ang) * 3), '#c8a848');
      }
      P.rect(wcx - 1, wcy - 1, 2, 2, '#c8a848');               // the wheel's hub
    } else if (kind === 'sign_garrison') {
      // a reinforced door with a small barred viewing slit — a guardhouse,
      // not a home
      const top = up === 0 ? 6 : 0;
      P.rect(6, top, 12, TS - top, '#3a3e44');
      P.rect(7, top + 1, 10, TS - top - 1, shade(trim, -0.2));
      P.rect(10, top + 2, 4, 3, '#161719');
      P.rect(10, top + 2, 4, 1, '#4a4e54');
      P.rect(14, top + 9, 2, 2, '#e8c860');
    } else {
      const top = up === 0 ? 6 : 0;
      P.rect(6, top, 12, TS - top, BEAM[1]);
      P.rect(7, top + 1, 10, TS - top - 1, trim);            // a painted door, the trade's own accent
      P.rect(7, top + 1, 2, TS - top - 1, shade(trim, 0.35));
      P.rect(14, top + 9, 2, 2, '#e8c860');
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
