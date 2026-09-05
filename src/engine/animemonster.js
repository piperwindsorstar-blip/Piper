// ============================================================================
//  ANIME MONSTERS — the eight body plans from engine/monsters.js, redrawn in
//  the same bezier-and-arc style as engine/animeface.js's characters, so a
//  battle doesn't mix two different art styles between one side of the field
//  and the other. Same MW x MH canvas and the same upscale() blow-up for
//  `sprite.scale`, so nothing about how battle.js sizes or positions a
//  monster's billboard has to change.
// ============================================================================

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function amShade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => (amt >= 0 ? c + (255 - c) * amt : c + c * amt);
  return rgbToHex(f(r), f(g), f(b));
}

const INK = '#1c1420';

function fillStroke(ctx, fill, lw = 1.4) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  ctx.stroke();
}

/** A simple round anime-monster eye: white, iris, pupil, one highlight —
 *  no lashes or brow, which would read as fussy at creature scale. */
function monsterEye(ctx, ex, ey, r, iris) {
  ctx.beginPath();
  ctx.arc(ex, ey, r, 0, Math.PI * 2);
  ctx.fillStyle = '#faf6ec';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(0.6, r * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(ex, ey + r * 0.1, r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = iris;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex, ey + r * 0.15, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex - r * 0.25, ey - r * 0.15, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
}

function limb(ctx, x1, y1, x2, y2, w, color) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 1;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function wingShape(ctx, x0, y0, dir, span, height, color) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(x0 + dir * span * 0.5, y0 - height, x0 + dir * span, y0 - height * 0.3);
  ctx.quadraticCurveTo(x0 + dir * span * 0.6, y0 + height * 0.15, x0 + dir * span * 0.3, y0 + height * 0.4);
  ctx.quadraticCurveTo(x0 + dir * span * 0.15, y0 + height * 0.15, x0, y0);
  ctx.closePath();
  fillStroke(ctx, color, 1.2);
}

/** Paints one monster body plan into `ctx`, centred on `ax` with its feet
 *  at `ground`. `sprite`: {plan, palette:[c1,c2,c3]}. `frame` 0/1 (idle/bob),
 *  matching monsterSprite()'s own 2-frame cycle. */
export function paintAnimeMonster(ctx, ax, ground, sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const bob = frame === 1 ? 1.4 : 0;
  const d1 = amShade(c1, -0.25), l1 = amShade(c1, 0.22);

  ctx.fillStyle = 'rgba(10,8,15,0.35)';
  ctx.beginPath();
  ctx.ellipse(ax, ground, 15, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  switch (sprite.plan) {
    case 'blob': {
      const cy = ground - 11 + bob;
      ctx.beginPath();
      ctx.ellipse(ax, cy, 15, 11, 0, 0, Math.PI * 2);
      fillStroke(ctx, c1, 1.6);
      ctx.beginPath();
      ctx.ellipse(ax - 4, cy - 4, 8, 5, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = c2;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
      monsterEye(ctx, ax - 5, cy, 3, INK);
      monsterEye(ctx, ax + 5, cy, 3, INK);
      ctx.strokeStyle = amShade(c3, -0.2);
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ax - 3, cy + 6);
      ctx.quadraticCurveTo(ax, cy + 8, ax + 3, cy + 6);
      ctx.stroke();
      break;
    }
    case 'quadruped': {
      const cy = ground - 15 + bob;
      const legSw = frame === 1 ? 1.5 : 0;
      for (const [lx, sw] of [[-10, legSw], [-3, -legSw], [4, legSw], [11, -legSw]]) {
        limb(ctx, ax + lx, cy + 6, ax + lx + sw, ground - 1, 3, c3);
      }
      ctx.beginPath();
      ctx.ellipse(ax - 1, cy, 16, 8, 0, 0, Math.PI * 2);
      fillStroke(ctx, c1);
      ctx.beginPath();
      ctx.ellipse(ax - 2, cy - 4, 12, 3.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = c2;
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
      const hx = ax + 15, hy = cy - 7;
      ctx.beginPath();
      ctx.ellipse(hx, hy, 7, 6, 0, 0, Math.PI * 2);
      fillStroke(ctx, c1);
      ctx.beginPath();
      ctx.moveTo(hx + 5, hy + 1);
      ctx.lineTo(hx + 11, hy + 3);
      ctx.lineTo(hx + 5, hy + 5);
      ctx.closePath();
      fillStroke(ctx, c3, 1);
      monsterEye(ctx, hx + 1, hy - 1, 2.2, c3);
      ctx.beginPath();
      ctx.moveTo(hx - 4, hy - 6);
      ctx.lineTo(hx - 1, hy - 11);
      ctx.lineTo(hx + 2, hy - 6);
      ctx.closePath();
      fillStroke(ctx, c3, 1);
      limb(ctx, ax - 16, cy + 2, ax - 25, cy + 8, 2.6, amShade(c1, -0.1));
      break;
    }
    case 'humanoid': {
      const cy = ground - 17 + bob;
      limb(ctx, ax - 9, cy - 6, ax - 12, cy + 12, 3.4, d1);
      limb(ctx, ax + 9, cy - 6, ax + 12, cy + 12, 3.4, c2);
      limb(ctx, ax - 8, cy + 15, ax - 9, ground - 1, 3.6, c3);
      limb(ctx, ax + 8, cy + 15, ax + 9, ground - 1, 3.6, amShade(c3, -0.15));
      ctx.beginPath();
      ctx.moveTo(ax - 9, cy - 8);
      ctx.quadraticCurveTo(ax - 12, cy + 6, ax - 9, cy + 15);
      ctx.lineTo(ax + 9, cy + 15);
      ctx.quadraticCurveTo(ax + 12, cy + 6, ax + 9, cy - 8);
      ctx.closePath();
      fillStroke(ctx, c1);
      const hx = ax, hy = cy - 16;
      ctx.beginPath();
      ctx.ellipse(hx, hy, 7, 7.5, 0, 0, Math.PI * 2);
      fillStroke(ctx, c1);
      monsterEye(ctx, hx - 3, hy, 2.4, c3);
      monsterEye(ctx, hx + 3, hy, 2.4, c3);
      ctx.strokeStyle = amShade(c1, -0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx - 2.5, hy + 4);
      ctx.lineTo(hx + 2.5, hy + 4);
      ctx.stroke();
      limb(ctx, ax + 13, cy - 8, ax + 20, cy - 24, 1.6, '#c8ccd4');
      break;
    }
    case 'flyer': {
      const flap = frame === 1 ? 3 : 0;
      const cy = ground - 20 + bob;
      wingShape(ctx, ax - 5, cy - flap, -1, 20, 15, amShade(c3, -0.1));
      wingShape(ctx, ax + 5, cy - flap, 1, 20, 15, c3);
      ctx.beginPath();
      ctx.ellipse(ax, cy + 4, 7, 9, 0, 0, Math.PI * 2);
      fillStroke(ctx, c1);
      const hx = ax, hy = cy - 8;
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      fillStroke(ctx, c1);
      monsterEye(ctx, hx - 3, hy, 2.2, c2);
      monsterEye(ctx, hx + 3, hy, 2.2, c2);
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy + 4);
      ctx.lineTo(hx, hy + 8);
      ctx.lineTo(hx + 2, hy + 4);
      ctx.closePath();
      fillStroke(ctx, amShade(c3, 0.2), 1);
      limb(ctx, ax, cy + 12, ax - 1, ground - 1, 2, c3);
      break;
    }
    case 'serpent': {
      const ph = frame === 1 ? 0.5 : 0;
      ctx.beginPath();
      for (let i = 0; i < 22; i++) {
        const t = i / 21;
        const yy = ground - 4 - t * 38;
        const xx = ax + Math.sin(i * 0.4 + ph) * 13;
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.strokeStyle = c1;
      ctx.lineCap = 'round';
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 11.5;
      ctx.globalCompositeOperation = 'destination-over';
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = c2;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      const hx = ax + Math.sin(21 * 0.4 + ph) * 13, hy = ground - 42;
      ctx.beginPath();
      ctx.ellipse(hx, hy, 8, 6, 0, 0, Math.PI * 2);
      fillStroke(ctx, c1);
      monsterEye(ctx, hx - 4, hy - 1, 2.2, c3);
      monsterEye(ctx, hx + 4, hy - 1, 2.2, c3);
      ctx.strokeStyle = '#d84040';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(hx, hy + 5);
      ctx.lineTo(hx, hy + 9);
      ctx.moveTo(hx, hy + 9);
      ctx.lineTo(hx - 1.5, hy + 11);
      ctx.moveTo(hx, hy + 9);
      ctx.lineTo(hx + 1.5, hy + 11);
      ctx.stroke();
      break;
    }
    case 'construct': {
      const cy = ground - 20 + bob;
      ctx.fillStyle = c3;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.rect(ax - 9, ground - 9, 7, 9);
      ctx.rect(ax + 2, ground - 9, 7, 9);
      ctx.fill(); ctx.stroke();
      limb(ctx, ax - 15, cy - 5, ax - 18, cy + 12, 5, amShade(c3, 0.15));
      limb(ctx, ax + 15, cy - 5, ax + 18, cy + 12, 5, c3);
      ctx.beginPath();
      ctx.moveTo(ax - 15, cy - 12);
      ctx.lineTo(ax + 15, cy - 12);
      ctx.lineTo(ax + 12, cy + 12);
      ctx.lineTo(ax - 12, cy + 12);
      ctx.closePath();
      fillStroke(ctx, c1, 1.6);
      ctx.strokeStyle = d1;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax - 12, cy - 4); ctx.lineTo(ax + 12, cy - 4);
      ctx.moveTo(ax - 11, cy + 4); ctx.lineTo(ax + 11, cy + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(ax - 11, cy - 22, 22, 11);
      fillStroke(ctx, c1, 1.4);
      ctx.fillStyle = '#f86040';
      ctx.beginPath();
      ctx.ellipse(ax - 5, cy - 17, 3, 2, 0, 0, Math.PI * 2);
      ctx.ellipse(ax + 5, cy - 17, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'plant': {
      const cy = ground - 30 + bob;
      ctx.strokeStyle = c3;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ax, cy + 8);
      ctx.lineTo(ax, ground - 1);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(ax - 2.4, cy + 12 + i * 5);
        ctx.lineTo(ax + 2.4, cy + 12 + i * 5);
        ctx.stroke();
      }
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(ax + dir * 13, ground - 20, 10, 4, dir * 0.3, 0, Math.PI * 2);
        fillStroke(ctx, dir < 0 ? c1 : amShade(c1, -0.15), 1);
      }
      ctx.beginPath();
      ctx.ellipse(ax, cy, 13, 11, 0, 0, Math.PI * 2);
      fillStroke(ctx, c1, 1.6);
      ctx.beginPath();
      ctx.ellipse(ax, cy + 2, 9, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#2a1220';
      ctx.fill();
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(ax + i * 4, cy - 3);
        ctx.lineTo(ax + i * 4 + 1.5, cy + 1);
        ctx.lineTo(ax + i * 4 - 1.5, cy + 1);
        ctx.closePath();
        ctx.fillStyle = '#f4f0e0';
        ctx.fill();
      }
      monsterEye(ctx, ax - 8, cy - 6, 2.2, c2);
      monsterEye(ctx, ax + 8, cy - 6, 2.2, c2);
      break;
    }
    case 'dragon': {
      const flap = frame === 1 ? 3 : 0;
      const cy = ground - 22 + bob;
      wingShape(ctx, ax - 6, cy - 6 - flap, -1, 24, 18, amShade(c3, -0.1));
      wingShape(ctx, ax + 6, cy - 6 - flap, 1, 24, 18, c3);
      ctx.strokeStyle = c1;
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ax - 6, cy + 6);
      ctx.quadraticCurveTo(ax - 18, cy + 10, ax - 24, cy + 20);
      ctx.stroke();
      limb(ctx, ax - 8, cy + 12, ax - 9, ground - 1, 5, c3);
      limb(ctx, ax + 8, cy + 12, ax + 9, ground - 1, 5, d1);
      ctx.beginPath();
      ctx.ellipse(ax, cy, 12, 11, 0, 0, Math.PI * 2);
      fillStroke(ctx, c1, 1.6);
      const hx = ax + 12, hy = cy - 15;
      ctx.beginPath();
      ctx.ellipse(hx, hy, 8, 7, 0, 0, Math.PI * 2);
      fillStroke(ctx, c1, 1.6);
      ctx.beginPath();
      ctx.moveTo(hx + 6, hy + 1);
      ctx.lineTo(hx + 13, hy + 3);
      ctx.lineTo(hx + 6, hy + 6);
      ctx.closePath();
      fillStroke(ctx, amShade(c1, -0.15), 1);
      monsterEye(ctx, hx + 1, hy - 1, 2.6, '#f0a020');
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx + dir * 3, hy - 6);
        ctx.lineTo(hx + dir * 5, hy - 13);
        ctx.lineTo(hx + dir * 1, hy - 7);
        ctx.closePath();
        fillStroke(ctx, c2, 1);
      }
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(ax, ground - 12, 12, 0, Math.PI * 2);
      fillStroke(ctx, c1);
    }
  }
}
