// ============================================================================
//  ACTOR SPRITES — party members, generated from class kit x race anatomy x
//  element tint.
//
//  actorSprite (36x48, 4 frames) and actorPortraitSprite (56x64, a bust) are
//  both painted by engine/animeface.js's bezier-and-arc anime style rather
//  than pixel.js's blocky painter — see that file's own header for why.
//  Townsfolk (npcSprite/npcPortraitSprite below) still use the original
//  traced-pixel look — not yet converted.
// ============================================================================

import { make, shade, mix } from './pixel.js';
import { ELEMENT_BY_ID } from '../data/elements.js';
import { getClass } from '../data/classes.js';
import { getRace } from '../data/races.js';
import { getItem } from '../data/items.js';
import { paintAnimeBust, paintAnimeBody, pickHairstyle } from './animeface.js';

export const AW = 36, AH = 48;      // actor canvas
export const PW = 56, PH = 64;      // portrait bust canvas
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
 * What a character actually carries, in visual terms — the weapon shape to
 * draw and its elemental tint (if any), and whether a shield rides the off
 * hand — independent of class, since two warriors can carry entirely
 * different arms. Falls back to the class's default kit whenever `o.equip`
 * is absent (a creation-screen preview, before any items are owned) or a
 * slot is empty, so every existing caller keeps working unchanged.
 */
function equipLook(o, kit) {
  const equip = o.equip;
  const weaponItem = equip?.weapon ? getItem(equip.weapon) : null;
  const offhandItem = equip?.offhand ? getItem(equip.offhand) : null;
  const weaponType = weaponItem?.wtype ?? kit.weapon;
  const weaponElement = weaponItem?.element && weaponItem.element !== 'none' ? weaponItem.element : null;
  const hasShield = offhandItem?.wtype === 'shield';
  return { weaponType, weaponElement, hasShield };
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
 * @param {object} o {classId, raceId, elementId, skin, hair, frame, equip}
 *   frame 0 idle · 1 step · 2 hurt · 3 attack
 *   equip {weapon, offhand, body, head, accessory} — item ids, all optional;
 *   when given, the actual carried weapon and off-hand shield are drawn
 *   instead of the class's stock loadout.
 */
export function actorSprite(o) {
  const cls = getClass(o.classId);
  const race = getRace(o.raceId ?? 'human');
  const kit = KITS[cls.root];
  const el = ELEMENT_BY_ID[o.elementId] ?? { color: '#c8c8d8', color2: '#ffffff' };
  const L = race.look;
  const frame = o.frame ?? 0;
  const tier = cls.tier;
  const { weaponType, weaponElement, hasShield } = equipLook(o, kit);

  const skin = L.skins[(o.skin ?? 0) % L.skins.length];
  const hair = L.hairs[(o.hair ?? 0) % L.hairs.length];
  const key = `act|${cls.root}|${tier}|${race.id}|${o.elementId}|${o.skin ?? 0}|${o.hair ?? 0}|${frame}` +
    `|${weaponType}|${weaponElement ?? ''}|${hasShield ? 1 : 0}`;

  return make(key, AW, AH, (P) => {
    const cloth = tier >= 3 ? shade(kit.cloth, 0.14) : kit.cloth;
    const trim = tier >= 2 ? mix(kit.trim, el.color, 0.55) : kit.trim;
    const eye = L.glow ?? L.eye ?? '#2b1f2e';
    const seed = hashStr(`${race.id}|${o.hair ?? 0}|${o.skin ?? 0}`);
    const hairStyle = pickHairstyle(cls.root, seed);

    paintAnimeBody(P.ctx, {
      w: AW, h: AH, frame, skin, hair, eye, cloth, trim, look: L, hairStyle, seed,
      weaponType, weaponElement, hasShield,
    });

    if (tier >= 5) {
      P.ctx.save();
      P.ctx.globalCompositeOperation = 'source-atop';
      P.ctx.globalAlpha = tier >= 7 ? 0.24 : 0.13;
      const g = P.ctx.createRadialGradient(AW / 2, AH * 0.55, 2, AW / 2, AH * 0.55, AW);
      g.addColorStop(0, el.color2 ?? el.color);
      g.addColorStop(1, el.color);
      P.ctx.fillStyle = g;
      P.ctx.fillRect(0, 0, AW, AH);
      P.ctx.restore();
    }
  });
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
    const build = L.build ?? 1;
    const cloth = tier >= 3 ? shade(kit.cloth, 0.14) : kit.cloth;
    const trim = tier >= 2 ? mix(kit.trim, el.color, 0.55) : kit.trim;
    const eye = L.glow ?? L.eye ?? '#2b1f2e';
    const seed = hashStr(`${race.id}|${o.hair ?? 0}|${o.skin ?? 0}`);
    const hairStyle = pickHairstyle(cls.root, seed);

    const cx = PW / 2, cy = PH * 0.467;
    const hw = 12.5 * Math.sqrt(build), hh = 13.6 * Math.sqrt(build);
    paintAnimeBust(P.ctx, cx, cy, hw, hh, { skin, hair, eye, cloth, trim, look: L, hairStyle, seed });

    // --- promotion wash, tier 5+ — the same treatment the body sprite gets
    if (tier >= 5) {
      P.ctx.save();
      P.ctx.globalCompositeOperation = 'source-atop';
      P.ctx.globalAlpha = tier >= 7 ? 0.22 : 0.12;
      const g = P.ctx.createRadialGradient(cx, cy, 2, cx, cy, hw + 20);
      g.addColorStop(0, el.color2 ?? el.color);
      g.addColorStop(1, el.color);
      P.ctx.fillStyle = g;
      P.ctx.fillRect(0, 0, PW, PH);
      P.ctx.restore();
    }
  });
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

