// ============================================================================
//  BOSS ART — one bespoke silhouette per story boss, built from the same
//  bezier-and-arc toolkit animemonster.js's eight body plans use (so a boss
//  still belongs to the same visual family as an ordinary encounter), but
//  drawn to its own design instead of picked from that shared list. A boss
//  should read as itself from across the field — Volk's hood, the Anvil
//  King's anvil-shaped head, the Worldheart's glowing canopy — not as
//  "another humanoid" wearing a different palette.
// ============================================================================

import { fillStroke, monsterEye, limb, wingShape, amShade, INK } from './animemonster.js';

function shadow(ctx, ax, ground, rx = 15) {
  ctx.fillStyle = 'rgba(10,8,15,0.35)';
  ctx.beginPath();
  ctx.ellipse(ax, ground, rx, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

// --- Volk, Brigand Chief of the Hollow (Lv9) --------------------------------
// A hooded highwayman with a raised blade — an ambush, not a standard bandit.
function paintVolk(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const bob = frame === 1 ? 1 : 0;
  shadow(ctx, ax, ground, 13);
  const cy = ground - 18 + bob;
  ctx.beginPath();
  ctx.moveTo(ax - 11, cy - 6);
  ctx.quadraticCurveTo(ax - 15, cy + 14, ax - 10, ground - 1);
  ctx.lineTo(ax + 10, ground - 1);
  ctx.quadraticCurveTo(ax + 15, cy + 14, ax + 11, cy - 6);
  ctx.closePath();
  fillStroke(ctx, c3, 1.6);
  ctx.beginPath();
  ctx.moveTo(ax - 8, cy - 8);
  ctx.quadraticCurveTo(ax - 10, cy + 6, ax - 7, cy + 15);
  ctx.lineTo(ax + 7, cy + 15);
  ctx.quadraticCurveTo(ax + 10, cy + 6, ax + 8, cy - 8);
  ctx.closePath();
  fillStroke(ctx, c1);
  ctx.strokeStyle = amShade(c3, -0.3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax - 7, cy - 6);
  ctx.lineTo(ax + 6, cy + 12);
  ctx.stroke();
  limb(ctx, ax - 7, cy - 5, ax - 12, cy + 10, 3, c1);
  limb(ctx, ax + 7, cy - 6, ax + 15, cy - 20, 3.2, c1);
  ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax + 15, cy - 20); ctx.lineTo(ax + 25, cy - 35); ctx.stroke();
  ctx.strokeStyle = '#dfe4ee'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(ax + 15, cy - 20); ctx.lineTo(ax + 25, cy - 35); ctx.stroke();
  const hx = ax, hy = cy - 16;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 7.5, 8, 0, 0, Math.PI * 2);
  fillStroke(ctx, c3, 1.6);
  ctx.beginPath();
  ctx.ellipse(hx, hy + 2, 5.4, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#150e18';
  ctx.fill();
  monsterEye(ctx, hx - 2.3, hy + 2, 1.5, '#e04030');
  monsterEye(ctx, hx + 2.3, hy + 2, 1.5, '#e04030');
}

// --- The Anvil King (Lv16) --------------------------------------------------
// A mountain that stood up: boulder torso, anvil-shaped head, fists like
// stones, ore-vein cracks instead of joints.
function paintAnvilKing(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const bob = frame === 1 ? 1 : 0;
  shadow(ctx, ax, ground, 19);
  const cy = ground - 20 + bob;
  limb(ctx, ax - 9, cy + 14, ax - 10, ground - 1, 7, c3);
  limb(ctx, ax + 9, cy + 14, ax + 10, ground - 1, 7, amShade(c3, -0.1));
  ctx.beginPath();
  ctx.moveTo(ax - 15, cy - 4);
  ctx.lineTo(ax + 15, cy - 4);
  ctx.lineTo(ax + 12, cy + 16);
  ctx.lineTo(ax - 12, cy + 16);
  ctx.closePath();
  fillStroke(ctx, c1, 1.8);
  ctx.strokeStyle = amShade(c1, 0.4); ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ax - 6, cy - 2); ctx.lineTo(ax - 2, cy + 6); ctx.lineTo(ax - 8, cy + 12);
  ctx.moveTo(ax + 4, cy); ctx.lineTo(ax + 8, cy + 9);
  ctx.stroke();
  for (const dir of [-1, 1]) {
    limb(ctx, ax + dir * 14, cy - 2, ax + dir * 21, cy + 9, 6, c1);
    ctx.beginPath();
    ctx.arc(ax + dir * 22, cy + 12, 7, 0, Math.PI * 2);
    fillStroke(ctx, amShade(c1, -0.08), 1.6);
  }
  const hx = ax, hy = cy - 15;
  ctx.beginPath();
  ctx.moveTo(hx - 11, hy + 5);
  ctx.lineTo(hx + 11, hy + 5);
  ctx.lineTo(hx + 7, hy - 4);
  ctx.lineTo(hx - 7, hy - 4);
  ctx.closePath();
  fillStroke(ctx, c2, 1.6);
  monsterEye(ctx, hx - 4, hy + 1, 2.4, '#e04020');
  monsterEye(ctx, hx + 4, hy + 1, 2.4, '#e04020');
}

