// ============================================================================
//  PIXEL — the shared low-level drawing kit every generated sprite uses.
//
//  Art is still authored as pixels on a grid; what makes it read as modern is
//  what happens on top: a traced outline, a three-tone ramp per material, an
//  ambient-occlusion pass where forms meet, and a rim light along the lit edge.
// ============================================================================

const cache = new Map();

// 4x4 ordered (Bayer) matrix, for blending two tones without a third colour
const BAYER = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
];

export function shade(hex, amt) {
  if (!hex || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = f(((n >> 16) & 255) * (1 + amt));
  const g = f(((n >> 8) & 255) * (1 + amt));
  const b = f((n & 255) * (1 + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const f = (sa, sb) => Math.round(sa + (sb - sa) * t);
  const r = f((pa >> 16) & 255, (pb >> 16) & 255);
  const g = f((pa >> 8) & 255, (pb >> 8) & 255);
  const bl = f(pa & 255, pb & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/**
 * Build (and cache) a sprite canvas.
 * opts.outline  trace a keyline of this colour around the silhouette
 * opts.ao       darken opaque pixels that sit under other opaque pixels
 * opts.rim      add a light edge along the given side ('tl' by default)
 */
export function make(key, w, h, draw, opts = {}) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w));
  cv.height = Math.max(1, Math.round(h));
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  draw(painter(c), c);
  if (opts.ao) ambientOcclusion(c, cv.width, cv.height, opts.ao);
  if (opts.rim) rimLight(c, cv.width, cv.height, opts.rim, opts.rimAlpha ?? 0.5);
  if (opts.outline) addOutline(c, cv.width, cv.height, opts.outline);
  cache.set(key, cv);
  return cv;
}

export function clearCache() { cache.clear(); }

export function painter(c) {
  return {
    ctx: c,
    px: (x, y, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); },
    rect: (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, Math.max(0, w | 0), Math.max(0, h | 0)); },
    /** mirrored around a vertical axis at `ax` */
    mrect: (ax, x, y, w, h, col) => {
      c.fillStyle = col;
      c.fillRect((ax + x) | 0, y | 0, w | 0, h | 0);
      c.fillRect((ax - x - w) | 0, y | 0, w | 0, h | 0);
    },
    ellipse: (cx, cy, rx, ry, col) => {
      if (rx <= 0 || ry <= 0) return;
      c.fillStyle = col;
      for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
        const t = 1 - (y * y) / (ry * ry);
        if (t < 0) continue;
        const dx = Math.floor(rx * Math.sqrt(t));
        c.fillRect((cx - dx) | 0, (cy + y) | 0, dx * 2 + 1, 1);
      }
    },
    tri: (x, y, w, h, col, dir = 1) => {
      c.fillStyle = col;
      for (let i = 0; i < h; i++) {
        const t = i / h;
        const ww = Math.round(w * (dir > 0 ? 1 - t : t));
        c.fillRect((x + (w - ww) / 2) | 0, (y + i) | 0, Math.max(1, ww), 1);
      }
    },
    /** a tapered limb or tail from (x0,y0) to (x1,y1) */
    taper: (x0, y0, x1, y1, r0, r1, col, steps = 12) => {
      c.fillStyle = col;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const r = r0 + (r1 - r0) * t;
        c.fillRect(Math.round(x - r), Math.round(y - r), Math.max(1, Math.round(r * 2)), Math.max(1, Math.round(r * 2)));
      }
    },
    dither: (x, y, w, h, col, density) => {
      c.fillStyle = col;
      const t = Math.round(density * 16);
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const px = (x + i) | 0, py = (y + j) | 0;
          if (BAYER[py & 3][px & 3] < t) c.fillRect(px, py, 1, 1);
        }
      }
    },
    speck: (pts, col) => { c.fillStyle = col; for (const [x, y] of pts) c.fillRect(x, y, 1, 1); },
  };
}

/** Trace a one-pixel keyline around everything opaque. */
export function addOutline(c, w, h, color) {
  const img = c.getImageData(0, 0, w, h);
  const a = img.data;
  const solid = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? false : a[(y * w + x) * 4 + 3] > 8;
  const edge = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) edge.push([x, y]);
    }
  }
  c.fillStyle = color;
  for (const [x, y] of edge) c.fillRect(x, y, 1, 1);
}

/**
 * Cheap ambient occlusion: darken opaque pixels that have opaque neighbours
 * above them, so overlapping forms separate instead of flattening together.
 */
export function ambientOcclusion(c, w, h, strength = 0.28) {
  const img = c.getImageData(0, 0, w, h);
  const a = img.data;
  const out = new Uint8ClampedArray(a);
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : a[(y * w + x) * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (a[i + 3] < 8) continue;
      // how enclosed is this pixel from above and the sides?
      let occ = 0;
      if (alphaAt(x, y - 1) > 8) occ += 1;
      if (alphaAt(x, y - 2) > 8) occ += 0.6;
      if (alphaAt(x - 1, y) > 8 && alphaAt(x + 1, y) > 8) occ += 0.4;
      if (occ <= 0) continue;
      const k = 1 - Math.min(1, occ / 2.6) * strength;
      out[i] = a[i] * k; out[i + 1] = a[i + 1] * k; out[i + 2] = a[i + 2] * k;
    }
  }
  c.putImageData(new ImageData(out, w, h), 0, 0);
}

/** Brighten the edge facing the light — the highlight HD-2D sprites live on. */
export function rimLight(c, w, h, color, alpha = 0.5) {
  const img = c.getImageData(0, 0, w, h);
  const a = img.data;
  const solid = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? false : a[(y * w + x) * 4 + 3] > 8;
  const lit = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      if (!solid(x - 1, y) || !solid(x, y - 1)) lit.push([x, y]);
    }
  }
  c.save();
  c.globalAlpha = alpha;
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = color;
  for (const [x, y] of lit) c.fillRect(x, y, 1, 1);
  c.restore();
}

/** Scale a finished sprite with nearest-neighbour, keeping the cache keyed. */
export function upscale(base, sc, key) {
  if (sc === 1) return base;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = Math.round(base.width * sc);
  cv.height = Math.round(base.height * sc);
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(base, 0, 0, cv.width, cv.height);
  cache.set(key, cv);
  return cv;
}
