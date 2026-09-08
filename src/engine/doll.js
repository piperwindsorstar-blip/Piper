// ============================================================================
//  DOLL — field + battle body. Race anatomy + class armour + weapon.
//  Built at ~1.72 world-units tall; callers scale to the sprite footprint.
// ============================================================================

function hex(n) {
  if (typeof n === "number") return n;
  if (!n || n[0] !== "#") return 0xc8b090;
  const h = n.slice(1);
  return parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
}

function mat(THREE, color, opts = {}) {
  return new THREE.MeshLambertMaterial({
    color: hex(color),
    flatShading: true,
    emissive: opts.emissive ?? 0x000000,
    ...opts,
  });
}

function box(THREE, w, h, d, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function sphere(THREE, r, material, segs = 8) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs), material);
}

function cyl(THREE, rTop, rBot, h, material, segs = 8) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), material);
}

function cone(THREE, r, h, material, segs = 8) {
  return new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), material);
}

import { getClass } from "../data/classes.js";
import { getRace } from "../data/races.js";
import { getArmorFilter, getWeaponFilter, getRaceFilter } from "./filters.js";

/** Unscaled height, feet to hair. Field uses 48/TS ≈ 2; battle uses 2.3. */
export const DOLL_H = 1.72;

export function lookFromActor(o) {
  const cls = getClass(o.classId);
  const race = getRace(o.raceId ?? "human");
  const L = race.look;
  const armor = getArmorFilter(cls.root);
  const weapon = getWeaponFilter(cls.root);
  const rf = getRaceFilter(race.id);
  return {
    skin: L.skins[(o.skin ?? 0) % L.skins.length],
    hair: L.hairs[(o.hair ?? 0) % L.hairs.length],
    eye: L.eye ?? "#2a2030",
    ears: L.ears ?? "round",
    muzzle: !!L.muzzle,
    tail: L.tail ?? null,
    wings: L.wings ?? null,
    horns: L.horns ?? null,
    beard: !!L.beard,
    build: L.build ?? 1,
    cloth: armor.cloth ?? "#a8342c",
    trim: armor.trim ?? "#e0bc58",
    metal: armor.metal ? "#d8e0ee" : "#a8b0bc",
    cape: armor.cape,
    helm: armor.helm,
    kind: armor.kind,
    weapon: weapon.type,
    raceId: race.id,
    classId: cls.root,
    scale: rf.scale ?? 1,
  };
}

function paintFace(skin, hair, eye) {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.fillStyle = skin;
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = hair;
  g.fillRect(0, 0, 16, 4);
  g.fillStyle = "#fff8ee";
  g.fillRect(3, 6, 3, 3);
  g.fillRect(10, 6, 3, 3);
  g.fillStyle = eye;
  g.fillRect(4, 7, 2, 2);
  g.fillRect(11, 7, 2, 2);
  g.fillStyle = "#1a1018";
  g.fillRect(4, 7, 1, 1);
  g.fillRect(11, 7, 1, 1);
  g.fillStyle = "#c07070";
  g.fillRect(7, 11, 2, 1);
  return c;
}