// --- The Hollow Choir (Lv23) -------------------------------------------------
// A robed spirit trailing off into nothing below the waist, ringed by the
// small mask-faces of every voice it's collected.
function paintChoir(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const flap = frame === 1 ? 2 : 0;
  shadow(ctx, ax, ground, 13);
  const cy = ground - 24 + flap * 0.3;
  ctx.beginPath();
  ctx.moveTo(ax - 10, cy - 2);
  ctx.quadraticCurveTo(ax - 14, cy + 20, ax, ground - 2);
  ctx.quadraticCurveTo(ax + 14, cy + 20, ax + 10, cy - 2);
  ctx.quadraticCurveTo(ax, cy - 8, ax - 10, cy - 2);
  ctx.closePath();
  fillStroke(ctx, c1, 1.6);
  const masks = [[-16, -5], [16, -3], [-9, -17], [10, -16]];
  masks.forEach(([mx, my], i) => {
    ctx.globalAlpha = i % 2 ? 0.55 : 0.85;
    ctx.beginPath();
    ctx.ellipse(ax + mx, cy + my, 4, 4.8, 0, 0, Math.PI * 2);
    fillStroke(ctx, c2, 1);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(ax + mx, cy + my + 6, 2.6, 1, 0, 0, Math.PI * 2);
    ctx.fillStyle = INK; ctx.fill();
  });
  const hx = ax, hy = cy - 10;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 7, 8, 0, 0, Math.PI * 2);
  fillStroke(ctx, c1, 1.6);
  monsterEye(ctx, hx - 3, hy - 1, 2, c3);
  monsterEye(ctx, hx + 3, hy - 1, 2, c3);
  ctx.beginPath();
  ctx.ellipse(hx, hy + 4, 2.4, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0c0810'; ctx.fill();
}

// --- Aurelith, the Last Wyrm (Lv28) -----------------------------------------
// A serpent's coiled spine (proven legible from the basilisk) crowned and
// winged, with gold flecks down its back standing in for the names it kept.
function paintAurelith(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const ph = frame === 1 ? 0.5 : 0;
  shadow(ctx, ax, ground, 16);
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    pts.push([ax + Math.sin(i * 0.7 + ph) * 15, ground - 4 - t * 34]);
  }
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 11; ctx.stroke();
  ctx.strokeStyle = c1; ctx.lineWidth = 8.5; ctx.stroke();
  ctx.fillStyle = c3;
  for (let i = 2; i < 19; i += 3) {
    const [x, y] = pts[i];
    ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  const topY = ground - 4 - 34;
  wingShape(ctx, ax - 5, topY + 6, -1, 22, 17, amShade(c2, -0.05));
  wingShape(ctx, ax + 5, topY + 6, 1, 22, 17, c2);
  const [hx, hy] = pts[19];
  ctx.beginPath();
  ctx.ellipse(hx, hy, 8, 6.5, 0, 0, Math.PI * 2);
  fillStroke(ctx, c1, 1.6);
  monsterEye(ctx, hx - 2.6, hy - 1, 2.4, '#3a2400');
  monsterEye(ctx, hx + 2.6, hy - 1, 2.4, '#3a2400');
  for (const dir of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx + dir * 4, hy - 5);
    ctx.lineTo(hx + dir * 4 - 1.2, hy - 11);
    ctx.lineTo(hx + dir * 4 + 1.2, hy - 11);
    ctx.closePath();
    fillStroke(ctx, c3, 0.8);
  }
}

// --- Kharos, the Cinder Sovereign (Lv37) ------------------------------------
// A flame given a crown: teardrop body, fire-wing aura, an ember diadem.
function paintKharos(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const flap = frame === 1 ? 3 : 0;
  shadow(ctx, ax, ground, 15);
  const cy = ground - 22 - flap * 0.3;
  wingShape(ctx, ax - 5, cy + 2, -1, 22, 20, amShade(c1, 0.15));
  wingShape(ctx, ax + 5, cy + 2, 1, 22, 20, c1);
  ctx.beginPath();
  ctx.moveTo(ax, cy - 14);
  ctx.quadraticCurveTo(ax + 10, cy - 2, ax + 7, cy + 14);
  ctx.quadraticCurveTo(ax, cy + 20, ax - 7, cy + 14);
  ctx.quadraticCurveTo(ax - 10, cy - 2, ax, cy - 14);
  ctx.closePath();
  fillStroke(ctx, c1, 1.6);
  ctx.beginPath();
  ctx.moveTo(ax, cy - 8);
  ctx.quadraticCurveTo(ax + 5, cy + 2, ax + 3, cy + 12);
  ctx.quadraticCurveTo(ax, cy + 15, ax - 3, cy + 12);
  ctx.quadraticCurveTo(ax - 5, cy + 2, ax, cy - 8);
  ctx.closePath();
  ctx.fillStyle = c2; ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1;
  const hx = ax, hy = cy - 18;
  ctx.beginPath();
  ctx.arc(hx, hy, 6.5, 0, Math.PI * 2);
  fillStroke(ctx, c1, 1.6);
  monsterEye(ctx, hx - 2.6, hy, 2.2, '#fff2c0');
  monsterEye(ctx, hx + 2.6, hy, 2.2, '#fff2c0');
  for (const dir of [-1.6, -0.6, 0.6, 1.6]) {
    ctx.beginPath();
    ctx.moveTo(hx + dir * 3.4, hy - 6);
    ctx.lineTo(hx + dir * 3.4 - 1, hy - 12 - Math.abs(dir));
    ctx.lineTo(hx + dir * 3.4 + 1, hy - 12 - Math.abs(dir));
    ctx.closePath();
    fillStroke(ctx, c3, 0.8);
  }
}