/** A head-and-shoulders bust for dialogue — the same kit/skin an NPC's field
 *  sprite already uses, just built at a size worth putting a face on. */
export const NPW = 40, NPH = 46;

export function npcPortraitSprite(kind, variant = 0) {
  const kit = NPC_KITS[kind] ?? NPC_KITS.talk;
  const skin = NPC_SKINS[variant % NPC_SKINS.length];
  return make(`npcport|${kind}|${variant}`, NPW, NPH, (P) => {
    const ax = NPW / 2;
    const cloth = kit.cloth, clothL = shade(cloth, 0.3), clothD = shade(cloth, -0.42);
    const skinL = shade(skin, 0.2), skinD = shade(skin, -0.26);
    const headW = 18, headH = 20, headY = 5;
    const shoulderY = headY + headH - 3;

    // shoulders, filling out to the canvas edges
    P.rect(0, shoulderY, NPW, NPH - shoulderY, cloth);
    P.rect(0, shoulderY, 3, NPH - shoulderY, clothL);
    P.rect(NPW - 3, shoulderY, 3, NPH - shoulderY, clothD);
    P.rect(0, shoulderY, NPW, 2, kit.trim);
    P.rect(ax - 4, shoulderY - 5, 8, 6, skinD);

    // head
    P.rect(ax - headW / 2, headY, headW, headH, skin);
    P.rect(ax - headW / 2, headY, 3, headH, skinL);
    P.rect(ax + headW / 2 - 3, headY, 3, headH, skinD);
    P.rect(ax - headW / 2 + 2, headY + headH - 4, headW - 4, 3, skinD);

    // eyes
    P.rect(ax - 7, headY + 8, 4, 2, shade(skin, -0.12));
    P.rect(ax + 3, headY + 8, 4, 2, shade(skin, -0.12));
    P.rect(ax - 6, headY + 9, 3, 3, '#241a2c');
    P.rect(ax + 3, headY + 9, 3, 3, '#241a2c');
    P.rect(ax - 5, headY + 9, 1, 1, '#eef2fb');
    P.rect(ax + 4, headY + 9, 1, 1, '#eef2fb');

    // nose + mouth
    P.rect(ax - 1, headY + 12, 2, 3, skinD);
    P.rect(ax - 3, headY + headH - 6, 6, 1, shade(skinD, -0.15));

    if (kit.hat === 'hood') {
      P.rect(ax - headW / 2 - 3, headY - 5, headW + 6, 9, kit.trim);
      P.rect(ax - headW / 2 - 3, headY - 5, headW + 6, 2, shade(kit.trim, 0.35));
      P.rect(ax - headW / 2 + 1, headY + 4, 2, headH - 4, kit.trim);
      P.rect(ax + headW / 2 - 3, headY + 4, 2, headH - 4, kit.trim);
    } else if (kit.hat === 'cap') {
      P.rect(ax - headW / 2 - 2, headY - 6, headW + 4, 7, cloth);
      P.rect(ax - headW / 2 - 2, headY - 6, headW + 4, 2, clothL);
      P.rect(ax - headW / 2 - 2, headY - 1, headW + 4, 2, kit.trim);
    } else {
      P.rect(ax - headW / 2 - 1, headY - 5, headW + 2, 7, kit.hair);
      P.rect(ax - headW / 2 - 1, headY - 5, headW + 2, 2, shade(kit.hair, 0.4));
      P.rect(ax - headW / 2 - 1, headY + 2, 3, headH - 6, kit.hair);
      P.rect(ax + headW / 2 - 2, headY + 2, 3, headH - 6, kit.hair);
    }
  }, { round: true, outline: OUTLINE, ao: 0.26, rim: RIM, rimAlpha: 0.32 });
}
