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

import { make, shade, paintSoftened } from './pixel.js';

export const TS = 24;

// --- world-space noise -------------------------------------------------------

function hash2(x, y) {
  // Both shifts must be unsigned (>>>): x ^ (x >> k) with a *signed* shift
  // always replicates x's own sign bit into the shifted copy, so the XOR
  // cancels bit 31 to 0 no matter what x is — this hash could never
  // produce a value >= 0.5, silently making every "n > 0.6"-ish threshold
  // downstream (bright grass, sand and road flecks, water crests, the top
  // rock/canopy tiers) unreachable across every biome theme.
  let n = (x | 0) * 374761393 + (y | 0) * 668265263;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
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

/** A fine, high-frequency brightness wobble layered under every material's
 *  own colour bands — the bands give a tile its broad shape (clumps, waves,
 *  embers), this gives every pixel inside them a little grain, the
 *  difference between a flat colour fill and something that reads as a
 *  material. Independent of the coordinates any material's own noise()
 *  calls use, so it never lines up with — and double-thickens — a band edge.
 */
function grain(wx, wy) {
  return (noise(wx * 3.1 + 4000, wy * 3.1 - 4000, 2.3) - 0.5) * 2;
}

/** A slow, broad brightness swell spanning many tiles — sun and cloud-shadow
 *  moving across a whole field, not a per-pixel material property. grain()
 *  above only reads up close; this is what keeps a field from looking like
 *  one uniform tone from normal play distance, the way a real meadow has
 *  lit and shaded stretches long before you can see individual blades.
 */
function patch(wx, wy) {
  return (noise(wx - 7000, wy + 7000, 110) - 0.5) * 2;
}

// --- ground materials --------------------------------------------------------

/** Which ground a tile stands on. Anything absent here is not auto-tiled. */
const GROUND_OF = {
  grass: 'grass', tree: 'grass', mountain: 'grass', town: 'grass',
  cave: 'grass', flower: 'grass', well: 'grass', bench: 'grass', signpost: 'grass',
  boulder: 'grass', stump: 'grass', haybale: 'grass',
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
    // Muted ~32% off these materials' original saturation (see git history
    // for the brighter version) — real grass, clay and dirt read as duller,
    // greyer versions of their hue than a game palette defaults to; the hue
    // and lightness bands (what actually gives the ground its shape) are
    // untouched, only how vivid each band is.
    grass: (wx, wy) => {
      // Wider than the other materials' bands (9.5 vs ~6.5-7) — grass is
      // the one material covering most of the screen at once, so the same
      // band scale that reads as fine gravel/wave texture on sand or water
      // reads as a staticky, camouflage-like mottle here. Broader bands
      // mean each patch of light or shade spans several pixels, the way an
      // actual meadow's sun/shade sweeps do, rather than flickering pixel
      // to pixel.
      const n = noise(wx, wy, 15);
      const clump = noise(wx + 91, wy + 37, 22);
      if (clump > 0.70 && n > 0.45) return '#6e9963';
      if (n > 0.63) return '#5e8555';
      if (n < 0.30) return '#3b5737';
      if (n < 0.44) return '#45633f';
      return '#50724a';
    },
    sand: (wx, wy) => {
      const n = noise(wx, wy, 7);
      if (n > 0.68) return '#ddd0af';
      if (n < 0.33) return '#b7a47d';
      return '#cbba95';
    },
    road: (wx, wy) => {
      const n = noise(wx, wy, 5.5);
      if (n > 0.72) return '#bcab90';
      if (n < 0.28) return '#81725b';
      if (n < 0.42) return '#8f7f66';
      return '#9d8d71';
    },
    water: (wx, wy) => {
      // a slow swell, with crests where two waves ride up together
      const swell = noise(wx * 0.7, wy * 1.6, 9);
      const fine = noise(wx + 200, wy * 2.2 + 60, 4);
      if (swell + fine * 0.5 > 1.10) return '#80a2c7';
      if (swell > 0.66) return '#40618b';
      if (swell < 0.32) return '#213451';
      return '#2f4a6f';
    },
  },
  desert: {
    // Muted the same ~32% as 'green' above, for the same reason.
    grass: (wx, wy) => {
      // sparse sage scrub over sun-baked earth, not a lawn — wider bands
      // than the 6.5-ish scale sand/road/water use, same reason as 'green'
      // (see its comment): fine bands across a screen-filling material read
      // as static rather than texture.
      const n = noise(wx, wy, 15);
      const clump = noise(wx + 91, wy + 37, 22);
      if (clump > 0.70 && n > 0.45) return '#879066';
      if (n > 0.63) return '#778058';
      if (n < 0.30) return '#7e6c4e';
      if (n < 0.44) return '#8a7656';
      return '#95815c';
    },
    sand: (wx, wy) => {
      const n = noise(wx, wy, 7);
      if (n > 0.68) return '#e6d9b4';
      if (n < 0.33) return '#bfa679';
      return '#d3be93';
    },
    road: (wx, wy) => {
      const n = noise(wx, wy, 5.5);
      if (n > 0.72) return '#cbb595';
      if (n < 0.28) return '#8a7656';
      if (n < 0.42) return '#9c8566';
      return '#af9975';
    },
    water: (wx, wy) => {
      // the same oasis blue, just less of the map wants to be it
      const swell = noise(wx * 0.7, wy * 1.6, 9);
      const fine = noise(wx + 200, wy * 2.2 + 60, 4);
      if (swell + fine * 0.5 > 1.10) return '#88aeb8';
      if (swell > 0.66) return '#41727a';
      if (swell < 0.32) return '#234047';
      return '#31585f';
    },
  },
  // Ashfall / Ashquarry / Cinderreach — a scorched reach that never quite
  // cooled: cinder and clinker instead of soil, embers instead of dew.
  ash: {
    grass: (wx, wy) => {
      const n = noise(wx, wy, 15);
      const clump = noise(wx + 91, wy + 37, 22);
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
      const n = noise(wx, wy, 15);
      const clump = noise(wx + 91, wy + 37, 22);
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
      const n = noise(wx, wy, 15);
      const clump = noise(wx + 91, wy + 37, 22);
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
      const n = noise(wx, wy, 15);
      const clump = noise(wx + 91, wy + 37, 22);
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
// grass fleck as a small leaning blade tuft (a lawn) rather than one dry mote
// (scrub, cinder, scale, muck) — the same distinction the old desert-only
// branch drew. `flowers`, where present, sprinkles rare single-pixel petals
// into grassTall meadows on top of the blades — wildflowers, not scrub or
// ash, so only the countryside theme earns them.
const SPECK = {
  green:   { grass: ['#82ad71', '#30482c'], grassTall: true,  flowers: ['#fdf6d8', '#f0b44c', '#f2a0bc'], road: ['#d0c5b0', '#675a47'], sand: '#eae0c5', water: '#c3dcf4' },
  desert:  { grass: ['#bbb085', '#615039'], grassTall: false, road: ['#e0d3b0', '#6f5d43'], sand: '#f2e9c9', water: '#cee4e6' },
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
    if (s.grassTall) {
      // Tufts cluster into little tussocks via a coarse noise field rather
      // than firing at one flat per-pixel rate — a real lawn is lusher in
      // some stretches and closer-cropped in the gaps between. That uneven
      // clumping (not just the blade shape itself) is what reads as an
      // actual meadow instead of an even fleck-speckled fill.
      const tuft = noise(wx * 0.45 + 300, wy * 0.45 - 300, 7.5);
      const hiT = 0.975 - Math.max(0, tuft - 0.55) * 0.30;
      if (h > hiT) {
        // A small leaning tuft — the main blade plus a shorter companion
        // that leans left or right, picked from the same hash so a given
        // world pixel always leans the same way — reads as a clump of
        // grass rather than the dead-straight single blade this used to be.
        P.px(px, py, hi);
        P.px(px, py - 1, hi);
        const lean = hash2(wx * 7 + 3, wy * 11 + 5) > 0.5 ? 1 : -1;
        P.px(px + lean, py - 1, hi);
        // In the lushest tussocks a third blade breaks the tuft's silhouette
        // so a dense patch reads as several overlapping blades instead of
        // one shape stamped wall-to-wall.
        if (tuft > 0.72 && hash2(wx * 17 + 2, wy * 23 + 9) > 0.6) P.px(px - lean, py - 2, hi);
      } else if (h < 0.032) {
        P.px(px, py, lo);
      }
    } else if (h > 0.960) {
      P.px(px, py, hi);
    } else if (h < 0.032) {
      P.px(px, py, lo);
    }
    if (s.flowers) {
      // Flowers cluster the same way: gated by an even broader noise field
      // so a whole little patch of meadow gets wildflowers together,
      // instead of single petals haze-scattered evenly across the entire
      // field, which read as digital noise rather than rare blooms.
      const meadow = noise(wx * 0.12 + 900, wy * 0.12 - 900, 9);
      if (meadow > 0.62) {
        const hf = hash2(wx * 13 + 29, wy * 17 + 41);
        if (hf > 0.985) P.px(px, py, s.flowers[Math.floor(hf * 997) % s.flowers.length]);
      }
    }
  } else if (mat === 'road') {
    const [hi, lo] = s.road;
    if (h > 0.972) P.px(px, py, hi);
    else if (h < 0.020) P.px(px, py, lo);
  } else if (mat === 'sand') {
    if (h > 0.978) P.px(px, py, s.sand);
  } else if (mat === 'water') {
    if (h > 0.994) P.px(px, py, s.water);
  }
}

// --- the bleed ---------------------------------------------------------------

/** Distance from a world point to a cell's square, in pixels. 0 inside it. */
function distToCell(wx, wy, cx0, cy0) {
  const dx = Math.max(cx0 - wx, 0, wx - (cx0 + TS));
  const dy = Math.max(cy0 - wy, 0, wy - (cy0 + TS));
  return Math.sqrt(dx * dx + dy * dy);
}

/** The unblurred ground for exactly one cell — cached under its own absolute
 *  position so a neighbouring cell's softened pass can reuse it instead of
 *  recomputing the same colour math (see paintSoftened in pixel.js). */
function groundSpriteRaw(mapId, x, y, sample, theme) {
  const MAT = MAT_THEMES[theme] ?? MAT_THEMES.green;
  const wx0 = x * TS, wy0 = y * TS;
  return make(`gndraw|${theme}|${mapId}|${x}|${y}`, TS, TS, (P) => {
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
        // Grass skips the fine per-pixel grain entirely: the same
        // near-pixel-scale jitter that reads as coarse gravel or a wave
        // ripple on sand/road/water just compounds with grass's own colour
        // bands and blade speckle into a staticky mottle that reads as
        // camouflage rather than a lawn. The broad patch() swell (many
        // pixels wide) still gives it sun/shade variation at a scale that
        // doesn't fight the band and blade shapes.
        const light = (mat === 'grass' ? 0 : grain(wx, wy) * 0.10) + patch(wx, wy) * 0.16;
        P.px(px, py, shade(MAT[mat](wx, wy), light));
        speckle(P, mat, px, py, wx, wy, theme);
      }
    }
  });
}