export function makeDoll(THREE, look) {
  const root = new THREE.Group();
  const hip = new THREE.Group();
  const torso = new THREE.Group();
  const headG = new THREE.Group();
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  const mats = [];

  const addMat = (color, opts) => {
    const m = mat(THREE, color, opts);
    mats.push(m);
    return m;
  };

  const skinM = addMat(look.skin ?? "#e8b890");
  const clothM = addMat(look.cloth ?? "#a8342c");
  const metalM = addMat(look.metal ?? "#d8e0ee", { emissive: 0x222838 });
  const trimM = addMat(look.trim ?? "#e0bc58", { emissive: 0x2a2008 });
  const capeM = addMat(look.cape ?? "#2a4784", { side: THREE.DoubleSide });
  const bootM = addMat("#241610");
  const bladeM = addMat("#eef2f8", { emissive: 0x3a4050 });
  const hairM = addMat(look.hair ?? "#3a2a20");

  const armored = look.kind === "plate" || look.kind === "mail";
  const robed = look.kind === "robe" || look.kind === "vestments" || look.kind === "silk";
  const bodyM = armored ? metalM : clothM;
  const wide = look.build < 0.92 ? 1.12 : look.build > 1.08 ? 1.08 : 1;

  const thighL = cyl(THREE, 0.09 * wide, 0.11 * wide, 0.50, clothM);
  thighL.position.y = -0.24;
  legL.add(thighL);
  const bootL = box(THREE, 0.20 * wide, 0.10, 0.30, bootM);
  bootL.position.set(0, -0.54, 0.06);
  legL.add(bootL);
  legL.position.set(-0.14 * wide, 0.60, 0);

  const thighR = cyl(THREE, 0.09 * wide, 0.11 * wide, 0.50, clothM);
  thighR.position.y = -0.24;
  legR.add(thighR);
  const bootR = box(THREE, 0.20 * wide, 0.10, 0.30, bootM);
  bootR.position.set(0, -0.54, 0.06);
  legR.add(bootR);
  legR.position.set(0.14 * wide, 0.60, 0);
  hip.add(legL);
  hip.add(legR);

  const hips = box(THREE, (robed ? 0.62 : 0.44) * wide, 0.24, 0.30, clothM);
  hips.position.y = 0.70;
  hip.add(hips);
  if (robed) {
    const skirt = cyl(THREE, 0.36 * wide, 0.20 * wide, 0.50, clothM, 8);
    skirt.position.y = 0.44;
    hip.add(skirt);
  }

  const chest = box(THREE, 0.48 * wide, 0.50, 0.30, bodyM);
  chest.position.y = 0.26;
  torso.add(chest);
  if (armored) {
    const plate = box(THREE, 0.52 * wide, 0.18, 0.34, metalM);
    plate.position.y = 0.38;
    torso.add(plate);
    const pL = sphere(THREE, 0.13, metalM, 6);
    pL.scale.set(1.15, 0.65, 1.0);
    pL.position.set(-0.30 * wide, 0.44, 0.04);
    torso.add(pL);
    const pR = sphere(THREE, 0.13, metalM, 6);
    pR.scale.set(1.15, 0.65, 1.0);
    pR.position.set(0.30 * wide, 0.44, 0.04);
    torso.add(pR);
    const belt = box(THREE, 0.50 * wide, 0.07, 0.32, trimM);
    belt.position.y = 0.02;
    torso.add(belt);
  } else if (look.kind === "vestments") {
    const sash = box(THREE, 0.50 * wide, 0.08, 0.32, trimM);
    sash.position.y = 0.06;
    torso.add(sash);
  }
  torso.position.y = 0.82;
  hip.add(torso);

  const uL = cyl(THREE, 0.065, 0.075, 0.44, bodyM);
  uL.position.y = -0.18;
  armL.add(uL);
  const hL = sphere(THREE, 0.08, skinM, 6);
  hL.position.y = -0.44;
  armL.add(hL);
  armL.position.set(-0.32 * wide, 0.40, 0);
  torso.add(armL);

  const uR = cyl(THREE, 0.065, 0.075, 0.44, bodyM);
  uR.position.y = -0.18;
  armR.add(uR);
  const hR = sphere(THREE, 0.08, skinM, 6);
  hR.position.y = -0.44;
  armR.add(hR);
  armR.position.set(0.32 * wide, 0.40, 0);
  torso.add(armR);

  const weapon = look.weapon ?? "sword";
  if (weapon === "sword" || weapon === "dagger" || weapon === "mace") {
    const h = weapon === "dagger" ? 0.40 : weapon === "mace" ? 0.36 : 0.78;
    const blade = weapon === "mace"
      ? sphere(THREE, 0.11, metalM, 6)
      : box(THREE, 0.06, h, 0.04, bladeM);
    blade.position.set(0.12, weapon === "mace" ? -0.62 : -0.68, 0.14);
    blade.rotation.z = -0.62;
    const guard = box(THREE, 0.20, 0.04, 0.07, trimM);
    guard.position.set(0.05, -0.40, 0.10);
    armR.add(blade);
    armR.add(guard);
  } else if (weapon === "spear" || weapon === "staff") {
    const pole = cyl(THREE, 0.028, 0.028, 1.25, addMat(weapon === "staff" ? "#6a4430" : "#d0d6e4"));
    pole.position.set(0.10, -0.70, 0.12);
    pole.rotation.z = -0.28;
    armR.add(pole);
    if (weapon === "staff") {
      const orb = sphere(THREE, 0.11, trimM, 7);
      orb.position.set(0.26, -1.26, 0.18);
      armR.add(orb);
    } else {
      const tip = cone(THREE, 0.065, 0.22, bladeM);
      tip.position.set(0.26, -1.26, 0.18);
      armR.add(tip);
    }
  } else if (weapon === "bow") {
    const bow = box(THREE, 0.04, 0.72, 0.04, addMat("#8a6238"));
    bow.position.set(0.16, -0.46, 0.10);
    armR.add(bow);
  } else if (weapon === "shield") {
    const sh = box(THREE, 0.07, 0.46, 0.36, metalM);
    sh.position.set(-0.16, -0.30, 0.12);
    const boss = cyl(THREE, 0.06, 0.06, 0.04, trimM);
    boss.rotation.z = Math.PI / 2;
    boss.position.set(-0.20, -0.30, 0.12);
    armL.add(sh);
    armL.add(boss);
  }

  if (look.cape) {
    const cape = box(THREE, 0.58 * wide, 0.88, 0.045, capeM);
    cape.position.set(0, 0.04, -0.20);
    cape.rotation.x = 0.24;
    torso.add(cape);
  }

  if (look.tail) {
    const tail = cyl(THREE, 0.04, 0.07, 0.55, hairM, 6);
    tail.position.set(0, 0.62, -0.28);
    tail.rotation.x = 0.9;
    hip.add(tail);
  }

  const head = sphere(THREE, 0.24, skinM, 8);
  head.position.y = 0.18;
  headG.add(head);

  const faceCv = paintFace(look.skin ?? "#e8b890", look.hair ?? "#3a2a20", look.eye ?? "#2a2030");
  const faceTex = new THREE.CanvasTexture(faceCv);
  faceTex.magFilter = THREE.NearestFilter;
  faceTex.minFilter = THREE.NearestFilter;
  const faceM = new THREE.MeshLambertMaterial({ map: faceTex });
  mats.push(faceM);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), faceM);
  face.position.set(0, 0.16, 0.22);
  headG.add(face);

  const hair = sphere(THREE, 0.26, hairM, 7);
  hair.position.y = 0.26;
  hair.scale.set(1.08, 0.70, 1.06);
  headG.add(hair);

  if (look.beard) {
    const beard = box(THREE, 0.20, 0.16, 0.12, hairM);
    beard.position.set(0, 0.02, 0.20);
    headG.add(beard);
  }

  if (look.ears === "long" || look.ears === "point" || look.raceId === "elf" || look.raceId === "fairy") {
    for (const s of [-1, 1]) {
      const ear = cone(THREE, 0.045, 0.20, skinM, 5);
      ear.position.set(s * 0.22, 0.26, 0);
      ear.rotation.z = s * -0.6;
      headG.add(ear);
    }
  }

  if (look.horns) {
    for (const s of [-1, 1]) {
      const hn = cone(THREE, 0.04, 0.18, addMat("#e8d8a8"), 5);
      hn.position.set(s * 0.16, 0.42, 0.02);
      hn.rotation.z = s * 0.35;
      headG.add(hn);
    }
  }

  if (look.wings) {
    for (const s of [-1, 1]) {
      const w = box(THREE, 0.08, 0.36, 0.28, addMat("#e8d8f8", { transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      w.position.set(s * 0.28, 0.20, -0.16);
      w.rotation.y = s * 0.4;
      torso.add(w);
    }
  }

  if (look.helm === "open") {
    const helm = cyl(THREE, 0.22, 0.24, 0.14, metalM, 8);
    helm.position.y = 0.34;
    headG.add(helm);
    const visor = box(THREE, 0.28, 0.06, 0.08, metalM);
    visor.position.set(0, 0.28, 0.18);
    headG.add(visor);
  } else if (look.helm === "point") {
    const hat = cone(THREE, 0.18, 0.70, clothM, 7);
    hat.position.y = 0.62;
    headG.add(hat);
    const brim = cyl(THREE, 0.30, 0.30, 0.045, clothM, 8);
    brim.position.y = 0.32;
    headG.add(brim);
  } else if (look.helm === "circlet") {
    const band = cyl(THREE, 0.25, 0.25, 0.045, trimM, 8);
    band.position.y = 0.32;
    headG.add(band);
  } else if (look.helm === "hood") {
    const hood = sphere(THREE, 0.28, clothM, 7);
    hood.scale.set(1.08, 0.82, 1.12);
    hood.position.y = 0.28;
    headG.add(hood);
  }

  headG.position.y = 0.58;
  torso.add(headG);
  root.add(hip);

  const pose = (frame = 0, _face = "right") => {
    const walk = frame === 1 ? 0.48 : frame === 4 ? -0.48 : 0;
    const atk = frame === 3;
    const hurt = frame === 2;
    legL.rotation.x = walk;
    legR.rotation.x = -walk;
    armL.rotation.x = -walk * 0.85;
    armR.rotation.x = atk ? -1.25 : walk * 0.85;
    torso.rotation.z = hurt ? 0.18 : 0;
    headG.rotation.x = hurt ? 0.15 : 0;
  };

  const place = (x, y, z, yaw) => {
    root.position.set(x, y, z);
    root.rotation.y = yaw;
  };

  const dispose = () => {
    root.traverse((o) => o.geometry?.dispose());
    for (const m of mats) m.dispose();
  };

  return { root, pose, place, dispose, look };
}
