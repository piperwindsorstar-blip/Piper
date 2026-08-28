// ============================================================================
//  SPRITES — everything is drawn procedurally into cached offscreen canvases.
//
//  There are no image assets: a character sprite is assembled from a class KIT
//  (silhouette: helm, body, cape, weapon) tinted by the character's ELEMENT,
//  and a monster sprite is assembled from a BODY PLAN plus a three-colour ramp.
//  The proportions follow the Final Fantasy VI battle sprite: a large head on a
//  short body, hard two-tone shading, and a single highlight pass.
// ============================================================================

import { ELEMENT_BY_ID } from '../data/elements.js';
import { getClass } from '../data/classes.js';

const cache = new Map();

function make(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  const P = {
    px: (x, y, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); },
    rect: (x, y, rw, rh, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, rw | 0, rh | 0); },
    // mirrored draw around a vertical axis at `ax`
    mrect: (ax, x, y, rw, rh, col) => {
      c.fillStyle = col;
      c.fillRect((ax + x) | 0, y | 0, rw | 0, rh | 0);
      c.fillRect((ax - x - rw) | 0, y | 0, rw | 0, rh | 0);
    },
    ellipse: (cx, cy, rx, ry, col) => {
      c.fillStyle = col;
      for (let y = -ry; y <= ry; y++) {
        const dx = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
        c.fillRect((cx - dx) | 0, (cy + y) | 0, dx * 2 + 1, 1);
      }
    },
    tri: (x, y, wdt, hgt, col, dir = 1) => {
      c.fillStyle = col;
      for (let i = 0; i < hgt; i++) {
        const t = i / hgt;
        const ww = Math.round(wdt * (dir > 0 ? 1 - t : t));
        c.fillRect((x + (wdt - ww) / 2) | 0, (y + i) | 0, Math.max(1, ww), 1);
      }
    },
  };
  draw(P, c);
  cache.set(key, cv);
  return cv;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = f(((n >> 16) & 255) * (1 + amt));
  const g = f(((n >> 8) & 255) * (1 + amt));
  const b = f((n & 255) * (1 + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
//  CLASS KITS — silhouette rules per root class
// ---------------------------------------------------------------------------
const SKIN = ['#e8b890', '#c89068', '#a06848', '#7a4c30'];
const HAIR = ['#3a2a20', '#7a4a20', '#c8a040', '#a02830', '#e8e8f0', '#204068'];

const KITS = {
  warrior:   { head: 'helm',   body: 'plate', cape: true,  weapon: 'sword',  cloth: '#a03028', trim: '#d8b048' },
  guardian:  { head: 'greathelm', body: 'plate', cape: true, weapon: 'shield', cloth: '#3050a0', trim: '#c8d0e0' },
  monk:      { head: 'band',   body: 'gi',    cape: false, weapon: 'fist',   cloth: '#d8a850', trim: '#a04828' },
  lancer:    { head: 'horned', body: 'plate', cape: true,  weapon: 'spear',  cloth: '#2f6f4f', trim: '#d8c060' },
  thief:     { head: 'hood',   body: 'light', cape: false, weapon: 'dagger', cloth: '#48407a', trim: '#8878c0' },
  archer:    { head: 'cap',    body: 'light', cape: true,  weapon: 'bow',    cloth: '#40683a', trim: '#a8c070' },
  dancer:    { head: 'veil',   body: 'dress', cape: false, weapon: 'dagger', cloth: '#c04888', trim: '#f0c8e0' },
  jester:    { head: 'jester', body: 'motley', cape: false, weapon: 'dagger', cloth: '#8838a0', trim: '#f0d048' },
  mage:      { head: 'hat',    body: 'robe',  cape: false, weapon: 'staff',  cloth: '#3a3a8c', trim: '#c8b060' },
  cleric:    { head: 'mitre',  body: 'robe',  cape: true,  weapon: 'mace',   cloth: '#e0e0e8', trim: '#c8a040' },
  summoner:  { head: 'horns',  body: 'robe',  cape: true,  weapon: 'staff',  cloth: '#6a3a8c', trim: '#d8b8f0' },
  spiritist: { head: 'mask',   body: 'robe',  cape: false, weapon: 'staff',  cloth: '#2a6a6a', trim: '#a0e0d0' },
};

const SW = 24, SH = 32;   // battle sprite size

/**
 * Battle/field sprite for a party member.
 * @param {object} o {classId, elementId, skin, hair, frame}
 */
export function heroSprite(o) {
  const cls = getClass(o.classId);
  const kit = KITS[cls.root];
  const el = ELEMENT_BY_ID[o.elementId] ?? { color: '#c8c8d8', color2: '#ffffff' };
  const tier = cls.tier;
  const skin = SKIN[o.skin ?? 0];
  const hair = HAIR[o.hair ?? 0];
  const frame = o.frame ?? 0;   // 0 idle, 1 step, 2 hurt, 3 attack
  const key = `hero|${cls.root}|${tier}|${o.elementId}|${o.skin ?? 0}|${o.hair ?? 0}|${frame}`;

  return make(key, SW, SH, (P) => {
    const ax = 12;                            // mirror axis
    const bob = frame === 1 ? 1 : 0;          // walk bob
    const lean = frame === 3 ? 2 : 0;         // attack lunge
    const hurt = frame === 2;
    // higher-tier characters get a brighter trim and an element aura ring
    const cloth = tier >= 3 ? shade(kit.cloth, 0.18) : kit.cloth;
    const clothD = shade(cloth, -0.4);
    const trim = tier >= 2 ? el.color : kit.trim;
    const trimL = shade(trim, 0.4);

    const y0 = 4 + bob;

    // --- aura for promoted classes ---------------------------------------
    if (tier >= 2) {
      P.ellipse(ax, 30, 8, 2, shade(el.color, -0.55));
      if (tier >= 4) P.ellipse(ax, 30, 10, 3, shade(el.color, -0.7));
    }

    // --- cape (behind) ----------------------------------------------------
    if (kit.cape) {
      P.rect(ax - 5 - lean, y0 + 9, 10, 13, clothD);
      P.rect(ax - 5 - lean, y0 + 9, 10, 1, shade(cloth, -0.15));
      P.mrect(ax, 4 + lean, y0 + 20, 2, 2, clothD);
    }

    // --- legs -------------------------------------------------------------
    const legY = y0 + 21;
    P.mrect(ax, 1, legY, 3, 6, kit.body === 'robe' || kit.body === 'dress' ? cloth : '#4a4a5a');
    P.mrect(ax, 1, legY + 5, 4, 2, '#2a2a34');            // boots
    if (kit.body === 'robe' || kit.body === 'dress') {
      // skirt over the legs
      for (let i = 0; i < 6; i++) P.mrect(ax, 0, legY + i, 4 + Math.floor(i / 2), 1, cloth);
      P.mrect(ax, 0, legY + 5, 7, 1, clothD);
    }

    // --- torso ------------------------------------------------------------
    const tY = y0 + 11;
    if (kit.body === 'plate') {
      P.mrect(ax, 0, tY, 6, 10, cloth);
      P.mrect(ax, 4, tY, 2, 10, clothD);
      P.mrect(ax, 0, tY, 6, 1, trimL);
      P.mrect(ax, 0, tY + 4, 6, 1, trim);           // belt
      P.mrect(ax, 3, tY + 1, 2, 3, trimL);          // pauldrons
    } else if (kit.body === 'robe') {
      P.mrect(ax, 0, tY, 6, 11, cloth);
      P.mrect(ax, 4, tY, 2, 11, clothD);
      P.rect(ax - 1, tY, 2, 11, trim);              // stole down the front
      P.mrect(ax, 0, tY + 10, 7, 1, clothD);
    } else if (kit.body === 'gi') {
      P.mrect(ax, 0, tY, 6, 10, cloth);
      P.mrect(ax, 4, tY, 2, 10, clothD);
      P.rect(ax - 3, tY, 3, 8, shade(cloth, 0.25));
      P.mrect(ax, 0, tY + 5, 6, 2, trim);           // sash
    } else if (kit.body === 'motley') {
      for (let i = 0; i < 10; i++) {
        P.rect(ax - 6, tY + i, 6, 1, i % 2 ? cloth : trim);
        P.rect(ax, tY + i, 6, 1, i % 2 ? trim : cloth);
      }
    } else if (kit.body === 'dress') {
      P.mrect(ax, 0, tY, 5, 10, cloth);
      P.mrect(ax, 3, tY, 2, 10, clothD);
      P.mrect(ax, 0, tY + 3, 5, 1, trimL);
    } else { // light
      P.mrect(ax, 0, tY, 6, 10, cloth);
      P.mrect(ax, 4, tY, 2, 10, clothD);
      P.mrect(ax, 0, tY + 5, 6, 1, trim);
    }

    // --- arms -------------------------------------------------------------
    const armY = tY + 2;
    P.rect(ax - 8, armY, 2, 7, cloth);                       // back arm
    P.rect(ax - 8, armY + 6, 2, 2, skin);
    P.rect(ax + 6 + lean, armY - lean, 2, 7, shade(cloth, 0.12)); // front arm
    P.rect(ax + 6 + lean, armY + 6 - lean, 2, 2, skin);

    // --- head -------------------------------------------------------------
    const hY = y0;
    P.rect(ax - 4, hY, 8, 9, skin);                    // face block
    P.rect(ax + 2, hY, 2, 9, shade(skin, -0.22));      // cheek shadow
    P.rect(ax - 4, hY + 8, 8, 1, shade(skin, -0.3));   // jaw
    // eyes (FF6 sprites read as two dark pips)
    if (!hurt) {
      P.rect(ax - 3, hY + 4, 1, 2, '#241820');
      P.rect(ax + 1, hY + 4, 1, 2, '#241820');
    } else {
      P.rect(ax - 3, hY + 5, 2, 1, '#241820');
      P.rect(ax + 1, hY + 5, 2, 1, '#241820');
    }

    // headgear
    switch (kit.head) {
      case 'helm':
        P.rect(ax - 5, hY - 2, 10, 5, trim);
        P.rect(ax - 5, hY - 2, 10, 1, trimL);
        P.rect(ax - 1, hY + 2, 2, 5, shade(trim, -0.2));   // nasal bar
        break;
      case 'greathelm':
        P.rect(ax - 5, hY - 3, 10, 9, trim);
        P.rect(ax - 5, hY - 3, 10, 1, trimL);
        P.rect(ax - 4, hY + 3, 8, 2, '#101018');           // visor slit
        P.rect(ax - 1, hY - 6, 2, 3, el.color);            // crest
        break;
      case 'horned':
        P.rect(ax - 5, hY - 2, 10, 5, trim);
        P.mrect(ax, 4, hY - 5, 2, 4, el.color);            // horns
        break;
      case 'horns':
        P.rect(ax - 4, hY - 1, 8, 3, hair);
        P.mrect(ax, 3, hY - 5, 2, 5, el.color);
        break;
      case 'hat': {                                        // wide wizard brim
        P.rect(ax - 8, hY - 1, 16, 2, cloth);
        P.tri(ax - 5, hY - 9, 10, 9, cloth);
        P.rect(ax - 8, hY - 1, 16, 1, shade(cloth, 0.3));
        P.rect(ax - 2, hY - 3, 4, 2, trim);
        break;
      }
      case 'mitre':
        P.rect(ax - 4, hY - 6, 8, 7, cloth);
        P.tri(ax - 4, hY - 9, 8, 4, cloth);
        P.rect(ax - 1, hY - 5, 2, 4, trim);
        break;
      case 'hood':
        P.rect(ax - 5, hY - 2, 10, 6, cloth);
        P.mrect(ax, 3, hY + 3, 2, 5, cloth);
        P.rect(ax - 5, hY - 2, 10, 1, shade(cloth, 0.25));
        P.rect(ax - 4, hY + 3, 8, 1, shade(cloth, -0.35));
        break;
      case 'cap':
        P.rect(ax - 4, hY - 2, 8, 3, cloth);
        P.rect(ax + 1, hY - 5, 3, 4, el.color);            // feather
        break;
      case 'band':
        P.rect(ax - 4, hY - 1, 8, 3, hair);
        P.rect(ax - 5, hY + 1, 10, 2, trim);
        P.rect(ax - 7, hY + 2, 3, 1, trim);                // trailing tie
        break;
      case 'jester': {
        P.rect(ax - 4, hY - 2, 8, 3, cloth);
        for (let i = 0; i < 3; i++) {
          P.rect(ax - 6 - i, hY - 4 - i, 2, 2, i % 2 ? trim : cloth);
          P.rect(ax + 4 + i, hY - 4 - i, 2, 2, i % 2 ? cloth : trim);
        }
        P.rect(ax - 8, hY - 7, 2, 2, el.color);
        P.rect(ax + 6, hY - 7, 2, 2, el.color);
        break;
      }
      case 'veil':
        P.rect(ax - 4, hY - 2, 8, 3, hair);
        P.rect(ax - 5, hY + 1, 10, 1, trim);
        P.mrect(ax, 4, hY + 2, 2, 7, shade(trim, -0.15));
        break;
      case 'mask':
        P.rect(ax - 4, hY - 2, 8, 3, hair);
        P.rect(ax - 5, hY + 2, 10, 4, trim);
        P.rect(ax - 3, hY + 3, 2, 2, '#101018');
        P.rect(ax + 1, hY + 3, 2, 2, '#101018');
        break;
      default:
        P.rect(ax - 4, hY - 2, 8, 4, hair);
    }
    if (kit.head === 'band' || kit.head === 'cap' || kit.head === 'veil') {
      P.mrect(ax, 4, hY + 2, 1, 5, hair);                  // side hair
    }

    // --- weapon -----------------------------------------------------------
    const wx = ax + 8 + lean;
    const wy = armY - 4 - lean;
    switch (kit.weapon) {
      case 'sword':
        P.rect(wx, wy - 6, 2, 14, '#d8dce8');
        P.rect(wx, wy - 6, 1, 14, '#ffffff');
        P.rect(wx - 2, wy + 7, 6, 2, trim);
        P.rect(wx, wy + 9, 2, 3, '#5a4028');
        break;
      case 'spear':
        P.rect(wx, wy - 10, 2, 24, '#6a4a28');
        P.tri(wx - 1, wy - 15, 4, 6, '#d8dce8');
        P.rect(wx - 1, wy - 9, 4, 2, trim);
        break;
      case 'staff':
        P.rect(wx, wy - 6, 2, 20, '#6a4a28');
        P.ellipse(wx + 1, wy - 8, 3, 3, el.color);
        P.ellipse(wx + 1, wy - 9, 1, 1, '#ffffff');
        break;
      case 'bow':
        for (let i = -8; i <= 8; i++) {
          const dx = Math.round(3 * Math.cos((i / 9) * 1.4));
          P.rect(wx + dx, wy + 2 + i, 2, 1, '#8a6030');
        }
        P.rect(wx + 1, wy - 6, 1, 17, '#e8e8f0');
        break;
      case 'dagger':
        P.rect(wx, wy + 1, 2, 7, '#d8dce8');
        P.rect(wx - 1, wy + 8, 4, 1, trim);
        break;
      case 'mace':
        P.rect(wx, wy + 1, 2, 10, '#6a4a28');
        P.ellipse(wx + 1, wy, 3, 3, trim);
        break;
      case 'shield':
        P.rect(wx - 1, wy, 6, 12, trim);
        P.rect(wx - 1, wy, 6, 1, trimL);
        P.rect(wx + 1, wy + 3, 2, 5, el.color);
        break;
      case 'fist':
        P.rect(wx - 1, wy + 5, 4, 4, shade(skin, -0.1));
        P.rect(wx - 1, wy + 5, 4, 1, trim);
        break;
      default: break;
    }
  });
}

// ---------------------------------------------------------------------------
//  MONSTER BODY PLANS
// ---------------------------------------------------------------------------
export function monsterSprite(sprite, frame = 0) {
  const [c1, c2, c3] = sprite.palette;
  const sc = sprite.scale ?? 1;
  const w = Math.round(32 * sc), h = Math.round(32 * sc);
  const key = `mon|${sprite.plan}|${sprite.palette.join()}|${sc}|${frame}`;
  return make(key, w, h, (P) => {
    const ax = w / 2;
    const bob = frame === 1 ? 1 : 0;
    const eye = '#f8f8c0', pupil = '#201020';
    const H2 = h - 1;
    switch (sprite.plan) {
      case 'blob': {
        P.ellipse(ax, H2 - 6 + bob, w * 0.42, h * 0.30, c1);
        P.ellipse(ax, H2 - 9 + bob, w * 0.34, h * 0.22, c2);
        P.ellipse(ax, H2 - 3, w * 0.44, h * 0.10, c3);
        P.ellipse(ax - w * 0.12, H2 - 12 + bob, 2, 2, eye);
        P.ellipse(ax + w * 0.12, H2 - 12 + bob, 2, 2, eye);
        P.px(ax - w * 0.12, H2 - 12 + bob, pupil);
        P.px(ax + w * 0.12, H2 - 12 + bob, pupil);
        P.ellipse(ax - w * 0.16, H2 - 15 + bob, 2, 1, shade(c2, 0.5));
        break;
      }
      case 'quadruped': {
        P.rect(ax - w * 0.30, H2 - 14 + bob, w * 0.52, h * 0.28, c1);   // body
        P.rect(ax - w * 0.30, H2 - 14 + bob, w * 0.52, 2, c2);
        P.rect(ax - w * 0.30, H2 - 6, w * 0.52, 2, c3);
        for (const lx of [-0.26, -0.10, 0.10, 0.24]) {
          P.rect(ax + w * lx, H2 - 6, 3, 6, c3);
        }
        P.rect(ax + w * 0.16, H2 - 20 + bob, w * 0.24, h * 0.22, c1);   // head
        P.rect(ax + w * 0.16, H2 - 20 + bob, w * 0.24, 2, c2);
        P.rect(ax + w * 0.36, H2 - 15 + bob, 3, 3, c3);                 // snout
        P.rect(ax + w * 0.22, H2 - 17 + bob, 2, 2, eye);
        P.rect(ax + w * 0.16, H2 - 23 + bob, 2, 3, c3);                 // ear
        P.rect(ax - w * 0.34, H2 - 16 + bob, 3, 6, c3);                 // tail
        break;
      }
      case 'humanoid': {
        P.rect(ax - 4, H2 - 30 + bob, 8, 8, c1);                        // head
        P.rect(ax - 4, H2 - 30 + bob, 8, 2, c2);
        P.rect(ax - 3, H2 - 26 + bob, 2, 2, eye); P.px(ax - 3, H2 - 26 + bob, pupil);
        P.rect(ax + 1, H2 - 26 + bob, 2, 2, eye); P.px(ax + 2, H2 - 26 + bob, pupil);
        P.rect(ax - 6, H2 - 22 + bob, 12, 12, c1);                      // torso
        P.rect(ax - 6, H2 - 22 + bob, 12, 2, c2);
        P.rect(ax + 2, H2 - 22 + bob, 4, 12, c3);
        P.rect(ax - 9, H2 - 21 + bob, 3, 10, c3);                       // arms
        P.rect(ax + 6, H2 - 21 + bob, 3, 10, c3);
        P.rect(ax - 5, H2 - 10, 4, 9, c3);                              // legs
        P.rect(ax + 1, H2 - 10, 4, 9, c3);
        break;
      }
      case 'flyer': {
        const flap = frame === 1 ? 2 : 0;
        P.ellipse(ax, H2 - 16 + bob, 5, 7, c1);                         // body
        P.ellipse(ax, H2 - 19 + bob, 4, 4, c2);
        for (const s of [-1, 1]) {                                      // wings
          for (let i = 0; i < 10; i++) {
            const yy = H2 - 20 + bob + Math.round(i * 0.5) - flap;
            P.rect(ax + s * (5 + i), yy, 1, Math.max(1, 8 - i), s < 0 ? c3 : c1);
          }
        }
        P.px(ax - 2, H2 - 20 + bob, eye);
        P.px(ax + 2, H2 - 20 + bob, eye);
        P.ellipse(ax, H2 - 8, 3, 4, c3);                                // tail
        break;
      }
      case 'serpent': {
        for (let i = 0; i < 16; i++) {
          const yy = H2 - 2 - i * 1.6;
          const xx = ax + Math.round(Math.sin(i * 0.55 + (frame === 1 ? 0.5 : 0)) * w * 0.22);
          const rr = Math.max(2, 6 - i * 0.25);
          P.ellipse(xx, yy, rr, rr * 0.6, i % 2 ? c1 : c2);
        }
        const hx = ax + Math.round(Math.sin(16 * 0.55) * w * 0.22);
        P.ellipse(hx, H2 - 27, 5, 4, c1);
        P.px(hx - 2, H2 - 28, eye); P.px(hx + 2, H2 - 28, eye);
        P.rect(hx - 1, H2 - 24, 2, 2, c3);
        break;
      }
      case 'construct': {
        P.rect(ax - w * 0.28, H2 - 24 + bob, w * 0.56, h * 0.44, c1);   // block body
        P.rect(ax - w * 0.28, H2 - 24 + bob, w * 0.56, 2, c2);
        P.rect(ax + w * 0.14, H2 - 24 + bob, w * 0.14, h * 0.44, c3);
        P.rect(ax - w * 0.18, H2 - 30 + bob, w * 0.36, 7, c1);          // head block
        P.rect(ax - w * 0.18, H2 - 30 + bob, w * 0.36, 1, c2);
        P.rect(ax - w * 0.10, H2 - 27 + bob, w * 0.06, 2, '#f86040');   // optics
        P.rect(ax + w * 0.04, H2 - 27 + bob, w * 0.06, 2, '#f86040');
        P.rect(ax - w * 0.40, H2 - 22 + bob, w * 0.12, h * 0.34, c3);   // arms
        P.rect(ax + w * 0.28, H2 - 22 + bob, w * 0.12, h * 0.34, c3);
        P.rect(ax - w * 0.22, H2 - 6, w * 0.16, 6, c3);                 // legs
        P.rect(ax + w * 0.06, H2 - 6, w * 0.16, 6, c3);
        break;
      }
      case 'plant': {
        P.rect(ax - 2, H2 - 18, 4, 18, c3);                             // stalk
        for (let i = 0; i < 5; i++) {                                   // leaves
          const s = i % 2 ? 1 : -1;
          P.ellipse(ax + s * 7, H2 - 4 - i * 3, 6, 2, c1);
        }
        P.ellipse(ax, H2 - 22 + bob, 8, 7, c1);                         // bud
        P.ellipse(ax, H2 - 23 + bob, 5, 4, c2);
        P.ellipse(ax, H2 - 22 + bob, 3, 2, '#301828');                  // maw
        for (let i = -3; i <= 3; i += 2) P.px(ax + i, H2 - 23 + bob, '#f8f8f0');
        break;
      }
      case 'dragon': {
        const flap = frame === 1 ? 2 : 0;
        for (const s of [-1, 1]) {                                      // wings
          for (let i = 0; i < 12; i++) {
            P.rect(ax + s * (6 + i), H2 - 26 + bob + i - flap, 1, Math.max(1, 12 - i), c3);
          }
        }
        P.ellipse(ax, H2 - 14 + bob, w * 0.22, h * 0.24, c1);           // body
        P.ellipse(ax, H2 - 17 + bob, w * 0.16, h * 0.14, c2);
        P.rect(ax - 3, H2 - 30 + bob, 6, 8, c1);                        // neck
        P.ellipse(ax + 2, H2 - 30 + bob, 6, 4, c1);                     // head
        P.rect(ax + 5, H2 - 30 + bob, 4, 3, c2);                        // snout
        P.px(ax + 2, H2 - 31 + bob, eye);
        P.rect(ax - 4, H2 - 34 + bob, 2, 4, c3);                        // horn
        for (let i = 0; i < 6; i++) P.px(ax - 7 - i, H2 - 10 + i, c3);  // tail
        P.rect(ax - 6, H2 - 4, 4, 4, c3);
        P.rect(ax + 2, H2 - 4, 4, 4, c3);
        break;
      }
      default:
        P.ellipse(ax, H2 - 10, 8, 8, c1);
    }
  });
}

// ---------------------------------------------------------------------------
//  MAP TILES (16x16)
// ---------------------------------------------------------------------------
export const TS = 16;

const TILE_DRAW = {
  grass: (P) => {
    P.rect(0, 0, TS, TS, '#3a7a38');
    for (const [x, y] of [[2, 3], [9, 5], [5, 11], [12, 12], [7, 8]]) {
      P.rect(x, y, 2, 1, '#4e9a48'); P.px(x + 1, y - 1, '#4e9a48');
    }
    P.rect(0, 15, TS, 1, '#2e6430');
  },
  road: (P) => {
    P.rect(0, 0, TS, TS, '#a89070');
    for (const [x, y] of [[3, 4], [10, 2], [6, 9], [13, 12], [1, 13]]) P.px(x, y, '#8a7458');
    for (const [x, y] of [[5, 2], [12, 7], [2, 9]]) P.px(x, y, '#c0aa88');
  },
  sand: (P) => {
    P.rect(0, 0, TS, TS, '#d8c088');
    for (const [x, y] of [[4, 3], [11, 6], [7, 12], [2, 9]]) P.px(x, y, '#c0a870');
  },
  water: (P) => {
    P.rect(0, 0, TS, TS, '#2a5aa8');
    P.rect(0, 4, TS, 2, '#3f78c8');
    P.rect(0, 11, TS, 2, '#3f78c8');
    for (const x of [2, 9]) { P.rect(x, 4, 3, 1, '#7ab0e8'); P.rect(x + 4, 11, 3, 1, '#7ab0e8'); }
  },
  tree: (P) => {
    P.rect(0, 0, TS, TS, '#3a7a38');
    P.rect(7, 10, 3, 5, '#5a3c20');
    P.ellipse(8, 7, 6, 6, '#2e6430');
    P.ellipse(8, 6, 5, 4, '#4e9a48');
    P.ellipse(6, 4, 2, 2, '#68b45c');
  },
  mountain: (P) => {
    P.rect(0, 0, TS, TS, '#3a7a38');
    P.tri(0, 2, 16, 14, '#8a7a68');
    P.tri(3, 2, 10, 8, '#a89880');
    P.tri(5, 2, 6, 4, '#e8e8f0');
    P.rect(0, 15, TS, 1, '#5a4e40');
  },
  wall: (P) => {
    P.rect(0, 0, TS, TS, '#4a4458');
    for (let y = 0; y < TS; y += 4) {
      P.rect(0, y, TS, 1, '#2e2a3c');
      const off = (y / 4) % 2 ? 4 : 0;
      for (let x = off; x < TS; x += 8) P.rect(x, y, 1, 4, '#2e2a3c');
    }
    P.rect(0, 0, TS, 1, '#66607a');
  },
  floor: (P) => {
    P.rect(0, 0, TS, TS, '#6a6478');
    P.rect(0, 0, TS, 1, '#7e7890');
    P.rect(0, 15, TS, 1, '#4e4a5c');
    for (const [x, y] of [[3, 5], [11, 9], [7, 3]]) P.px(x, y, '#5a5468');
  },
  town: (P) => {
    P.rect(0, 0, TS, TS, '#3a7a38');
    P.rect(2, 6, 12, 9, '#c8b090');
    P.rect(2, 6, 12, 1, '#e0cbaa');
    P.tri(1, 1, 14, 6, '#a04838');
    P.rect(6, 10, 4, 5, '#5a3c20');
    P.rect(3, 8, 2, 2, '#6a90c8');
    P.rect(11, 8, 2, 2, '#6a90c8');
  },
  cave: (P) => {
    P.rect(0, 0, TS, TS, '#5a5040');
    P.ellipse(8, 10, 7, 6, '#2a2430');
    P.ellipse(8, 12, 5, 4, '#100c18');
    P.rect(0, 15, TS, 1, '#3a3428');
  },
  stairs: (P) => {
    P.rect(0, 0, TS, TS, '#6a6478');
    for (let i = 0; i < 4; i++) {
      P.rect(2 + i, 3 + i * 3, 12 - i * 2, 3, '#8e88a0');
      P.rect(2 + i, 3 + i * 3, 12 - i * 2, 1, '#a8a2b8');
    }
  },
  chest: (P) => {
    P.rect(0, 0, TS, TS, '#6a6478');
    P.rect(3, 6, 10, 8, '#8a5a28');
    P.rect(3, 6, 10, 2, '#b07838');
    P.rect(3, 9, 10, 1, '#d8b048');
    P.rect(7, 9, 2, 3, '#d8b048');
  },
  bridge: (P) => {
    P.rect(0, 0, TS, TS, '#2a5aa8');
    P.rect(0, 3, TS, 10, '#8a6a40');
    P.rect(0, 3, TS, 1, '#a88a58');
    P.rect(0, 12, TS, 1, '#5a4428');
    for (let x = 1; x < TS; x += 4) P.rect(x, 3, 1, 10, '#6a5030');
  },
};

export function tileSprite(name) {
  const draw = TILE_DRAW[name] ?? TILE_DRAW.grass;
  return make(`tile|${name}`, TS, TS, draw);
}

export const TILE_NAMES = Object.keys(TILE_DRAW);

export function clearSpriteCache() { cache.clear(); }