/**
 * Ground for one cell: its own material, then every higher-priority material
 * around it bleeding across a noisy boundary. Where land meets water a sand
 * beach is laid slightly proud of the land, so a shore reads as a shore.
 *
 * `key` is `${mapId}|${x}|${y}` (see field.js's renderWorldTexture) — parsed
 * back apart so a neighbour's raw tile can be looked up by its own absolute
 * cell, not derived from this tile's key relative to it.
 */
export function groundSprite(key, sample, theme = 'green') {
  const [mapId, cxs, cys] = key.split('|');
  const cx = Number(cxs), cy = Number(cys);
  return make(`gnd|${theme}|${key}`, TS, TS, (P) => {
    softened(P, sample, (dx, dy, nSample) =>
      groundSpriteRaw(mapId, cx + dx, cy + dy, nSample, theme));
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
        if (d < 3.4 && fieldAt(f, px, py - 4) < 0) P.px(px, py, 'rgba(20,26,18,0.20)');
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
      } else col = g > 0.74 ? ROCK[0] : g > 0.58 ? ROCK[1] : g < 0.16 ? ROCK[4] : g < 0.34 ? ROCK[3] : ROCK[2];
      P.px(px, py, col);
    }
  }

  // the peaks
  const G = 16;
  for (let gy = Math.floor((wy0 - G * 2) / G); gy <= Math.floor((wy0 + TS + G) / G); gy++) {
    for (let gx = Math.floor((wx0 - G * 2) / G); gx <= Math.floor((wx0 + TS + G) / G); gx++) {
      const bx = Math.round(gx * G + hash2(gx, gy) * G * 0.8) - wx0;
      const by = Math.round(gy * G + hash2(gx + 3, gy + 9) * G * 0.8) - wy0;
      // squared, not linear: mostly foothills with a few real summits towering
      // over them, rather than the near-uniform cobblestones a flat 7.5-14
      // spread produced regardless of how wide that spread looked on paper.
      const rr = hash2(gx + 23, gy + 11);
      const r = 6 + rr * rr * 15;
      const tall = hash2(gx + 5, gy + 31) > 0.84;     // rare, so a snowcap means something
      if (fieldAt(f, bx, by) > -2) continue;          // only inside the rock
      const R = Math.ceil(r) + 2;
      for (let y = -R; y <= R; y++) {
        for (let x = -R; x <= R; x++) {
          const cx = bx + x, cy = by + y;
          if (cx < 0 || cy < 0 || cx >= TS || cy >= TS) continue;
          if (fieldAt(f, cx, cy) >= -1) continue;
          // A cone, not an ellipse: width tapers straight from the base to a
          // point at the apex — the silhouette that actually reads as a
          // mountain, where the old squared distance field only ever
          // produced a smooth dome (a boulder, not a peak) however the
          // shading inside it was tuned. jag roughens the taper into broken
          // scree instead of a drafting-compass triangle.
          const up = -(y + r * 0.3) / r;              // 1 at the apex, 0 at the foot
          if (up < -0.18 || up > 1.15) continue;
          const jag = (noise((wx0 + cx) * 0.6, (wy0 + cy) * 0.6, 3.2) - 0.5) * r * 0.45;
          const halfW = r * Math.max(0.02, 1 - up * 0.88) + jag;
          if (Math.abs(x) > halfW) continue;
          const side = x / Math.max(1, halfW);        // <0 lit, >0 in shadow
          const edge = halfW - Math.abs(x);
          let col;
          if (edge < 1.2 || up > 1.02) col = ROCK[4]; // the peak's own edge
          else if (tall && up > 0.62) col = side < 0.1 ? SNOW[0] : SNOW[1];
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
        if (d < 3.0 && fieldAt(f, px, py - 4) < 0) P.px(px, py, 'rgba(18,32,16,0.20)');
        continue;
      }
      const depth = -d;
      const n = noise(wx, wy, 5);
      let col;
      if (depth < 1.4) col = LEAF[4];
      else col = n > 0.72 ? LEAF[0] : n > 0.58 ? LEAF[1] : n < 0.14 ? LEAF[4] : n < 0.3 ? LEAF[3] : LEAF[2];
      P.px(px, py, col);
    }
  }

  // treetop bumps: a jittered grid in world space, so nothing lines up with cells.
  // They overlap generously — spaced 7px but wider than that across — so the
  // result is one canopy with crowns in it, not a tray of separate balls.
  const G = 7;
  for (let gy = Math.floor((wy0 - G * 2) / G); gy <= Math.floor((wy0 + TS + G) / G); gy++) {
    for (let gx = Math.floor((wx0 - G * 2) / G); gx <= Math.floor((wx0 + TS + G) / G); gx++) {
      const bx = Math.round(gx * G + hash2(gx, gy) * G * 0.9) - wx0;
      const by = Math.round(gy * G + hash2(gx + 7, gy + 3) * G * 0.9) - wy0;
      // squared, not linear: mostly modest crowns with occasional big canopy
      // trees standing over them — an even 3.4-5.6 spread read as one size
      // of tree repeated, however much the shading inside it varied.
      const rr = hash2(gx + 19, gy + 5);
      const r = 2.6 + rr * rr * 5.5;
      // A conifer among the broadleaves: a narrow cone jutting up rather than
      // another round crown, so a forest reads as mixed woodland instead of
      // one tree's silhouette stamped at different sizes.
      const conifer = hash2(gx + 41, gy + 13) > 0.8;
      if (fieldAt(f, bx, by) > -1.5) continue;        // only inside the canopy
      const R = Math.ceil(r) + 1;
      for (let y = -R; y <= R; y++) {
        for (let x = -R; x <= R; x++) {
          const cx = bx + x, cy = by + y;
          if (cx < 0 || cy < 0 || cx >= TS || cy >= TS) continue;
          if (fieldAt(f, cx, cy) >= -0.8) continue;
          let up = 0;
          if (conifer) {
            // Taller and narrower than a broadleaf crown ever gets, so it
            // pokes above the treeline instead of reading as one more round
            // bump — the actual point of drawing a different silhouette.
            up = -(y + r * 0.55) / r;
            if (up < -0.05 || up > 1.3) continue;
            if (Math.abs(x) > r * 0.5 * Math.max(0.04, 1 - up * 0.85)) continue;
          } else {
            const dd = Math.sqrt(x * x + y * y * 1.15);
            if (dd > r) continue;
          }
          // lit on the upper left, with the underside left dark to separate crowns
          const t = (x + y * 1.25) / (r * 2) + 0.5;
          const col = conifer && up > 1.08 ? LEAF[0]  // a bright needle-tip catching the light
            : t < 0.28 ? LEAF[0] : t < 0.62 ? LEAF[1] : t < 0.88 ? LEAF[2] : LEAF[3];
          P.px(cx, cy, col);
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

const softened = (P, sample, rawTile, opts) => paintSoftened(TS, P, sample, rawTile, opts);

/** The unblurred mass content for exactly one cell — cached under its own
 *  absolute position for the same reason groundSpriteRaw is (see there). */
function massSpriteRaw(mapId, x, y, sample, theme) {
  const wx0 = x * TS, wy0 = y * TS;
  return make(`massraw|${theme}|${mapId}|${x}|${y}`, TS, TS, (P) => {
    const rock = massField('mountain', wx0, wy0, sample);
    if (rock) drawMountain(P, rock, wx0, wy0, theme);
    const wood = massField('tree', wx0, wy0, sample);
    if (wood) {
      drawTrunk(P, sample, theme);
      drawTrees(P, wood, wx0, wy0, theme);
    }
  });
}

/**
 * Everything standing on the ground in this cell, including the parts owned by
 * neighbouring cells — which is what lets a peak rise into the sky above it and a
 * canopy close over a cell border.
 */
export function massSprite(key, sample, theme = 'green') {
  const [mapId, cxs, cys] = key.split('|');
  const cx = Number(cxs), cy = Number(cys);
  return make(`mass|${theme}|${key}`, TS, TS, (P) => {
    softened(P, sample, (dx, dy, nSample) =>
      massSpriteRaw(mapId, cx + dx, cy + dy, nSample, theme));
  }, { outline: 'rgba(18,14,10,0.55)' });
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
