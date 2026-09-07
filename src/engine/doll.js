// ============================================================================
//  DOLL — a cheap HD-2D body: 3D parts, lit in the existing 480×270
//  nearest-neighbour scene. That low-res blit *is* the pixel overlay.
//
//  One doll is a kit (armour + weapon) on a race-tinted skin. Recolor the
//  materials when class or race changes; pose the limbs per frame.
// ============================================================================

function hex(n) {
  if (typeof n === 'number') return n;
  if (!n || n[0] !== '#') return 0xc8b090;
  const h = n.slice(1);
  return parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
}

function mat(THREE, color, opts = {}) {
  return new THREE.MeshLambertMaterial({
    color: hex(color),
    flatShading: true,
    ...opts,
  });
}

function box(THREE, w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = false;
  return m;
}

function sphere(THREE, r, material, segs = 6) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs), material);
}

/**
 * @param {object} look
 *   skin, cloth, trim, metal, cape, helm ('open'|'point'|'circlet'|'hood'|'none')
 *   weapon ('sword'|'spear'|'staff'|'bow'|'dagger'|'mace'|'fist'|'shield')
 *   kind ('plate'|'mail'|'leather'|'robe'|'vestments'|'gi'|'silk')
 */
import { getClass } from '../data/classes.js';
import { getRace } from '../data/races.js';
import { getArmorFilter, getWeaponFilter } from './filters.js';

