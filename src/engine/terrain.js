// ============================================================================
//  TERRAIN — outdoor ground and landmasses, drawn across cells rather than
//  inside them.
//
//  The old tiles were self-contained 24x24 stamps, which is what made the world
//  look blocky: a tile could not know what it bordered, so every coastline was a
//  staircase, every mountain range was a row of identical triangles, and a
//  forest was a grid of identical blobs.
//
//  Two ideas fix that, and both depend on working in WORLD space, not tile
//  space:
//
//  1. GROUND is a priority ladder — water < sand < grass < road. A cell fills
//     with its own material, then every higher-priority material around it
//     bleeds in across an irregular boundary. The boundary comes out of a
//     distance field, so an orthogonal neighbour gives a soft edge and a
//     diagonal one gives a rounded corner, with no case analysis at all.
//
//  2. MASSES (mountains, forest) are drawn by every cell they touch, clipped to
//     that cell. A peak therefore rises into the cell above it, and a ridgeline
//     sampled from world x runs unbroken across a whole range.
//
//  Because every texture is a function of world position, nothing repeats: a
//  field of grass is one continuous field, not the same stamp four hundred
//  times.
//
//  This module knows nothing about maps. The caller passes a `sample(dx, dy)`
//  closure returning a neighbour's tile name, plus the cell's world position.
// ============================================================================

import { make, shade } from './pixel.js';

export const TS = 24;

// --- world-space noise -------------------------------------------------------

function hash2(x, y) {
  let n = (x | 0) * 374761393 + (y | 0) * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}

/** Bilinear value noise on a `scale`-pixel grid. Continuous across tile seams. */
function noise(x, y, scale) {
  const gx = Math.floor(x / scale), gy = Math.floor(y / scale);
  const fx = x / scale - gx, fy = y / scale - gy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(gx, gy), b = hash2(gx + 1, gy);
  const c = hash2(gx, gy + 1), d = hash2(gx + 1, gy + 1);
  const top = a + (b - a) * sx, bot = c + (d - c) * sx;
  return top + (bot - top) * sy;
}

// --- ground materials --------------------------------------------------------

/** Which ground a tile stands on. Anything absent here is not auto-tiled. */
const GROUND_OF = {
  grass: 'grass', tree: 'grass', mountain: 'grass', town: 'grass',
  cave: 'grass', flower: 'grass',
  road: 'road', sand: 'sand', water: 'water', bridge: 'water',
};

const PRIORITY = { water: 0, sand: 1, grass: 2, road: 3 };

/** Outdoor tiles get the terrain treatment; interiors keep their own stamps. */
export const isOutdoor = (name) => name !== null && Object.hasOwn(GROUND_OF, name);

/**
 * Each material is a colour as a function of world position. Sampling noise
 * instead of stamping a pattern is what stops a large field from tiling.
 *
 * Two themes, not one: 'green' is the countryside these functions were
 * written for, 'desert' warms and dries every material for fortress and
 * wasteland regions — sage instead of green, ochre instead of grey road, a
 * bleached rather than a wet-look sand. The bleed and distance-field logic
 * above knows nothing of either; only the colour lookup changes.
 */
