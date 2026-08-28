// ============================================================================
//  MONSTERS — eight body plans, drawn at 1:1 into a 64x52 canvas and then
//  blown up with nearest-neighbour, so `scale` genuinely makes a boss bigger
//  and gives it the thick keyline a large sprite needs.
// ============================================================================

import { make, upscale, shade } from './pixel.js';

export const MW = 64, MH = 52;
const OUTLINE = '#0a0810';
const RIM = '#8fa8d8';

export function monsterSprite(sprite, frame = 0) {
  const sc = sprite.scale ?? 1;
  const base = monsterBase(sprite, frame);
  return upscale(base, sc, `mon@${sc}|${sprite.plan}|${sprite.palette.join()}|${frame}`);
}

function monsterBase(sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const key = `mon|${sprite.plan}|${sprite.palette.join()}|${frame}`;
  return make(key, MW, MH, (P) => {
    const ax = MW / 2;
    const G = MH - 2;                 // ground line
    const bob = frame === 1 ? 1 : 0;
    const eye = '#f8f8c0', pupil = '#1c1020';
    const d1 = shade(c1, -0.3), l1 = shade(c1, 0.22);

    switch (sprite.plan) {
      case 'blob': {
        P.ellipse(ax, G - 2, 15, 3, '#00000055');
        P.ellipse(ax, G - 9 + bob, 15, 10, c1);
        P.ellipse(ax - 4, G - 13 + bob, 10, 6, c2);
        P.ellipse(ax + 6, G - 7 + bob, 7, 5, d1);
        P.ellipse(ax - 6, G - 15 + bob, 4, 2, shade(c2, 0.4));      // specular
        P.ellipse(ax - 5, G - 12 + bob, 3, 3, eye); P.ellipse(ax - 5, G - 12 + bob, 1, 1, pupil);
        P.ellipse(ax + 5, G - 12 + bob, 3, 3, eye); P.ellipse(ax + 5, G - 12 + bob, 1, 1, pupil);
        P.ellipse(ax, G - 5 + bob, 4, 1, c3);
        break;
      }
      case 'quadruped': {
        P.ellipse(ax, G - 1, 18, 3, '#00000055');
        for (const [lx, d] of [[-11, 1], [-4, 0], [5, 0], [12, 1]]) {
          P.rect(ax + lx, G - 9, 4, 9, d ? d1 : c3);
          P.rect(ax + lx, G - 2, 4, 2, shade(c3, -0.3));
        }
        P.ellipse(ax - 1, G - 15 + bob, 17, 8, c1);
        P.rect(ax - 17, G - 21 + bob, 32, 3, c2);                    // lit spine
        P.ellipse(ax - 1, G - 11 + bob, 15, 4, d1);                  // belly shadow
        P.ellipse(ax + 15, G - 20 + bob, 8, 7, c1);                  // head
        P.ellipse(ax + 13, G - 23 + bob, 5, 3, c2);
        P.rect(ax + 21, G - 19 + bob, 5, 4, c3);                     // snout
        P.rect(ax + 24, G - 18 + bob, 2, 2, '#241820');
        P.rect(ax + 13, G - 22 + bob, 3, 2, eye); P.px(ax + 14, G - 22 + bob, pupil);
        P.tri(ax + 9, G - 28 + bob, 5, 6, c3);                       // ear
        P.taper(ax - 16, G - 16 + bob, ax - 26, G - 22 + bob, 3, 1, c3, 8);
        break;
      }
      case 'humanoid': {
        P.ellipse(ax, G - 1, 12, 3, '#00000055');
        P.rect(ax - 8, G - 15, 6, 15, c3);
        P.rect(ax + 2, G - 15, 6, 15, d1);
        P.mrect(ax, 2, G - 2, 7, 2, '#231d2c');
        P.rect(ax - 10, G - 34 + bob, 20, 20, c1);                   // torso
        P.rect(ax - 10, G - 34 + bob, 5, 20, c2);
        P.rect(ax + 5, G - 34 + bob, 5, 20, d1);
        P.rect(ax - 10, G - 34 + bob, 20, 3, shade(c2, 0.2));        // shoulders
        P.rect(ax - 10, G - 22 + bob, 20, 2, c3);                    // belt
        P.rect(ax - 15, G - 33 + bob, 5, 17, d1);                    // arms
        P.rect(ax + 10, G - 33 + bob, 5, 17, c2);
        P.rect(ax - 7, G - 47 + bob, 14, 14, c1);                    // head
        P.rect(ax - 7, G - 47 + bob, 4, 14, c2);
        P.rect(ax + 3, G - 47 + bob, 4, 14, d1);
        P.rect(ax - 7, G - 47 + bob, 14, 3, shade(c3, 0.15));
        P.rect(ax - 5, G - 41 + bob, 4, 3, eye); P.rect(ax - 4, G - 40 + bob, 2, 2, pupil);
        P.rect(ax + 1, G - 41 + bob, 4, 3, eye); P.rect(ax + 2, G - 40 + bob, 2, 2, pupil);
        P.rect(ax - 3, G - 36 + bob, 6, 1, d1);
        P.rect(ax + 14, G - 46 + bob, 3, 28, '#9aa2b6');             // blade
        P.rect(ax + 14, G - 46 + bob, 1, 28, '#dfe4f0');
        P.rect(ax + 11, G - 20 + bob, 9, 3, c3);
        break;
      }
      case 'flyer': {
        const flap = frame === 1 ? 4 : 0;
        P.ellipse(ax, G - 1, 10, 2, '#00000044');
        const WH = 13, WSPAN = 22;
        for (const sgn of [-1, 1]) {
          const back = sgn < 0;
          const face = back ? shade(c3, -0.2) : c1;
          const lit = back ? c3 : c2;
          for (let r = 0; r < WH; r++) {
            const t = (r - (WH - 1) / 2) / ((WH - 1) / 2);
            const span = Math.round(WSPAN * Math.sqrt(Math.max(0, 1 - t * t)));
            if (span <= 0) continue;
            const yy = G - 34 + bob - flap + r;
            const x0 = sgn < 0 ? ax - 6 - span : ax + 6;
            P.rect(x0, yy, span, 1, r < 4 ? lit : face);
          }
          for (let k = 0; k < 4; k++) {
            P.rect(ax + sgn * (9 + k * 4), G - 24 + bob - flap + k, 1, 6, shade(face, -0.35));
          }
        }
        P.ellipse(ax, G - 19 + bob, 7, 12, c1);                      // body
        P.ellipse(ax - 2, G - 22 + bob, 4, 7, c2);
        P.ellipse(ax + 3, G - 15 + bob, 3, 5, d1);
        P.ellipse(ax, G - 32 + bob, 6, 6, c1);                       // head
        P.ellipse(ax - 2, G - 34 + bob, 3, 3, c2);
        P.rect(ax - 5, G - 34 + bob, 3, 3, eye); P.px(ax - 4, G - 33 + bob, pupil);
        P.rect(ax + 2, G - 34 + bob, 3, 3, eye); P.px(ax + 3, G - 33 + bob, pupil);
        P.rect(ax - 2, G - 28 + bob, 4, 3, shade(c3, 0.25));         // beak
        P.taper(ax, G - 8 + bob, ax - 2, G - 1, 3, 1, c3, 6);
        break;
      }
      case 'serpent': {
        const ph = frame === 1 ? 0.5 : 0;
        P.ellipse(ax, G - 1, 14, 3, '#00000055');
        for (let i = 0; i < 26; i++) {
          const yy = G - 3 - i * 1.45;
          const xx = ax + Math.round(Math.sin(i * 0.36 + ph) * 15);
          const rr = Math.max(3, 9 - i * 0.22);
          P.ellipse(xx, yy, rr, rr * 0.62, c1);
          P.ellipse(xx - rr * 0.4, yy - 1, rr * 0.5, rr * 0.3, c2);
          P.ellipse(xx + rr * 0.55, yy + 1, rr * 0.3, rr * 0.28, d1);
          if (i % 3 === 0) P.px(xx, yy, c3);
        }
        const hx = ax + Math.round(Math.sin(26 * 0.36 + ph) * 15);
        const hy = G - 42;
        P.ellipse(hx, hy, 10, 7, c1);
        P.ellipse(hx - 3, hy - 2, 6, 4, c2);
        P.rect(hx - 6, hy - 4, 3, 3, eye); P.px(hx - 5, hy - 3, pupil);
        P.rect(hx + 3, hy - 4, 3, 3, eye); P.px(hx + 4, hy - 3, pupil);
        P.rect(hx - 3, hy + 4, 7, 3, shade(c3, 0.15));
        P.rect(hx - 1, hy + 7, 3, 4, '#d84040');
        P.mrect(hx, 5, hy - 11, 3, 6, c3);
        break;
      }
      case 'construct': {
        P.ellipse(ax, G - 1, 16, 3, '#00000066');
        P.rect(ax - 16, G - 32 + bob, 32, 24, c1);                   // block body
        P.rect(ax - 16, G - 32 + bob, 32, 3, c2);
        P.rect(ax + 8, G - 32 + bob, 8, 24, d1);
        P.rect(ax - 16, G - 22 + bob, 32, 1, shade(c3, -0.2));
        P.rect(ax - 16, G - 14 + bob, 32, 1, shade(c3, -0.2));
        P.rect(ax - 11, G - 42 + bob, 22, 11, c1);                   // head block
        P.rect(ax - 11, G - 42 + bob, 22, 2, c2);
        P.rect(ax + 5, G - 42 + bob, 6, 11, d1);
        P.rect(ax - 7, G - 38 + bob, 5, 3, '#f86040');               // optics
        P.rect(ax + 2, G - 38 + bob, 5, 3, '#f86040');
        P.rect(ax - 6, G - 38 + bob, 2, 1, '#ffd0b0');
        P.rect(ax - 24, G - 30 + bob, 8, 20, c3);                    // arms
        P.rect(ax + 16, G - 30 + bob, 8, 20, c3);
        P.rect(ax - 24, G - 30 + bob, 8, 2, shade(c3, 0.25));
        P.rect(ax - 12, G - 9, 9, 9, c3);                            // legs
        P.rect(ax + 3, G - 9, 9, 9, shade(c3, -0.2));
        break;
      }
      case 'plant': {
        P.ellipse(ax, G - 1, 12, 3, '#00000055');
        P.rect(ax - 4, G - 28, 8, 28, c3);                           // stalk
        P.rect(ax - 4, G - 28, 3, 28, c1);
        P.rect(ax + 2, G - 28, 2, 28, shade(c3, -0.3));
        for (let i = 0; i < 5; i++) P.rect(ax - 4, G - 4 - i * 6, 8, 1, shade(c3, -0.35));
        P.ellipse(ax - 13, G - 13, 10, 4, c1);                       // leaves
        P.ellipse(ax - 13, G - 14, 8, 3, c2);
        P.rect(ax - 22, G - 13, 18, 1, shade(c1, -0.3));
        P.ellipse(ax + 13, G - 20, 9, 4, shade(c1, -0.2));
        P.rect(ax + 5, G - 20, 17, 1, shade(c3, -0.2));
        P.ellipse(ax, G - 35 + bob, 13, 11, c1);                     // bulb
        P.ellipse(ax - 3, G - 38 + bob, 8, 6, c2);
        P.ellipse(ax, G - 33 + bob, 9, 5, '#2a1220');                // maw
        for (let i = -6; i <= 6; i += 4) {
          P.rect(ax + i, G - 37 + bob, 2, 3, '#f4f0e0');
          P.rect(ax + i + 2, G - 30 + bob, 2, 3, '#f4f0e0');
        }
        P.rect(ax - 8, G - 42 + bob, 3, 2, eye);
        P.rect(ax + 6, G - 42 + bob, 3, 2, eye);
        break;
      }
      case 'dragon': {
        const flap = frame === 1 ? 4 : 0;
        const memb = shade(c3, -0.15), bone = c2;
        P.ellipse(ax, G - 1, 16, 3, '#00000066');
        for (const sgn of [-1, 1]) {
          const back = sgn < 0;
          const face = back ? shade(memb, -0.28) : memb;
          const WH = 20, WSPAN = 24;
          for (let r = 0; r < WH; r++) {
            const t = (r - (WH - 1) / 2) / ((WH - 1) / 2);
            const span = Math.round(WSPAN * Math.sqrt(Math.max(0, 1 - t * t)));
            if (span <= 0) continue;
            const yy = G - 44 + bob - flap + r;
            const x0 = sgn < 0 ? ax - 7 - span : ax + 7;
            P.rect(x0, yy, span, 1, face);
            if (r < 3) P.rect(x0, yy, span, 1, back ? shade(bone, -0.2) : bone);
          }
          for (let k = 1; k <= 3; k++) {
            P.rect(ax + sgn * (7 + k * 7), G - 41 + bob - flap + k * 3, 1, 18 - k * 4, shade(bone, -0.4));
          }
        }
        P.taper(ax - 10, G - 16, ax - 26, G - 2, 4, 1, c3, 12);      // tail
        for (let i = 0; i < 5; i++) P.px(ax - 13 - i * 2, G - 14 + i * 2, shade(c3, 0.2));
        P.ellipse(ax, G - 17 + bob, 13, 13, c1);                     // body
        P.ellipse(ax - 3, G - 21 + bob, 8, 7, c2);
        P.rect(ax - 11, G - 8, 7, 8, c3);                            // legs
        P.rect(ax + 4, G - 8, 7, 8, shade(c3, -0.2));
        for (let i = 0; i < 12; i++) P.rect(ax - 4 + Math.round(i * 0.4), G - 29 - i + bob, 8, 1, c1);
        P.ellipse(ax + 4, G - 43 + bob, 10, 7, c1);                  // head
        P.ellipse(ax + 2, G - 45 + bob, 6, 4, c2);
        P.rect(ax + 10, G - 43 + bob, 7, 4, shade(c1, -0.15));       // snout
        P.rect(ax + 14, G - 42 + bob, 3, 2, c3);
        P.rect(ax + 1, G - 46 + bob, 3, 3, eye); P.px(ax + 2, G - 45 + bob, pupil);
        P.mrect(ax + 2, 4, G - 53 + bob, 3, 7, c3);                  // horns
        for (let i = 0; i < 7; i++) P.px(ax - 5 + i, G - 34 + bob + i, c3);
        break;
      }
      default:
        P.ellipse(ax, G - 12, 12, 12, c1);
    }
  }, { outline: OUTLINE, ao: 0.26, rim: RIM, rimAlpha: 0.3 });
}
