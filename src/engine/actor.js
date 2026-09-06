// ============================================================================
//  ACTOR SPRITES — party members, generated from class kit x race anatomy x
//  element tint.
//
//  actorSprite (36x48, 4 frames) and actorPortraitSprite (56x64, a bust) are
//  both painted by engine/animeface.js's bezier-and-arc anime style rather
//  than pixel.js's blocky painter — see that file's own header for why.
//  Townsfolk (npcSprite/npcPortraitSprite below) use the same painters, just
//  rendered at the actor/portrait canvas's native size and scaled down onto
//  their own smaller canvas — see those functions for why.
// ============================================================================

import { make, shade, mix } from './pixel.js';
import { ELEMENT_BY_ID } from '../data/elements.js';
import { getClass } from '../data/classes.js';
import { getRace } from '../data/races.js';
import { getItem } from '../data/items.js';
import { paintAnimeBust, paintAnimeBody, pickHairstyle } from './animeface.js';

export const AW = 36, AH = 48;      // actor canvas
export const PW = 56, PH = 64;      // portrait bust canvas

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
  warrior:   { weapon: 'sword',  cloth: '#a8342c', trim: '#e0bc58' },
  guardian:  { weapon: 'shield', cloth: '#3358ab', trim: '#cdd6e8' },
  monk:      { weapon: 'fist',   cloth: '#dcac52', trim: '#a84c2a' },
  lancer:    { weapon: 'spear',  cloth: '#2f7352', trim: '#dcc464' },
  thief:     { weapon: 'dagger', cloth: '#4a4280', trim: '#8f7ec8' },
  archer:    { weapon: 'bow',    cloth: '#436c3c', trim: '#adc576' },
  dancer:    { weapon: 'dagger', cloth: '#c44a8c', trim: '#f4cee6' },
  jester:    { weapon: 'dagger', cloth: '#8c3aa6', trim: '#f4d44c' },
  mage:      { weapon: 'staff',  cloth: '#3c3c94', trim: '#ccb464' },
  cleric:    { weapon: 'mace',   cloth: '#e4e4ee', trim: '#cca442' },
  summoner:  { weapon: 'staff',  cloth: '#6e3c94', trim: '#dcbcf4' },
  spiritist: { weapon: 'staff',  cloth: '#2c6e6e', trim: '#a4e4d4' },
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
// No race data to draw from (an NPC is just a "kind" + a skin variant), so
// every townsfolk shares one plain-human anatomy — only cloth, hair colour
// and hairstyle vary, the same way a player character's kit differs by class
// while race anatomy is layered on separately.
const NPC_LOOK = {
  ears: 'round', muzzle: false, tail: null, wings: null, horns: null,
  tusks: false, beard: false, goggles: false, fins: false, scaled: false,
  fur: false, plates: false, gaunt: false, build: 1,
};
const NPC_EYE = '#4a3a2c';
const NPC_KITS = {
  shop:   { cloth: '#8d5c2a', trim: '#dcb44c', hair: '#3a2a20', hairstyles: ['spiky', 'bob'] },
  inn:    { cloth: '#325fa8', trim: '#ccd8f0', hair: '#5a3a1c', hairstyles: ['swept', 'bob'] },
  temple: { cloth: '#dfe0ec', trim: '#cca442', hair: '#e8e8f0', hairstyles: ['flowing', 'braid'] },
  guild:  { cloth: '#9d3a3a', trim: '#e4c464', hair: '#241c18', hairstyles: ['spiky', 'swept'] },
  talk:   { cloth: '#4e7d4e', trim: '#8cbc8c', hair: '#6a4a24', hairstyles: ['bob', 'swept'] },
};
const NPC_SKINS = ['#e8b890', '#c89068', '#a06848', '#7a4c30'];
export const NW = 24, NH = 32;

export function npcSprite(kind, variant = 0, frame = 0) {
  const kit = NPC_KITS[kind] ?? NPC_KITS.talk;
  const skin = NPC_SKINS[variant % NPC_SKINS.length];
  const hairStyle = kit.hairstyles[variant % kit.hairstyles.length];
  return make(`npc|${kind}|${variant}|${frame}`, NW, NH, (P) => {
    // paintAnimeBody's proportions are tuned for the actor canvas (AW x AH)
    // it was built for — painted there at native size, then scaled down onto
    // the townsfolk's own smaller canvas, which keeps NPCs a visible notch
    // smaller than the party on the field, same as the old pixel sprites.
    const src = document.createElement('canvas');
    src.width = AW; src.height = AH;
    paintAnimeBody(src.getContext('2d'), {
      w: AW, h: AH, frame, skin, hair: kit.hair, eye: NPC_EYE,
      cloth: kit.cloth, trim: kit.trim, look: NPC_LOOK, hairStyle,
      seed: hashStr(`${kind}|${variant}`), weaponType: 'fist', weaponElement: null, hasShield: false,
    });
    P.ctx.imageSmoothingEnabled = true;
    P.ctx.drawImage(src, 0, 0, NW, NH);
  });
}

/** A head-and-shoulders bust for dialogue — the same kit/skin an NPC's field
 *  sprite already uses, just built at a size worth putting a face on. */
export const NPW = 40, NPH = 46;

export function npcPortraitSprite(kind, variant = 0) {
  const kit = NPC_KITS[kind] ?? NPC_KITS.talk;
  const skin = NPC_SKINS[variant % NPC_SKINS.length];
  const hairStyle = kit.hairstyles[variant % kit.hairstyles.length];
  return make(`npcport|${kind}|${variant}`, NPW, NPH, (P) => {
    // Same native-size-then-downscale approach as npcSprite, using the
    // portrait bust canvas (PW x PH) paintAnimeBust is tuned for.
    const src = document.createElement('canvas');
    src.width = PW; src.height = PH;
    const cx = PW / 2, cy = PH * 0.467;
    paintAnimeBust(src.getContext('2d'), cx, cy, 12.5, 13.6, {
      skin, hair: kit.hair, eye: NPC_EYE, cloth: kit.cloth, trim: kit.trim,
      look: NPC_LOOK, hairStyle, seed: hashStr(`${kind}|${variant}`),
    });
    P.ctx.imageSmoothingEnabled = true;
    P.ctx.drawImage(src, 0, 0, NPW, NPH);
  });
}