const MAT_THEMES = {
  green: {
    grass: (wx, wy) => {
      const n = noise(wx, wy, 6.5);
      const clump = noise(wx + 91, wy + 37, 17);
      if (clump > 0.70 && n > 0.45) return '#67a557';
      if (n > 0.63) return '#57904a';
      if (n < 0.30) return '#365f2f';
      if (n < 0.44) return '#3f6b37';
      return '#4a7c40';
    },
    sand: (wx, wy) => {
      const n = noise(wx, wy, 7);
      if (n > 0.68) return '#e8d5a4';
      if (n < 0.33) return '#c4a970';
      return '#d8bf88';
    },
    road: (wx, wy) => {
      const n = noise(wx, wy, 5.5);
      if (n > 0.72) return '#c6ae86';
      if (n < 0.28) return '#8a7452';
      if (n < 0.42) return '#98815d';
      return '#a89066';
    },
    water: (wx, wy) => {
      // a slow swell, with crests where two waves ride up together
      const swell = noise(wx * 0.7, wy * 1.6, 9);
      const fine = noise(wx + 200, wy * 2.2 + 60, 4);
      if (swell + fine * 0.5 > 1.10) return '#6fa2d8';
      if (swell > 0.66) return '#2f5f9c';
      if (swell < 0.32) return '#16315c';
      return '#20477e';
    },
  },
  desert: {
    grass: (wx, wy) => {
      // sparse sage scrub over sun-baked earth, not a lawn
      const n = noise(wx, wy, 6.5);
      const clump = noise(wx + 91, wy + 37, 17);
      if (clump > 0.70 && n > 0.45) return '#8c9a5c';
      if (n > 0.63) return '#7c8a4e';
      if (n < 0.30) return '#8a6f42';
      if (n < 0.44) return '#96794a';
      return '#a2854f';
    },
    sand: (wx, wy) => {
      const n = noise(wx, wy, 7);
      if (n > 0.68) return '#f2dfa8';
      if (n < 0.33) return '#d0aa68';
      return '#e2c384';
    },
    road: (wx, wy) => {
      const n = noise(wx, wy, 5.5);
      if (n > 0.72) return '#d8b888';
      if (n < 0.28) return '#96794a';
      if (n < 0.42) return '#a8875a';
      return '#bc9c68';
    },
    water: (wx, wy) => {
      // the same oasis blue, just less of the map wants to be it
      const swell = noise(wx * 0.7, wy * 1.6, 9);
      const fine = noise(wx + 200, wy * 2.2 + 60, 4);
      if (swell + fine * 0.5 > 1.10) return '#7cb4c4';
      if (swell > 0.66) return '#337c88';
      if (swell < 0.32) return '#1a4550';
      return '#265f6a';
    },
  },
};

/** Sparse detail scattered over a filled material: blades, pebbles, glints. */
function speckle(P, mat, px, py, wx, wy, theme) {
  const h = hash2(wx * 3 + 11, wy * 5 + 7);
  if (mat === 'grass') {
    if (theme === 'desert') {
      if (h > 0.978) P.px(px, py, '#c8b878');       // a dry stalk, not a blade
      else if (h < 0.018) P.px(px, py, '#6a5230');
    } else if (h > 0.972) { P.px(px, py, '#7cbb63'); P.px(px, py - 1, '#8ecb70'); }
    else if (h < 0.022) P.px(px, py, '#2c4e26');
  } else if (mat === 'road') {
    if (h > 0.982) P.px(px, py, theme === 'desert' ? '#ecd8a4' : '#d8c8a8');
    else if (h < 0.014) P.px(px, py, theme === 'desert' ? '#7a5f38' : '#6e5c40');
  } else if (mat === 'sand') {
    if (h > 0.984) P.px(px, py, theme === 'desert' ? '#fbeec0' : '#f2e4bd');
  } else if (mat === 'water') {
    if (h > 0.9958) P.px(px, py, theme === 'desert' ? '#c8e8ec' : '#b8dcff');
  }
}

// --- the bleed ---------------------------------------------------------------

