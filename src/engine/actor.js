// ============================================================================
//  ACTOR SPRITES — party members and townsfolk, generated from
//  class kit x race anatomy x element tint.
//
//  36x48, roughly HD-2D proportions: a large head, a compact body, and enough
//  room for the anatomy a race actually needs — pointed ears, a muzzle, a tail,
//  wings, horns, plating. Every sprite gets ambient occlusion, a rim light from
//  the upper left, and a traced keyline, which is what stops generated pixel
//  art from reading flat.
// ============================================================================

import { make, shade, mix } from './pixel.js';
import { ELEMENT_BY_ID } from '../data/elements.js';
import { getClass } from '../data/classes.js';
import { getRace } from '../data/races.js';

export const AW = 36, AH = 48;      // actor canvas
export const PW = 40, PH = 44;      // portrait bust canvas
const OUTLINE = '#0a0812';
const RIM = '#8fa8d8';

/** Cheap, stable per-string number — picks a hair style deterministically
 *  from race + hair-index without adding a new data field. */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h += s.charCodeAt(i);
  return h;
}

/**
 * The head-and-shoulders "face": silhouette, cheeks, jaw, eyes, eyebrows,
 * mouth — used by the full body sprite. paintPortraitFace() below is the
 * same construction at the bust's bigger scale.
 */
function paintFace(P, { ax, hY, headW, headH, skin, skinL, skinD, hairD, eye, hurt, L }) {
  const hRows = headH - 1;
  // an oval: widest at the cheekbones, drawn in at the crown and again at the
  // jaw. A 2px chamfer is not enough to stop a head reading as a block.
  const headHalf = (i) => {
    const t = (i + 0.5) / hRows;
    const s = Math.sin(Math.PI * (0.14 + 0.78 * t));
    return headW * (0.52 + 0.48 * s);
  };
  const hw = (i) => Math.max(1, Math.round(headHalf(i)));
  P.profile(ax, hY, hRows, skin, headHalf);
  for (let i = 1; i < hRows - 1; i++) {                            // cheeks
    P.rect(ax - hw(i), hY + i, 2, 1, skinL);
    P.rect(ax + hw(i) - 2, hY + i, 2, 1, skinD);
  }
  P.rect(ax - hw(hRows - 2), hY + headH - 2, hw(hRows - 2) * 2, 1, skinD);   // jaw
  P.px(ax, hY + headH - 3, skinL);                                 // chin highlight
  if (L.scaled) {
    for (let i = 0; i < 5; i++) P.px(ax - 3 + (i % 3) * 3, hY + 2 + i, shade(skin, -0.2));
  }
  if (L.gaunt) {                                                   // Revenant
    P.rect(ax - headW + 1, hY + 5, 2, 3, skinD);
    P.rect(ax + headW - 3, hY + 5, 2, 3, skinD);
  }
  // eyebrows, pupil/eyes — proportioned like a real eye socket, not a
  // cartoon dot: a sliver of white, a shaded iris, a dark pupil
  if (!hurt) {
    P.rect(ax - 4, hY + 4, 3, 1, hairD);
    P.rect(ax + 1, hY + 4, 3, 1, hairD);
    P.rect(ax - 4, hY + 5, 3, 2, '#e8e4dc');
    P.rect(ax + 1, hY + 5, 3, 2, '#e8e4dc');
    P.rect(ax - 4, hY + 5, 2, 2, eye);
    P.rect(ax + 2, hY + 5, 2, 2, eye);
    P.px(ax - 4, hY + 6, shade(eye, -0.4));
    P.px(ax + 2, hY + 6, shade(eye, -0.4));
    P.px(ax - 4, hY + 5, L.glow ?? '#f4f4ff');
    P.px(ax + 2, hY + 5, L.glow ?? '#f4f4ff');
  } else {
    P.px(ax - 3, hY + 4, hairD);
    P.px(ax + 2, hY + 4, hairD);
    P.rect(ax - 4, hY + 6, 3, 1, eye);
    P.rect(ax + 1, hY + 6, 3, 1, eye);
  }
  if (!L.muzzle) P.rect(ax - 1, hY + 9, 2, 1, skinD);              // mouth
}

/**
 * The battle portrait's face — same construction as paintFace(), just at
 * the bust's bigger scale, so the eye gets one extra row to hold a visible
 * sclera-iris-pupil structure instead of a flat chip. Still a proportionate
 * eye, not an oversized one: realism here means depth and shading, not size.
 */
