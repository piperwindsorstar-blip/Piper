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

function quant(v) {
  return Math.max(0, Math.min(255, Math.round(v / 14) * 14));
}

export function applyHd2d(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0, n = d.length; i < n; i += 4) {
    const p = i >> 2;
    const x = p % w;
    const y = (p / w) | 0;
    const bias = (BAYER[y & 3][x & 3] / 16 - 0.47) * 11;
    d[i] = quant(d[i] + bias);
    d[i + 1] = quant(d[i + 1] + bias);
    d[i + 2] = quant(d[i + 2] + bias);
  }
  ctx.putImageData(img, 0, 0);
}