/** Distance from a world point to a cell's square, in pixels. 0 inside it. */
function distToCell(wx, wy, cx0, cy0) {
  const dx = Math.max(cx0 - wx, 0, wx - (cx0 + TS));
  const dy = Math.max(cy0 - wy, 0, wy - (cy0 + TS));
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Ground for one cell: its own material, then every higher-priority material
 * around it bleeding across a noisy boundary. Where land meets water a sand
 * beach is laid slightly proud of the land, so a shore reads as a shore.
 */
export function groundSprite(key, wx0, wy0, sample, theme = 'green') {
  const MAT = MAT_THEMES[theme] ?? MAT_THEMES.green;
  return make(`gnd|${theme}|${key}`, TS, TS, (P) => {
    const own = GROUND_OF[sample(0, 0)] ?? 'grass';

    // which higher-priority materials are around, and where
    const around = new Map();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const name = sample(dx, dy);
        // off-map reads as more of the same, so the border grows no false coast
        const mat = name === null ? own : (GROUND_OF[name] ?? own);
        if (PRIORITY[mat] <= PRIORITY[own]) continue;
        if (!around.has(mat)) around.set(mat, []);
        around.get(mat).push([wx0 + dx * TS, wy0 + dy * TS]);
      }
    }
    const higher = [...around.keys()].sort((a, b) => PRIORITY[a] - PRIORITY[b]);
    const beach = own === 'water' && higher.length > 0;

    for (let py = 0; py < TS; py++) {
      for (let px = 0; px < TS; px++) {
        const wx = wx0 + px, wy = wy0 + py;
        let mat = own;
        // the boundary wobbles a few pixels, continuously across seams
        const depth = 6.4 + (noise(wx, wy, 8) - 0.5) * 7.5
          + (noise(wx + 500, wy + 90, 26) - 0.5) * 7;
        for (const m of higher) {
          let d = Infinity;
          for (const [cx, cy] of around.get(m)) d = Math.min(d, distToCell(wx, wy, cx, cy));
          if (beach && d < depth + 3.6) mat = 'sand';
          if (d < depth) mat = m;
        }
        P.px(px, py, MAT[mat](wx, wy));
        speckle(P, mat, px, py, wx, wy, theme);
      }
    }
  });
}

// --- landmasses --------------------------------------------------------------
//
//  A mass is not "the cells that contain it". It is a signed field: negative
//  inside, positive outside, with the boundary pushed around by world-space
//  noise. Because the field is measured to an INSET square rather than the whole
//  cell, the outline can cut *into* a cell as well as bulge out of it — which is
//  the difference between a mountain and a grey slab the size of its tile.

const PAD = 9;                       // margin sampled past the cell, for probes
const FW = TS + PAD * 2;

//  The three numbers are not free. For two neighbouring cells to join into one
//  mass rather than two lumps, the bridge between their inset squares must stay
//  covered at its narrowest: reach - |wob|max > inset. Break that and a range
//  falls apart into a bead necklace, one bead per tile — which is exactly the
//  blockiness this module exists to remove.
const KIND = {
  mountain: {
    inset: 5,
    reach: 10.5,
    // two octaves, the second sharp, so a range reads as jagged rock
    wob: (wx, wy) => (noise(wx, wy, 13) - 0.5) * 5 + (noise(wx * 1.7 + 40, wy, 4.5) - 0.5) * 3,
  },
  tree: {
    inset: 5,
    reach: 10.5,
    // lumpier and rounder: the scallop of foliage rather than stone
    wob: (wx, wy) => (noise(wx, wy, 9) - 0.5) * 5 + (noise(wx + 88, wy - 30, 3.6) - 0.5) * 3,
  },
};

/** Distance to a cell's square, shrunk by `inset` so the mass can pull inward. */
function distInset(wx, wy, cx0, cy0, inset) {
  const dx = Math.max(cx0 + inset - wx, 0, wx - (cx0 + TS - inset));
  const dy = Math.max(cy0 + inset - wy, 0, wy - (cy0 + TS - inset));
  return Math.sqrt(dx * dx + dy * dy);
}

/** Build the signed field for one kind over this cell plus its margin. */
function massField(kind, wx0, wy0, sample) {
  const { inset, reach, wob } = KIND[kind];
  const cells = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (sample(dx, dy) === kind) cells.push([wx0 + dx * TS, wy0 + dy * TS]);
    }
  }
  if (!cells.length) return null;
  const f = new Float32Array(FW * FW);
  for (let j = 0; j < FW; j++) {
    for (let i = 0; i < FW; i++) {
      const wx = wx0 + i - PAD, wy = wy0 + j - PAD;
      let d = Infinity;
      for (const [cx, cy] of cells) {
        const t = distInset(wx, wy, cx, cy, inset);
        if (t < d) d = t;
      }
      f[j * FW + i] = d - (reach + wob(wx, wy));
    }
  }
  return f;
}