function paintPortraitFace(P, { ax, hY, headW, headH, skin, skinL, skinD, hairD, eye, hurt, L }) {
  const hRows = headH - 1;
  const headHalf = (i) => {
    const t = (i + 0.5) / hRows;
    const s = Math.sin(Math.PI * (0.14 + 0.78 * t));
    return headW * (0.52 + 0.48 * s);
  };
  const hw = (i) => Math.max(1, Math.round(headHalf(i)));
  P.profile(ax, hY, hRows, skin, headHalf);
  for (let i = 1; i < hRows - 1; i++) {                            // cheeks
    P.rect(ax - hw(i), hY + i, 2, 1, skinL);
    P.rect(ax + hw(i) - 2, hY + i, 2, 1, skinD);
  }
  P.rect(ax - hw(hRows - 2), hY + headH - 2, hw(hRows - 2) * 2, 1, skinD);   // jaw
  P.px(ax, hY + headH - 3, skinL);                                 // chin highlight
  if (L.scaled) {
    for (let i = 0; i < 5; i++) P.px(ax - 4 + (i % 3) * 4, hY + 3 + i * 1.3 | 0, shade(skin, -0.2));
  }
  if (L.gaunt) {
    P.rect(ax - headW + 1, hY + 6, 2, 4, skinD);
    P.rect(ax + headW - 3, hY + 6, 2, 4, skinD);
  }

  const eyeY = hY + Math.round(headH * 0.42);
  const dx = Math.max(4, Math.round(headW * 0.6));
  if (hurt) {
    for (const cx of [ax - dx, ax + dx]) P.rect(cx - 2, eyeY, 4, 1, shade(eye, -0.3));
  } else {
    for (const cx of [ax - dx, ax + dx]) {
      P.rect(cx - 2, eyeY - 3, 5, 1, hairD);                       // brow
      P.rect(cx - 2, eyeY - 1, 5, 3, '#e8e4dc');                   // sclera
      P.rect(cx - 2, eyeY - 1, 4, 2, eye);                         // iris, shaded not flat
      P.rect(cx - 2, eyeY, 4, 1, shade(eye, -0.3));
      P.px(cx - 1, eyeY - 1, L.glow ?? shade(eye, -0.55));         // pupil
      P.px(cx - 2, eyeY - 1, '#f4f4ff');                           // one small highlight
      P.rect(cx - 2, eyeY + 1, 4, 1, shade(skin, -0.2));           // lower lid
    }
  }
  if (!L.muzzle) {
    P.rect(ax - 1, hY + headH - 6, 3, 1, shade(skin, -0.3));       // mouth
    P.px(ax - 1, hY + headH - 5, shade(skin, -0.15));
  }
}

/** The flat-color hair cap, with a handful of cheap shape variants layered
 *  on top so hair reads as more than a solid-color hat. Purely a function
 *  of race + hair-index (both already in the sprite cache key), so no new
 *  cache-key field is needed. */
function paintHairCap(P, { ax, hY, headW, hair, hairL, hairD, styleIdx }) {
  const capHalf = (half) => (i) => (i === 0 ? half - 2 : i === 1 ? half - 1 : half);
  const cap = (yTop, rows, half, col) => P.profile(ax, yTop, rows, col, capHalf(half));
  cap(hY - 2, 4, headW, hair);
  P.rect(ax - headW + 2, hY - 2, headW - 1, 1, hairL);
  switch (styleIdx) {
    case 1:                                                        // parted
      P.rect(ax, hY - 2, 1, 4, hairD);
      break;
    case 2:                                                        // fringe
      P.rect(ax - headW + 1, hY + 2, headW * 2 - 2, 1, hair);
      P.px(ax - headW + 2, hY + 3, hair);
      P.px(ax + headW - 3, hY + 3, hair);
      break;
    case 3:                                                        // swept
      P.rect(ax - headW - 1, hY - 4, 3, 3, hair);
      P.rect(ax + headW - 2, hY - 5, 3, 3, hair);
      break;
    default: break;                                                // plain cap
  }
  P.mrect(ax, headW - 1, hY + 1, 1, 5, hair);
}

/**
 * Race anatomy drawn OVER the headgear (or, for the portrait bust, straight
 * over the hair): ears, horns, a muzzle, tusks, a beard, goggles. The race
 * has to read at a glance, or twelve of them look like twelve of the same
 * person.
 */
