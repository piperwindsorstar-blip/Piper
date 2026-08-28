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

// 4x4 ordered (Bayer) matrix — the standard SNES way to blend two tones
// without a third colour, and what gives the tiles their grain.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function make(key, w, h, draw, opts = {}) {
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
    /** Ordered dither of `col` over a region; density 0..1. */
    dither: (x, y, rw, rh, col, density) => {
      c.fillStyle = col;
      const t = Math.round(density * 16);
      for (let j = 0; j < rh; j++) {
        for (let i = 0; i < rw; i++) {
          const px = (x + i) | 0, py = (y + j) | 0;
          if (BAYER[py & 3][px & 3] < t) c.fillRect(px, py, 1, 1);
        }
      }
    },
    /** Scatter fixed points so a repeated tile keeps its grain seamless. */
    speck: (pts, col) => { c.fillStyle = col; for (const [x, y] of pts) c.fillRect(x, y, 1, 1); },
  };
  draw(P, c);
  if (opts.outline) addOutline(c, w, h, opts.outline);
  cache.set(key, cv);
  return cv;
}

/**
 * Trace a one-pixel border around everything opaque. Every SNES character
 * sprite has this; without it the art reads as flat blocks against the
 * background instead of as a figure standing in front of it.
 */
function addOutline(c, w, h, color) {
  const img = c.getImageData(0, 0, w, h);
  const a = img.data;
  const opaque = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? false : a[(y * w + x) * 4 + 3] > 8;
  const edge = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (opaque(x, y)) continue;
      if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) edge.push([x, y]);
    }
  }
  c.fillStyle = color;
  for (const [x, y] of edge) c.fillRect(x, y, 1, 1);
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
const OUTLINE = '#0e0a16';   // the near-black every SNES sprite is traced in

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
    // three tones per material — light, base, dark — lit from the upper left,
    // which is the convention the whole FFVI sprite sheet follows
    const cloth = tier >= 3 ? shade(kit.cloth, 0.18) : kit.cloth;
    const clothL = shade(cloth, 0.3);
    const clothD = shade(cloth, -0.42);
    const trim = tier >= 2 ? el.color : kit.trim;
    const trimL = shade(trim, 0.4);
    const trimD = shade(trim, -0.4);
    const skinL = shade(skin, 0.22);
    const skinD = shade(skin, -0.26);
    const hairL = shade(hair, 0.35);

    const y0 = 4 + bob;

    // contact shadow, tinted by element once the character has been promoted
    P.ellipse(ax, 30, tier >= 4 ? 9 : 8, 2,
      tier >= 2 ? shade(el.color, -0.62) : '#181428');

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
      P.rect(ax - 6, tY, 3, 10, clothL);             // lit left plate
      P.mrect(ax, 4, tY, 2, 10, clothD);
      P.mrect(ax, 0, tY, 6, 1, trimL);               // gorget
      P.mrect(ax, 0, tY + 4, 6, 1, trim);            // belt
      P.mrect(ax, 0, tY + 5, 6, 1, trimD);
      P.mrect(ax, 3, tY + 1, 3, 3, trimL);           // pauldrons
      P.mrect(ax, 3, tY + 4, 3, 1, trimD);
    } else if (kit.body === 'robe') {
      P.mrect(ax, 0, tY, 6, 11, cloth);
      P.rect(ax - 6, tY, 2, 11, clothL);
      P.mrect(ax, 4, tY, 2, 11, clothD);
      P.rect(ax - 1, tY, 2, 11, trim);               // stole down the front
      P.rect(ax - 1, tY, 1, 11, trimL);
      P.mrect(ax, 0, tY + 10, 7, 1, clothD);
    } else if (kit.body === 'gi') {
      P.mrect(ax, 0, tY, 6, 10, cloth);
      P.mrect(ax, 4, tY, 2, 10, clothD);
      P.rect(ax - 4, tY, 4, 9, clothL);              // open lapel
      P.rect(ax - 1, tY, 1, 9, clothD);
      P.mrect(ax, 0, tY + 5, 6, 2, trim);            // sash
      P.mrect(ax, 0, tY + 6, 6, 1, trimD);
    } else if (kit.body === 'motley') {
      for (let i = 0; i < 10; i++) {
        P.rect(ax - 6, tY + i, 6, 1, i % 2 ? cloth : trim);
        P.rect(ax, tY + i, 6, 1, i % 2 ? trim : cloth);
      }
      P.rect(ax - 6, tY, 12, 1, trimL);
    } else if (kit.body === 'dress') {
      P.mrect(ax, 0, tY, 5, 10, cloth);
      P.rect(ax - 5, tY, 2, 10, clothL);
      P.mrect(ax, 3, tY, 2, 10, clothD);
      P.mrect(ax, 0, tY + 3, 5, 1, trimL);
    } else { // light
      P.mrect(ax, 0, tY, 6, 10, cloth);
      P.rect(ax - 6, tY, 2, 10, clothL);
      P.mrect(ax, 4, tY, 2, 10, clothD);
      P.mrect(ax, 0, tY + 5, 6, 1, trim);
      P.mrect(ax, 0, tY + 6, 6, 1, trimD);
    }

    // --- arms -------------------------------------------------------------
    const armY = tY + 2;
    P.rect(ax - 8, armY, 2, 7, clothD);                       // back arm, shaded
    P.rect(ax - 8, armY + 6, 2, 2, skinD);
    P.rect(ax + 6 + lean, armY - lean, 2, 7, clothL);         // front arm, lit
    P.rect(ax + 6 + lean, armY + 6 - lean, 2, 2, skin);

    // --- head -------------------------------------------------------------
    const hY = y0;
    P.rect(ax - 4, hY, 8, 9, skin);                    // face block
    P.rect(ax - 4, hY + 1, 2, 6, skinL);               // lit cheek
    P.rect(ax + 2, hY, 2, 9, skinD);                   // shadowed cheek
    P.rect(ax - 4, hY + 8, 8, 1, skinD);               // jaw
    // eyes: two dark pips with a single white catchlight, as on the SNES sheet
    if (!hurt) {
      P.rect(ax - 3, hY + 4, 2, 2, '#241820');
      P.rect(ax + 1, hY + 4, 2, 2, '#241820');
      P.px(ax - 3, hY + 4, '#f0f0f8');
      P.px(ax + 1, hY + 4, '#f0f0f8');
    } else {
      P.rect(ax - 3, hY + 5, 2, 1, '#241820');
      P.rect(ax + 1, hY + 5, 2, 1, '#241820');
    }
    P.rect(ax - 1, hY + 7, 2, 1, skinD);               // mouth line

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
        P.rect(ax - 4, hY - 2, 6, 1, hairL);
        P.mrect(ax, 4, hY + 1, 1, 4, hair);
    }
    if (kit.head === 'band' || kit.head === 'cap' || kit.head === 'veil') {
      P.mrect(ax, 4, hY + 2, 1, 5, hair);                  // side hair
      P.rect(ax - 4, hY - 1, 5, 1, hairL);
    }

    // --- weapon -----------------------------------------------------------
    const wx = ax + 8 + lean;
    const wy = armY - 4 - lean;
    switch (kit.weapon) {
      case 'sword':
        P.rect(wx, wy - 6, 3, 14, '#8e96ac');
        P.rect(wx, wy - 6, 1, 14, '#eef2ff');
        P.rect(wx + 1, wy - 6, 1, 14, '#c8cee0');
        P.rect(wx - 2, wy + 7, 7, 2, trim);
        P.rect(wx - 2, wy + 7, 7, 1, trimL);
        P.rect(wx, wy + 9, 2, 3, '#5a4028');
        P.px(wx, wy + 11, '#3a2818');
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
  }, { outline: OUTLINE });
}