/** Sample the field in cell coordinates; well outside the margin reads as air. */
const fieldAt = (f, x, y) => {
  const i = x + PAD, j = y + PAD;
  if (i < 0 || j < 0 || i >= FW || j >= FW) return 99;
  return f[j * FW + i];
};

const ROCK = ['#a99c86', '#8a7f6d', '#6b6255', '#4e4740', '#332e29'];
const SNOW = ['#f2f4fa', '#d2d8e8'];

/**
 * Rock reads as rock only if it has faces. A mass filled with noise is flat grey
 * paint however good the noise is, so a range is built the way the canopy is:
 * overlapping peaks on a jittered world grid, each with a lit upper-left face, a
 * shadowed right face and a bright crest between them. What makes it a *range*
 * rather than a row of hills is that the grid is in world space, so the peaks
 * never line up with the cells underneath them.
 */
function drawMountain(P, f, wx0, wy0) {
  // the mass itself, and the shadow it throws on the ground below
  for (let py = 0; py < TS; py++) {
    for (let px = 0; px < TS; px++) {
      const d = fieldAt(f, px, py);
      const wx = wx0 + px, wy = wy0 + py;
      if (d >= 0) {
        if (d < 3.4 && fieldAt(f, px, py - 4) < 0) P.px(px, py, 'rgba(20,26,18,0.30)');
        continue;
      }
      const depth = -d;
      const face = fieldAt(f, px, py + 6) >= 0;       // the ground falls away below
      const g = noise(wx, wy, 6);
      let col;
      if (depth < 1.5) col = ROCK[4];                 // outline
      else if (face) {
        // the southern cliff, striated so it reads as a vertical wall
        col = ((wx * 5 + ((hash2(wx, 0) * 3) | 0)) % 7 < 2) ? ROCK[4] : ROCK[3];
      } else col = g > 0.68 ? ROCK[1] : g < 0.32 ? ROCK[3] : ROCK[2];
      P.px(px, py, col);
    }
  }

  // the peaks
  const G = 14;
  for (let gy = Math.floor((wy0 - G * 2) / G); gy <= Math.floor((wy0 + TS + G) / G); gy++) {
    for (let gx = Math.floor((wx0 - G * 2) / G); gx <= Math.floor((wx0 + TS + G) / G); gx++) {
      const bx = Math.round(gx * G + hash2(gx, gy) * G * 0.8) - wx0;
      const by = Math.round(gy * G + hash2(gx + 3, gy + 9) * G * 0.8) - wy0;
      // a wide spread of sizes, so a range has summits rather than cobbles
      const r = 7.5 + hash2(gx + 23, gy + 11) * 6.5;
      const tall = hash2(gx + 5, gy + 31) > 0.55;     // only some carry snow
      if (fieldAt(f, bx, by) > -2) continue;          // only inside the rock
      const R = Math.ceil(r) + 2;
      for (let y = -R; y <= R; y++) {
        for (let x = -R; x <= R; x++) {
          const cx = bx + x, cy = by + y;
          if (cx < 0 || cy < 0 || cx >= TS || cy >= TS) continue;
          if (fieldAt(f, cx, cy) >= -1) continue;
          // taller than wide, apex above the centre: a peak rather than a dome
          const ay = y + r * 0.28;
          const dd = Math.sqrt(x * x * 1.5 + ay * ay * 0.85);
          if (dd > r) continue;
          const up = -(y + r * 0.3) / r;              // 1 at the apex, 0 at the foot
          const side = x / r;                         // <0 lit, >0 in shadow
          let col;
          if (dd > r - 1.2) col = ROCK[4];            // the peak's own edge
          else if (tall && up > 0.52) col = side < 0.1 ? SNOW[0] : SNOW[1];
          else if (Math.abs(side) < 0.13 && up > 0.1) col = ROCK[0];   // the crest
          else if (side < 0) col = up > 0.35 ? ROCK[0] : ROCK[1];
          else col = up > 0.35 ? ROCK[2] : ROCK[3];
          P.px(cx, cy, col);
        }
      }
    }
  }
}

const LEAF = ['#5da24a', '#3d7d35', '#2a5b28', '#1b3f1e', '#122c15'];