function paintRaceAnatomy(P, { ax, hY, headW, headH, skin, skinL, skinD, hair, hairL, hairD, L }) {
  switch (L.ears) {
    case 'long': {                                     // Elf, Fairy, Gnome
      for (let i = 0; i < 9; i++) {
        const dx = Math.floor(i * 0.55);
        const yy = hY + 6 - i;
        P.px(ax - headW - 1 - dx, yy, i > 5 ? skinL : skin);
        P.px(ax - headW - 2 - dx, yy, skinD);
        P.px(ax + headW + dx, yy, i > 5 ? skin : skinD);
        P.px(ax + headW + 1 + dx, yy, skinD);
      }
      P.px(ax - headW - 5, hY - 2, skinL);
      break;
    }
    case 'wolf': {                                     // Wolfkin
      for (const sgn of [-1, 1]) {
        const base = sgn < 0 ? ax - headW + 1 : ax + headW - 6;
        for (let i = 0; i < 8; i++) {
          const wdt = Math.max(1, 6 - Math.floor(i * 0.8));
          const xx = base + sgn * Math.floor(i * 0.4) + (sgn < 0 ? 0 : 6 - wdt);
          P.rect(xx, hY - 7 + i, wdt, 1, sgn < 0 ? hair : hairD);
        }
        P.rect(sgn < 0 ? ax - headW + 2 : ax + headW - 4, hY - 4, 2, 3, shade(skin, 0.12));
      }
      break;
    }
    case 'fin':                                        // Merfolk
      for (const sgn of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const len = 5 - i;
          P.rect(sgn < 0 ? ax - headW - len : ax + headW, hY + 2 + i * 3, len, 2,
            mix(skin, '#7fe0ff', 0.65 - i * 0.12));
        }
      }
      break;
    default: break;
  }
  if (L.horns === 'small') {                            // Lizardfolk, Ogrekin
    P.mrect(ax, headW - 4, hY - 5, 3, 6, '#ded1b6');
    P.mrect(ax, headW - 4, hY - 5, 1, 6, '#f4ecd8');
  } else if (L.horns === 'dragon') {                    // Draconian
    for (let i = 0; i < 9; i++) {
      const dx = Math.floor(i * 0.5);
      P.rect(ax - headW + 1 - dx, hY - 1 - i, 2, 1, '#e8dcc0');
      P.rect(ax + headW - 2 + dx, hY - 1 - i, 2, 1, '#c8bc9c');
    }
  }
  if (L.muzzle) {                                       // Wolfkin, Lizardfolk, Draconian
    const my = hY + headH - 7;
    P.rect(ax - 4, my, 8, 8, skin);
    P.rect(ax - 4, my, 8, 1, skinL);
    P.rect(ax - 4, my, 2, 7, skinL);
    P.rect(ax + 2, my, 2, 7, skinD);
    P.rect(ax - 3, my + 5, 6, 3, skinD);                // jaw
    P.rect(ax - 2, my + 3, 4, 3, '#241820');            // nose
    P.px(ax - 1, my + 3, '#4a3a40');
    P.rect(ax - 3, my + 7, 6, 1, shade(skin, -0.34));
    if (L.tusks || L.scaled) {                          // small fangs
      P.rect(ax - 3, my + 7, 1, 2, '#f0ece0');
      P.rect(ax + 2, my + 7, 1, 2, '#f0ece0');
    }
  }
  if (L.tusks && !L.muzzle) {                           // Ogrekin
    P.rect(ax - 5, hY + headH - 5, 2, 5, '#f0ece0');
    P.rect(ax + 3, hY + headH - 5, 2, 5, '#f0ece0');
    P.rect(ax - 5, hY + headH - 5, 2, 1, '#ffffff');
  }
  if (L.beard) {                                        // Dwarf
    P.rect(ax - headW, hY + headH - 4, headW * 2, 7, hair);
    P.rect(ax - headW, hY + headH - 4, 3, 6, hairL);
    P.rect(ax - 3, hY + headH + 2, 6, 3, hairD);
    P.rect(ax - headW, hY + headH - 4, headW * 2, 1, hairL);
  }
  if (L.goggles) {                                      // Gnome
    P.rect(ax - headW - 1, hY + 3, headW * 2 + 2, 4, '#4a3c2c');
    P.rect(ax - headW - 1, hY + 3, headW * 2 + 2, 1, '#6a5842');
    P.rect(ax - 5, hY + 4, 4, 2, '#8fd8f0');
    P.rect(ax + 1, hY + 4, 4, 2, '#6ab0c8');
    P.px(ax - 5, hY + 4, '#dff4ff');
  }
}

// ---------------------------------------------------------------------------
//  CLASS KITS — silhouette rules per root class
// ---------------------------------------------------------------------------
const KITS = {
  warrior:   { head: 'helm',      body: 'plate',  cape: true,  weapon: 'sword',  cloth: '#a8342c', trim: '#e0bc58' },
  guardian:  { head: 'greathelm', body: 'plate',  cape: true,  weapon: 'shield', cloth: '#3358ab', trim: '#cdd6e8' },
  monk:      { head: 'band',      body: 'gi',     cape: false, weapon: 'fist',   cloth: '#dcac52', trim: '#a84c2a' },
  lancer:    { head: 'horned',    body: 'plate',  cape: true,  weapon: 'spear',  cloth: '#2f7352', trim: '#dcc464' },
  thief:     { head: 'hood',      body: 'light',  cape: false, weapon: 'dagger', cloth: '#4a4280', trim: '#8f7ec8' },
  archer:    { head: 'cap',       body: 'light',  cape: true,  weapon: 'bow',    cloth: '#436c3c', trim: '#adc576' },
  dancer:    { head: 'veil',      body: 'dress',  cape: false, weapon: 'dagger', cloth: '#c44a8c', trim: '#f4cee6' },
  jester:    { head: 'jester',    body: 'motley', cape: false, weapon: 'dagger', cloth: '#8c3aa6', trim: '#f4d44c' },
  mage:      { head: 'hat',       body: 'robe',   cape: false, weapon: 'staff',  cloth: '#3c3c94', trim: '#ccb464' },
  cleric:    { head: 'mitre',     body: 'robe',   cape: true,  weapon: 'mace',   cloth: '#e4e4ee', trim: '#cca442' },
  summoner:  { head: 'horns',     body: 'robe',   cape: true,  weapon: 'staff',  cloth: '#6e3c94', trim: '#dcbcf4' },
  spiritist: { head: 'mask',      body: 'robe',   cape: false, weapon: 'staff',  cloth: '#2c6e6e', trim: '#a4e4d4' },
};

/**
 * @param {object} o {classId, raceId, elementId, skin, hair, frame}
 *   frame 0 idle · 1 step · 2 hurt · 3 attack
 */