// --- The Gatekeeper (Lv46) ---------------------------------------------------
// A door given arms: an arched, keyholed torso instead of a chest.
function paintGatekeeper(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const bob = frame === 1 ? 1 : 0;
  shadow(ctx, ax, ground, 17);
  const cy = ground - 20 + bob;
  limb(ctx, ax - 9, cy + 12, ax - 10, ground - 1, 6, c3);
  limb(ctx, ax + 9, cy + 12, ax + 10, ground - 1, 6, amShade(c3, -0.1));
  ctx.beginPath();
  ctx.moveTo(ax - 13, cy + 14);
  ctx.lineTo(ax - 13, cy - 4);
  ctx.quadraticCurveTo(ax - 13, cy - 16, ax, cy - 16);
  ctx.quadraticCurveTo(ax + 13, cy - 16, ax + 13, cy - 4);
  ctx.lineTo(ax + 13, cy + 14);
  ctx.closePath();
  fillStroke(ctx, c1, 1.8);
  ctx.beginPath();
  ctx.moveTo(ax - 8, cy + 11);
  ctx.lineTo(ax - 8, cy - 3);
  ctx.quadraticCurveTo(ax - 8, cy - 11, ax, cy - 11);
  ctx.quadraticCurveTo(ax + 8, cy - 11, ax + 8, cy - 3);
  ctx.lineTo(ax + 8, cy + 11);
  ctx.closePath();
  ctx.fillStyle = amShade(c1, -0.2); ctx.fill();
  ctx.fillStyle = c3;
  ctx.beginPath(); ctx.arc(ax, cy + 1, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ax - 1.6, cy + 2); ctx.lineTo(ax + 1.6, cy + 2);
  ctx.lineTo(ax + 1, cy + 8); ctx.lineTo(ax - 1, cy + 8);
  ctx.closePath(); ctx.fill();
  limb(ctx, ax - 13, cy - 4, ax - 20, cy + 10, 5.5, c1);
  limb(ctx, ax + 13, cy - 4, ax + 20, cy + 10, 5.5, amShade(c1, -0.08));
  const hx = ax, hy = cy - 16;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 6, 5, 0, 0, Math.PI * 2);
  fillStroke(ctx, c2, 1.4);
  monsterEye(ctx, hx - 2.4, hy, 1.8, '#e8ecf4');
  monsterEye(ctx, hx + 2.4, hy, 1.8, '#e8ecf4');
}

// --- Nerith, the Drowned Vicar (Lv55) ---------------------------------------
// A vestment robe with a crozier and a crown, and no visible feet at all.
function paintNerith(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const flap = frame === 1 ? 2 : 0;
  shadow(ctx, ax, ground, 14);
  const cy = ground - 22 + flap * 0.2;
  ctx.beginPath();
  ctx.moveTo(ax - 9, cy - 4);
  ctx.quadraticCurveTo(ax - 16, cy + 16, ax - 12, ground - 1);
  ctx.lineTo(ax + 12, ground - 1);
  ctx.quadraticCurveTo(ax + 16, cy + 16, ax + 9, cy - 4);
  ctx.closePath();
  fillStroke(ctx, c1, 1.6);
  ctx.strokeStyle = c3; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ax - 6, cy - 2); ctx.lineTo(ax - 3, ground - 4);
  ctx.moveTo(ax + 6, cy - 2); ctx.lineTo(ax + 3, ground - 4);
  ctx.stroke();
  ctx.strokeStyle = amShade(c1, -0.3); ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax + 13, cy + 12); ctx.lineTo(ax + 15, cy - 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ax + 15, cy - 22, 3.4, Math.PI * 0.15, Math.PI * 1.6);
  ctx.strokeStyle = c3; ctx.lineWidth = 1.6; ctx.stroke();
  const hx = ax, hy = cy - 12;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 6.5, 7, 0, 0, Math.PI * 2);
  fillStroke(ctx, c1, 1.6);
  monsterEye(ctx, hx - 2.6, hy, 2, c3);
  monsterEye(ctx, hx + 2.6, hy, 2, c3);
  ctx.strokeStyle = c3; ctx.lineWidth = 1.6;
  for (const dir of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx + dir * 3.2, hy - 6);
    ctx.lineTo(hx + dir * 3.2, hy - 11 - (dir === 0 ? 2 : 0));
    ctx.stroke();
  }
}

