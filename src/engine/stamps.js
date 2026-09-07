// ============================================================================
//  STAMPS — high-fidelity overlays for the three compositor slots.
//
//  Painted in the 36×48 design grid (the body painter scales the canvas
//  up to 72×96). One function per race, one per armour kind, extra metal
//  on the weapon that is already in the hand.
// ============================================================================

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
function afShade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => (amt >= 0 ? c + (255 - c) * amt : c + c * amt);
  return rgbToHex(f(r), f(g), f(b));
}
function afMix(a, b, t) {
  const [ar, ag, ab] = hexToRgb(a), [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function paintRaceStamp(ctx, hx, hy, hw, hh, raceId, skin, ink) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const r = raceId ?? 'human';
  if (r === 'elf') {
    ctx.strokeStyle = afShade(skin, -0.25);
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(hx - hw * 0.22, hy + hh * 0.12);
    ctx.quadraticCurveTo(hx, hy + hh * 0.28, hx + hw * 0.18, hy + hh * 0.1);
    ctx.stroke();
    ctx.fillStyle = 'rgba(180, 230, 160, 0.35)';
    ctx.beginPath();
    ctx.arc(hx + hw * 0.42, hy - hh * 0.05, 0.7, 0, Math.PI * 2);
    ctx.fill();
  } else if (r === 'dwarf') {
    ctx.fillStyle = afShade(skin, -0.18);
    ctx.beginPath();
    ctx.ellipse(hx, hy + hh * 0.22, hw * 0.22, hh * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  } else if (r === 'fairy') {
    ctx.fillStyle = 'rgba(255, 210, 240, 0.55)';
    for (const [dx, dy] of [[-hw * 1.15, -hh * 0.1], [hw * 1.15, -hh * 0.2], [0, -hh * 1.35]]) {
      ctx.beginPath();
      ctx.arc(hx + dx, hy + dy, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (r === 'saurian') {
    ctx.fillStyle = afShade(skin, -0.22);
    for (const [dx, dy] of [[-hw * 0.55, hh * 0.15], [-hw * 0.4, hh * 0.35], [hw * 0.5, hh * 0.18]]) {
      ctx.beginPath();
      ctx.ellipse(hx + dx, hy + dy, 0.9, 0.55, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (r === 'lupine') {
    ctx.fillStyle = afShade(skin, -0.3);
    ctx.beginPath();
    ctx.ellipse(hx, hy + hh * 0.28, hw * 0.16, hh * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(hx, hy + hh * 0.32);
    ctx.lineTo(hx, hy + hh * 0.48);
    ctx.stroke();
  } else if (r === 'ogrekin') {
    ctx.fillStyle = afShade(skin, -0.28);
    ctx.beginPath();
    ctx.moveTo(hx - hw * 0.7, hy - hh * 0.15);
    ctx.quadraticCurveTo(hx, hy - hh * 0.42, hx + hw * 0.7, hy - hh * 0.15);
    ctx.quadraticCurveTo(hx, hy - hh * 0.08, hx - hw * 0.7, hy - hh * 0.15);
    ctx.fill();
  } else if (r === 'gnome') {
    ctx.strokeStyle = afMix('#c8d8e8', skin, 0.2);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(hx - hw * 0.32, hy + hh * 0.02, hw * 0.28, hh * 0.2, 0, 0, Math.PI * 2);
    ctx.ellipse(hx + hw * 0.32, hy + hh * 0.02, hw * 0.28, hh * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (r === 'merfolk') {
    ctx.strokeStyle = afShade(skin, -0.25);
    ctx.lineWidth = 0.6;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + dir * hw * 0.72, hy + hh * 0.05);
      ctx.quadraticCurveTo(hx + dir * hw * 0.88, hy + hh * 0.2, hx + dir * hw * 0.7, hy + hh * 0.38);
      ctx.stroke();
    }
  } else if (r === 'draconian') {
    ctx.fillStyle = afShade(skin, -0.2);
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + dir * hw * 0.15, hy - hh * 0.95);
      ctx.lineTo(hx + dir * hw * 0.08, hy - hh * 1.25);
      ctx.lineTo(hx + dir * hw * 0.28, hy - hh * 0.9);
      ctx.closePath();
      ctx.fill();
    }
  } else if (r === 'automaton') {
    ctx.strokeStyle = 'rgba(220, 230, 245, 0.7)';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(hx - hw * 0.55, hy - hh * 0.1);
    ctx.lineTo(hx + hw * 0.55, hy - hh * 0.1);
    ctx.moveTo(hx, hy - hh * 0.55);
    ctx.lineTo(hx, hy + hh * 0.45);
    ctx.stroke();
    ctx.fillStyle = '#7ec8e8';
    ctx.beginPath();
    ctx.arc(hx + hw * 0.38, hy + hh * 0.35, 0.7, 0, Math.PI * 2);
    ctx.fill();
  } else if (r === 'revenant') {
    ctx.strokeStyle = 'rgba(160, 170, 220, 0.7)';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(hx - hw * 0.15, hy - hh * 0.4);
    ctx.lineTo(hx - hw * 0.05, hy + hh * 0.35);
    ctx.moveTo(hx + hw * 0.2, hy - hh * 0.15);
    ctx.lineTo(hx + hw * 0.35, hy + hh * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

export function paintArmorStamp(ctx, ax, lean, bodyTop, hipY, bodyW, armor, cloth, trim, metal, metalL, metalD, ink) {
  if (!armor) return;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (armor.kind === 'plate' || armor.kind === 'mail') {
    ctx.fillStyle = metalL;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.7;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(ax + dir * bodyW * 0.72 + lean, bodyTop + 5, 2.2, 3.1, dir * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = metalD;
    for (const [dx, dy] of [[-2.2, 5], [2.2, 5], [0, 8], [-1.6, 11], [1.6, 11]]) {
      ctx.beginPath();
      ctx.arc(ax + lean + dx, bodyTop + dy, 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = afShade(trim, -0.1);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(ax - bodyW * 0.45 + lean, hipY - 1);
    ctx.lineTo(ax + bodyW * 0.45 + lean, hipY - 1);
    ctx.stroke();
  }
  if (armor.kind === 'mail') {
    ctx.strokeStyle = 'rgba(20,16,24,0.35)';
    ctx.lineWidth = 0.45;
    for (let y = bodyTop + 4; y < hipY - 2; y += 2.2) {
      ctx.beginPath();
      ctx.moveTo(ax - bodyW * 0.4 + lean, y);
      ctx.lineTo(ax + bodyW * 0.4 + lean, y + 1.2);
      ctx.stroke();
    }
  }
  if (armor.kind === 'leather') {
    ctx.strokeStyle = afShade(cloth, -0.35);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(ax - bodyW * 0.15 + lean, bodyTop + 2);
    ctx.lineTo(ax - bodyW * 0.35 + lean, hipY);
    ctx.moveTo(ax + bodyW * 0.15 + lean, bodyTop + 2);
    ctx.lineTo(ax + bodyW * 0.35 + lean, hipY);
    ctx.stroke();
  }
  if (armor.kind === 'robe' || armor.kind === 'vestments' || armor.kind === 'silk') {
    ctx.strokeStyle = afShade(cloth, 0.22);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(ax - bodyW * 0.2 + lean, bodyTop + 3);
    ctx.quadraticCurveTo(ax - bodyW * 0.55 + lean, hipY, ax - bodyW * 0.7 + lean, hipY + 8);
    ctx.moveTo(ax + bodyW * 0.15 + lean, bodyTop + 4);
    ctx.quadraticCurveTo(ax + bodyW * 0.5 + lean, hipY + 2, ax + bodyW * 0.65 + lean, hipY + 8);
    ctx.stroke();
  }
  if (armor.kind === 'gi') {
    ctx.strokeStyle = trim;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ax - bodyW * 0.35 + lean, bodyTop + 1);
    ctx.lineTo(ax + bodyW * 0.05 + lean, hipY);
    ctx.moveTo(ax + bodyW * 0.35 + lean, bodyTop + 1);
    ctx.lineTo(ax - bodyW * 0.05 + lean, hipY);
    ctx.stroke();
  }
  ctx.restore();
}

export function paintWeaponStamp(ctx, handX, handY, angle, category, accent) {
  if (category === 'blade') {
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(handX, handY, 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(handX + Math.cos(angle) * 2, handY + Math.sin(angle) * 2);
    ctx.lineTo(handX + Math.cos(angle) * 7, handY + Math.sin(angle) * 7);
    ctx.stroke();
  } else if (category === 'staff') {
    ctx.strokeStyle = 'rgba(255,240,180,0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(handX + Math.cos(angle) * 12, handY + Math.sin(angle) * 12, 2.6, 0, Math.PI * 2);
    ctx.stroke();
  }
}