export function actorSprite(o) {
  const cls = getClass(o.classId);
  const race = getRace(o.raceId ?? 'human');
  const kit = KITS[cls.root];
  const el = ELEMENT_BY_ID[o.elementId] ?? { color: '#c8c8d8', color2: '#ffffff' };
  const L = race.look;
  const frame = o.frame ?? 0;
  const tier = cls.tier;

  const skin = L.skins[(o.skin ?? 0) % L.skins.length];
  const hair = L.hairs[(o.hair ?? 0) % L.hairs.length];
  const key = `act|${cls.root}|${tier}|${race.id}|${o.elementId}|${o.skin ?? 0}|${o.hair ?? 0}|${frame}`;

  return make(key, AW, AH, (P) => {
    const ax = AW / 2;                       // mirror axis
    const build = L.build ?? 1;
    const bob = frame === 1 ? 1 : 0;
    const lean = frame === 3 ? 3 : 0;
    const hurt = frame === 2;

    // vertical layout, compressed or stretched by the race's build
    const ground = AH - 3;
    const legH = Math.round(11 * build);
    const bodyH = Math.round(14 * build);
    const headH = Math.round(13 * build);
    const headW = Math.round(6 * build);      // half-width
    const bodyW = Math.round(6 * build);      // half-width, narrower than the head

    const legY = ground - legH + bob;
    const bodyY = legY - bodyH;
    const headY = bodyY - headH + 1;

    // three tones per material, lit from the upper left
    const cloth = tier >= 3 ? shade(kit.cloth, 0.14) : kit.cloth;
    const clothL = shade(cloth, 0.32);
    const clothD = shade(cloth, -0.42);
    const trim = tier >= 2 ? mix(kit.trim, el.color, 0.55) : kit.trim;
    const trimL = shade(trim, 0.38);
    const trimD = shade(trim, -0.4);
    const skinL = shade(skin, 0.2);
    const skinD = shade(skin, -0.26);
    const hairL = shade(hair, 0.34);
    const hairD = shade(hair, -0.34);
    const eye = L.glow ?? L.eye ?? '#2b1f2e';
    const hairStyle = (hashStr(race.id) + (o.hair ?? 0)) % 4;
    // The torso and cape are the largest flat-color regions on the sprite —
    // big enough for a light dither to read as cloth texture rather than
    // noise, unlike hair/trim/limbs, which are too thin for it.
    const USE_DITHER = true;

    // --- contact shadow, tinted once promoted ------------------------------
    P.ellipse(ax, ground + 1, Math.round(9 * build), 2,
      tier >= 5 ? shade(el.color, -0.5) : tier >= 2 ? shade(el.color, -0.66) : '#151222');

    // --- wings (behind everything) -----------------------------------------
    if (L.wings === 'fairy') {
      for (const s of [-1, 1]) {
        const flap = frame === 1 ? 2 : 0;
        for (let r = 0; r < 14; r++) {
          const t = (r - 6.5) / 7;
          const span = Math.round(11 * Math.sqrt(Math.max(0, 1 - t * t)));
          if (span <= 0) continue;
          const yy = bodyY - 8 + r - flap;
          const x0 = s < 0 ? ax - 5 - span : ax + 5;
          P.rect(x0, yy, span, 1, r % 3 === 0 ? '#cfe8ff' : '#9fd0f0');
        }
        P.rect(ax + s * 12, bodyY - 6, 1, 10, '#e8f4ff');
      }
    } else if (L.wings === 'dragon') {
      for (const s of [-1, 1]) {
        const flap = frame === 1 ? 2 : 0;
        const memb = shade(skin, -0.3), bone = shade(skin, 0.15);
        for (let r = 0; r < 15; r++) {
          const t = (r - 7) / 7.5;
          const span = Math.round(12 * Math.sqrt(Math.max(0, 1 - t * t)));
          if (span <= 0) continue;
          const yy = bodyY - 7 + r - flap;
          const x0 = s < 0 ? ax - 6 - span : ax + 6;
          P.rect(x0, yy, span, 1, s < 0 ? shade(memb, -0.2) : memb);
          if (r < 2) P.rect(x0, yy, span, 1, bone);
        }
      }
    }

    // --- tail (behind the body, but well clear of the cape) ----------------
    const tailX = ax - bodyW - 1;
    // Tails sweep down and back, which reads as a tail; a thick one curling
    // upward past the shoulder just reads as a blob attached to the arm.
    if (L.tail === 'wolf') {
      const sw = frame === 1 ? 2 : 0;
      P.taper(tailX, bodyY + 11, tailX - 8, bodyY + 16 - sw, 3, 2.5, shade(hair, -0.12), 10);
      P.taper(tailX - 6, bodyY + 15 - sw, tailX - 11, bodyY + 8 - sw, 2.5, 2, hair, 8);
      P.taper(tailX - 10, bodyY + 10 - sw, tailX - 12, bodyY + 6 - sw, 2, 1.5, '#e8e4dc', 4);
    } else if (L.tail === 'lizard') {
      P.taper(tailX, bodyY + 13, tailX - 9, ground - 4, 2.5, 1.5, shade(skin, -0.14), 10);
      P.taper(tailX - 8, ground - 5, tailX - 13, ground - 1, 1.5, 1, shade(skin, -0.2), 8);
    } else if (L.tail === 'dragon') {
      P.taper(tailX, bodyY + 12, tailX - 9, ground - 5, 3, 1.5, shade(skin, -0.18), 10);
      P.taper(tailX - 8, ground - 6, tailX - 13, ground - 2, 1.5, 1, shade(skin, -0.24), 8);
      for (let i = 0; i < 4; i++) P.px(tailX - 2 - i * 2, bodyY + 14 + i * 2, trimD);
    }

    // --- cape ---------------------------------------------------------------
    if (kit.cape) {
      const capeW = bodyW * 2 - 2, capeH = bodyH + legH - 4;
      P.rect(ax - bodyW + 1 - lean, bodyY + 1, capeW, capeH, clothD);
      if (USE_DITHER) P.dither(ax - bodyW + 1 - lean, bodyY + 1, capeW, 3, cloth, 0.35);
      else P.rect(ax - bodyW + 1 - lean, bodyY + 1, capeW, 2, shade(cloth, -0.2));
      P.mrect(ax, bodyW - 2 + lean, bodyY + bodyH + legH - 7, 2, 3, shade(clothD, -0.2));
    }

    // --- legs ---------------------------------------------------------------
    const robed = kit.body === 'robe' || kit.body === 'dress';
    if (robed) {
      for (let i = 0; i < legH; i++) {
        const wdt = bodyW - 1 + Math.floor(i / 3);
        P.rect(ax - wdt, legY + i, wdt * 2, 1, i > legH - 3 ? clothD : cloth);
        P.rect(ax - wdt, legY + i, 2, 1, clothL);
      }
    } else {
      P.mrect(ax, 1, legY, 3, legH - 2, '#3c3c4e');
      P.mrect(ax, 1, legY, 1, legH - 2, '#50506a');
      P.mrect(ax, 0, legY + legH - 3, 5, 3, '#241f2e');            // boots
      P.mrect(ax, 0, legY + legH - 3, 5, 1, '#3a3446');
    }

    // --- torso --------------------------------------------------------------
    //
    //  Sloped shoulders narrowing to a waist. Drawing the body as one rectangle
    //  is what made these figures read as stacked boxes; every row now carries
    //  its own width, and the trim rides that width instead of a fixed one.
    const bY = bodyY;
    const torsoHalf = (i) => {
      const t = i / Math.max(1, bodyH - 1);
      if (i === 0) return bodyW - 2.4;                               // shoulder slope
      if (i === 1) return bodyW - 0.7;
      return bodyW - bodyW * 0.30 * Math.min(1, (t - 0.08) / 0.92);
    };
    const tw = (i) => Math.max(1, Math.round(torsoHalf(i)));
    /** A band of trim that follows the taper. */
    const band = (i, col, h = 1) => {
      for (let k = 0; k < h; k++) {
        const w = tw(i + k);
        P.rect(ax - w, bY + i + k, w * 2, 1, col);
      }
    };

    P.profile(ax, bY, bodyH, cloth, torsoHalf);
    for (let i = 0; i < bodyH; i++) {                                // lit and shadow sides
      const w = tw(i);
      P.rect(ax - w, bY + i, 3, 1, clothL);
      P.rect(ax + w - 3, bY + i, 3, 1, clothD);
      if (USE_DITHER) {                                              // soften the hard edge
        P.dither(ax - w + 1, bY + i, 2, 1, cloth, 0.4);
        P.dither(ax + w - 3, bY + i, 2, 1, cloth, 0.4);
      }
    }
    switch (kit.body) {
      case 'plate':
        band(0, trimL, 2);                                           // gorget
        band(6, trim); band(7, trimD);                               // belt
        P.mrect(ax, tw(1) - 3, bY + 1, 4, 4, trimL);                 // pauldrons
        P.mrect(ax, tw(5) - 3, bY + 5, 4, 1, trimD);
        break;
      case 'robe':
        P.rect(ax - 2, bY, 4, bodyH, trim);                          // stole
        P.rect(ax - 2, bY, 1, bodyH, trimL);
        band(bodyH - 2, clothD, 2);
        break;
      case 'gi':
        P.rect(ax - 5, bY, 5, bodyH - 2, clothL);                    // lapel
        P.rect(ax - 1, bY, 1, bodyH - 2, clothD);
        band(7, trim); band(8, trimD);                               // sash
        break;
      case 'motley':
        for (let i = 0; i < bodyH; i++) {
          const w = tw(i);
          P.rect(ax - w, bY + i, w, 1, i % 2 ? cloth : trim);
          P.rect(ax, bY + i, w, 1, i % 2 ? trim : cloth);
        }
        band(0, trimL);
        break;
      case 'dress':
        band(4, trimL);
        break;
      default:
        band(7, trim); band(8, trimD);
    }
    if (L.plates) {                                                  // Automaton
      band(3, shade(cloth, -0.55));
      band(10, shade(cloth, -0.55));
      P.rect(ax - 2, bY + 4, 4, 4, L.glow ?? '#f06040');             // core
      P.rect(ax - 1, bY + 5, 2, 2, '#fff0d0');
    }
    if (L.fins) {                                                    // Merfolk
      P.mrect(ax, tw(3) - 1, bY + 3, 4, 2, mix(skin, '#7fe0ff', 0.5));
      P.mrect(ax, tw(6) - 1, bY + 6, 3, 2, mix(skin, '#7fe0ff', 0.35));
    }

    // --- arms ---------------------------------------------------------------
    const armY = bY + 2;
    const armH = bodyH - 3;
    P.rect(ax - tw(2) - 3, armY, 3, armH, clothD);                   // back arm
    P.rect(ax - tw(2) - 3, armY + armH - 2, 3, 3, skinD);
    P.rect(ax + tw(2) + lean, armY - lean, 3, armH, clothL);         // front arm
    P.rect(ax + tw(2) + lean, armY + armH - 2 - lean, 3, 3, skin);

    // --- head ---------------------------------------------------------------
    //
    //  Rounded at the crown and again at the jaw. Most classes wear something
    //  that covers the crown, so the jaw is where this actually shows.
    const hY = headY;
    paintFace(P, { ax, hY, headW, headH, skin, skinL, skinD, hairD, eye, hurt, L });

    // --- headgear -----------------------------------------------------------
    //  Whatever sits on the head IS the silhouette the player sees, so rounding
    //  the skull alone changes nothing — a full-width hat squares it straight
    //  back off. Every cap pulls its top two rows in instead.
    const capHalf = (half) => (i) => (i === 0 ? half - 2 : i === 1 ? half - 1 : half);
    const cap = (yTop, rows, half, col) => P.profile(ax, yTop, rows, col, capHalf(half));
    const capLit = (yTop, half, col) => P.profile(ax, yTop, 1, col, capHalf(half));

    const hairTop = () => {
      if (L.muzzle || L.plates) return;
      paintHairCap(P, { ax, hY, headW, hair, hairL, hairD, styleIdx: hairStyle });
    };
    switch (kit.head) {
      case 'helm':
        cap(hY - 3, 6, headW + 1, trim);
        capLit(hY - 3, headW + 1, trimL);
        P.rect(ax - 1, hY + 3, 2, 6, trimD);                          // nasal bar
        break;
      case 'greathelm':
        cap(hY - 4, headH + 2, headW + 1, trim);
        capLit(hY - 4, headW + 1, trimL);
        P.rect(ax - headW + 1, hY + 4, headW * 2 - 2, 2, '#0d0d16');  // visor
        P.rect(ax - 1, hY - 8, 2, 5, el.color);                        // crest
        break;
      case 'horned':
        cap(hY - 3, 5, headW + 1, trim);
        P.mrect(ax, headW - 1, hY - 7, 2, 5, el.color);
        break;
      case 'horns':
        hairTop();
        P.mrect(ax, headW - 2, hY - 8, 2, 7, el.color);
        break;
      case 'hat':
        P.rect(ax - 12, hY - 1, 24, 3, cloth);
        P.tri(ax - 7, hY - 13, 14, 13, cloth);
        P.rect(ax - 12, hY - 1, 24, 1, clothL);
        P.rect(ax - 3, hY - 5, 6, 3, trim);
        break;
      case 'mitre':
        cap(hY - 8, 9, headW, cloth);
        P.tri(ax - headW, hY - 12, headW * 2, 5, cloth);
        P.rect(ax - 1, hY - 7, 3, 6, trim);
        break;
      case 'hood':
        cap(hY - 3, 7, headW + 1, cloth);
        P.mrect(ax, headW - 1, hY + 4, 2, 6, cloth);
        capLit(hY - 3, headW + 1, clothL);
        P.rect(ax - headW, hY + 4, headW * 2, 1, shade(cloth, -0.45));
        break;
      case 'cap':
        hairTop();
        cap(hY - 4, 4, headW, cloth);
        capLit(hY - 4, headW, clothL);
        P.rect(ax + 2, hY - 8, 4, 5, el.color);                        // feather
        break;
      case 'band':
        hairTop();
        P.rect(ax - headW - 1, hY + 1, headW * 2 + 2, 2, trim);
        P.rect(ax - headW - 4, hY + 2, 4, 1, trim);
        break;
      case 'jester':
        cap(hY - 3, 4, headW, cloth);
        for (let i = 0; i < 4; i++) {
          P.rect(ax - headW - 2 - i, hY - 5 - i, 2, 2, i % 2 ? trim : cloth);
          P.rect(ax + headW + i, hY - 5 - i, 2, 2, i % 2 ? cloth : trim);
        }
        P.rect(ax - headW - 6, hY - 10, 3, 3, el.color);
        P.rect(ax + headW + 4, hY - 10, 3, 3, el.color);
        break;
      case 'veil':
        hairTop();
        P.rect(ax - headW - 1, hY + 1, headW * 2 + 2, 1, trim);
        P.mrect(ax, headW, hY + 2, 2, 9, shade(trim, -0.18));
        break;
      case 'mask':
        hairTop();
        P.rect(ax - headW - 1, hY + 3, headW * 2 + 2, 5, trim);
        P.rect(ax - 4, hY + 4, 3, 2, '#0d0d16');
        P.rect(ax + 1, hY + 4, 3, 2, '#0d0d16');
        break;
      default: hairTop();
    }

    // --- race anatomy, drawn OVER the headgear ------------------------------
    // A helm has ear holes and does not cover a muzzle: the race has to read
    // at a glance, or twelve of them look like twelve of the same person.
    paintRaceAnatomy(P, { ax, hY, headW, headH, skin, skinL, skinD, hair, hairL, hairD, L });

    // --- weapon (in front) ---------------------------------------------------
    const wx = ax + bodyW + 4 + lean;
    const wy = armY - 5 - lean;
    const steel = '#a2acc4', steelL = '#eef2ff', steelD = '#6a7286';
    switch (kit.weapon) {
      case 'sword':
        P.rect(wx, wy - 8, 4, 21, steel);
        P.rect(wx, wy - 8, 1, 21, steelL);
        P.rect(wx + 3, wy - 8, 1, 21, steelD);
        P.rect(wx - 2, wy + 12, 8, 2, trim);
        P.rect(wx - 2, wy + 12, 8, 1, trimL);
        P.rect(wx + 1, wy + 14, 2, 5, '#5c4028');
        break;
      case 'spear':
        P.rect(wx + 1, wy - 14, 2, 34, '#6b4a28');
        P.rect(wx + 1, wy - 14, 1, 34, '#8a6238');
        P.tri(wx - 1, wy - 21, 6, 8, steel);
        P.rect(wx - 1, wy - 13, 6, 2, trim);
        break;
      case 'staff':
        P.rect(wx + 1, wy - 8, 3, 30, '#6b4a28');
        P.rect(wx + 1, wy - 8, 1, 30, '#8a6238');
        P.ellipse(wx + 2, wy - 11, 4, 4, el.color);
        P.ellipse(wx + 1, wy - 12, 2, 2, '#ffffff');
        break;
      case 'bow':
        for (let i = -12; i <= 12; i++) {
          const dx = Math.round(4 * Math.cos((i / 13) * 1.4));
          P.rect(wx + dx, wy + 3 + i, 2, 1, '#8a6030');
          if (i % 4 === 0) P.px(wx + dx, wy + 3 + i, '#a87a44');
        }
        P.rect(wx + 2, wy - 9, 1, 25, '#e4e8f4');
        break;
      case 'dagger':
        P.rect(wx, wy + 2, 3, 10, steel);
        P.rect(wx, wy + 2, 1, 10, steelL);
        P.rect(wx - 1, wy + 12, 5, 2, trim);
        break;
      case 'mace':
        P.rect(wx + 1, wy + 2, 2, 14, '#6b4a28');
        P.ellipse(wx + 2, wy + 1, 4, 4, trim);
        P.ellipse(wx + 1, wy, 2, 2, trimL);
        break;
      case 'shield':
        P.rect(wx - 1, wy, 9, 17, trim);
        P.rect(wx - 1, wy, 9, 1, trimL);
        P.rect(wx + 1, wy + 4, 5, 8, el.color);
        P.rect(wx + 2, wy + 5, 3, 3, shade(el.color, 0.4));
        break;
      case 'fist':
        P.rect(wx - 1, wy + 8, 5, 5, shade(skin, -0.08));
        P.rect(wx - 1, wy + 8, 5, 1, trim);
        break;
      default: break;
    }
  }, { round: true, outline: OUTLINE, ao: 0.26, rim: RIM, rimAlpha: 0.34 });
}