// ---------------------------------------------------------------------------
//  TOWNSFOLK — built from the same rules as the party sprites (three tones,
//  a traced outline, a big head on a short body) so they sit in the same world.
// ---------------------------------------------------------------------------
const NPC_KITS = {
  shop:   { cloth: '#8a5a28', trim: '#d8b048', hair: '#3a2a20', hat: 'cap' },
  inn:    { cloth: '#2f5aa0', trim: '#c8d8f0', hair: '#5a3a1c', hat: 'none' },
  temple: { cloth: '#dcdce8', trim: '#c8a040', hair: '#e8e8f0', hat: 'hood' },
  guild:  { cloth: '#9a3838', trim: '#e0c060', hair: '#241c18', hat: 'none' },
  talk:   { cloth: '#4a7a4a', trim: '#8ab88a', hair: '#6a4a24', hat: 'none' },
};

const NW = 16, NH = 22;

export function npcSprite(kind, variant = 0, frame = 0) {
  const kit = NPC_KITS[kind] ?? NPC_KITS.talk;
  const skin = SKIN[variant % SKIN.length];
  const key = `npc|${kind}|${variant}|${frame}`;
  return make(key, NW, NH, (P) => {
    const ax = 8;
    const bob = frame === 1 ? 1 : 0;
    const y0 = 3 + bob;
    const cloth = kit.cloth, clothL = shade(cloth, 0.28), clothD = shade(cloth, -0.4);
    const skinL = shade(skin, 0.2), skinD = shade(skin, -0.26);

    P.ellipse(ax, NH - 2, 5, 1, '#181428');            // contact shadow
    // legs
    P.mrect(ax, 1, y0 + 14, 2, 4, clothD);
    P.mrect(ax, 1, y0 + 17, 3, 1, '#2a2028');
    // body
    P.rect(ax - 4, y0 + 7, 8, 8, cloth);
    P.rect(ax - 4, y0 + 7, 2, 8, clothL);
    P.rect(ax + 2, y0 + 7, 2, 8, clothD);
    P.rect(ax - 4, y0 + 10, 8, 1, kit.trim);           // belt / stole
    // arms
    P.rect(ax - 6, y0 + 8, 2, 6, clothD);
    P.rect(ax + 4, y0 + 8, 2, 6, clothL);
    P.rect(ax - 6, y0 + 13, 2, 1, skinD);
    P.rect(ax + 4, y0 + 13, 2, 1, skin);
    // head
    P.rect(ax - 3, y0, 6, 7, skin);
    P.rect(ax - 3, y0 + 1, 2, 5, skinL);
    P.rect(ax + 1, y0, 2, 7, skinD);
    P.rect(ax - 2, y0 + 3, 1, 2, '#241820');
    P.rect(ax + 1, y0 + 3, 1, 2, '#241820');
    // hair / headgear
    if (kit.hat === 'hood') {
      P.rect(ax - 4, y0 - 2, 8, 5, kit.trim);
      P.rect(ax - 4, y0 - 2, 8, 1, shade(kit.trim, 0.35));
      P.mrect(ax, 3, y0 + 2, 1, 4, kit.trim);
    } else if (kit.hat === 'cap') {
      P.rect(ax - 4, y0 - 2, 8, 3, cloth);
      P.rect(ax - 4, y0 - 2, 8, 1, clothL);
      P.rect(ax - 4, y0 + 1, 8, 1, kit.trim);
    } else {
      P.rect(ax - 3, y0 - 2, 6, 3, kit.hair);
      P.rect(ax - 3, y0 - 2, 4, 1, shade(kit.hair, 0.4));
      P.mrect(ax, 3, y0 + 1, 1, 3, kit.hair);
    }
  }, { outline: OUTLINE });
}