// --- The World Heart (Lv66) --------------------------------------------------
// A tree given a pulse: root legs, a bark trunk, a glowing heart at its
// centre, and a canopy for a head.
function paintWorldheart(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const bob = frame === 1 ? 1.5 : 0;
  shadow(ctx, ax, ground, 18);
  const cy = ground - 22 + bob;
  for (const dir of [-1, 1]) {
    ctx.strokeStyle = amShade(c1, -0.25); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax + dir * 4, cy + 14);
    ctx.quadraticCurveTo(ax + dir * 12, cy + 18, ax + dir * 14, ground - 1);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(ax - 10, cy + 16);
  ctx.quadraticCurveTo(ax - 13, cy - 4, ax - 8, cy - 14);
  ctx.lineTo(ax + 8, cy - 14);
  ctx.quadraticCurveTo(ax + 13, cy - 4, ax + 10, cy + 16);
  ctx.closePath();
  fillStroke(ctx, amShade(c1, -0.15), 1.8);
  for (const dir of [-1, 1]) {
    ctx.strokeStyle = amShade(c1, -0.15); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax + dir * 8, cy - 8);
    ctx.quadraticCurveTo(ax + dir * 18, cy - 6, ax + dir * 20, cy + 6);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(ax, cy + 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = c3; ctx.fill();
  ctx.beginPath();
  ctx.arc(ax, cy + 2, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = '#fff8d8'; ctx.fill();
  ctx.beginPath();
  ctx.ellipse(ax, cy - 20, 15, 11, 0, 0, Math.PI * 2);
  fillStroke(ctx, c2, 1.8);
  ctx.beginPath();
  ctx.ellipse(ax - 5, cy - 23, 6, 4.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = amShade(c2, 0.2); ctx.fill();
  monsterEye(ctx, ax - 4, cy - 18, 2.2, INK);
  monsterEye(ctx, ax + 4, cy - 18, 2.2, INK);
}

// --- Vessia, the Glass Warden (Lv75) -----------------------------------------
// Angular glass wings and a halo on an armored, faceted body.
function paintVessia(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const flap = frame === 1 ? 2 : 0;
  shadow(ctx, ax, ground, 15);
  const cy = ground - 22;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(ax + dir * 3, cy - 6 - flap);
    ctx.lineTo(ax + dir * 22, cy - 14 - flap);
    ctx.lineTo(ax + dir * 18, cy + 2);
    ctx.lineTo(ax + dir * 6, cy + 6);
    ctx.closePath();
    ctx.globalAlpha = 0.85;
    fillStroke(ctx, dir < 0 ? amShade(c1, -0.05) : c1, 1.2);
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  ctx.moveTo(ax - 7, cy - 10);
  ctx.lineTo(ax + 7, cy - 10);
  ctx.lineTo(ax + 6, cy + 16);
  ctx.lineTo(ax - 6, cy + 16);
  ctx.closePath();
  fillStroke(ctx, c2, 1.6);
  limb(ctx, ax - 4, cy + 14, ax - 5, ground - 1, 3.4, c2);
  limb(ctx, ax + 4, cy + 14, ax + 5, ground - 1, 3.4, amShade(c2, -0.08));
  ctx.strokeStyle = c3; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(ax, cy - 20, 8, 2.4, 0, 0, Math.PI * 2); ctx.stroke();
  const hx = ax, hy = cy - 14;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 5.6, 6, 0, 0, Math.PI * 2);
  fillStroke(ctx, c2, 1.4);
  monsterEye(ctx, hx - 2.2, hy, 1.8, '#8fd6ec');
  monsterEye(ctx, hx + 2.2, hy, 1.8, '#8fd6ec');
}

// --- The Thirteenth (Lv88) ---------------------------------------------------
// A plain cloaked figure at the hub of a nine-spoked wheel — the one shape
// that was in front of you the whole time.
function paintThirteenth(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const spin = frame === 1 ? 0.3 : 0;
  shadow(ctx, ax, ground, 15);
  const cy = ground - 20;
  ctx.save();
  ctx.translate(ax, cy - 4);
  ctx.rotate(spin);
  ctx.strokeStyle = c3; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
    ctx.lineTo(Math.cos(a) * 20, Math.sin(a) * 20);
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(ax - 8, cy + 16);
  ctx.quadraticCurveTo(ax - 10, cy - 6, ax - 6, cy - 14);
  ctx.lineTo(ax + 6, cy - 14);
  ctx.quadraticCurveTo(ax + 10, cy - 6, ax + 8, cy + 16);
  ctx.closePath();
  fillStroke(ctx, c1, 1.8);
  const hx = ax, hy = cy - 18;
  ctx.beginPath();
  ctx.arc(hx, hy, 6, 0, Math.PI * 2);
  fillStroke(ctx, c1, 1.6);
  monsterEye(ctx, hx - 2.4, hy, 2, c2);
  monsterEye(ctx, hx + 2.4, hy, 2, c2);
}

// --- The Seam (Lv96) ---------------------------------------------------------
// Not a robed figure — a jagged, person-shaped tear with a glowing crack
// down the middle and nothing where a face should be but the eyes.
function paintSeam(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  shadow(ctx, ax, ground, 14);
  const cy = ground - 20;
  ctx.beginPath();
  ctx.moveTo(ax - 7, cy + 16);
  ctx.lineTo(ax - 9, cy + 4);
  ctx.lineTo(ax - 6, cy - 4);
  ctx.lineTo(ax - 8, cy - 10);
  ctx.lineTo(ax - 4, cy - 15);
  ctx.lineTo(ax + 4, cy - 15);
  ctx.lineTo(ax + 8, cy - 10);
  ctx.lineTo(ax + 6, cy - 4);
  ctx.lineTo(ax + 9, cy + 4);
  ctx.lineTo(ax + 7, cy + 16);
  ctx.closePath();
  fillStroke(ctx, c1, 1.8);
  ctx.strokeStyle = c2; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(ax, cy - 14);
  ctx.lineTo(ax - 2, cy - 6);
  ctx.lineTo(ax + 2, cy + 2);
  ctx.lineTo(ax - 1, cy + 10);
  ctx.lineTo(ax + 1, cy + 15);
  ctx.stroke();
  monsterEye(ctx, ax - 2.4, cy - 18, 1.8, c3);
  monsterEye(ctx, ax + 2.4, cy - 18, 1.8, c3);
}

// --- Bramble Warden (labyrinth 1, floors 1-4) -------------------------------
// A woven thorn-vine sentinel — berry eyes on the torso instead of a face,
// a real head kept small and half-hidden above it.
function paintBrambleWarden(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const bob = frame === 1 ? 1 : 0;
  shadow(ctx, ax, ground, 14);
  const cy = ground - 20 + bob;
  limb(ctx, ax - 6, cy + 14, ax - 8, ground - 1, 4, c3);
  limb(ctx, ax + 6, cy + 14, ax + 8, ground - 1, 4, amShade(c3, -0.1));
  ctx.beginPath();
  ctx.ellipse(ax, cy, 11, 13, 0, 0, Math.PI * 2);
  fillStroke(ctx, c1, 1.6);
  ctx.strokeStyle = amShade(c1, -0.3); ctx.lineWidth = 1.4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(a) * 10, cy + Math.sin(a) * 12);
    ctx.lineTo(ax + Math.cos(a) * 15, cy + Math.sin(a) * 17);
    ctx.stroke();
  }
  ctx.fillStyle = c3;
  ctx.beginPath(); ctx.arc(ax - 4, cy - 3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ax + 4, cy - 3, 2, 0, Math.PI * 2); ctx.fill();
  limb(ctx, ax - 10, cy - 6, ax - 18, cy + 8, 3, c1);
  limb(ctx, ax + 10, cy - 6, ax + 18, cy + 8, 3, c1);
  const hx = ax, hy = cy - 16;
  ctx.beginPath(); ctx.ellipse(hx, hy, 6, 6, 0, 0, Math.PI * 2); fillStroke(ctx, c2, 1.4);
  monsterEye(ctx, hx - 2.4, hy, 1.8, INK);
  monsterEye(ctx, hx + 2.4, hy, 1.8, INK);
}