export function lookFromActor(o) {
  const cls = getClass(o.classId);
  const race = getRace(o.raceId ?? 'human');
  const L = race.look;
  const armor = getArmorFilter(cls.root);
  const weapon = getWeaponFilter(cls.root);
  return {
    skin: L.skins[(o.skin ?? 0) % L.skins.length],
    hair: L.hairs[(o.hair ?? 0) % L.hairs.length],
    cloth: armor.cloth ?? '#a8342c',
    trim: armor.trim ?? '#e0bc58',
    metal: '#c8d0dc',
    cape: armor.cape,
    helm: armor.helm,
    kind: armor.kind,
    weapon: weapon.type,
    raceId: race.id,
    classId: cls.root,
  };
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

  const skinM = addMat(look.skin ?? '#e8b890');
  const clothM = addMat(look.cloth ?? '#a8342c');
  const metalM = addMat(look.metal ?? '#c8d0dc');
  const trimM = addMat(look.trim ?? '#e0bc58');
  const capeM = addMat(look.cape ?? '#2a4784', { side: THREE.DoubleSide });
  const bootM = addMat('#241610');

  const armored = look.kind === 'plate' || look.kind === 'mail' || look.metal;
  const robed = look.kind === 'robe' || look.kind === 'vestments' || look.kind === 'silk';
  const bodyM = armored ? metalM : clothM;

  // legs
  const thighL = box(THREE, 0.22, 0.55, 0.22, clothM);
  thighL.position.y = -0.28;
  legL.add(thighL);
  const footL = box(THREE, 0.24, 0.12, 0.32, bootM);
  footL.position.set(0, -0.58, 0.04);
  legL.add(footL);
  legL.position.set(-0.16, 0.62, 0);

  const thighR = box(THREE, 0.22, 0.55, 0.22, clothM);
  thighR.position.y = -0.28;
  legR.add(thighR);
  const footR = box(THREE, 0.24, 0.12, 0.32, bootM);
  footR.position.set(0, -0.58, 0.04);
  legR.add(footR);
  legR.position.set(0.16, 0.62, 0);

  hip.add(legL);
  hip.add(legR);

  // hips / robe flare
  const hips = box(THREE, robed ? 0.62 : 0.48, 0.28, 0.32, clothM);
  hips.position.y = 0.72;
  hip.add(hips);
  if (robed) {
    const skirt = box(THREE, 0.7, 0.5, 0.36, clothM);
    skirt.position.y = 0.46;
    hip.add(skirt);
  }

  // torso + pauldrons
  const chest = box(THREE, 0.52, 0.55, 0.34, bodyM);
  chest.position.y = 0.28;
  torso.add(chest);
  if (armored) {
    const plate = box(THREE, 0.56, 0.22, 0.38, metalM);
    plate.position.y = 0.42;
    torso.add(plate);
    const pL = box(THREE, 0.22, 0.16, 0.28, metalM);
    pL.position.set(-0.34, 0.46, 0);
    torso.add(pL);
    const pR = box(THREE, 0.22, 0.16, 0.28, metalM);
    pR.position.set(0.34, 0.46, 0);
    torso.add(pR);
    const belt = box(THREE, 0.54, 0.08, 0.36, trimM);
    belt.position.y = 0.02;
    torso.add(belt);
  }
  torso.position.y = 0.86;
  hip.add(torso);

  // arms
  const uL = box(THREE, 0.16, 0.48, 0.16, bodyM);
  uL.position.y = -0.22;
  armL.add(uL);
  const hL = sphere(THREE, 0.09, skinM, 5);
  hL.position.y = -0.48;
  armL.add(hL);
  armL.position.set(-0.36, 0.42, 0);
  torso.add(armL);

  const uR = box(THREE, 0.16, 0.48, 0.16, bodyM);
  uR.position.y = -0.22;
  armR.add(uR);
  const hR = sphere(THREE, 0.09, skinM, 5);
  hR.position.y = -0.48;
  armR.add(hR);
  armR.position.set(0.36, 0.42, 0);
  torso.add(armR);

  // weapon in the right hand
  const weapon = look.weapon ?? 'sword';
  if (weapon === 'sword' || weapon === 'dagger' || weapon === 'mace') {
    const blade = box(THREE, weapon === 'dagger' ? 0.06 : 0.08, weapon === 'dagger' ? 0.45 : 0.7, 0.04, addMat('#eef2f8'));
    blade.position.y = -0.78;
    const guard = box(THREE, 0.22, 0.05, 0.08, trimM);
    guard.position.y = -0.5;
    armR.add(blade);
    armR.add(guard);
  } else if (weapon === 'spear' || weapon === 'staff') {
    const pole = box(THREE, 0.06, 1.15, 0.06, addMat(weapon === 'staff' ? '#6a4430' : '#d8dce8'));
    pole.position.y = -0.9;
    armR.add(pole);
    if (weapon === 'staff') {
      const orb = sphere(THREE, 0.12, trimM, 6);
      orb.position.y = -1.48;
      armR.add(orb);
    } else {
      const tip = box(THREE, 0.12, 0.22, 0.04, addMat('#eef2f8'));
      tip.position.y = -1.48;
      armR.add(tip);
    }
  } else if (weapon === 'bow') {
    const bow = box(THREE, 0.06, 0.7, 0.06, addMat('#8a6238'));
    bow.position.set(0.12, -0.55, 0);
    armR.add(bow);
  } else if (weapon === 'shield') {
    const sh = box(THREE, 0.08, 0.42, 0.32, metalM);
    sh.position.set(-0.16, -0.35, 0.08);
    armL.add(sh);
  }

  // cape
  if (look.cape) {
    const cape = box(THREE, 0.7, 0.85, 0.06, capeM);
    cape.position.set(0, 0.1, -0.22);
    cape.rotation.x = 0.18;
    torso.add(cape);
  }

  // head
  const head = sphere(THREE, 0.28, skinM, 7);
  head.position.y = 0.22;
  headG.add(head);
  const hair = sphere(THREE, 0.3, addMat(look.hair ?? '#3a2a20'), 6);
  hair.position.y = 0.3;
  hair.scale.set(1.05, 0.7, 1.05);
  headG.add(hair);

  if (look.helm === 'open') {
    const helm = box(THREE, 0.5, 0.16, 0.48, metalM);
    helm.position.y = 0.38;
    headG.add(helm);
  } else if (look.helm === 'point') {
    const hat = box(THREE, 0.22, 0.55, 0.22, clothM);
    hat.position.y = 0.62;
    headG.add(hat);
    const brim = box(THREE, 0.55, 0.06, 0.55, clothM);
    brim.position.y = 0.38;
    headG.add(brim);
  } else if (look.helm === 'circlet') {
    const band = box(THREE, 0.5, 0.05, 0.5, trimM);
    band.position.y = 0.36;
    headG.add(band);
  } else if (look.helm === 'hood') {
    const hood = box(THREE, 0.5, 0.28, 0.5, clothM);
    hood.position.y = 0.4;
    headG.add(hood);
  }

  headG.position.y = 0.62;
  torso.add(headG);

  root.add(hip);
  root.scale.setScalar(1);

  const pose = (frame = 0, _face = 'right') => {
    const walk = frame === 1 ? 0.45 : frame === 4 ? -0.45 : 0;
    const atk = frame === 3;
    const hurt = frame === 2;
    legL.rotation.x = walk;
    legR.rotation.x = -walk;
    armL.rotation.x = -walk * 0.8;
    armR.rotation.x = atk ? -1.15 : walk * 0.8;
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