/**
 * A close-up bust for the battle status card — a bigger head-to-frame ratio
 * than the full-body sprite can ever give a percentage crop, since the
 * head's absolute size doesn't change no matter what's cropped. Deliberately
 * skips the class headgear switch: several of its cases (the mage's 'hat',
 * for one) use pixel offsets sized for the body sprite's headW and would
 * misalign against a head this much bigger. Showing the bare face is also
 * the convention the reference art itself uses — portraits reveal the face
 * even for helmeted classes.
 *
 * @param {object} o {classId, raceId, elementId, skin, hair}
 */
export function actorPortraitSprite(o) {
  const cls = getClass(o.classId);
  const race = getRace(o.raceId ?? 'human');
  const kit = KITS[cls.root];
  const el = ELEMENT_BY_ID[o.elementId] ?? { color: '#c8c8d8', color2: '#ffffff' };
  const L = race.look;
  const tier = cls.tier;

  const skin = L.skins[(o.skin ?? 0) % L.skins.length];
  const hair = L.hairs[(o.hair ?? 0) % L.hairs.length];
  const key = `bust|${cls.root}|${tier}|${race.id}|${o.elementId}|${o.skin ?? 0}|${o.hair ?? 0}`;

  return make(key, PW, PH, (P) => {
    const ax = PW / 2;
    const build = L.build ?? 1;

    const cloth = tier >= 3 ? shade(kit.cloth, 0.14) : kit.cloth;
    const clothL = shade(cloth, 0.32);
    const trim = tier >= 2 ? mix(kit.trim, el.color, 0.55) : kit.trim;
    const trimL = shade(trim, 0.38);
    const skinL = shade(skin, 0.2);
    const skinD = shade(skin, -0.26);
    const hairL = shade(hair, 0.34);
    const hairD = shade(hair, -0.34);
    const eye = L.glow ?? L.eye ?? '#2b1f2e';
    const hairStyle = (hashStr(race.id) + (o.hair ?? 0)) % 4;

    const headW = Math.round(6 * build * 1.4);
    const headH = Math.round(13 * build * 1.25);
    const hY = 4;

    // --- shoulders/collar (drawn first, the head silhouette sits on top) ---
    const maxHalf = PW / 2 - 2;
    const shoulderY = hY + headH - 2;
    const shoulderH = Math.max(4, PH - shoulderY - 2);
    const shoulderHalf = (i) => Math.min(maxHalf, headW + 3 + i * 0.8);
    P.profile(ax, shoulderY, shoulderH, cloth, shoulderHalf);
    for (let i = 0; i < shoulderH; i++) {
      const w = Math.max(1, Math.round(shoulderHalf(i)));
      P.rect(ax - w, shoulderY + i, 3, 1, clothL);
      P.dither(ax - w + 2, shoulderY + i, 2, 1, cloth, 0.35);
    }
    P.rect(ax - headW, shoulderY, headW * 2, 2, trim);              // collar
    P.rect(ax - headW, shoulderY, headW * 2, 1, trimL);

    paintPortraitFace(P, { ax, hY, headW, headH, skin, skinL, skinD, hairD, eye, hurt: false, L });
    if (!L.muzzle && !L.plates) {
      paintHairCap(P, { ax, hY, headW, hair, hairL, hairD, styleIdx: hairStyle });
    }
    paintRaceAnatomy(P, { ax, hY, headW, headH, skin, skinL, skinD, hair, hairL, hairD, L });
  }, { round: true, outline: OUTLINE, ao: 0.3, rim: RIM, rimAlpha: 0.42 });
}

