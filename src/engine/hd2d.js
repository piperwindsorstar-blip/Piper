// ============================================================================
//  HD-2D — Octopath-style finish on the 480×270 buffer.
//
//  Snap colour onto a coarse ramp, Bayer-dither the leftover. Applied in
//  Screen.applyPost so every scene (title through game-over) shares it.
// ============================================================================

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function quant(v, step) {
  return Math.max(0, Math.min(255, Math.round(v / step) * step));
}

export function applyHd2d(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const step = 4;
  for (let i = 0, n = d.length; i < n; i += 4) {
    const p = i >> 2;
    const x = p % w;
    const y = (p / w) | 0;
    const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    if (lum < 14) continue;
    const bias = (BAYER[y & 3][x & 3] / 16 - 0.47) * 2.2;
    d[i] = quant(d[i] + bias, step);
    d[i + 1] = quant(d[i + 1] + bias, step);
    d[i + 2] = quant(d[i + 2] + bias, step);
  }
  ctx.putImageData(img, 0, 0);
}