// --- The Root Tyrant (labyrinth 1, floor 5) ---------------------------------
// Every corridor in the Bramblemaze was a root — so this is a hub with six
// root-limbs branching out like the maze's own map.
function paintRootTyrant(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  shadow(ctx, ax, ground, 19);
  const cy = ground - 22;
  ctx.strokeStyle = amShade(c1, -0.2); ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.5;
    const x1 = ax + Math.cos(a) * 22, y1 = cy + 6 + Math.sin(a) * 16;
    ctx.beginPath();
    ctx.moveTo(ax, cy + 6);
    ctx.quadraticCurveTo(ax + Math.cos(a) * 12, cy + 6 + Math.sin(a) * 8, x1, y1);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(ax, cy, 12, 14, 0, 0, Math.PI * 2);
  fillStroke(ctx, c1, 1.8);
  ctx.strokeStyle = amShade(c1, -0.3); ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ax - 4, cy - 10); ctx.lineTo(ax - 6, cy + 10);
  ctx.moveTo(ax + 5, cy - 9); ctx.lineTo(ax + 7, cy + 11);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(ax, cy - 18, 10, 7, 0, 0, Math.PI * 2);
  fillStroke(ctx, c2, 1.6);
  monsterEye(ctx, ax - 3.4, cy - 16, 2.2, c3);
  monsterEye(ctx, ax + 3.4, cy - 16, 2.2, c3);
}

// --- Coil Wraith (labyrinth 2, floors 1-4) ----------------------------------
// A ghostly serpent looped into a tight inward spiral instead of rearing
// straight up — it loops the same corridor until the corridor is all there is.
function paintCoilWraith(ctx, ax, ground, sprite, frame) {
  const [c1, , c3] = sprite.palette;
  const ph = frame === 1 ? 0.4 : 0;
  shadow(ctx, ax, ground, 15);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const ang = t * Math.PI * 5 + ph;
    const r = 3 + (1 - t) * 17;
    const xx = ax + Math.cos(ang) * r, yy = ground - 22 + Math.sin(ang) * r * 0.7;
    if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'destination-over'; ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = c1; ctx.lineWidth = 5; ctx.stroke();
  ctx.globalAlpha = 1;
  const hx = ax + 20, hy = ground - 22;
  ctx.beginPath(); ctx.ellipse(hx, hy, 6, 5, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 1.4);
  monsterEye(ctx, hx - 2, hy - 1, 2, c3);
  monsterEye(ctx, hx + 2, hy - 1, 2, c3);
}