// ---------------------------------------------------------------------------
//  TOWNSFOLK
// ---------------------------------------------------------------------------
const NPC_KITS = {
  shop:   { cloth: '#8d5c2a', trim: '#dcb44c', hair: '#3a2a20', hat: 'cap' },
  inn:    { cloth: '#325fa8', trim: '#ccd8f0', hair: '#5a3a1c', hat: 'none' },
  temple: { cloth: '#dfe0ec', trim: '#cca442', hair: '#e8e8f0', hat: 'hood' },
  guild:  { cloth: '#9d3a3a', trim: '#e4c464', hair: '#241c18', hat: 'none' },
  talk:   { cloth: '#4e7d4e', trim: '#8cbc8c', hair: '#6a4a24', hat: 'none' },
};
const NPC_SKINS = ['#e8b890', '#c89068', '#a06848', '#7a4c30'];
export const NW = 24, NH = 32;

export function npcSprite(kind, variant = 0, frame = 0) {
  const kit = NPC_KITS[kind] ?? NPC_KITS.talk;
  const skin = NPC_SKINS[variant % NPC_SKINS.length];
  return make(`npc|${kind}|${variant}|${frame}`, NW, NH, (P) => {
    const ax = NW / 2;
    const bob = frame === 1 ? 1 : 0;
    const ground = NH - 2;
    const cloth = kit.cloth, clothL = shade(cloth, 0.3), clothD = shade(cloth, -0.42);
    const skinL = shade(skin, 0.2), skinD = shade(skin, -0.26);
    const legY = ground - 7 + bob, bodyY = legY - 10, headY = bodyY - 9;

    P.ellipse(ax, ground, 6, 2, '#151222');
    P.mrect(ax, 1, legY, 3, 6, clothD);
    P.mrect(ax, 1, legY + 5, 4, 2, '#241f2e');
    P.rect(ax - 5, bodyY, 10, 10, cloth);
    P.rect(ax - 5, bodyY, 2, 10, clothL);
    P.rect(ax + 3, bodyY, 2, 10, clothD);
    P.rect(ax - 5, bodyY + 5, 10, 1, kit.trim);
    P.rect(ax - 8, bodyY + 1, 3, 8, clothD);
    P.rect(ax + 5, bodyY + 1, 3, 8, clothL);
    P.rect(ax - 8, bodyY + 7, 3, 2, skinD);
    P.rect(ax + 5, bodyY + 7, 3, 2, skin);
    P.rect(ax - 4, headY, 8, 9, skin);
    P.rect(ax - 4, headY + 1, 2, 6, skinL);
    P.rect(ax + 2, headY, 2, 9, skinD);
    P.rect(ax - 3, headY + 4, 2, 2, '#2b1f2e');
    P.rect(ax + 1, headY + 4, 2, 2, '#2b1f2e');
    P.rect(ax - 1, headY + 7, 2, 1, skinD);
    if (kit.hat === 'hood') {
      P.rect(ax - 5, headY - 3, 10, 6, kit.trim);
      P.rect(ax - 5, headY - 3, 10, 1, shade(kit.trim, 0.35));
      P.mrect(ax, 4, headY + 3, 1, 5, kit.trim);
    } else if (kit.hat === 'cap') {
      P.rect(ax - 5, headY - 3, 10, 4, cloth);
      P.rect(ax - 5, headY - 3, 10, 1, clothL);
      P.rect(ax - 5, headY + 1, 10, 1, kit.trim);
    } else {
      P.rect(ax - 4, headY - 3, 8, 4, kit.hair);
      P.rect(ax - 4, headY - 3, 5, 1, shade(kit.hair, 0.4));
      P.mrect(ax, 3, headY + 1, 1, 4, kit.hair);
    }
  }, { round: true, outline: OUTLINE, ao: 0.24, rim: RIM, rimAlpha: 0.3 });
}