/**
 * Canopy as a mass with a scalloped edge, then treetop bumps laid on a jittered
 * WORLD grid. Placing the bumps in world space rather than per cell is what stops
 * a forest reading as a lattice — the texture no longer knows where cells are.
 */
function drawTrees(P, f, wx0, wy0) {
  for (let py = 0; py < TS; py++) {
    for (let px = 0; px < TS; px++) {
      const d = fieldAt(f, px, py);
      const wx = wx0 + px, wy = wy0 + py;
      if (d >= 0) {
        if (d < 3.0 && fieldAt(f, px, py - 4) < 0) P.px(px, py, 'rgba(18,32,16,0.32)');
        continue;
      }
      const depth = -d;
      const n = noise(wx, wy, 5);
      let col;
      if (depth < 1.4) col = LEAF[4];
      else col = n > 0.66 ? LEAF[1] : n < 0.32 ? LEAF[3] : LEAF[2];
      P.px(px, py, col);
    }
  }

  // treetop bumps: a jittered grid in world space, so nothing lines up with cells
  // They overlap generously — spaced 7px but 3.4-5.6 across — so the result is
  // one canopy with crowns in it, not a tray of separate balls.
  const G = 7;
  for (let gy = Math.floor((wy0 - G * 2) / G); gy <= Math.floor((wy0 + TS + G) / G); gy++) {
    for (let gx = Math.floor((wx0 - G * 2) / G); gx <= Math.floor((wx0 + TS + G) / G); gx++) {
      const bx = Math.round(gx * G + hash2(gx, gy) * G * 0.9) - wx0;
      const by = Math.round(gy * G + hash2(gx + 7, gy + 3) * G * 0.9) - wy0;
      const r = 3.4 + hash2(gx + 19, gy + 5) * 2.2;
      if (fieldAt(f, bx, by) > -1.5) continue;        // only inside the canopy
      const R = Math.ceil(r) + 1;
      for (let y = -R; y <= R; y++) {
        for (let x = -R; x <= R; x++) {
          const cx = bx + x, cy = by + y;
          if (cx < 0 || cy < 0 || cx >= TS || cy >= TS) continue;
          if (fieldAt(f, cx, cy) >= -0.8) continue;
          const dd = Math.sqrt(x * x + y * y * 1.15);
          if (dd > r) continue;
          // lit on the upper left, with the underside left dark to separate crowns
          const t = (x + y * 1.25) / (r * 2) + 0.5;
          P.px(cx, cy, t < 0.28 ? LEAF[0] : t < 0.62 ? LEAF[1] : t < 0.88 ? LEAF[2] : LEAF[3]);
        }
      }
    }
  }
}

/** A lone tree still deserves a trunk. */
function drawTrunk(P, sample) {
  if (sample(0, 0) !== 'tree') return;
  const near = (dx, dy) => sample(dx, dy) === 'tree';
  if (near(-1, 0) || near(1, 0) || near(0, -1) || near(0, 1)) return;
  P.rect(11, 17, 3, 6, '#3f2c16');
  P.rect(11, 17, 1, 6, '#5d4020');
  P.rect(10, 22, 5, 1, '#2a1c0d');
}

const MASSES = ['mountain', 'tree'];   // drawn in this order: canopy in front

/**
 * Everything standing on the ground in this cell, including the parts owned by
 * neighbouring cells — which is what lets a peak rise into the sky above it and a
 * canopy close over a cell border.
 */
export function massSprite(key, wx0, wy0, sample) {
  return make(`mass|${key}`, TS, TS, (P) => {
    const rock = massField('mountain', wx0, wy0, sample);
    if (rock) drawMountain(P, rock, wx0, wy0);
    const wood = massField('tree', wx0, wy0, sample);
    if (wood) {
      drawTrunk(P, sample);
      drawTrees(P, wood, wx0, wy0);
    }
  });
}

/** True when a cell carries anything on the mass layer, its own or a neighbour's. */
export function hasMass(sample) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (MASSES.includes(sample(dx, dy))) return true;
    }
  }
  return false;
}