// --- The Hollow Oracle (labyrinth 2, floor 5) -------------------------------
// A hooded oracle with a spiral third eye where a mouth would be, ringed by
// floating orbs — answers every question with the same coil of an answer.
function paintHollowOracle(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const flap = frame === 1 ? 2 : 0;
  shadow(ctx, ax, ground, 14);
  const cy = ground - 22 + flap * 0.2;
  ctx.beginPath();
  ctx.moveTo(ax - 9, cy - 4);
  ctx.quadraticCurveTo(ax - 14, cy + 16, ax - 10, ground - 1);
  ctx.lineTo(ax + 10, ground - 1);
  ctx.quadraticCurveTo(ax + 14, cy + 16, ax + 9, cy - 4);
  ctx.closePath();
  fillStroke(ctx, c1, 1.6);
  ctx.fillStyle = c3;
  for (const [ox, oy] of [[-15, -8], [15, -6], [0, -24]]) {
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(ax + ox, cy + oy, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const hx = ax, hy = cy - 12;
  ctx.beginPath(); ctx.ellipse(hx, hy, 6.5, 7, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 1.6);
  ctx.strokeStyle = c3; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, ang = t * Math.PI * 3, r = t * 3.4;
    const xx = hx + Math.cos(ang) * r, yy = hy - 3 + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
  }
  ctx.stroke();
  monsterEye(ctx, hx - 2.6, hy + 3, 1.6, c2);
  monsterEye(ctx, hx + 2.6, hy + 3, 1.6, c2);
}

// --- Cinder Sentinel (labyrinth 3, floors 1-4) ------------------------------
// Banked coals in a shape that still remembers standing guard — a blocky
// plate-armor statue with glowing seams and a halberd held at rest.
function paintCinderSentinel(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  shadow(ctx, ax, ground, 15);
  const cy = ground - 20;
  limb(ctx, ax - 7, cy + 14, ax - 8, ground - 1, 5, c1);
  limb(ctx, ax + 7, cy + 14, ax + 8, ground - 1, 5, amShade(c1, -0.1));
  ctx.beginPath();
  ctx.rect(ax - 10, cy - 12, 20, 26);
  fillStroke(ctx, c1, 1.8);
  ctx.strokeStyle = c3; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(ax - 6, cy - 10); ctx.lineTo(ax - 6, cy + 12);
  ctx.moveTo(ax + 6, cy - 10); ctx.lineTo(ax + 6, cy + 12);
  ctx.moveTo(ax - 10, cy); ctx.lineTo(ax + 10, cy);
  ctx.stroke();
  ctx.strokeStyle = amShade(c1, -0.3); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(ax + 13, cy + 14); ctx.lineTo(ax + 13, cy - 24); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax + 13, cy - 24); ctx.lineTo(ax + 18, cy - 18); ctx.lineTo(ax + 13, cy - 14); ctx.lineTo(ax + 9, cy - 19);
  ctx.closePath(); fillStroke(ctx, c2, 1);
  const hx = ax, hy = cy - 18;
  ctx.beginPath(); ctx.rect(hx - 6, hy - 5, 12, 10); fillStroke(ctx, c2, 1.4);
  ctx.fillStyle = c3;
  ctx.beginPath(); ctx.rect(hx - 4, hy - 1, 8, 2); ctx.fill();
}

// --- The Molten Sovereign (labyrinth 3, floor 5) ----------------------------
// A magma dragon coiled the way the whole spiral maze was always going to
// end — the coil shape of Coil Wraith, given wings, a head, and heat.
function paintMoltenSovereign(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const ph = frame === 1 ? 0.4 : 0;
  shadow(ctx, ax, ground, 18);
  const pts = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, ang = t * Math.PI * 3.2 + ph, r = 4 + t * 18;
    pts.push([ax + Math.cos(ang) * r, ground - 8 - Math.sin(ang) * r * 0.6 - t * 4]);
  }
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.stroke();
  ctx.strokeStyle = c1; ctx.lineWidth = 8.5; ctx.stroke();
  ctx.strokeStyle = c3; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.9;
  ctx.beginPath();
  for (let i = 2; i < 24; i += 6) { const [x, y] = pts[i]; ctx.moveTo(x - 2, y); ctx.lineTo(x + 2, y); }
  ctx.stroke();
  ctx.globalAlpha = 1;
  const [tx, ty] = pts[20];
  wingShape(ctx, tx - 4, ty - 4, -1, 18, 14, amShade(c2, -0.1));
  wingShape(ctx, tx + 4, ty - 4, 1, 18, 14, c2);
  const [hx, hy] = pts[26];
  ctx.beginPath(); ctx.ellipse(hx, hy, 7.5, 6, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 1.6);
  monsterEye(ctx, hx - 2.4, hy - 1, 2.2, '#ffe090');
  monsterEye(ctx, hx + 2.4, hy - 1, 2.2, '#ffe090');
}

