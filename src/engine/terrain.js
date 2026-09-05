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
  cave: 'grass', flower: 'grass', well: 'grass',
  road: 'road', stall: 'road', lamp: 'road',
  sand: 'sand', water: 'water', bridge: 'water',
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
  // Ashfall / Ashquarry / Cinderreach — a scorched reach that never quite
  // cooled: cinder and clinker instead of soil, embers instead of dew.
  ash: {
    grass: (wx, wy) => {
      const n = noise(wx, wy, 6.5);
      const clump = noise(wx + 91, wy + 37, 17);
      if (clump > 0.72 && n > 0.5) return '#a8482a';         // a bank still glowing underneath
      if (n > 0.63) return '#4a423c';
      if (n < 0.30) return '#221e1b';
      if (n < 0.44) return '#2e2925';
      return '#3a332e';
    },
    sand: (wx, wy) => {
      const n = noise(wx, wy, 7);
      if (n > 0.68) return '#9a8f82';
      if (n < 0.33) return '#5e564e';
      return '#6e6459';
    },
    road: (wx, wy) => {
      const n = noise(wx, wy, 5.5);
      if (n > 0.72) return '#5c534a';
      if (n < 0.28) return '#2a2521';
      if (n < 0.42) return '#342e29';
      return '#443c35';
    },
    water: (wx, wy) => {
      // scorched, still water with an oily ember sheen rather than a swell
      const swell = noise(wx * 0.7, wy * 1.6, 9);
      const fine = noise(wx + 200, wy * 2.2 + 60, 4);
      if (swell + fine * 0.5 > 1.10) return '#7a3a24';
      if (swell > 0.66) return '#4a2418';
      if (swell < 0.32) return '#160a08';
      return '#2c1610';
    },
  },
  // Harrow's Rest / Duskwell — the harvest country past its season, gold
  // gone to rust.
  autumn: {
    grass: (wx, wy) => {
      const n = noise(wx, wy, 6.5);
      const clump = noise(wx + 91, wy + 37, 17);
      if (clump > 0.70 && n > 0.45) return '#c8963c';
      if (n > 0.63) return '#a87830';
      if (n < 0.30) return '#6e4a24';
      if (n < 0.44) return '#805a2a';
      return '#96702e';
    },
    sand: (wx, wy) => {
      const n = noise(wx, wy, 7);
      if (n > 0.68) return '#e0c894';
      if (n < 0.33) return '#b89158';
      return '#ccaa70';
    },
    road: (wx, wy) => {
      const n = noise(wx, wy, 5.5);
      if (n > 0.72) return '#a8815a';
      if (n < 0.28) return '#6a4c2e';
      if (n < 0.42) return '#7a5a36';
      return '#8c6a40';
    },
    water: (wx, wy) => {
      const swell = noise(wx * 0.7, wy * 1.6, 9);
      const fine = noise(wx + 200, wy * 2.2 + 60, 4);
      if (swell + fine * 0.5 > 1.10) return '#8a7048';
      if (swell > 0.66) return '#4a3a24';
      if (swell < 0.32) return '#241c10';
      return '#362a18';
    },
  },
  // Glasshaven / Glassfields — sand and water both gone to fused, pale glass.
  crystal: {
    grass: (wx, wy) => {
      const n = noise(wx, wy, 6.5);
      const clump = noise(wx + 91, wy + 37, 17);
      if (clump > 0.70 && n > 0.45) return '#d8d0ec';
      if (n > 0.63) return '#b8b0d4';
      if (n < 0.30) return '#7c7498';
      if (n < 0.44) return '#8c84ac';
      return '#a09cc0';
    },
    sand: (wx, wy) => {
      const n = noise(wx, wy, 7);
      if (n > 0.68) return '#f4f0fa';
      if (n < 0.33) return '#c8c0dc';
      return '#e0dcf0';
    },
    road: (wx, wy) => {
      const n = noise(wx, wy, 5.5);
      if (n > 0.72) return '#c4bcd8';
      if (n < 0.28) return '#8880a0';
      if (n < 0.42) return '#9890b0';
      return '#aca4c4';
    },
    water: (wx, wy) => {
      // glassy and still — a bright crest instead of a rolling swell
      const swell = noise(wx * 0.7, wy * 1.6, 9);
      const fine = noise(wx + 200, wy * 2.2 + 60, 4);
      if (swell + fine * 0.5 > 1.10) return '#e8f4ff';
      if (swell > 0.66) return '#9cd0ec';
      if (swell < 0.32) return '#5088b0';
      return '#78b0d4';
    },
  },
  // Tidewatch / the Drowned Vale — brackish, half-drowned lowland.
  swamp: {
    grass: (wx, wy) => {
      const n = noise(wx, wy, 6.5);
      const clump = noise(wx + 91, wy + 37, 17);
      if (clump > 0.70 && n > 0.45) return '#5c6e3c';
      if (n > 0.63) return '#4a5c30';
      if (n < 0.30) return '#241e14';
      if (n < 0.44) return '#332a1c';
      return '#3e4a28';
    },
    sand: (wx, wy) => {
      const n = noise(wx, wy, 7);
      if (n > 0.68) return '#7a6c48';
      if (n < 0.33) return '#4a4030';
      return '#5e523a';
    },
    road: (wx, wy) => {
      const n = noise(wx, wy, 5.5);
      if (n > 0.72) return '#5a5038';
      if (n < 0.28) return '#302a1e';
      if (n < 0.42) return '#3a3324';
      return '#463c2a';
    },
    water: (wx, wy) => {
      const swell = noise(wx * 0.7, wy * 1.6, 9);
      const fine = noise(wx + 200, wy * 2.2 + 60, 4);
      if (swell + fine * 0.5 > 1.10) return '#4a5c3a';
      if (swell > 0.66) return '#243420';
      if (swell < 0.32) return '#0e140c';
      return '#182410';
    },
  },
};

