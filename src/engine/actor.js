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
const OUTLINE = '#0a0812';
const RIM = '#8fa8d8';

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
    const bodyW = Math.round(7 * build);      // half-width

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
      P.rect(ax - bodyW + 1 - lean, bodyY + 1, bodyW * 2 - 2, bodyH + legH - 4, clothD);
      P.rect(ax - bodyW + 1 - lean, bodyY + 1, bodyW * 2 - 2, 2, shade(cloth, -0.2));
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
    const bY = bodyY;
    P.rect(ax - bodyW, bY, bodyW * 2, bodyH, cloth);
    P.rect(ax - bodyW, bY, 3, bodyH, clothL);                        // lit side
    P.rect(ax + bodyW - 3, bY, 3, bodyH, clothD);                    // shadow side
    switch (kit.body) {
      case 'plate':
        P.rect(ax - bodyW, bY, bodyW * 2, 2, trimL);                 // gorget
        P.rect(ax - bodyW, bY + 6, bodyW * 2, 1, trim);              // belt
        P.rect(ax - bodyW, bY + 7, bodyW * 2, 1, trimD);
        P.mrect(ax, bodyW - 3, bY + 1, 4, 4, trimL);                 // pauldrons
        P.mrect(ax, bodyW - 3, bY + 5, 4, 1, trimD);
        break;
      case 'robe':
        P.rect(ax - 2, bY, 4, bodyH, trim);                          // stole
        P.rect(ax - 2, bY, 1, bodyH, trimL);
        P.rect(ax - bodyW, bY + bodyH - 2, bodyW * 2, 2, clothD);
        break;
      case 'gi':
        P.rect(ax - 5, bY, 5, bodyH - 2, clothL);                    // lapel
        P.rect(ax - 1, bY, 1, bodyH - 2, clothD);
        P.rect(ax - bodyW, bY + 7, bodyW * 2, 2, trim);              // sash
        P.rect(ax - bodyW, bY + 8, bodyW * 2, 1, trimD);
        break;
      case 'motley':
        for (let i = 0; i < bodyH; i++) {
          P.rect(ax - bodyW, bY + i, bodyW, 1, i % 2 ? cloth : trim);
          P.rect(ax, bY + i, bodyW, 1, i % 2 ? trim : cloth);
        }
        P.rect(ax - bodyW, bY, bodyW * 2, 1, trimL);
        break;
      case 'dress':
        P.rect(ax - bodyW, bY + 4, bodyW * 2, 1, trimL);
        break;
      default:
        P.rect(ax - bodyW, bY + 7, bodyW * 2, 1, trim);
        P.rect(ax - bodyW, bY + 8, bodyW * 2, 1, trimD);
    }
    if (L.plates) {                                                  // Automaton
      P.rect(ax - bodyW, bY + 3, bodyW * 2, 1, shade(cloth, -0.55));
      P.rect(ax - bodyW, bY + 10, bodyW * 2, 1, shade(cloth, -0.55));
      P.rect(ax - 2, bY + 4, 4, 4, L.glow ?? '#f06040');             // core
      P.rect(ax - 1, bY + 5, 2, 2, '#fff0d0');
    }
    if (L.fins) {                                                    // Merfolk
      P.mrect(ax, bodyW - 1, bY + 3, 4, 2, mix(skin, '#7fe0ff', 0.5));
      P.mrect(ax, bodyW - 1, bY + 6, 3, 2, mix(skin, '#7fe0ff', 0.35));
    }

    // --- arms ---------------------------------------------------------------
    const armY = bY + 2;
    const armH = bodyH - 3;
    P.rect(ax - bodyW - 3, armY, 3, armH, clothD);                   // back arm
    P.rect(ax - bodyW - 3, armY + armH - 2, 3, 3, skinD);
    P.rect(ax + bodyW + lean, armY - lean, 3, armH, clothL);         // front arm
    P.rect(ax + bodyW + lean, armY + armH - 2 - lean, 3, 3, skin);

    // --- head ---------------------------------------------------------------
    const hY = headY;
    P.rect(ax - headW, hY, headW * 2, headH - 1, skin);
    P.rect(ax - headW, hY + 1, 2, headH - 3, skinL);                 // lit cheek
    P.rect(ax + headW - 2, hY, 2, headH - 1, skinD);                 // shadow cheek
    P.rect(ax - headW, hY + headH - 2, headW * 2, 1, skinD);         // jaw
    if (L.scaled) {
      for (let i = 0; i < 5; i++) P.px(ax - 3 + (i % 3) * 3, hY + 2 + i, shade(skin, -0.2));
    }
    if (L.gaunt) {                                                   // Revenant
      P.rect(ax - headW + 1, hY + 5, 2, 3, skinD);
      P.rect(ax + headW - 3, hY + 5, 2, 3, skinD);
    }
    // eyes
    if (!hurt) {
      P.rect(ax - 4, hY + 5, 3, 2, eye);
      P.rect(ax + 1, hY + 5, 3, 2, eye);
      P.px(ax - 4, hY + 5, '#f4f4ff');
      P.px(ax + 1, hY + 5, '#f4f4ff');
      if (L.glow) { P.px(ax - 3, hY + 6, L.glow); P.px(ax + 2, hY + 6, L.glow); }
    } else {
      P.rect(ax - 4, hY + 6, 3, 1, eye);
      P.rect(ax + 1, hY + 6, 3, 1, eye);
    }
    if (!L.muzzle) P.rect(ax - 1, hY + 9, 2, 1, skinD);              // mouth

    // --- headgear -----------------------------------------------------------
    const hairTop = () => {
      if (L.muzzle || L.plates) return;
      P.rect(ax - headW, hY - 2, headW * 2, 4, hair);
      P.rect(ax - headW, hY - 2, headW - 1, 1, hairL);
      P.mrect(ax, headW - 1, hY + 1, 1, 5, hair);
    };
    switch (kit.head) {
      case 'helm':
        P.rect(ax - headW - 1, hY - 3, headW * 2 + 2, 6, trim);
        P.rect(ax - headW - 1, hY - 3, headW * 2 + 2, 1, trimL);
        P.rect(ax - 1, hY + 3, 2, 6, trimD);                          // nasal bar
        break;
      case 'greathelm':
        P.rect(ax - headW - 1, hY - 4, headW * 2 + 2, headH + 2, trim);
        P.rect(ax - headW - 1, hY - 4, headW * 2 + 2, 1, trimL);
        P.rect(ax - headW + 1, hY + 4, headW * 2 - 2, 2, '#0d0d16');  // visor
        P.rect(ax - 1, hY - 8, 2, 5, el.color);                        // crest
        break;
      case 'horned':
        P.rect(ax - headW - 1, hY - 3, headW * 2 + 2, 5, trim);
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
        P.rect(ax - headW, hY - 8, headW * 2, 9, cloth);
        P.tri(ax - headW, hY - 12, headW * 2, 5, cloth);
        P.rect(ax - 1, hY - 7, 3, 6, trim);
        break;
      case 'hood':
        P.rect(ax - headW - 1, hY - 3, headW * 2 + 2, 7, cloth);
        P.mrect(ax, headW - 1, hY + 4, 2, 6, cloth);
        P.rect(ax - headW - 1, hY - 3, headW * 2 + 2, 1, clothL);
        P.rect(ax - headW, hY + 4, headW * 2, 1, shade(cloth, -0.45));
        break;
      case 'cap':
        hairTop();
        P.rect(ax - headW, hY - 4, headW * 2, 4, cloth);
        P.rect(ax - headW, hY - 4, headW * 2, 1, clothL);
        P.rect(ax + 2, hY - 8, 4, 5, el.color);                        // feather
        break;
      case 'band':
        hairTop();
        P.rect(ax - headW - 1, hY + 1, headW * 2 + 2, 2, trim);
        P.rect(ax - headW - 4, hY + 2, 4, 1, trim);
        break;
      case 'jester':
        P.rect(ax - headW, hY - 3, headW * 2, 4, cloth);
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
  }, { outline: OUTLINE, ao: 0.26, rim: RIM, rimAlpha: 0.34 });
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
  }, { outline: OUTLINE, ao: 0.24, rim: RIM, rimAlpha: 0.3 });
}