// --- Vault Warden (labyrinth 4, floors 1-4) ---------------------------------
// Set to open for no one — a round vault-door torso with a wheel-lock face.
function paintVaultWarden(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const bob = frame === 1 ? 1 : 0;
  shadow(ctx, ax, ground, 16);
  const cy = ground - 20 + bob;
  limb(ctx, ax - 8, cy + 14, ax - 9, ground - 1, 5.6, c3);
  limb(ctx, ax + 8, cy + 14, ax + 9, ground - 1, 5.6, amShade(c3, -0.1));
  ctx.beginPath(); ctx.arc(ax, cy, 13, 0, Math.PI * 2); fillStroke(ctx, c1, 1.8);
  ctx.strokeStyle = c3; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(ax, cy, 6, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(a) * 6, cy + Math.sin(a) * 6);
    ctx.lineTo(ax + Math.cos(a) * 10, cy + Math.sin(a) * 10);
    ctx.stroke();
  }
  limb(ctx, ax - 13, cy - 4, ax - 19, cy + 10, 5, c1);
  limb(ctx, ax + 13, cy - 4, ax + 19, cy + 10, 5, amShade(c1, -0.08));
  const hx = ax, hy = cy - 18;
  ctx.beginPath(); ctx.ellipse(hx, hy, 5.6, 5, 0, 0, Math.PI * 2); fillStroke(ctx, c2, 1.4);
  monsterEye(ctx, hx - 2.2, hy, 1.7, c3);
  monsterEye(ctx, hx + 2.2, hy, 1.7, c3);
}

// --- The Storm Tyrant (labyrinth 4, floor 5) --------------------------------
// The vault only ever opened one way, and it just did — jagged lightning-
// bolt wings instead of a smooth flyer's, a crown of small bolts.
function paintStormTyrant(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const flap = frame === 1 ? 3 : 0;
  shadow(ctx, ax, ground, 15);
  const cy = ground - 24 - flap * 0.3;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(ax + dir * 4, cy - 4);
    ctx.lineTo(ax + dir * 16, cy - 14);
    ctx.lineTo(ax + dir * 10, cy - 8);
    ctx.lineTo(ax + dir * 22, cy + 2);
    ctx.lineTo(ax + dir * 8, cy + 4);
    ctx.closePath();
    fillStroke(ctx, dir < 0 ? amShade(c1, -0.1) : c1, 1.2);
  }
  ctx.beginPath(); ctx.ellipse(ax, cy + 6, 10, 12, 0, 0, Math.PI * 2); fillStroke(ctx, c2, 1.6);
  const hx = ax, hy = cy - 6;
  ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, Math.PI * 2); fillStroke(ctx, c1, 1.6);
  monsterEye(ctx, hx - 2.6, hy, 2.2, '#fffde0');
  monsterEye(ctx, hx + 2.6, hy, 2.2, '#fffde0');
  ctx.strokeStyle = c3; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(hx - 4, hy - 6); ctx.lineTo(hx - 2, hy - 11); ctx.lineTo(hx - 4, hy - 9); ctx.lineTo(hx - 1, hy - 15);
  ctx.moveTo(hx + 4, hy - 6); ctx.lineTo(hx + 2, hy - 11); ctx.lineTo(hx + 4, hy - 9); ctx.lineTo(hx + 1, hy - 15);
  ctx.stroke();
}

// --- Tideworn Sentinel (labyrinth 5, floors 1-4) ----------------------------
// Wore the corridor smooth before the maze wore it down — wide, smooth arcs
// instead of a jagged spine, with a sheen highlight down one side.
function paintTidewornSentinel(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const ph = frame === 1 ? 0.5 : 0;
  shadow(ctx, ax, ground, 15);
  const pts = [];
  for (let i = 0; i < 16; i++) { const t = i / 15; pts.push([ax + Math.sin(i * 0.5 + ph) * 10, ground - 4 - t * 32]); }
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();
  ctx.strokeStyle = c1; ctx.lineWidth = 7.5; ctx.stroke();
  ctx.strokeStyle = c2; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x - 2, y) : ctx.lineTo(x - 2, y)));
  ctx.stroke();
  ctx.globalAlpha = 1;
  const [hx, hy] = pts[15];
  ctx.beginPath(); ctx.ellipse(hx, hy, 7, 5.4, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 1.4);
  monsterEye(ctx, hx - 2.4, hy - 1, 2, c3);
  monsterEye(ctx, hx + 2.4, hy - 1, 2, c3);
  ctx.beginPath();
  ctx.moveTo(hx, hy - 5); ctx.lineTo(hx + 2, hy - 10); ctx.lineTo(hx - 1, hy - 6);
  ctx.closePath(); fillStroke(ctx, c2, 0.8);
}

