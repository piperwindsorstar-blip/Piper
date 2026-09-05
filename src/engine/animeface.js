// ============================================================================
//  ANIME FACE — a second art style for actor busts and (eventually) bodies:
//  big cel-shaded eyes and clean linework instead of the traced-pixel look
//  pixel.js's own painter draws. Kept as raw canvas bezier/arc work rather
//  than the painter's pixel-grid primitives, since smooth curves are the
//  whole point here — see pixel.js's own header for why that one stays
//  pixel-grid. make()'s outline/ao/rim postprocessing still works on this:
//  it scans rasterised alpha, not vector paths, so a keyline traced around
//  a bezier silhouette comes out just as clean as around a blocky one.
// ============================================================================

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
export function afShade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => (amt >= 0 ? c + (255 - c) * amt : c + c * amt);
  return rgbToHex(f(r), f(g), f(b));
}
export function afMix(a, b, t) {
  const [ar, ag, ab] = hexToRgb(a), [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function headPath(ctx, cx, cy, w, h) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h);
  ctx.bezierCurveTo(cx + w * 1.02, cy - h * 0.98, cx + w * 1.14, cy - h * 0.2, cx + w * 0.9, cy + h * 0.38);
  ctx.bezierCurveTo(cx + w * 0.74, cy + h * 0.86, cx + w * 0.3, cy + h * 1.06, cx, cy + h * 1.06);
  ctx.bezierCurveTo(cx - w * 0.3, cy + h * 1.06, cx - w * 0.74, cy + h * 0.86, cx - w * 0.9, cy + h * 0.38);
  ctx.bezierCurveTo(cx - w * 1.14, cy - h * 0.2, cx - w * 1.02, cy - h * 0.98, cx, cy - h);
  ctx.closePath();
}

function drawEye(ctx, ex, ey, ew, eh, iris, flip) {
  const dir = flip ? -1 : 1;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ex - dir * ew, ey);
  ctx.quadraticCurveTo(ex - dir * ew * 0.4, ey - eh, ex, ey - eh * 0.92);
  ctx.quadraticCurveTo(ex + dir * ew * 0.7, ey - eh * 0.85, ex + dir * ew, ey - eh * 0.05);
  ctx.quadraticCurveTo(ex + dir * ew * 0.55, ey + eh * 0.62, ex, ey + eh * 0.66);
  ctx.quadraticCurveTo(ex - dir * ew * 0.5, ey + eh * 0.55, ex - dir * ew, ey);
  ctx.closePath();
  ctx.fillStyle = '#fbf6ec';
  ctx.fill();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(ex + dir * ew * 0.12, ey + eh * 0.08, eh * 0.64, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(ex, ey - eh * 0.5, ex, ey + eh * 0.6);
  g.addColorStop(0, afShade(iris, 0.35));
  g.addColorStop(1, afShade(iris, -0.25));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex + dir * ew * 0.12, ey + eh * 0.08, eh * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#191113';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex - dir * ew * 0.18, ey - eh * 0.32, eh * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(ex - dir * ew * 1.04, ey + eh * 0.08);
  ctx.quadraticCurveTo(ex - dir * ew * 0.4, ey - eh * 1.18, ex, ey - eh * 1.06);
  ctx.quadraticCurveTo(ex + dir * ew * 0.72, ey - eh * 1.08, ex + dir * ew * 1.04, ey - eh * 0.1);
  ctx.lineWidth = eh * 0.26;
  ctx.strokeStyle = '#211a17';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ex - dir * ew * 0.7, ey - eh * 1.5);
  ctx.quadraticCurveTo(ex, ey - eh * 1.9, ex + dir * ew * 0.8, ey - eh * 1.58);
  ctx.lineWidth = eh * 0.18;
  ctx.strokeStyle = '#211a17';
  ctx.stroke();
}