// ---------------------------------------------------------------------------
//  MONSTER BODY PLANS
// ---------------------------------------------------------------------------
const MW = 44, MH = 36;   // base monster canvas: wide enough for a full wingspan

/**
 * Monsters are drawn once at 1:1 and then blown up with nearest-neighbour, so
 * `scale` makes the creature bigger — not just its canvas. The outline is
 * traced before the blit, which is why a boss gets the thick keyline a SNES
 * boss has rather than a hairline lost at size.
 */
export function monsterSprite(sprite, frame = 0) {
  const sc = sprite.scale ?? 1;
  const base = monsterBase(sprite, frame);
  if (sc === 1) return base;
  const key = `mon@${sc}|${sprite.plan}|${sprite.palette.join()}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = Math.round(MW * sc);
  cv.height = Math.round(MH * sc);
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(base, 0, 0, cv.width, cv.height);
  cache.set(key, cv);
  return cv;
}

function monsterBase(sprite, frame) {
  const [c1, c2, c3] = sprite.palette;
  const w = MW, h = MH;
  const key = `mon|${sprite.plan}|${sprite.palette.join()}|${frame}`;
  return make(key, w, h, (P) => {
    const ax = w / 2;
    const bob = frame === 1 ? 1 : 0;
    const eye = '#f8f8c0', pupil = '#201020';
    const H2 = h - 1;
    switch (sprite.plan) {
      case 'blob': {
        P.ellipse(ax, H2 - 6 + bob, w * 0.42, h * 0.30, c1);
        P.ellipse(ax - w * 0.08, H2 - 9 + bob, w * 0.30, h * 0.20, c2);
        P.ellipse(ax + w * 0.14, H2 - 5 + bob, w * 0.20, h * 0.16, shade(c1, -0.25));
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
        P.rect(ax - w * 0.30, H2 - 14 + bob, w * 0.52, 2, c2);          // lit spine
        P.rect(ax - w * 0.30, H2 - 9, w * 0.52, 3, shade(c1, -0.28));   // belly shadow
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
        const dark = shade(c1, -0.32);
        // legs
        P.rect(ax - 5, H2 - 10, 4, 10, c3);
        P.rect(ax + 1, H2 - 10, 4, 10, shade(c3, -0.25));
        P.rect(ax - 6, H2 - 2, 5, 2, '#2a2028');
        P.rect(ax + 1, H2 - 2, 5, 2, '#2a2028');
        // torso, lit on the left
        P.rect(ax - 6, H2 - 22 + bob, 12, 13, c1);
        P.rect(ax - 6, H2 - 22 + bob, 3, 13, c2);
        P.rect(ax + 3, H2 - 22 + bob, 3, 13, dark);
        P.rect(ax - 6, H2 - 22 + bob, 12, 2, shade(c2, 0.15));          // shoulders
        P.rect(ax - 6, H2 - 14 + bob, 12, 1, c3);                       // belt
        // arms
        P.rect(ax - 9, H2 - 21 + bob, 3, 11, dark);
        P.rect(ax + 6, H2 - 21 + bob, 3, 11, c2);
        // head
        P.rect(ax - 4, H2 - 31 + bob, 8, 9, c1);
        P.rect(ax - 4, H2 - 31 + bob, 3, 9, c2);
        P.rect(ax + 2, H2 - 31 + bob, 2, 9, dark);
        P.rect(ax - 4, H2 - 31 + bob, 8, 2, shade(c3, 0.1));            // brow
        P.rect(ax - 3, H2 - 27 + bob, 2, 2, eye); P.px(ax - 3, H2 - 27 + bob, pupil);
        P.rect(ax + 1, H2 - 27 + bob, 2, 2, eye); P.px(ax + 2, H2 - 27 + bob, pupil);
        P.rect(ax - 2, H2 - 24 + bob, 4, 1, dark);                      // mouth
        // a blade in the near hand
        P.rect(ax + 8, H2 - 30 + bob, 2, 18, '#9aa2b6');
        P.rect(ax + 8, H2 - 30 + bob, 1, 18, '#dfe4f0');
        P.rect(ax + 6, H2 - 13 + bob, 6, 2, c3);
        break;
      }
      case 'flyer': {
        const flap = frame === 1 ? 3 : 0;
        // Wings as a lens: widest through the middle rows, tapering at both the
        // leading and trailing edge. A straight taper reads as a paper dart.
        const WH = 9, WSPAN = 15;
        for (const sgn of [-1, 1]) {
          const back = sgn < 0;
          const face = back ? shade(c3, -0.2) : c1;
          const lit = back ? c3 : c2;
          for (let r = 0; r < WH; r++) {
            const t = (r - (WH - 1) / 2) / ((WH - 1) / 2);
            const span = Math.round(WSPAN * Math.sqrt(Math.max(0, 1 - t * t)));
            if (span <= 0) continue;
            const yy = H2 - 21 + bob - flap + r;
            const x0 = sgn < 0 ? ax - 4 - span : ax + 4;
            P.rect(x0, yy, span, 1, face);
            if (r < 3) P.rect(x0, yy, span, 1, lit);          // lit upper coverts
          }
          // feather separators along the trailing edge
          for (let k = 0; k < 3; k++) {
            const wx = ax + sgn * (7 + k * 4);
            P.rect(wx, H2 - 16 + bob - flap + k, 1, 4, shade(face, -0.35));
          }
        }
        P.ellipse(ax, H2 - 12 + bob, 5, 8, c1);                         // body
        P.ellipse(ax - 1, H2 - 14 + bob, 3, 5, c2);
        P.ellipse(ax + 2, H2 - 10 + bob, 2, 4, shade(c1, -0.3));
        P.ellipse(ax, H2 - 21 + bob, 4, 4, c1);                         // head
        P.ellipse(ax - 1, H2 - 22 + bob, 2, 2, c2);
        P.rect(ax - 3, H2 - 22 + bob, 2, 2, eye); P.px(ax - 3, H2 - 22 + bob, pupil);
        P.rect(ax + 1, H2 - 22 + bob, 2, 2, eye); P.px(ax + 2, H2 - 22 + bob, pupil);
        P.rect(ax - 1, H2 - 18 + bob, 3, 2, shade(c3, 0.25));           // beak
        for (let i = 0; i < 5; i++) P.rect(ax - 2 + (i % 2), H2 - 5 + i, 3, 1, c3);
        break;
      }
      case 'serpent': {
        const ph = frame === 1 ? 0.5 : 0;
        // a coiled body that tapers upward, each segment shaded on its right
        for (let i = 0; i < 20; i++) {
          const yy = H2 - 2 - i * 1.35;
          const xx = ax + Math.round(Math.sin(i * 0.42 + ph) * w * 0.20);
          const rr = Math.max(2.5, 7 - i * 0.2);
          P.ellipse(xx, yy, rr, rr * 0.62, c1);
          P.ellipse(xx - rr * 0.35, yy - 1, rr * 0.5, rr * 0.3, c2);
          P.ellipse(xx + rr * 0.5, yy + 1, rr * 0.3, rr * 0.25, shade(c1, -0.3));
          if (i % 3 === 0) P.px(xx, yy, c3);                            // scale row
        }
        const hx = ax + Math.round(Math.sin(20 * 0.42 + ph) * w * 0.20);
        const hy = H2 - 30;
        P.ellipse(hx, hy, 7, 5, c1);                                    // head
        P.ellipse(hx - 2, hy - 1, 4, 3, c2);
        P.rect(hx - 4, hy - 3, 2, 2, eye); P.px(hx - 4, hy - 3, pupil);
        P.rect(hx + 2, hy - 3, 2, 2, eye); P.px(hx + 3, hy - 3, pupil);
        P.rect(hx - 2, hy + 3, 5, 2, shade(c3, 0.15));                  // snout
        P.rect(hx - 1, hy + 5, 3, 3, '#d84040');                        // tongue
        P.mrect(hx, 4, hy - 7, 2, 4, c3);                               // horns
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
        // thick stalk with a lit left edge
        P.rect(ax - 3, H2 - 20, 6, 20, c3);
        P.rect(ax - 3, H2 - 20, 2, 20, c1);
        P.rect(ax + 2, H2 - 20, 1, 20, shade(c3, -0.3));
        for (let i = 0; i < 4; i++) P.rect(ax - 3, H2 - 4 - i * 5, 6, 1, shade(c3, -0.35));
        // two broad leaves, one lit and one in shadow
        P.ellipse(ax - 9, H2 - 9, 7, 3, c1);
        P.ellipse(ax - 9, H2 - 10, 6, 2, c2);
        P.rect(ax - 15, H2 - 9, 12, 1, shade(c1, -0.3));
        P.ellipse(ax + 9, H2 - 14, 6, 3, shade(c1, -0.2));
        P.rect(ax + 4, H2 - 14, 11, 1, shade(c3, -0.2));
        // the head: a bulb split into an upper and lower jaw
        P.ellipse(ax, H2 - 24 + bob, 9, 8, c1);
        P.ellipse(ax - 2, H2 - 26 + bob, 6, 5, c2);
        P.ellipse(ax, H2 - 23 + bob, 6, 4, '#2a1220');                  // maw
        for (let i = -4; i <= 4; i += 3) {                              // teeth
          P.rect(ax + i, H2 - 26 + bob, 1, 2, '#f4f0e0');
          P.rect(ax + i + 1, H2 - 21 + bob, 1, 2, '#f4f0e0');
        }
        P.px(ax - 5, H2 - 29 + bob, eye); P.px(ax + 5, H2 - 29 + bob, eye);
        break;
      }
      case 'dragon': {
        const flap = frame === 1 ? 3 : 0;
        const memb = shade(c3, -0.15), bone = c2;
        // membraned wings: a leading bone edge with the membrane hanging below
        for (const sgn of [-1, 1]) {
          const back = sgn < 0;
          const face = back ? shade(memb, -0.28) : memb;
          const WH = 15, WSPAN = 17;
          for (let r = 0; r < WH; r++) {
            const t = (r - (WH - 1) / 2) / ((WH - 1) / 2);
            const span = Math.round(WSPAN * Math.sqrt(Math.max(0, 1 - t * t)));
            if (span <= 0) continue;
            const yy = H2 - 32 + bob - flap + r;
            const x0 = sgn < 0 ? ax - 5 - span : ax + 5;
            P.rect(x0, yy, span, 1, face);
            if (r < 2) P.rect(x0, yy, span, 1, back ? shade(bone, -0.2) : bone);
          }
          for (let k = 1; k <= 3; k++) {                                // wing fingers
            const wx = ax + sgn * (5 + k * 5);
            P.rect(wx, H2 - 30 + bob - flap + k * 2, 1, 13 - k * 3, shade(bone, -0.4));
          }
        }
        // tail, sweeping back and to the left
        for (let i = 0; i < 9; i++) {
          P.ellipse(ax - 8 - i, H2 - 12 + i * 1.1, Math.max(1, 4 - i * 0.35), 2, c3);
        }
        P.ellipse(ax, H2 - 13 + bob, w * 0.20, h * 0.24, c1);           // body
        P.ellipse(ax - 2, H2 - 16 + bob, w * 0.13, h * 0.14, c2);
        P.rect(ax - 5, H2 - 6, 5, 6, c3);                               // legs
        P.rect(ax + 1, H2 - 6, 5, 6, shade(c3, -0.2));
        // neck and head
        for (let i = 0; i < 9; i++) P.rect(ax - 3 + Math.round(i * 0.3), H2 - 22 - i + bob, 6, 1, c1);
        P.ellipse(ax + 3, H2 - 32 + bob, 7, 5, c1);
        P.ellipse(ax + 2, H2 - 33 + bob, 4, 3, c2);
        P.rect(ax + 7, H2 - 32 + bob, 5, 3, shade(c1, -0.15));          // snout
        P.rect(ax + 9, H2 - 31 + bob, 3, 1, c3);
        P.rect(ax + 1, H2 - 34 + bob, 2, 2, eye); P.px(ax + 2, H2 - 34 + bob, pupil);
        P.mrect(ax + 1, 3, H2 - 39 + bob, 2, 5, c3);                    // horns
        for (let i = 0; i < 5; i++) P.px(ax - 4 + i, H2 - 26 + bob + i, c3);  // spine ridge
        break;
      }
      default:
        P.ellipse(ax, H2 - 10, 8, 8, c1);
    }
  }, { outline: OUTLINE });
}

// ---------------------------------------------------------------------------
//  MAP TILES (16x16)
// ---------------------------------------------------------------------------
export const TS = 16;

// Each tile is a fixed 16x16 pattern, never randomised, so a field of them
// tiles seamlessly. Texture comes from a 4-5 tone ramp plus ordered dither,
// which is how the SNES got grass to read as grass in 15 colours.
const TILE_DRAW = {
  grass: (P) => {
    // muted olive-green base; texture comes from irregular clumps rather than
    // a full-tile dither, which at 16px reads as a checker instead of grass
    P.rect(0, 0, TS, TS, '#4a7a3e');
    P.speck([[1, 1], [2, 1], [6, 2], [7, 2], [12, 1], [4, 5], [5, 5],
      [10, 6], [14, 5], [2, 8], [8, 9], [9, 9], [13, 10], [5, 12],
      [11, 13], [1, 14], [6, 15], [15, 13]], '#568c48');
    P.speck([[3, 3], [11, 4], [7, 7], [14, 8], [0, 10], [9, 12], [4, 14], [12, 15]], '#3e6834');
    // a few blades: a bright tip over a dark base
    for (const [x, y] of [[2, 4], [9, 2], [13, 7], [5, 10], [11, 12], [1, 12]]) {
      P.px(x, y, '#6ea058'); P.px(x + 1, y, '#6ea058'); P.px(x, y + 1, '#345c2c');
    }
  },
  road: (P) => {
    P.rect(0, 0, TS, TS, '#a08a62');
    P.dither(0, 0, TS, TS, '#b89a70', 0.5);
    P.dither(0, 0, TS, TS, '#88724e', 0.22);
    P.speck([[3, 4], [10, 2], [6, 9], [13, 12], [1, 13], [8, 6]], '#6e5a3c');
    P.speck([[5, 2], [12, 7], [2, 9], [14, 4]], '#d0b48c');
  },
  sand: (P) => {
    P.rect(0, 0, TS, TS, '#d4bc84');
    P.dither(0, 0, TS, TS, '#e4d09c', 0.42);
    P.dither(0, 0, TS, TS, '#bca068', 0.2);
    P.speck([[4, 3], [11, 6], [7, 12], [2, 9], [14, 14]], '#a88c58');
  },
  water: (P) => {
    // deep base with two lighter swells and a short crest on each
    P.rect(0, 0, TS, TS, '#1e3f78');
    P.speck([[2, 6], [9, 7], [13, 14], [5, 15], [11, 0]], '#193462');
    for (const y of [2, 9]) {
      P.rect(0, y, TS, 3, '#2c5896');
      P.rect(0, y, TS, 1, '#3a6cae');
    }
    P.rect(1, 2, 4, 1, '#6f9fd4'); P.rect(9, 2, 3, 1, '#6f9fd4');
    P.rect(5, 9, 4, 1, '#6f9fd4'); P.rect(12, 9, 2, 1, '#6f9fd4');
  },
  tree: (P) => {
    TILE_DRAW.grass(P);
    // The canopy nearly fills the tile so a block of trees reads as one wood
    // rather than as separate lollipops with grass showing between them.
    P.rect(7, 12, 3, 4, '#3d2a14');
    P.rect(7, 12, 1, 4, '#5c3d1c');
    P.ellipse(8, 8, 7, 7, '#17400f');            // outer mass
    P.ellipse(8, 7, 6, 6, '#245c1c');
    P.ellipse(6, 6, 5, 4, '#33792a');            // lit lobe, upper left
    P.ellipse(9, 5, 4, 3, '#2c6c24');
    P.ellipse(5, 4, 3, 2, '#469a38');
    P.speck([[4, 3], [6, 2], [3, 6], [8, 3]], '#63b84f');
    P.speck([[11, 10], [9, 12], [5, 11], [12, 7]], '#123409');
  },
  mountain: (P) => {
    TILE_DRAW.grass(P);
    // A peak: narrow at the top, full width at the base, lit on the left face
    // and in shadow on the right, with a snow cap and a dark keyline so a
    // range of them reads as a ridge.
    for (let y = 0; y < TS; y++) {
      const half = Math.max(1, Math.round((y + 1) / 2));
      const x0 = 8 - half, x1 = 8 + half;
      P.rect(x0, y, half, 1, '#93856d');                 // lit face
      P.rect(8, y, x1 - 8, 1, '#5d5346');                // shadowed face
      P.px(x0, y, '#332d26');                            // keyline
      P.px(x1 - 1, y, '#332d26');
      if (y < 5) {                                       // snow cap
        P.rect(x0 + 1, y, Math.max(1, half - 1), 1, '#e4e8f2');
        P.rect(8, y, Math.max(1, half - 1), 1, '#b8c0d4');
      }
    }
    P.speck([[5, 9], [10, 11], [4, 13], [11, 14], [7, 12]], '#7b6f5c');
    P.speck([[9, 8], [12, 13], [6, 14]], '#4a4238');
    P.rect(0, 15, TS, 1, '#332d26');
  },
  // Continuation variants, chosen by the field renderer from a tile's
  // neighbours, so a run of mountains reads as one ridge and a block of trees
  // as one wood instead of as repeated single objects.
  ridge: (P) => {
    TILE_DRAW.grass(P);
    // Two peaks per tile with the profile returning to the same height at both
    // edges, so neighbouring ridge tiles join into one continuous skyline.
    const prof = [5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4];
    for (let x = 0; x < TS; x++) {
      const top = prof[x];
      const lit = (x % 8) < 4;                       // each peak lit on its left
      for (let y = top; y < TS; y++) P.px(x, y, lit ? '#93856d' : '#5d5346');
      P.px(x, top, '#332d26');                       // silhouette keyline
      if (top <= 2) P.rect(x, top + 1, 1, 2, lit ? '#e4e8f2' : '#b8c0d4');
    }
    P.speck([[3, 9], [10, 11], [6, 13], [13, 10], [8, 14], [1, 12]], '#7b6f5c');
    P.speck([[5, 11], [12, 14], [9, 9]], '#4a4238');
    P.rect(0, 15, TS, 1, '#332d26');
  },
  rock: (P) => {
    // the interior of a mountain mass: no sky, just stone
    P.rect(0, 0, TS, TS, '#6f6455');
    P.speck([[1, 2], [5, 1], [9, 3], [13, 2], [3, 6], [7, 5], [11, 7], [15, 6],
      [2, 10], [6, 9], [10, 11], [14, 10], [4, 14], [8, 13], [12, 15]], '#8a7d68');
    P.speck([[3, 3], [11, 1], [7, 8], [1, 7], [13, 12], [5, 12], [9, 15], [15, 3]], '#544a3e');
    // short broken fissures rather than long strokes, which would repeat into
    // a visible diagonal across a whole mountain mass
    P.speck([[4, 1], [4, 2], [5, 3], [11, 5], [11, 6], [2, 10], [3, 11],
      [8, 2], [14, 8], [14, 9], [6, 15]], '#413a30');
  },
  forest: (P) => {
    // full canopy, no trunk: the interior of a wood
    P.rect(0, 0, TS, TS, '#1c4a14');
    P.ellipse(4, 4, 5, 4, '#245c1c');
    P.ellipse(12, 5, 5, 4, '#245c1c');
    P.ellipse(8, 11, 6, 5, '#245c1c');
    P.ellipse(3, 3, 3, 2, '#33792a');
    P.ellipse(11, 4, 3, 2, '#33792a');
    P.ellipse(7, 10, 4, 3, '#33792a');
    P.speck([[2, 2], [10, 3], [6, 9], [13, 12], [4, 13]], '#469a38');
    P.speck([[7, 6], [1, 9], [14, 8], [9, 14], [0, 5]], '#123409');
  },
  shore: (P) => {
    // a pale wet-sand lip, drawn over the land side of a water edge
    P.rect(0, 0, TS, 3, '#c9b283');
    P.rect(0, 0, TS, 1, '#ddc79a');
    P.speck([[2, 2], [7, 2], [12, 2], [4, 1], [10, 1]], '#b09a6e');
  },
  wall: (P) => {
    // dressed stone: staggered courses with a lit top edge on each block
    P.rect(0, 0, TS, TS, '#4a4458');
    P.dither(0, 0, TS, TS, '#565068', 0.4);
    for (let y = 0; y < TS; y += 5) {
      P.rect(0, y, TS, 1, '#2a2636');
      P.rect(0, y + 1, TS, 1, '#666078');
      const off = (y / 5) % 2 ? 4 : 0;
      for (let x = off; x < TS + 8; x += 8) {
        if (x < TS) P.rect(x, y, 1, 5, '#2a2636');
      }
    }
    P.dither(0, 0, TS, 3, '#7a7490', 0.3);
  },
  floor: (P) => {
    P.rect(0, 0, TS, TS, '#5e5870');
    P.dither(0, 0, TS, TS, '#6a6480', 0.42);
    P.dither(0, 0, TS, TS, '#4e4860', 0.2);
    P.rect(0, 0, TS, 1, '#7a7490');
    P.rect(0, 15, TS, 1, '#443e56');
    P.speck([[3, 5], [11, 9], [7, 3], [14, 12], [1, 10]], '#514b64');
  },
  house: (P) => {
    // plaster between a timber lintel and a stone footing
    P.rect(0, 0, TS, TS, '#c8ac84');
    P.speck([[2, 3], [9, 5], [13, 2], [5, 8], [11, 9], [3, 11], [14, 12]], '#bc9e74');
    P.speck([[6, 2], [12, 6], [1, 9], [8, 13]], '#d8c098');
    P.rect(0, 0, TS, 2, '#7a5c3a');            // lintel
    P.rect(0, 0, TS, 1, '#946e46');
    P.rect(0, 12, TS, 4, '#8e8478');           // stone footing
    P.speck([[1, 13], [5, 14], [9, 13], [13, 15], [3, 15], [11, 14]], '#a09688');
    P.rect(0, 12, TS, 1, '#a49a8c');
    P.rect(0, 15, TS, 1, '#5e564c');
  },
  door: (P) => {
    TILE_DRAW.house(P);
    P.rect(3, 2, 10, 14, '#4a3018');           // frame
    P.rect(4, 3, 8, 13, '#6b4622');            // leaf
    P.speck([[5, 5], [9, 8], [6, 11], [10, 13]], '#7d5429');
    P.rect(4, 3, 8, 1, '#8f6534');
    P.rect(4, 3, 1, 13, '#845729');
    P.rect(4, 8, 8, 1, '#4a3018');             // cross rail
    P.rect(10, 10, 2, 2, '#e8c860');           // handle
    P.px(10, 10, '#fff0b0');
    P.rect(0, 15, TS, 1, '#5e564c');
  },
  flower: (P) => {
    TILE_DRAW.grass(P);
    for (const [x, y, c] of [[3, 4, '#f0e070'], [10, 3, '#e87890'], [6, 10, '#f0e070'], [12, 12, '#c890f0']]) {
      P.px(x, y - 1, '#3c7a34');
      P.rect(x - 1, y, 3, 1, c);
      P.rect(x, y - 1, 1, 3, c);
      P.px(x, y, '#fff8d0');
    }
  },
  roof: (P) => {
    // clay pantiles: staggered rows, each course lit along its upper lip
    P.rect(0, 0, TS, TS, '#9c4030');
    for (let y = 0; y < TS; y += 4) {
      P.rect(0, y, TS, 1, '#c8664a');
      P.rect(0, y + 3, TS, 1, '#6a2a1e');
      const off = (y / 4) % 2 ? 3 : 0;
      for (let x = off; x < TS + 6; x += 6) if (x < TS) P.rect(x, y + 1, 1, 2, '#7e3324');
    }
    P.speck([[2, 1], [8, 5], [13, 9], [5, 13]], '#d87a58');
  },
  town: (P) => {
    TILE_DRAW.grass(P);
    P.rect(2, 7, 12, 8, '#c4a880');
    P.dither(2, 7, 12, 8, '#d8bc94', 0.4);
    P.rect(1, 6, 14, 1, '#6a2a1e');
    P.tri(0, 1, 16, 6, '#8e3a2c');
    P.tri(0, 1, 16, 4, '#c05c40');
    P.rect(6, 10, 4, 5, '#5a3c20');
    P.rect(6, 10, 4, 1, '#7a5430');
    P.rect(3, 9, 2, 2, '#6a90c8'); P.px(3, 9, '#a8ccf0');
    P.rect(11, 9, 2, 2, '#6a90c8'); P.px(11, 9, '#a8ccf0');
    P.rect(0, 15, TS, 1, '#2e6228');
  },
  cave: (P) => {
    P.rect(0, 0, TS, TS, '#5a5040');
    P.dither(0, 0, TS, TS, '#6a5e4a', 0.4);
    P.dither(0, 0, TS, TS, '#463e30', 0.22);
    P.ellipse(8, 10, 7, 6, '#231d2a');
    P.ellipse(8, 11, 6, 5, '#120e18');
    P.ellipse(8, 12, 4, 3, '#05030a');
    P.rect(2, 4, 3, 1, '#7e7058');
    P.rect(11, 5, 3, 1, '#7e7058');
    P.rect(0, 15, TS, 1, '#332c22');
  },
  stairs: (P) => {
    P.rect(0, 0, TS, TS, '#4e4860');
    for (let i = 0; i < 4; i++) {
      const y = 2 + i * 3, x = 1 + i;
      P.rect(x, y, 14 - i * 2, 3, '#7a7490');
      P.rect(x, y, 14 - i * 2, 1, '#9a94b0');
      P.rect(x, y + 2, 14 - i * 2, 1, '#3e3850');
    }
    P.dither(0, 0, TS, TS, '#6a6480', 0.14);
  },
  chest: (P) => {
    TILE_DRAW.floor(P);
    P.rect(2, 5, 12, 9, '#3a2410');
    P.rect(3, 6, 10, 3, '#8a5a28');
    P.dither(3, 6, 10, 3, '#a8703a', 0.4);
    P.rect(3, 6, 10, 1, '#c08c4a');
    P.rect(3, 10, 10, 3, '#7a4e22');
    P.dither(3, 10, 10, 3, '#8a5a28', 0.4);
    P.rect(2, 9, 12, 1, '#e8c860');
    P.rect(7, 9, 2, 4, '#e8c860');
    P.px(7, 11, '#3a2410');
  },
  bridge: (P) => {
    TILE_DRAW.water(P);
    P.rect(0, 2, TS, 12, '#7a5a34');
    P.dither(0, 2, TS, 12, '#8e6a3e', 0.42);
    P.rect(0, 2, TS, 1, '#a88a58');
    P.rect(0, 13, TS, 1, '#4e3a20');
    for (let x = 1; x < TS; x += 4) P.rect(x, 3, 1, 10, '#5e441f');
    P.rect(0, 6, TS, 1, '#684c26');
  },
};

export function tileSprite(name) {
  const draw = TILE_DRAW[name] ?? TILE_DRAW.grass;
  return make(`tile|${name}`, TS, TS, draw);
}

export const TILE_NAMES = Object.keys(TILE_DRAW);

export function clearSpriteCache() { cache.clear(); }
