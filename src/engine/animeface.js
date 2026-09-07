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

import { paintRaceStamp, paintArmorStamp, paintWeaponStamp } from './stamps.js';

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
  // Title-plate HD-2D eye: a small white oval, dark iris, one highlight.
  // The old anime eye ate the face at 36px and fought the key art.
  const dir = flip ? -1 : 1;
  ctx.save();
  ctx.fillStyle = '#f4efe4';
  ctx.beginPath();
  ctx.ellipse(ex, ey, ew, eh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = afShade(iris, -0.15);
  ctx.beginPath();
  ctx.ellipse(ex + dir * ew * 0.08, ey + eh * 0.06, ew * 0.62, eh * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1214';
  ctx.beginPath();
  ctx.ellipse(ex + dir * ew * 0.1, ey + eh * 0.08, ew * 0.28, eh * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(ex - dir * ew * 0.28, ey - eh * 0.28, Math.max(0.45, eh * 0.22), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  paintRaceStamp(ctx, cx, cy, hw, hh, o.raceId, o.skin, ink);
  if (o.armor || o.kitRoot) drawClassMark(ctx, cx, cy, hw, hh, o.kitRoot, o.trim, ink, o.armor);
}

/** Small, bust-safe class marks. Kept off the body sprite on purpose —
 *  a 36px figure cannot afford a hat that eats the head. */
function drawClassMark(ctx, cx, cy, hw, hh, root, trim, ink, armor) {
  const helm = armor?.helm ?? (
    root === 'warrior' || root === 'guardian' ? 'open'
    : root === 'mage' || root === 'summoner' || root === 'spiritist' ? 'point'
    : root === 'cleric' ? 'circlet'
    : root === 'thief' || root === 'archer' ? 'hood'
    : 'none'
  );
  ctx.save();
  ctx.lineJoin = 'round';
  if (helm === 'open') {
    ctx.fillStyle = trim;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, hh * 0.04);
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.9, cy - hh * 0.55);
    ctx.quadraticCurveTo(cx, cy - hh * 1.35, cx + hw * 0.9, cy - hh * 0.55);
    ctx.lineTo(cx + hw * 0.8, cy - hh * 0.28);
    ctx.quadraticCurveTo(cx, cy - hh * 0.42, cx - hw * 0.8, cy - hh * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (helm === 'point') {
    ctx.fillStyle = trim;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, hh * 0.04);
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh * 1.85);
    ctx.lineTo(cx + hw * 0.95, cy - hh * 0.15);
    ctx.lineTo(cx - hw * 0.95, cy - hh * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (helm === 'circlet') {
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(1.2, hh * 0.07);
    ctx.beginPath();
    ctx.ellipse(cx, cy - hh * 0.05, hw * 0.72, hh * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (helm === 'hood') {
    ctx.fillStyle = 'rgba(20,16,28,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - hh * 0.55, hw * 0.95, hh * 0.55, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (root === 'dancer' || root === 'jester') {
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.moveTo(cx + hw * 0.15, cy - hh * 1.05);
    ctx.quadraticCurveTo(cx + hw * 1.1, cy - hh * 1.6, cx + hw * 1.25, cy - hh * 0.4);
    ctx.quadraticCurveTo(cx + hw * 0.7, cy - hh * 0.85, cx + hw * 0.2, cy - hh * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
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

  const ew = hw * 0.18, eh = hh * 0.16;
  drawEye(ctx, cx - hw * 0.36, cy + hh * 0.06, ew, eh, o.eye, true);
  drawEye(ctx, cx + hw * 0.36, cy + hh * 0.06, ew, eh, o.eye, false);

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
  if (!o._native) {
    const S = (o.w || 36) / 36;
    ctx.save();
    ctx.scale(S, S);
    paintAnimeBody(ctx, { ...o, w: 36, h: 48, _native: true });
    ctx.restore();
    return;
  }
  // Painted HD-2D field sprite — same costume language as the title plate:
  // cape, metal, hat, boots, a held weapon. Curves and three-tone ramps,
  // not stacked boxes, so the 36px figure still reads as the illustration.
  const look = o.look ?? {};
  const build = look.build ?? 1;
  const frame = o.frame ?? 0;
  const root = o.kitRoot ?? 'warrior';
  const ax = o.w / 2;
  const bob = (frame === 1 || frame === 5) ? 1 : 0;
  const face = o.face === 'up' || o.face === 'down' || o.face === 'left' ? o.face : 'right';
  const lean = frame === 3 ? 2.2 : face === 'up' ? -1.2 : 0;
  const stride = frame === 1 ? 2.4 : frame === 4 ? -2.4 : frame === 3 ? 1.6 : 0;
  const hurt = frame === 2;
  const ground = o.h - 2.5 + bob;
  const ink = o.ink ?? '#1a1418';

  const cloth = o.cloth;
  const clothD = afShade(cloth, -0.28);
  const clothL = afShade(cloth, 0.18);
  const trim = o.trim;
  const metal = afMix('#d4cfc4', trim, 0.22);
  const metalL = afShade(metal, 0.28);
  const metalD = afShade(metal, -0.32);
  const boot = '#241610';
  const armor = o.armor ?? { kind: 'plate', cape: null, helm: 'none', metal: false };
  const isRobe = armor.kind === 'robe' || armor.kind === 'vestments' || armor.kind === 'silk';
  const isArmor = !!armor.metal;
  const capeCol = armor.cape;

  const widthF = Math.sqrt(build) * (o.raceScale ?? 1);
  const bodyW = 7.0 * widthF;

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // contact shadow
  ctx.fillStyle = 'rgba(8,6,14,0.4)';
  ctx.beginPath();
  ctx.ellipse(ax, ground + 1.2, 8.5 * widthF, 2.0, 0, 0, Math.PI * 2);
  ctx.fill();

  // cape — title-plate blue / robe drape, behind the figure
  if (capeCol && face !== 'up') {
    ctx.fillStyle = afShade(capeCol, -0.12);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax - 2 + lean, 16);
    ctx.quadraticCurveTo(ax - 14 + lean, 22, ax - 11 + lean, 38);
    ctx.quadraticCurveTo(ax - 6 + lean, 36, ax - 3 + lean, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = afShade(capeCol, 0.16);
    ctx.beginPath();
    ctx.moveTo(ax - 3 + lean, 17);
    ctx.quadraticCurveTo(ax - 8 + lean, 22, ax - 6 + lean, 30);
    ctx.quadraticCurveTo(ax - 4 + lean, 24, ax - 3 + lean, 18);
    ctx.fill();
  }

  const strokeLimb = (x1, y1, x2, y2, w, fill) => {
    ctx.strokeStyle = ink;
    ctx.lineWidth = w + 1.2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = fill;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };

  const hipY = 30 + bob;
  const shoulderY = 17 + bob;
  const bodyTop = 15 + bob;

  // legs + boots
  const lFootX = ax - 3.2 - stride, rFootX = ax + 3.2 + stride;
  strokeLimb(ax - 2.2, hipY, lFootX, ground - 3, bodyW * 0.42, clothD);
  strokeLimb(ax + 2.2, hipY, rFootX, ground - 3, bodyW * 0.42, clothD);
  for (const fx of [lFootX, rFootX]) {
    ctx.fillStyle = boot;
    ctx.beginPath();
    ctx.ellipse(fx, ground - 1.2, 3.1, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = afShade(boot, 0.28);
    ctx.beginPath();
    ctx.ellipse(fx - 0.4, ground - 1.6, 1.6, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // hips / robe flare
  ctx.fillStyle = isRobe ? cloth : clothD;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (isRobe) {
    ctx.moveTo(ax - bodyW * 0.55 + lean, hipY - 2);
    ctx.quadraticCurveTo(ax - bodyW * 1.35 + lean, hipY + 6, ax - bodyW * 1.05 + lean, ground - 6);
    ctx.lineTo(ax + bodyW * 1.05 + lean, ground - 6);
    ctx.quadraticCurveTo(ax + bodyW * 1.35 + lean, hipY + 6, ax + bodyW * 0.55 + lean, hipY - 2);
  } else {
    ctx.moveTo(ax - bodyW * 0.7 + lean, hipY - 3);
    ctx.quadraticCurveTo(ax - bodyW * 0.9 + lean, hipY + 4, ax - bodyW * 0.55 + lean, hipY + 7);
    ctx.lineTo(ax + bodyW * 0.55 + lean, hipY + 7);
    ctx.quadraticCurveTo(ax + bodyW * 0.9 + lean, hipY + 4, ax + bodyW * 0.7 + lean, hipY - 3);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // torso — metal breastplate or cloth, with a lit edge
  ctx.fillStyle = isArmor ? metal : cloth;
  ctx.beginPath();
  ctx.moveTo(ax - bodyW * 0.55 + lean, bodyTop);
  ctx.quadraticCurveTo(ax - bodyW * 1.15 + lean, bodyTop + 7, ax - bodyW * 0.7 + lean, hipY);
  ctx.lineTo(ax + bodyW * 0.7 + lean, hipY);
  ctx.quadraticCurveTo(ax + bodyW * 1.15 + lean, bodyTop + 7, ax + bodyW * 0.55 + lean, bodyTop);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = isArmor ? metalL : clothL;
  ctx.beginPath();
  ctx.moveTo(ax - bodyW * 0.35 + lean, bodyTop + 1);
  ctx.quadraticCurveTo(ax - bodyW * 0.55 + lean, bodyTop + 7, ax - bodyW * 0.25 + lean, hipY - 2);
  ctx.lineTo(ax - bodyW * 0.05 + lean, hipY - 2);
  ctx.quadraticCurveTo(ax - bodyW * 0.2 + lean, bodyTop + 6, ax - bodyW * 0.15 + lean, bodyTop + 1);
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(ax - bodyW * 0.4 + lean, bodyTop + 0.6);
  ctx.quadraticCurveTo(ax + lean, bodyTop + 2.4, ax + bodyW * 0.4 + lean, bodyTop + 0.6);
  ctx.stroke();
  if (isArmor) {
    ctx.strokeStyle = metalD;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ax + lean, bodyTop + 3);
    ctx.lineTo(ax + lean, hipY - 2);
    ctx.stroke();
  }
  paintArmorStamp(ctx, ax, lean, bodyTop, hipY, bodyW, armor, cloth, trim, metal, metalL, metalD, ink);

  // off-hand
  const offX = ax - bodyW * 1.05 + lean, offY = shoulderY + (frame === 3 ? 3 : 8);
  strokeLimb(ax - bodyW * 0.55 + lean, shoulderY, offX, offY, bodyW * 0.38, isArmor ? metal : cloth);
  if (o.hasShield) {
    ctx.fillStyle = metal;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(offX - 1.4, offY, 3.2, 4.2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = trim;
    ctx.beginPath();
    ctx.ellipse(offX - 1.4, offY, 1.4, 2.0, -0.2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = o.skin;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(offX, offY, 2.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // action hand + weapon
  const atk = frame === 3;
  const handX = ax + bodyW * 1.05 + lean + (atk ? 2 : 0);
  const handY = shoulderY + (atk ? 3 : 9);
  strokeLimb(ax + bodyW * 0.55 + lean, shoulderY, handX, handY, bodyW * 0.38, isArmor ? metal : cloth);
  ctx.fillStyle = o.skin;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(handX, handY, 2.0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const { weaponType, weaponElement } = o;
  const category = WEAPON_CATEGORY[weaponType] ?? 'blade';
  const reach = weaponType === 'bow' || weaponType === 'staff' ? 9
    : weaponType === 'spear' || weaponType === 'whip' ? 3 : 2;
  if (weaponType && weaponType !== 'fist') {
    const angle = atk ? -1.15 : (frame === 1 || frame === 4) ? -0.35 : -0.12;
    drawWeapon(ctx, handX, handY, angle, category, '#eef2f8',
      weaponElement ? afShade(trim, 0.3) : afShade(trim, 0.12), reach);
    paintWeaponStamp(ctx, handX, handY, angle, category,
      weaponElement ? afShade(trim, 0.3) : afShade(trim, 0.12));
  }

  // head — title-plate proportion: big enough for the face, small enough
  // that a cape and a sword still have room
  const hx = ax + lean * 0.45;
  const hy = 12.4 + bob;
  const hw = 4.35 * widthF;
  const hh = 4.55 * widthF;
  paintAnimeHead(ctx, hx, hy, hw, hh, { ...o, ink, kitRoot: root });
  paintRaceStamp(ctx, hx, hy, hw, hh, o.raceId, o.skin, ink);

  // hats / open helms sit on the hair, never over the eyes
  ctx.save();
  ctx.lineJoin = 'round';
  if (armor.helm === 'point') {
    ctx.fillStyle = cloth;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, hy - hh * 1.85);
    ctx.lineTo(hx + hw * 1.05, hy - hh * 0.15);
    ctx.lineTo(hx - hw * 1.05, hy - hh * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.arc(hx, hy - hh * 1.85, 1.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (armor.helm === 'open') {
    ctx.fillStyle = metal;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx - hw * 0.95, hy - hh * 0.35);
    ctx.quadraticCurveTo(hx, hy - hh * 1.35, hx + hw * 0.95, hy - hh * 0.35);
    ctx.lineTo(hx + hw * 0.85, hy - hh * 0.05);
    ctx.quadraticCurveTo(hx, hy - hh * 0.2, hx - hw * 0.85, hy - hh * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = metalL;
    ctx.fillRect(hx - 0.7, hy - hh * 1.15, 1.4, hh * 0.7);
  } else if (armor.helm === 'circlet') {
    ctx.strokeStyle = trim;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(hx, hy - hh * 0.08, hw * 0.78, hh * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (armor.helm === 'hood') {
    ctx.fillStyle = clothD;
    ctx.beginPath();
    ctx.ellipse(hx, hy - hh * 0.55, hw * 1.05, hh * 0.5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx - hw * 1.05, hy - hh * 0.15);
    ctx.quadraticCurveTo(hx - hw * 1.3, hy + hh * 0.35, hx - hw * 0.7, hy + hh * 0.15);
    ctx.fill();
  }
  ctx.restore();

  if (hurt) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(220,40,40,0.32)';
    ctx.fillRect(0, 0, o.w, o.h);
    ctx.restore();
  }
}