// Per-theme detail colours: a bright and a dark fleck for grass and road,
// one bright glint each for sand and water. `grassTall` draws the bright
// grass fleck as a two-pixel blade (a lawn) rather than one dry mote (scrub,
// cinder, scale, muck) — the same distinction the old desert-only branch drew.
const SPECK = {
  green:   { grass: ['#7cbb63', '#2c4e26'], grassTall: true,  road: ['#d8c8a8', '#6e5c40'], sand: '#f2e4bd', water: '#b8dcff' },
  desert:  { grass: ['#c8b878', '#6a5230'], grassTall: false, road: ['#ecd8a4', '#7a5f38'], sand: '#fbeec0', water: '#c8e8ec' },
  ash:     { grass: ['#e8783c', '#120e0c'], grassTall: false, road: ['#847666', '#1c1815'], sand: '#b0a696', water: '#c86a34' },
  autumn:  { grass: ['#e8c05c', '#4a3016'], grassTall: true,  road: ['#c8a878', '#4a3620'], sand: '#f0dcac', water: '#c8a860' },
  crystal: { grass: ['#f8f4ff', '#6c6488'], grassTall: false, road: ['#f0ecff', '#8078a0'], sand: '#ffffff', water: '#ffffff' },
  swamp:   { grass: ['#7a8c4a', '#0c0e08'], grassTall: false, road: ['#6a6048', '#1a1610'], sand: '#8a7c54', water: '#5a6c3e' },
};