// --- The Drowned Regent (labyrinth 5, floor 5) ------------------------------
// Still keeps court — a wide, seated silhouette with tattered hem streaks
// and a barnacled crown, arms resting like they're still on a throne.
function paintDrownedRegent(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const flap = frame === 1 ? 1 : 0;
  shadow(ctx, ax, ground, 17);
  const cy = ground - 20 + flap * 0.3;
  ctx.beginPath();
  ctx.moveTo(ax - 13, ground - 1);
  ctx.quadraticCurveTo(ax - 14, cy - 2, ax - 7, cy - 12);
  ctx.lineTo(ax + 7, cy - 12);
  ctx.quadraticCurveTo(ax + 14, cy - 2, ax + 13, ground - 1);
  ctx.closePath();
  fillStroke(ctx, c1, 1.8);
  ctx.strokeStyle = amShade(c1, -0.25); ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ax - 9, ground - 1); ctx.lineTo(ax - 7, cy + 8);
  ctx.moveTo(ax + 2, ground - 1); ctx.lineTo(ax + 1, cy + 9);
  ctx.moveTo(ax + 9, ground - 1); ctx.lineTo(ax + 8, cy + 7);
  ctx.stroke();
  limb(ctx, ax - 7, cy - 6, ax - 16, cy + 2, 3.4, c1);
  limb(ctx, ax + 7, cy - 6, ax + 16, cy + 2, 3.4, c1);
  const hx = ax, hy = cy - 16;
  ctx.beginPath(); ctx.ellipse(hx, hy, 6.4, 7, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 1.6);
  monsterEye(ctx, hx - 2.6, hy, 2, c3);
  monsterEye(ctx, hx + 2.6, hy, 2, c3);
  for (const dir of [-1, 0, 1]) {
    ctx.beginPath(); ctx.arc(hx + dir * 3.4, hy - 8, 1.6, 0, Math.PI * 2); fillStroke(ctx, c2, 0.7);
  }
}

// --- Abyss Warden (labyrinth 6, floors 1-4) ---------------------------------
// Paces the last ring the way a held breath paces a chest — a prowling
// quadruped with glowing ring markings and one asymmetric void eye.
function paintAbyssWarden(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const cy = ground - 15;
  const legSw = frame === 1 ? 1.5 : 0;
  shadow(ctx, ax, ground, 17);
  for (const [lx, sw] of [[-11, legSw], [-4, -legSw], [4, legSw], [11, -legSw]]) {
    limb(ctx, ax + lx, cy + 6, ax + lx + sw, ground - 1, 3, c3);
  }
  ctx.beginPath(); ctx.ellipse(ax - 1, cy, 17, 9, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 1.8);
  ctx.strokeStyle = c3; ctx.lineWidth = 1.2;
  for (const [rx, ry, rr] of [[-6, -1, 3], [3, -3, 2.4], [9, 1, 2]]) {
    ctx.beginPath(); ctx.ellipse(ax + rx, cy + ry, rr, rr * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
  }
  const hx = ax + 16, hy = cy - 7;
  ctx.beginPath(); ctx.ellipse(hx, hy, 7, 6, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 1.6);
  monsterEye(ctx, hx + 1, hy - 1, 2.4, c3);
  ctx.beginPath();
  ctx.moveTo(hx - 4, hy - 6); ctx.lineTo(hx - 1, hy - 11); ctx.lineTo(hx + 2, hy - 6);
  ctx.closePath(); fillStroke(ctx, c2, 1);
  limb(ctx, ax - 17, cy + 2, ax - 25, cy + 8, 2.6, amShade(c1, -0.1));
}

// --- The Endless Maw (labyrinth 6, floor 5) ---------------------------------
// Uncoils once, all the way to the centre, and is still hungry after — the
// serpent spine ending in an actual gaping, toothed maw, not a small head.
function paintEndlessMaw(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const ph = frame === 1 ? 0.4 : 0;
  shadow(ctx, ax, ground, 19);
  const pts = [];
  for (let i = 0; i <= 22; i++) { const t = i / 22; pts.push([ax + Math.sin(i * 0.65 + ph) * 17, ground - 4 - t * 36]); }
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = INK; ctx.lineWidth = 13; ctx.lineCap = 'round'; ctx.stroke();
  ctx.strokeStyle = c1; ctx.lineWidth = 10; ctx.stroke();
  ctx.strokeStyle = c2; ctx.lineWidth = 3; ctx.globalAlpha = 0.5; ctx.stroke();
  ctx.globalAlpha = 1;
  const [hx, hy] = pts[22];
  ctx.beginPath(); ctx.ellipse(hx, hy, 10, 8, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 1.8);
  ctx.beginPath(); ctx.ellipse(hx, hy + 2, 7, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#050208'; ctx.fill();
  ctx.fillStyle = '#e8e4d8';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(hx + i * 2.4, hy - 2); ctx.lineTo(hx + i * 2.4 + 1, hy + 2); ctx.lineTo(hx + i * 2.4 - 1, hy + 2);
    ctx.closePath(); ctx.fill();
  }
  monsterEye(ctx, hx - 5, hy - 6, 1.8, c3);
  monsterEye(ctx, hx + 5, hy - 6, 1.8, c3);
}

export const BOSS_PAINTERS = {
  volk: paintVolk,
  anvilking: paintAnvilKing,
  choir: paintChoir,
  aurelith: paintAurelith,
  kharos: paintKharos,
  gatekeeper: paintGatekeeper,
  nerith: paintNerith,
  worldheart: paintWorldheart,
  vessia: paintVessia,
  thirteenth: paintThirteenth,
  seam: paintSeam,
  bramblewarden: paintBrambleWarden,
  roottyrant: paintRootTyrant,
  coilwraith: paintCoilWraith,
  holloworacle: paintHollowOracle,
  cindersentinel: paintCinderSentinel,
  moltensovereign: paintMoltenSovereign,
  vaultwarden: paintVaultWarden,
  stormtyrant: paintStormTyrant,
  tidewornsentinel: paintTidewornSentinel,
  drownedregent: paintDrownedRegent,
  abysswarden: paintAbyssWarden,
  endlessmaw: paintEndlessMaw,
};