// One robust ear-to-ear cap silhouette closed by a single curve across the
// front — kept to one segment on purpose so no fringe shape can accidentally
// self-intersect and swallow the face.
function drawHairCap(ctx, cx, cy, w, h, color, o, ink) {
  ctx.fillStyle = color;
  const sideY = cy - h * 0.05;
  const peakY = cy - h * (o.peak ?? 1.3);
  ctx.beginPath();
  ctx.moveTo(cx - w * 1.02, sideY);
  ctx.quadraticCurveTo(cx - w * 1.08, peakY, cx - w * (o.crownOff ?? 0), peakY - h * 0.06);
  ctx.quadraticCurveTo(cx + w * 1.08, peakY, cx + w * 1.02, sideY);
  const dipY = cy - h * (o.fringe ?? 0.5);
  if (o.part) {
    ctx.quadraticCurveTo(cx + w * 0.45, dipY - h * 0.22, cx, dipY);
    ctx.quadraticCurveTo(cx - w * 0.45, dipY - h * 0.22, cx - w * 1.02, sideY);
  } else {
    ctx.quadraticCurveTo(cx, dipY, cx - w * 1.02, sideY);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = Math.max(1, h * 0.045);
  ctx.strokeStyle = ink;
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (o.spikes) {
    for (let i = 0; i < o.spikes; i++) {
      const t = (i + 0.5) / o.spikes;
      const sx = cx + (t * 2 - 1) * w * 0.85;
      const baseY = peakY + h * 0.15;
      ctx.beginPath();
      ctx.moveTo(sx - w * 0.14, baseY);
      ctx.lineTo(sx, peakY - h * (0.35 + 0.25 * (i % 2 ? 1 : 0.4)));
      ctx.lineTo(sx + w * 0.14, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = Math.max(1, h * 0.03);
      ctx.stroke();
    }
  }
}

function drawSideHair(ctx, cx, cy, w, h, color, style, ink) {
  ctx.fillStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, h * 0.045);
  ctx.strokeStyle = ink;
  const shape = (path) => { ctx.beginPath(); path(); ctx.closePath(); ctx.fill(); ctx.stroke(); };
  if (style === 'ponytail') {
    shape(() => {
      ctx.moveTo(cx + w * 0.55, cy - h * 1.15);
      ctx.quadraticCurveTo(cx + w * 1.25, cy - h * 0.6, cx + w * 0.85, cy + h * 0.6);
      ctx.quadraticCurveTo(cx + w * 0.6, cy + h * 1.2, cx + w * 0.35, cy + h * 1.55);
      ctx.quadraticCurveTo(cx + w * 0.55, cy + h * 0.7, cx + w * 0.3, cy - h * 0.2);
    });
  } else if (style === 'twin') {
    for (const dir of [-1, 1]) {
      shape(() => {
        ctx.moveTo(cx + dir * w * 0.95, cy - h * 0.35);
        ctx.quadraticCurveTo(cx + dir * w * 1.5, cy + h * 0.1, cx + dir * w * 1.2, cy + h * 1.35);
        ctx.quadraticCurveTo(cx + dir * w * 0.95, cy + h * 0.6, cx + dir * w * 0.72, cy - h * 0.1);
      });
    }
  } else if (style === 'long') {
    for (const dir of [-1, 1]) {
      shape(() => {
        ctx.moveTo(cx + dir * w * 0.98, cy - h * 0.15);
        ctx.quadraticCurveTo(cx + dir * w * 1.2, cy + h * 1.0, cx + dir * w * 1.0, cy + h * 2.3);
        ctx.quadraticCurveTo(cx + dir * w * 0.75, cy + h * 1.1, cx + dir * w * 0.68, cy - h * 0.1);
      });
    }
  } else if (style === 'sidebraid') {
    shape(() => {
      ctx.moveTo(cx - w * 0.92, cy - h * 0.25);
      ctx.quadraticCurveTo(cx - w * 1.1, cy + h * 0.6, cx - w * 0.8, cy + h * 1.5);
      ctx.quadraticCurveTo(cx - w * 0.62, cy + h * 0.7, cx - w * 0.62, cy - h * 0.1);
    });
  }
}

export const HAIRSTYLES = {
  swept: { peak: 1.28, fringe: 0.62, part: true, crownOff: 0.15, sideHair: 'long' },
  spiky: { peak: 1.35, fringe: 0.7, part: false, spikes: 5 },
  bob: { peak: 1.2, fringe: 0.75, part: false },
  ponytail: { peak: 1.22, fringe: 0.68, part: true, sideHair: 'ponytail' },
  twintails: { peak: 1.18, fringe: 0.8, part: true, sideHair: 'twin' },
  flowing: { peak: 1.25, fringe: 0.6, part: true, sideHair: 'long' },
  braid: { peak: 1.2, fringe: 0.72, part: false, sideHair: 'sidebraid' },
};
const ROOT_HAIRSTYLES = {
  warrior: ['spiky', 'swept'], guardian: ['spiky', 'bob'], monk: ['spiky', 'bob'],
  thief: ['swept', 'braid'], archer: ['ponytail', 'swept'], lancer: ['spiky', 'ponytail'],
  dancer: ['twintails', 'flowing'], jester: ['twintails', 'spiky'],
  mage: ['bob', 'swept'], cleric: ['bob', 'flowing'], summoner: ['flowing', 'braid'],
  spiritist: ['flowing', 'braid'],
};
export function pickHairstyle(root, seed) {
  const opts = ROOT_HAIRSTYLES[root] ?? ['swept'];
  return opts[seed % opts.length];
}

function drawEar(ctx, cx, cy, side, ew, eh, style, skin, hairColor, ink) {
  const dir = side;
  const ex = cx + dir * ew * 0.98, ey = cy + eh * 0.08;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink;
  if (style === 'long') {
    ctx.fillStyle = skin;
    ctx.lineWidth = Math.max(1, eh * 0.05);
    ctx.beginPath();
    ctx.moveTo(ex, ey - eh * 0.1);
    ctx.quadraticCurveTo(ex + dir * ew * 0.55, ey - eh * 0.75, ex + dir * ew * 0.42, ey - eh * 1.15);
    ctx.quadraticCurveTo(ex + dir * ew * 0.22, ey - eh * 0.65, ex - dir * ew * 0.02, ey + eh * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (style === 'wolf') {
    const wx = cx + dir * ew * 0.55, wy = cy - eh * 0.95;
    ctx.fillStyle = hairColor;
    ctx.lineWidth = Math.max(1, eh * 0.05);
    ctx.beginPath();
    ctx.moveTo(wx - dir * ew * 0.28, wy + eh * 0.3);
    ctx.quadraticCurveTo(wx + dir * ew * 0.1, wy - eh * 0.55, wx + dir * ew * 0.35, wy - eh * 0.75);
    ctx.quadraticCurveTo(wx + dir * ew * 0.4, wy - eh * 0.15, wx + dir * ew * 0.3, wy + eh * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = afShade(skin, -0.1);
    ctx.beginPath();
    ctx.moveTo(wx - dir * ew * 0.14, wy + eh * 0.2);
    ctx.quadraticCurveTo(wx + dir * ew * 0.14, wy - eh * 0.35, wx + dir * ew * 0.3, wy - eh * 0.5);
    ctx.quadraticCurveTo(wx + dir * ew * 0.3, wy - eh * 0.05, wx + dir * ew * 0.22, wy + eh * 0.22);
    ctx.closePath();
    ctx.fill();
  } else if (style === 'fin') {
    ctx.fillStyle = afMix(skin, '#3ad0e0', 0.35);
    ctx.lineWidth = Math.max(1, eh * 0.05);
    ctx.beginPath();
    ctx.moveTo(ex, ey - eh * 0.1);
    ctx.quadraticCurveTo(ex + dir * ew * 0.5, ey - eh * 0.3, ex + dir * ew * 0.38, ey + eh * 0.15);
    ctx.quadraticCurveTo(ex + dir * ew * 0.2, ey + eh * 0.2, ex, ey + eh * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = skin;
    ctx.lineWidth = Math.max(1, eh * 0.04);
    ctx.beginPath();
    ctx.ellipse(ex + dir * ew * 0.06, ey, ew * 0.14, eh * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * Paints an anime-style bust straight onto `ctx` (a canvas already sized by
 * the caller — this only ever draws inside a cx/cy-centred box, it does not
 * touch canvas.width/height). `o`: {skin, hair, eye, cloth, trim, look,
 * hairStyle, seed, ink}. `look` is a race's own `look` object from
 * data/races.js — ears/muzzle/horns/tusks/beard/goggles/fins/scaled/fur/
 * plates/gaunt/build read exactly as they do for the pixel sprite.
 */
export function paintAnimeBust(ctx, cx, cy, hw, hh, o) {
  const ink = o.ink ?? '#2a1c17';

  // shoulders / collar
  ctx.fillStyle = o.cloth;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, hh * 0.045);
  ctx.strokeStyle = ink;
  ctx.beginPath();
  ctx.moveTo(cx - hw * 1.55, cy + hh * 2.4);
  ctx.quadraticCurveTo(cx - hw * 1.5, cy + hh * 0.75, cx - hw * 0.65, cy + hh * 0.95);
  ctx.quadraticCurveTo(cx, cy + hh * 1.15, cx + hw * 0.65, cy + hh * 0.95);
  ctx.quadraticCurveTo(cx + hw * 1.5, cy + hh * 0.75, cx + hw * 1.55, cy + hh * 2.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = o.trim;
  ctx.lineWidth = Math.max(1.5, hh * 0.09);
  ctx.beginPath();
  ctx.moveTo(cx - hw * 0.55, cy + hh * 0.98);
  ctx.quadraticCurveTo(cx, cy + hh * 1.2, cx + hw * 0.55, cy + hh * 0.98);
  ctx.stroke();

  paintAnimeHead(ctx, cx, cy, hw, hh, o);
}

/** Head only: hair, ears, horns, face, tusks, beard, goggles — everything
 *  above the collarbone. Shared by the bust portrait (which adds shoulders
 *  around it) and the full body sprite (which adds a torso and limbs). */
export function paintAnimeHead(ctx, cx, cy, hw, hh, o) {
  const ink = o.ink ?? '#2a1c17';
  const preset = HAIRSTYLES[o.hairStyle] ?? HAIRSTYLES.swept;
  const look = o.look;

  if (preset.sideHair && preset.sideHair !== 'long') drawSideHair(ctx, cx, cy, hw, hh, afShade(o.hair, -0.08), preset.sideHair, ink);
  if (preset.sideHair === 'long') drawSideHair(ctx, cx, cy, hw, hh, afShade(o.hair, -0.05), 'long', ink);

  if (look.ears && look.ears !== 'none') {
    drawEar(ctx, cx, cy, -1, hw, hh, look.ears, o.skin, o.hair, ink);
    drawEar(ctx, cx, cy, 1, hw, hh, look.ears, o.skin, o.hair, ink);
  }

  if (look.horns) {
    ctx.fillStyle = look.horns === 'dragon' ? '#e8e0c8' : afShade(o.skin, -0.3);
    ctx.lineWidth = Math.max(1, hh * 0.035);
    ctx.strokeStyle = ink;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * hw * 0.5, cy - hh * 0.95);
      ctx.quadraticCurveTo(cx + dir * hw * 0.72, cy - hh * 1.35, cx + dir * hw * 0.58, cy - hh * 1.55);
      ctx.quadraticCurveTo(cx + dir * hw * 0.46, cy - hh * 1.25, cx + dir * hw * 0.32, cy - hh * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // head
  ctx.fillStyle = o.skin;
  headPath(ctx, cx, cy, hw, hh);
  ctx.fill();
  ctx.save();
  headPath(ctx, cx, cy, hw, hh);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(cx, cy + hh * 0.85, hw * 1.1, hh * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = afShade(o.skin, -0.12);
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.globalAlpha = 1;
  if (look.gaunt) {
    ctx.fillStyle = afMix(o.skin, '#2a3050', 0.5);
    ctx.globalAlpha = 0.45;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + dir * hw * 0.42, cy + hh * 0.14, hw * 0.28, hh * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (look.plates) {
    ctx.strokeStyle = afShade(o.skin, -0.35);
    ctx.lineWidth = Math.max(1, hh * 0.03);
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.85, cy - hh * 0.15);
    ctx.lineTo(cx - hw * 0.35, cy - hh * 0.15);
    ctx.moveTo(cx + hw * 0.35, cy - hh * 0.15);
    ctx.lineTo(cx + hw * 0.85, cy - hh * 0.15);
    ctx.stroke();
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + dir * hw * 0.65, cy - hh * 0.55, Math.max(1, hh * 0.04), 0, Math.PI * 2);
      ctx.fillStyle = afShade(o.skin, -0.4);
      ctx.fill();
    }
  }
  ctx.restore();
  headPath(ctx, cx, cy, hw, hh);
  ctx.lineWidth = Math.max(1.2, hh * 0.045);
  ctx.strokeStyle = ink;
  ctx.stroke();

  const ew = hw * 0.34, eh = hh * 0.3;
  drawEye(ctx, cx - hw * 0.42, cy + hh * 0.05, ew, eh, o.eye, true);
  drawEye(ctx, cx + hw * 0.42, cy + hh * 0.05, ew, eh, o.eye, false);

  if (look.muzzle) {
    ctx.fillStyle = afShade(o.skin, -0.06);
    ctx.beginPath();
    ctx.ellipse(cx, cy + hh * 0.6, hw * 0.3, hh * 0.2, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#241a16';
    ctx.beginPath();
    ctx.ellipse(cx, cy + hh * 0.56, hw * 0.055, hh * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = afShade(o.skin, -0.3);
    ctx.lineWidth = Math.max(1, hh * 0.028);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - hh * 0.03, cy + hh * 0.33);
    ctx.quadraticCurveTo(cx, cy + hh * 0.48, cx + hh * 0.045, cy + hh * 0.46);
    ctx.stroke();
  }

  if (look.tusks) {
    ctx.fillStyle = '#f4ecd8';
    ctx.lineWidth = Math.max(1, hh * 0.02);
    ctx.strokeStyle = ink;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * hw * 0.2, cy + hh * 0.7);
      ctx.lineTo(cx + dir * hw * 0.3, cy + hh * 0.9);
      ctx.lineTo(cx + dir * hw * 0.13, cy + hh * 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  if (!look.muzzle) {
    ctx.strokeStyle = afShade(o.skin, -0.45);
    ctx.lineWidth = Math.max(1, hh * 0.032);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const smile = (o.seed % 5) > 1;
    ctx.moveTo(cx - hw * 0.15, cy + hh * (smile ? 0.63 : 0.68));
    ctx.quadraticCurveTo(cx, cy + hh * (smile ? 0.78 : 0.68), cx + hw * 0.15, cy + hh * (smile ? 0.63 : 0.68));
    ctx.stroke();
  }

  if (look.beard) {
    ctx.fillStyle = afShade(o.hair, -0.05);
    ctx.lineWidth = Math.max(1, hh * 0.04);
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.72, cy + hh * 0.28);
    ctx.quadraticCurveTo(cx - hw * 0.58, cy + hh * 1.2, cx, cy + hh * 1.38);
    ctx.quadraticCurveTo(cx + hw * 0.58, cy + hh * 1.2, cx + hw * 0.72, cy + hh * 0.28);
    ctx.quadraticCurveTo(cx + hw * 0.48, cy + hh * 0.6, cx, cy + hh * 0.66);
    ctx.quadraticCurveTo(cx - hw * 0.48, cy + hh * 0.6, cx - hw * 0.72, cy + hh * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (!look.plates) {
    drawHairCap(ctx, cx, cy, hw, hh, o.hair, preset, ink);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = afShade(o.hair, 0.35);
    ctx.beginPath();
    ctx.ellipse(cx - hw * 0.35, cy - hh * 1.05, hw * 0.32, hh * 0.15, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = afShade(o.skin, 0.08);
    ctx.lineWidth = Math.max(1, hh * 0.04);
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.85, cy - hh * 0.15);
    ctx.quadraticCurveTo(cx - hw * 0.9, cy - hh * 1.2, cx, cy - hh * 1.3);
    ctx.quadraticCurveTo(cx + hw * 0.9, cy - hh * 1.2, cx + hw * 0.85, cy - hh * 0.15);
    ctx.quadraticCurveTo(cx, cy - hh * 0.35, cx - hw * 0.85, cy - hh * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = afShade(o.skin, -0.3);
    ctx.lineWidth = Math.max(1, hh * 0.025);
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh * 1.28);
    ctx.lineTo(cx, cy - hh * 0.4);
    ctx.stroke();
  }

  if (look.goggles) {
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = Math.max(1.5, hh * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.85, cy - hh * 0.72);
    ctx.lineTo(cx + hw * 0.85, cy - hh * 0.72);
    ctx.stroke();
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + dir * hw * 0.42, cy - hh * 0.72, hh * 0.17, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,200,220,0.5)';
      ctx.fill();
      ctx.lineWidth = Math.max(1, hh * 0.045);
      ctx.strokeStyle = '#3a3a3a';
      ctx.stroke();
    }
  }
}

const WEAPON_CATEGORY = {
  sword: 'blade', axe: 'blade', dagger: 'blade', mace: 'blade', fist: 'fist',
  spear: 'pole', whip: 'pole', bow: 'bow', staff: 'staff', shield: 'none',
};

function drawWeapon(ctx, handX, handY, angle, category, color, accent, reach) {
  const len = reach >= 9 ? (category === 'bow' ? 9 : 12) : reach === 3 ? 13 : 9;
  const tipX = handX + Math.cos(angle) * len, tipY = handY + Math.sin(angle) * len;
  ctx.lineCap = 'round';
  if (category === 'bow') {
    const midX = handX + Math.cos(angle) * len * 0.5, midY = handY + Math.sin(angle) * len * 0.5;
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.quadraticCurveTo(midX + nx * 4, midY + ny * 4, tipX, tipY);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    return;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = category === 'pole' ? 1.7 : category === 'staff' ? 1.8 : 2.6;
  ctx.beginPath();
  ctx.moveTo(handX, handY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  if (category === 'blade') {
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(handX - nx * 2.4, handY - ny * 2.4);
    ctx.lineTo(handX + nx * 2.4, handY + ny * 2.4);
    ctx.stroke();
  } else if (category === 'staff') {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (category === 'pole') {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - Math.sin(angle) * 1.6, tipY + Math.cos(angle) * 1.6);
    ctx.lineTo(tipX + Math.cos(angle) * 2.4, tipY + Math.sin(angle) * 2.4);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * A full standing chibi figure: head (via paintAnimeHead), a simple torso,
 * capsule-stroke limbs and a weapon hint on the attack frame — the anime
 * equivalent of actorSprite()'s pixel body. `o`: everything paintAnimeHead
 * needs, plus {frame, weaponType, weaponElement, hasShield, w, h} where w/h
 * are the destination canvas size (AW/AH).
 */
export function paintAnimeBody(ctx, o) {
  const ink = o.ink ?? '#2a1c17';
  const look = o.look;
  const build = look.build ?? 1;
  const frame = o.frame ?? 0;
  const ax = o.w / 2;
  const bob = frame === 1 ? 1 : 0;
  const lean = frame === 3 ? 2.4 : 0;
  const hurt = frame === 2;

  // Height is dampened (^0.4) so a small-build race reads as a bit shorter
  // rather than a doll standing next to everyone else — the pixel sprite
  // kept every race at nearly the same on-field stature and let build show
  // up as girth instead, which is what widthFactor (a lighter sqrt taper)
  // is for here.
  const heightFactor = Math.pow(build, 0.4), widthFactor = Math.sqrt(build);
  const ground = o.h - 3;
  const legH = 11 * heightFactor, bodyH = 13 * heightFactor, headH = 6.6 * heightFactor;
  const bodyW = 5.6 * widthFactor, headW = 6.6 * widthFactor;
  const legY = ground - legH + bob;
  const bodyTop = legY - bodyH;
  const headCy = bodyTop - headH * 0.75;

  const clothD = afShade(o.cloth, -0.35);
  const skinD = afShade(o.skin, -0.25);

  // contact shadow
  ctx.fillStyle = 'rgba(10,8,15,0.4)';
  ctx.beginPath();
  ctx.ellipse(ax, ground + 1, 7 * build, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs
  ctx.lineCap = 'round';
  ctx.strokeStyle = clothD;
  ctx.lineWidth = bodyW * 0.5;
  const stride = frame === 1 ? 2.2 : frame === 3 ? 1.6 : 0;
  ctx.beginPath();
  ctx.moveTo(ax - bodyW * 0.4, bodyTop + bodyH * 0.85);
  ctx.lineTo(ax - bodyW * 0.55 - stride * 0.3, ground - 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax + bodyW * 0.4, bodyTop + bodyH * 0.85);
  ctx.lineTo(ax + bodyW * 0.55 + stride * 0.3, ground - 1);
  ctx.stroke();
  ctx.fillStyle = ink;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(ax + dir * (bodyW * 0.55 + stride * 0.3), ground - 0.6, bodyW * 0.32, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // torso
  ctx.fillStyle = o.cloth;
  ctx.strokeStyle = ink;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ax - bodyW * 0.5 + lean * 0.2, bodyTop);
  ctx.quadraticCurveTo(ax - bodyW * 1.15 + lean * 0.2, bodyTop + bodyH * 0.4, ax - bodyW * 0.75 + lean * 0.3, bodyTop + bodyH);
  ctx.lineTo(ax + bodyW * 0.75 + lean * 0.3, bodyTop + bodyH);
  ctx.quadraticCurveTo(ax + bodyW * 1.15 + lean * 0.2, bodyTop + bodyH * 0.4, ax + bodyW * 0.5 + lean * 0.2, bodyTop);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = o.trim;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(ax - bodyW * 0.4, bodyTop + 0.5);
  ctx.quadraticCurveTo(ax, bodyTop + 2, ax + bodyW * 0.4, bodyTop + 0.5);
  ctx.stroke();

  // arms (drawn after torso, before head so hands can hold a weapon at the head/torso boundary)
  // Each is an ink-outlined capsule stroke: a wider dark pass first, then a
  // thinner cloth-coloured one on top — without it, a sleeve the same colour
  // as the torso it crosses in front of just vanishes into the silhouette.
  const armColor = afShade(o.cloth, 0.08);
  const armW = bodyW * 0.48;
  const strokeArm = (x1, y1, x2, y2) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = ink;
    ctx.lineWidth = armW + 1.1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = armColor;
    ctx.lineWidth = armW;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const shoulderY = bodyTop + bodyH * 0.18;
  const { weaponType, weaponElement, hasShield } = o;
  const category = WEAPON_CATEGORY[weaponType] ?? 'blade';
  const reach = weaponType === 'bow' || weaponType === 'staff' ? 9 : weaponType === 'spear' || weaponType === 'whip' ? 3 : 2;
  // off-hand
  const offX = ax - bodyW * 0.95 - (frame === 3 ? 1 : 0), offY = shoulderY + bodyH * (frame === 3 ? 0.15 : 0.45);
  strokeArm(ax - bodyW * 0.55, shoulderY, offX, offY);
  if (hasShield) {
    ctx.fillStyle = afShade(o.trim, -0.1);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(offX - 1.5, offY, 2.6, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = o.skin;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(offX, offY, bodyW * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // action hand
  const swingAngle = frame === 3 ? -0.65 : frame === 1 ? -0.15 : 0.08;
  const handX = ax + bodyW * 0.95 + lean * 0.6, handY = shoulderY + bodyH * (0.55 + swingAngle * 0.3);
  strokeArm(ax + bodyW * 0.55 + lean * 0.3, shoulderY, handX, handY);
  ctx.fillStyle = o.skin;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(handX, handY, bodyW * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (frame === 3) {
    const angle = -1.1 + swingAngle;
    drawWeapon(ctx, handX, handY, angle, category, '#e8ecf4', weaponElement ? afShade(o.trim, 0.25) : afShade(o.trim, 0.15), reach);
  }

  paintAnimeHead(ctx, ax + lean * 0.5, headCy, headW, headH, { ...o, ink });

  if (hurt) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(220,40,40,0.32)';
    ctx.fillRect(0, 0, o.w, o.h);
    ctx.restore();
  }
}