/** Sparse detail scattered over a filled material: blades, pebbles, glints. */
function speckle(P, mat, px, py, wx, wy, theme) {
  const h = hash2(wx * 3 + 11, wy * 5 + 7);
  const s = SPECK[theme] ?? SPECK.green;
  if (mat === 'grass') {
    const [hi, lo] = s.grass;
    if (h > 0.972) { P.px(px, py, hi); if (s.grassTall) P.px(px, py - 1, hi); }
    else if (h < 0.022) P.px(px, py, lo);
  } else if (mat === 'road') {
    const [hi, lo] = s.road;
    if (h > 0.982) P.px(px, py, hi);
    else if (h < 0.014) P.px(px, py, lo);
  } else if (mat === 'sand') {
    if (h > 0.984) P.px(px, py, s.sand);
  } else if (mat === 'water') {
    if (h > 0.9958) P.px(px, py, s.water);
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

// Per-theme rock + crest palettes. `crest` is the tall-peak highlight — snow
// in green country, sun-bleach on sandstone, an ember seam on a volcanic
// range, raw facets on crystal, a lichen crust in the swamp — so the same
// jittered-peak silhouette in drawMountain reads as a genuinely different
// range per region rather than the same grey stamp recoloured once.
const ROCK_THEMES = {
  green:   { rock: ['#a99c86', '#8a7f6d', '#6b6255', '#4e4740', '#332e29'], crest: ['#f2f4fa', '#d2d8e8'] },
  desert:  { rock: ['#c9a97e', '#ab8862', '#87694a', '#654e38', '#42311f'], crest: ['#f0dca8', '#d8bc80'] },
  ash:     { rock: ['#5a4a42', '#403430', '#2c2320', '#1c1614', '#0e0a08'], crest: ['#f0803c', '#b8481c'] },
  autumn:  { rock: ['#ab9878', '#8c7c5e', '#6e6048', '#524634', '#362d21'], crest: ['#f2f4fa', '#d2d8e8'] },
  crystal: { rock: ['#dcd4f0', '#bcb0dc', '#9c90c0', '#786ca0', '#584e7c'], crest: ['#ffffff', '#d8e8ff'] },
  swamp:   { rock: ['#767a5e', '#5c6048', '#454838', '#302f26', '#1c1c16'], crest: ['#a8b878', '#8a9c5e'] },
};
// Per-theme canopy palette, brightest crown to deepest shadow.
const LEAF_THEMES = {
  green:   ['#5da24a', '#3d7d35', '#2a5b28', '#1b3f1e', '#122c15'],
  desert:  ['#9aa05c', '#7c8248', '#5e6438', '#404428', '#282a18'],
  ash:     ['#8a5040', '#5c3428', '#3a2018', '#22120c', '#100806'],
  autumn:  ['#e8a83c', '#c87a28', '#a85a20', '#7a3c18', '#4a2410'],
  crystal: ['#e8e4ff', '#c8c0ec', '#a89cd8', '#8078b8', '#5c5490'],
  swamp:   ['#5c6e3c', '#3e4a28', '#2a3218', '#1a2010', '#0e1408'],
};

/**
 * Rock reads as rock only if it has faces. A mass filled with noise is flat grey
 * paint however good the noise is, so a range is built the way the canopy is:
 * overlapping peaks on a jittered world grid, each with a lit upper-left face, a
 * shadowed right face and a bright crest between them. What makes it a *range*
 * rather than a row of hills is that the grid is in world space, so the peaks
 * never line up with the cells underneath them.
 */
function drawMountain(P, f, wx0, wy0, theme = 'green') {
  const { rock: ROCK, crest: SNOW } = ROCK_THEMES[theme] ?? ROCK_THEMES.green;
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
      const tall = hash2(gx + 5, gy + 31) > 0.55;     // only some carry a crest
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

/**
 * Canopy as a mass with a scalloped edge, then treetop bumps laid on a jittered
 * WORLD grid. Placing the bumps in world space rather than per cell is what stops
 * a forest reading as a lattice — the texture no longer knows where cells are.
 */
function drawTrees(P, f, wx0, wy0, theme = 'green') {
  const LEAF = LEAF_THEMES[theme] ?? LEAF_THEMES.green;
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

const TRUNK_THEMES = {
  green: ['#3f2c16', '#5d4020', '#2a1c0d'],
  desert: ['#4a3420', '#6a4c2c', '#302012'],
  ash: ['#1a1210', '#302420', '#0c0806'],
  autumn: ['#4a3420', '#6a4c2c', '#302012'],
  crystal: ['#8078a0', '#a89cd8', '#5c5490'],
  swamp: ['#2a2818', '#403c24', '#181608'],
};

/** A lone tree still deserves a trunk. */
function drawTrunk(P, sample, theme = 'green') {
  if (sample(0, 0) !== 'tree') return;
  const near = (dx, dy) => sample(dx, dy) === 'tree';
  if (near(-1, 0) || near(1, 0) || near(0, -1) || near(0, 1)) return;
  const [dark, mid, shadow] = TRUNK_THEMES[theme] ?? TRUNK_THEMES.green;
  P.rect(11, 17, 3, 6, dark);
  P.rect(11, 17, 1, 6, mid);
  P.rect(10, 22, 5, 1, shadow);
}

const MASSES = ['mountain', 'tree'];   // drawn in this order: canopy in front

/**
 * Everything standing on the ground in this cell, including the parts owned by
 * neighbouring cells — which is what lets a peak rise into the sky above it and a
 * canopy close over a cell border.
 */
export function massSprite(key, wx0, wy0, sample, theme = 'green') {
  return make(`mass|${theme}|${key}`, TS, TS, (P) => {
    const rock = massField('mountain', wx0, wy0, sample);
    if (rock) drawMountain(P, rock, wx0, wy0, theme);
    const wood = massField('tree', wx0, wy0, sample);
    if (wood) {
      drawTrunk(P, sample, theme);
      drawTrees(P, wood, wx0, wy0, theme);
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
