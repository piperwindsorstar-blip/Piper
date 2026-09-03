// ============================================================================
//  FIELD — walking the overworld, towns and dungeons.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Dialogue, Menu, hpColor } from '../../engine/ui.js';
import { tileSprite, actorSprite, npcSprite, TS } from '../../engine/sprites.js';
import { groundSprite, massSprite, hasMass, isOutdoor } from '../../engine/terrain.js';
import { buildingSprite, hasStructure, isStructure } from '../../engine/building.js';
import { Particles } from '../../engine/particles.js';
import {
  getMap, tileAt, isSolid, mapSize, warpAt, npcAt, chestAt, signAt, bossAt, BOSS_SLOTS, SHOPS,
} from '../../data/maps.js';
import { formationsForRegion } from '../../data/enemies.js';
import { getItem } from '../../data/items.js';
import { stats, canPromote } from '../character.js';
import { getJob } from '../../data/jobs.js';
import { rng } from '../../engine/rng.js';
import { STORY } from '../../data/story.js';
import { sfx, playMusic } from '../../engine/audio.js';
import { FIELD_THEME, TOWN_THEME } from '../../data/music.js';
import { QUESTS, questState, questReady, startQuest, completeQuest } from '../../data/quests.js';
import * as THREE from '../../vendor/three.module.js';

const STEP_TIME = 0.15;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// One world unit = one tile (TS pixels), so every existing pixel-space
// measurement (tile positions, sprite dimensions) converts to 3D world
// units just by dividing by TS — no separate scale to keep in sync.
// MARGIN_PX bakes extra tiles around the old visible window into the ground
// texture, since the angled 3D camera reveals more than the flat 480x270
// view used to show; the plane is sized to match.
const MARGIN_PX = 7 * TS;
// The camera must look exactly at the world origin — worldFromScreenPx maps
// the old visible window's own screen centre to (0,0,0), and lookAt's target
// is by construction what a camera projects back to screen centre, so any
// other target would desync where a tile "is" on the ground texture from
// where a billboard standing on it actually renders.
//
// Orthographic, not perspective: the old flat view spans about 11 world
// units of depth (270px / TS), which at any perspective camera close enough
// to keep a real 3D angle blows up hugely in size near the camera and
// vanishes near the horizon — fine for the battle arena's few units of
// depth, badly wrong at overworld scale. An angled orthographic camera
// still compresses the far edge relative to the near one (the actual depth
// cue this is for), just linearly instead of by 1/distance.
const FIELD_CAM_POS = { x: 0, y: 9, z: 7 };
const FIELD_CAM_LOOK = { x: 0, y: 0, z: 0 };
const FIELD_VIEW_SIZE = 6.3;

// A full day/night cycle, in real seconds of played time — long enough that
// it reads as weather rather than a strobing gimmick, short enough to see
// more than one phase in a normal session.
const DAY_LEN = 300;

function mixHex(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

export class FieldScene {
  constructor(app) { this.app = app; }

  enter(opts = {}) {
    this.g = this.app.game;
    this.dlg = new Dialogue();
    this.fxp = new Particles(220);
    this.ambientT = 0;
    this.moving = null;
    this.stepT = 0;
    this.animT = 0;
    this.banner = 2.2;
    this.pendingWarp = null;
    this.fade = opts.fadeIn ? 1 : 0;
    this.fadeDir = opts.fadeIn ? -1 : 0;
    this.choice = null;
    this.encounterCooldown = 0;
    this.rainT = 0;
    this.thunderFlash = 0;
    this.rollWeather();
    this.setup3D();
    if (opts.message) this.dlg.say(opts.message);
    // returning from a battle we won on a boss tile
    if (opts.afterBossFlag) this.g.setFlag(opts.afterBossFlag);
    if (!this.g.flag('story.intro') && this.g.mapId === 'wren') {
      this.g.setFlag('story.intro');
      for (const line of STORY.intro) this.dlg.say(line);
    } else if (this.g.flag('boss.thirteenth') && !this.g.flag('story.epilogue')) {
      this.g.setFlag('story.epilogue');
      for (const line of STORY.epilogue) this.dlg.say(line);
    } else if (this.g.flag('boss.aurelith') && !this.g.flag('story.midpoint')) {
      this.g.setFlag('story.midpoint');
      for (const line of STORY.midpoint) this.dlg.say(line);
    }
  }

  get map() { return this.g.map; }

  /**
   * Builds the 3D field once per scene push: an offscreen WebGL canvas
   * rendered at the native 480x270, a single ground plane, a fixed camera,
   * and a lazily-populated billboard per NPC/player. The ground plane's
   * texture is *baked from the existing 2D tile renderer* — renderWorldTexture
   * below is the old draw()'s ground/mass/building/chest passes, verbatim,
   * just retargeted at a dedicated canvas instead of the screen buffer —
   * so terrain.js/building.js/tileSprite never had to change at all. Because
   * the camera never moves (all scrolling already happens by re-baking the
   * texture at a new camera() offset each frame, exactly as the flat 2D
   * version scrolled it), a tile's position on that texture and a billboard's
   * projected position always agree without any extra bookkeeping.
   */
  setup3D() {
    if (!this.canvas3D) this.canvas3D = document.createElement('canvas');
    this.canvas3D.width = W;
    this.canvas3D.height = H;
    this.renderer3D = new THREE.WebGLRenderer({ canvas: this.canvas3D, antialias: false, alpha: false });
    this.renderer3D.setPixelRatio(1);
    this.renderer3D.setSize(W, H, false);

    this.scene3D = new THREE.Scene();
    const aspect = W / H;
    this.camera3D = new THREE.OrthographicCamera(
      -FIELD_VIEW_SIZE * aspect, FIELD_VIEW_SIZE * aspect, FIELD_VIEW_SIZE, -FIELD_VIEW_SIZE, 0.1, 60,
    );
    this.camera3D.position.set(FIELD_CAM_POS.x, FIELD_CAM_POS.y, FIELD_CAM_POS.z);
    this.camera3D.lookAt(FIELD_CAM_LOOK.x, FIELD_CAM_LOOK.y, FIELD_CAM_LOOK.z);
    // Orthographic view rays are parallel, so every billboard should face
    // one fixed direction — back along the camera's look vector — not the
    // direction to the camera's literal position (a perspective-camera
    // formula). See battle.js's setup3D for the full explanation and the
    // warped-sprite bug this fixes for anyone off-centre and deep in Z.
    this.billboardYaw = Math.atan2(FIELD_CAM_POS.x - FIELD_CAM_LOOK.x, FIELD_CAM_POS.z - FIELD_CAM_LOOK.z);

    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.position.set(-3, 6, 4);
    this.scene3D.add(this.sun);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene3D.add(this.ambient);

    if (!this.worldCanvas) this.worldCanvas = document.createElement('canvas');
    this.worldCanvas.width = W + MARGIN_PX * 2;
    this.worldCanvas.height = H + MARGIN_PX * 2;
    this.worldTex = new THREE.CanvasTexture(this.worldCanvas);
    this.worldTex.magFilter = THREE.NearestFilter;
    // Plain nearest minification, no mipmaps: this texture is re-uploaded
    // every frame (renderWorldTexture scrolls it), so mipmap regeneration
    // here is real GPU cost billboard textures (which only change texture
    // when their owner's sprite frame does) don't pay. Linear minification
    // was tried first to fight shimmer on distant tiles, but it softened
    // the whole ground plane every frame ("squishy") for a texel-aliasing
    // risk that's minor here — the ground stays close to native scale
    // across most of the view, unlike the billboards, which really did
    // need mipmaps. Crisp now; revisit with mipmaps only if ground shimmer
    // turns out to be a real problem.
    this.worldTex.minFilter = THREE.NearestFilter;
    this.worldTex.colorSpace = THREE.SRGBColorSpace;
    const planeW = this.worldCanvas.width / TS, planeH = this.worldCanvas.height / TS;
    this.groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(planeW, planeH),
      new THREE.MeshLambertMaterial({ map: this.worldTex }),
    );
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.scene3D.add(this.groundMesh);

    this.fieldBillboards = new Map();
  }

  /** Releases the offscreen WebGL context and every GPU resource this scene
   *  allocated — see battle.js's dispose3D for why this matters. This field
   *  scene is usually reused across map warps (setup3D only runs once per
   *  push), so it leaks far less often in practice than a battle does, but
   *  it still needs disposing on the rarer full exits (e.g. game over). The
   *  app's scene stack calls this whenever this scene is popped or replaced
   *  — see main.js. */
  dispose3D() {
    this.scene3D.traverse((obj) => {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material].filter(Boolean);
      for (const m of mats) { m.map?.dispose(); m.dispose(); }
    });
    this.scene3D.background?.dispose?.();
    this.renderer3D.dispose();
    this.renderer3D.forceContextLoss();
    this.fieldBillboards.clear();
  }

  /**
   * A tile-space pixel position (already offset by camera(), exactly the
   * coordinates the old 2D drawImage calls used) -> that same point's 3D
   * world position, ground level. The ground plane spans the baked
   * MARGIN_PX-padded texture, so a point at the visible window's own centre
   * (screen-space W/2, H/2) lands at world (0, 0, 0) under the fixed camera.
   */
  worldFromScreenPx(px, py) {
    return { x: (px - W / 2) / TS, y: 0, z: (py - H / 2) / TS };
  }

  /** Projects a 3D world point to 2D screen-space pixels in the 480x270
   *  buffer, for the 2D overlays (boss glow, NPC glyphs, player light) that
   *  still draw on top of the 3D-rendered backdrop. */
  project(world) {
    const v = new THREE.Vector3(world.x, world.y, world.z);
    v.project(this.camera3D);
    return { x: (v.x * 0.5 + 0.5) * W, y: (1 - (v.y * 0.5 + 0.5)) * H };
  }

  /** A raw pixel position (pre-camera-offset, same coordinate space
   *  playerPixel()/npc.x*TS use) -> its projected screen position — the
   *  3D-aware replacement for the old flat `px - cam.x`. */
  pixelScreenPos(px, py) {
    const cam = this.camera();
    return this.project(this.worldFromScreenPx(px - cam.x, py - cam.y));
  }

  /** Same, addressed by tile coordinate. */
  tileScreenPos(tileX, tileY) {
    return this.pixelScreenPos(tileX * TS, tileY * TS);
  }

  /**
   * Bakes the ground/mass/building/feature/closed-chest layers into
   * `this.worldCanvas`, for a window MARGIN_PX wider than the screen on
   * every side (see the constant's comment) — identical to the old draw()'s
   * two tile passes, just widened and pointed at ctx instead of scr.ctx.
   */
  renderWorldTexture() {
    const ctx = this.worldCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const m = this.map;
    const cam = this.camera();
    const ox = cam.x - MARGIN_PX, oy = cam.y - MARGIN_PX;
    // Filled, not cleared: on a map smaller than the margin-padded window
    // (most towns), the baked area can reach past the map's real edge —
    // camera() only ever clamps the old, narrower 480x270 window in-bounds.
    // A cleared (fully transparent) canvas would read as flat black there
    // since the ground material isn't alpha-blended; a fill reads as the
    // same void colour draw() already uses past the plane's own edge.
    ctx.fillStyle = m.bg ?? '#0b0e18';
    ctx.fillRect(0, 0, this.worldCanvas.width, this.worldCanvas.height);
    const { w, h } = mapSize(m);
    const x0 = Math.max(0, Math.floor(ox / TS));
    const y0 = Math.max(0, Math.floor(oy / TS));
    const x1 = Math.min(w - 1, Math.ceil((ox + this.worldCanvas.width) / TS));
    const y1 = Math.min(h - 1, Math.ceil((oy + this.worldCanvas.height) / TS));
    const theme = m.theme ?? 'green';

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = tileAt(m, x, y);
        if (!t) continue;
        const px = x * TS - ox, py = y * TS - oy;
        if (isOutdoor(t.tile)) {
          ctx.drawImage(groundSprite(`${m.id}|${x}|${y}`, x * TS, y * TS, sampler(m, x, y), theme), px, py);
        } else if (isStructure(t.tile)) {
          ctx.drawImage(groundSprite(`${m.id}|${x}|${y}`, x * TS, y * TS, groundUnder(m, x, y), theme), px, py);
        } else {
          ctx.drawImage(tileSprite(t.tile), px, py);
        }
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = tileAt(m, x, y);
        if (!t) continue;
        const px2 = x * TS - ox, py2 = y * TS - oy;
        const smp = sampler(m, x, y);
        if (hasStructure(smp)) {
          ctx.drawImage(buildingSprite(`${m.id}|${x}|${y}`, smp, theme), px2, py2);
        }
        if (!isOutdoor(t.tile)) continue;
        const px = x * TS - ox, py = y * TS - oy;
        if (hasMass(smp)) {
          ctx.drawImage(massSprite(`${m.id}|${x}|${y}`, x * TS, y * TS, smp), px, py);
        }
        if (FEATURE.has(t.tile)) ctx.drawImage(tileSprite(t.tile), px, py);
      }
    }
    for (const c of m.chests ?? []) {
      if (this.g.flag(`chest.${c.id}`)) continue;
      ctx.drawImage(tileSprite('chest'), c.x * TS - ox, c.y * TS - oy);
    }
    this.worldTex.needsUpdate = true;
  }

  /** The sprite canvas + billboard world size for one field actor (the
   *  player or an NPC) — factored out so syncFieldBillboards treats both
   *  the same way. */
  billboardFor(cv, pixelX, pixelY) {
    const cam = this.camera();
    const world = this.worldFromScreenPx(pixelX - cam.x, pixelY - cam.y);
    return { world, w: cv.width / TS, h: cv.height / TS };
  }

  /** Creates/updates one camera-facing billboard per NPC plus the player,
   *  keyed by a stable id — same CanvasTexture + cylindrical-billboard
   *  technique as the battle scene's units. */
  syncFieldBillboards() {
    const seen = new Set();
    const sync = (key, cv, pixelX, pixelY, footYOffset = 0) => {
      seen.add(key);
      const { world, w, h } = this.billboardFor(cv, pixelX, pixelY);
      let b = this.fieldBillboards.get(key);
      if (!b) {
        const tex = new THREE.CanvasTexture(cv);
        // Nearest magnification keeps the sprite crisp at native size.
        // Nearest-filtered mipmaps for minification: plain nearest with no
        // mipmaps aliases into shimmer when a sprite renders smaller than
        // native size, and linear-filtered mipmaps fix that but blur the
        // pixel art ("squishy") — nearest mipmaps avoid both, same as the
        // battle scene's billboards.
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestMipmapNearestFilter;
        tex.generateMipmaps = true;
        tex.colorSpace = THREE.SRGBColorSpace;
        // See battle.js's billboard material for why this is 0.04, not 0.5:
        // sprites bake in a faint contact shadow and antialiased edges that
        // a 0.5 cutoff was discarding outright.
        const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        this.scene3D.add(mesh);
        b = { mesh, tex, canvas: null };
        this.fieldBillboards.set(key, b);
      }
      if (b.canvas !== cv) {
        b.canvas = cv;
        b.tex.image = cv;
        b.tex.needsUpdate = true;
        b.mesh.scale.set(w, h, 1);
      }
      b.mesh.position.set(world.x, world.y + h / 2 + footYOffset, world.z);
      b.mesh.rotation.y = this.billboardYaw;
    };

    for (const n of this.map.npcs ?? []) {
      const cv = npcSprite(n.kind, (n.x + n.y) % 4, Math.floor(this.animT * 1.6 + n.x * 0.7 + n.y * 0.3) % 2);
      sync(`npc:${n.x},${n.y}`, cv, n.x * TS, n.y * TS + TS);
    }
    const leader = this.g.leader;
    const pcv = actorSprite({
      classId: leader.classId, raceId: leader.raceId, elementId: leader.elementId,
      skin: leader.skin, hair: leader.hair, equip: leader.equip,
      frame: this.moving ? (Math.floor(this.animT * 8) % 2) : 0,
    });
    const pp = this.playerPixel();
    sync('player', pcv, pp.x, pp.y + TS);

    for (const [key, b] of this.fieldBillboards) {
      if (!seen.has(key)) { this.scene3D.remove(b.mesh); this.fieldBillboards.delete(key); }
    }
  }

  /** Re-bakes the ground texture, syncs billboards and renders the arena to
   *  the offscreen canvas; draw() blits the result in as this frame's
   *  backdrop. Lighting follows `look` so night/rain/indoor darkening still
   *  reads on the 3D scene the same way it tinted the flat 2D one. */
  render3D() {
    this.renderWorldTexture();
    this.syncFieldBillboards();
    const look = this.look;
    this.sun.intensity = look.dark ? 0.5 : 1.6;
    this.ambient.intensity = look.dark ? 0.55 : 0.85;
    this.ambient.color.set(look.dark ? 0x8890c0 : 0xffffff);
    // fills anywhere past the (deliberately oversized) ground plane's edge —
    // matches the map's own background colour instead of showing through
    // as flat black
    if (!this.scene3DBg) this.scene3DBg = new THREE.Color();
    this.scene3DBg.set(this.map.bg ?? '#0b0e18');
    this.scene3D.background = this.scene3DBg;
    this.renderer3D.render(this.scene3D, this.camera3D);
  }

  /** Called every frame; playMusic() is a no-op once the named track is
   *  already playing, so this is a cheap way to pick up a town/wild switch
   *  the moment a warp crosses one without needing its own hook. */
  syncMusic() {
    playMusic(this.map.town ? 'town' : 'field', this.map.town ? TOWN_THEME : FIELD_THEME);
  }

  /** 0 at midday, ramping up to 1 at true midnight, 0 again by dawn. Only
   *  meaningful outdoors — caves and the abyss are dark all the time already
   *  and never read this. */
  nightAmount() {
    const phase = (this.g.playtime % DAY_LEN) / DAY_LEN;
    const sunHeight = Math.cos((phase - 0.25) * Math.PI * 2);
    return Math.max(0, -sunHeight);
  }

  /** Rolled once per map (a fresh visit, or a warp into a new one) rather
   *  than re-rolled every frame — weather is a condition you arrive into,
   *  not a flicker. Indoors stays clear; there is no sky to rain from. */
  rollWeather() {
    const m = this.map;
    this.raining = (m.outdoor || m.town) && rng.chance(0.3);
    this.thunderT = this.raining ? 3 + Math.random() * 8 : Infinity;
  }

  /** Look for the current map, driving grade, lights and ambient particles.
   *  Caves and the abyss keep their own fixed dark palette — night and
   *  weather are an outdoor/town condition only. */
  get look() {
    const m = this.map;
    const base = m.town ? { grade: '#ffb46a', amount: 0.09, vignette: 0.40, motes: '#ffd9a0', warm: true }
      : m.outdoor ? { grade: '#9ecdff', amount: 0.07, vignette: 0.36, motes: '#dff2ff' }
        : m.encounter === 'abyss' ? { grade: '#a06cff', amount: 0.22, vignette: 0.74, motes: '#c8a0ff', dark: true }
          : { grade: '#5a7cc0', amount: 0.17, vignette: 0.68, motes: '#9ab4e0', dark: true };
    if (!m.outdoor && !m.town) return base;

    const night = this.nightAmount();
    const wet = this.raining ? 0.55 : 0;
    const dk = Math.min(1, night * 0.9 + wet * 0.4);
    if (dk <= 0) return base;
    return {
      ...base,
      grade: mixHex(base.grade, this.raining ? '#33415e' : '#16224a', Math.min(1, night * 0.85 + wet)),
      amount: Math.min(0.4, base.amount + dk * 0.22),
      vignette: Math.min(0.82, base.vignette + dk * 0.3),
      motes: mixHex(base.motes, '#c9d8ff', night),
      dark: night > 0.5,
      warm: base.warm && night <= 0.5,
    };
  }

  spawnAmbient(dt) {
    this.ambientT += dt;
    const rate = this.map.outdoor ? 0.10 : 0.16;
    while (this.ambientT > rate) {
      this.ambientT -= rate;
      const look = this.look;
      this.fxp.spawn({
        x: Math.random() * W, y: H * 0.15 + Math.random() * H * 0.8,
        vx: (Math.random() - 0.4) * 7, vy: -3 - Math.random() * 7,
        life: 2.4 + Math.random() * 2.4, color: look.motes, glow: true, size: 1,
      });
    }
  }

  /** Rain streaks and the occasional flash of distant thunder — screen-space,
   *  like the ambient motes, since weather sits over the whole view rather
   *  than any one world position. */
  spawnRainAndThunder(dt) {
    this.rainT += dt;
    const rate = 0.012;
    while (this.rainT > rate) {
      this.rainT -= rate;
      this.fxp.spawn({
        x: Math.random() * (W + 60) - 30, y: -4,
        vx: -40, vy: 260 + Math.random() * 60,
        life: 0.5, color: 'rgba(210,225,255,0.75)', size: 2, glow: true, fade: false,
      });
    }
    this.thunderT -= dt;
    if (this.thunderT <= 0) {
      this.thunderT = 6 + Math.random() * 16;
      this.thunderFlash = 0.14;
      this.app.screen.addShake(2);
    }
    this.thunderFlash = Math.max(0, this.thunderFlash - dt);
  }

  // --- update --------------------------------------------------------------
  update(dt, input) {
    this.animT += dt;
    this.fxp.update(dt);
    this.spawnAmbient(dt);
    if (this.raining) this.spawnRainAndThunder(dt);
    this.syncMusic();
    this.banner = Math.max(0, this.banner - dt);
    this.g.playtime += dt;
    this.dlg.update(dt);
    if (this.fadeDir) {
      this.fade = Math.max(0, Math.min(1, this.fade + this.fadeDir * dt * 3));
      if (this.fade === 0) this.fadeDir = 0;
      if (this.fade === 1 && this.fadeDir > 0) { this.fadeDir = 0; this.completeWarp(); }
      return;
    }

    if (this.choice) return this.updateChoice(input);

    if (this.dlg.active) {
      if (input.tap('confirm') || input.tap('cancel')) {
        const emptied = this.dlg.skipOrAdvance();
        if (emptied && this.pendingBoss) {
          const boss = this.pendingBoss;
          this.pendingBoss = null;
          this.app.push('battle', { formationId: boss.formation, bossFlag: boss.flag });
        }
      }
      return;
    }

    if (input.tap('menu')) { this.app.push('menu'); return; }

    if (this.moving) {
      this.stepT += dt;
      if (this.stepT >= STEP_TIME) {
        const cam = this.camera();
        this.fxp.dust(this.g.x * TS + TS / 2 - cam.x, this.g.y * TS + TS - 2 - cam.y,
          this.map.outdoor ? '#6a8a58' : '#7a7284', 3);
        this.g.x = this.moving.tx;
        this.g.y = this.moving.ty;
        this.moving = null;
        this.stepT = 0;
        sfx.step();
        this.onArrive();
      }
      return;
    }

    if (input.tap('confirm')) { this.interact(); return; }

    // held direction walks continuously; a quick tap still takes one step
    let ax = input.axis();
    if (!ax.x && !ax.y) {
      const d = input.dir();
      ax = { x: d.x, y: d.y };
    }
    if (ax.x || ax.y) {
      const dir = ax.x ? (ax.x < 0 ? 'left' : 'right') : (ax.y < 0 ? 'up' : 'down');
      this.g.facing = dir;
      const [dx, dy] = DIRS[dir];
      const tx = this.g.x + dx, ty = this.g.y + dy;
      if (!this.blocked(tx, ty)) { this.moving = { tx, ty, dir }; this.stepT = 0; }
    }
  }

  blocked(x, y) {
    const m = this.map;
    const { w, h } = mapSize(m);
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    if (isSolid(m, x, y)) return true;
    if (npcAt(m, x, y)) return true;
    const c = chestAt(m, x, y);
    if (c && !this.g.flag(`chest.${c.id}`)) return true;
    return false;
  }

  onArrive() {
    this.g.stepTaken();
    const m = this.map;
    const wp = warpAt(m, this.g.x, this.g.y);
    if (wp) { sfx.door(); this.pendingWarp = wp; this.fadeDir = 1; return; }

    const boss = bossAt(m, this.g.x, this.g.y);
    if (boss && !this.g.flag(`boss.${boss.flag}`)) {
      if (boss.requires && !this.g.flag(`boss.${boss.requires}`)) {
        this.dlg.say('The way is sealed. Something further in has not been dealt with.');
        return;
      }
      this.dlg.say(boss.intro);
      this.pendingBoss = boss;
      return;
    }

    if (this.encounterCooldown > 0) { this.encounterCooldown -= 1; return; }
    const chance = this.g.encounterChance();
    if (chance > 0 && rng.chance(chance)) this.startEncounter();
  }

  startEncounter() {
    const m = this.map;
    const pool = formationsForRegion(m.encounter);
    if (!pool.length) return;
    const f = rng.pick(pool);
    const scout = this.g.jobRankOf('scout');
    const keenScent = this.g.party.some((c) => c.raceId === 'lupine');
    const preemptive = rng.chance(Math.min(0.5, 0.06 + 0.08 * scout + (keenScent ? 0.08 : 0)));
    const ambushed = !preemptive && scout < 5 && !keenScent && rng.chance(0.06);
    this.g.stepsSinceBattle = 0;
    this.app.push('battle', { formationId: f.id, preemptive, ambushed });
  }

  // --- interaction ---------------------------------------------------------
  interact() {
    const m = this.map;
    const [dx, dy] = DIRS[this.g.facing];
    const x = this.g.x + dx, y = this.g.y + dy;

    const sign = signAt(m, x, y);
    if (sign) { this.dlg.say(sign.text); return; }

    const chest = chestAt(m, x, y) ?? chestAt(m, this.g.x, this.g.y);
    if (chest && !this.g.flag(`chest.${chest.id}`)) { this.openChest(chest); return; }

    const npc = npcAt(m, x, y);
    if (npc) { this.talkTo(npc); return; }

    // standing on the exit of a town
    const wp = warpAt(m, this.g.x, this.g.y);
    if (wp) { sfx.door(); this.pendingWarp = wp; this.fadeDir = 1; }
  }

  openChest(chest) {
    const locked = chest.locked && !this.g.hasJob('locksmith');
    if (locked) { this.dlg.say('Locked. A Locksmith could open this.'); return; }
    this.g.setFlag(`chest.${chest.id}`);
    if (chest.gold) {
      sfx.chest();
      this.g.earn(chest.gold);
      this.dlg.say(`${chest.gold} gold.`);
    } else if (chest.item) {
      const it = getItem(chest.item);
      if (this.g.addItem(chest.item)) { sfx.chest(); this.dlg.say(`Found ${it.name}.`); }
      else { this.g.setFlag(`chest.${chest.id}`, false); sfx.error(); this.dlg.say('The pack is full.'); }
    }
    if (chest.locked) {
      const smith = this.g.party.find((c) => c.jobId === 'locksmith');
      if (smith) { const m = this.g.jobTick(smith, 12); if (m) this.dlg.say(m); }
    }
  }

  talkTo(npc) {
    if (this.handleQuestTalk(npc)) return;
    switch (npc.kind) {
      case 'inn': {
        const cost = this.g.innCost(npc.cost ?? 10);
        this.choice = {
          title: `${npc.name}: "${cost} gold for the night."`,
          options: ['Rest', 'Not now'],
          onPick: (i) => {
            if (i !== 0) { this.dlg.say('"Come back when you\'re tired enough."'); return; }
            if (!this.g.spend(cost)) { this.dlg.say('"You are short."'); return; }
            this.g.restParty();
            this.dlg.say('The party sleeps. Everyone wakes whole.');
            const chef = this.g.party.find((c) => c.jobId === 'chef');
            if (chef) { const m = this.g.jobTick(chef, 8); if (m) this.dlg.say(m); }
          },
        };
        break;
      }
      case 'temple': {
        const fallen = this.g.party.filter((c) => c.hp <= 0);
        const promo = this.g.party.filter((c) => canPromote(c));
        const opts = [];
        if (promo.length) opts.push('Take a promotion');
        if (fallen.length) opts.push(`Revive the fallen (${this.reviveCost()}G)`);
        opts.push('Leave');
        this.choice = {
          title: `${npc.name}: "${npc.text}"`,
          options: opts,
          onPick: (i) => {
            const pick = opts[i];
            if (pick === 'Take a promotion') this.app.push('promotion');
            else if (pick && pick.startsWith('Revive')) {
              const cost = this.reviveCost();
              if (!this.g.spend(cost)) { this.dlg.say('"Not enough. The rite is not free."'); return; }
              for (const c of this.g.party) if (c.hp <= 0) { c.hp = stats(c).maxHp; c.alive = true; c.statuses = {}; }
              this.dlg.say('The fallen open their eyes.');
              const pil = this.g.party.find((c) => c.jobId === 'pilgrim');
              if (pil) { const m = this.g.jobTick(pil, 15); if (m) this.dlg.say(m); }
            }
          },
        };
        break;
      }
      case 'shop':
        this.app.push('shop', { shopId: npc.shop, name: SHOPS[npc.shop]?.name ?? npc.name });
        break;
      case 'guild':
        this.dlg.say(npc.text, npc.name, this.npcPortrait(npc));
        this.dlg.say('(Open the party menu with C or TAB for Formation, Jobs and the class ladder.)');
        break;
      case 'recruit': {
        const flag = `story.recruited.${npc.id}`;
        if (this.g.flag(flag)) { this.dlg.say(npc.text, npc.name, this.npcPortrait(npc)); break; }
        this.choice = {
          title: `${npc.name}: "${npc.hook}"`,
          options: ['Recruit', 'Not yet'],
          onPick: (i) => {
            if (i !== 0) { this.dlg.say('"The offer stands, whenever you\'re ready."', npc.name, this.npcPortrait(npc)); return; }
            const ch = this.g.addMember(npc.recruit);
            this.g.setFlag(flag);
            if (!ch) { this.dlg.say('The roster has no room left.'); return; }
            if (this.g.party.includes(ch)) { this.dlg.say(`${ch.name} joins the party.`); return; }
            // The active party is already full (it always is, past creation's
            // starting four), so addMember() only benched them — ask right
            // here who to swap out instead of leaving a new recruit invisible
            // on the bench with no clear way to notice they exist.
            const party = this.g.party;
            this.choice = {
              title: `${ch.name} joins the roster. Who do they take the field for?`,
              options: [...party.map((p) => `${p.name} (Lv${p.level})`), "No one — bench them for now"],
              onPick: (j) => {
                if (j < party.length) {
                  const out = party[j];
                  this.g.benchInto(ch.id, out.grid.row, out.grid.col);
                  this.dlg.say(`${ch.name} takes the field for ${out.name}.`);
                } else {
                  this.dlg.say(`${ch.name} waits on the bench — swap them in anytime from the party menu's Formation page.`);
                }
              },
            };
          },
        };
        break;
      }
      default:
        this.dlg.say(this.reactionLine(npc), npc.name, this.npcPortrait(npc));
    }
  }

  /** The bust dialogue shows beside an NPC's lines — the same kit/skin
   *  variant their own field sprite already uses, so the face matches. */
  npcPortrait(npc) { return { npcKind: npc.kind, variant: (npc.x + npc.y) % 4 }; }

  /**
   * Any quest hook this NPC carries right now, handled before their normal
   * line — as the quest's own giver, or as the drop-off point for someone
   * else's delivery. Returns true when it fully handled the conversation
   * (so talkTo() skips the kind-based switch below), false to fall through
   * to their ordinary dialogue.
   */
  handleQuestTalk(npc) {
    const receiving = Object.values(QUESTS).find((q) => q.type === 'deliver' && q.deliverTo === npc.name);
    if (receiving && this.g.flag(`quest.${receiving.id}.active`)) {
      completeQuest(this.g, receiving.id);
      this.dlg.say(receiving.deliverText, npc.name, this.npcPortrait(npc));
      this.sayReward(receiving.reward);
      return true;
    }

    const giving = Object.values(QUESTS).find((q) => q.npc === npc.name);
    if (!giving) return false;
    const state = questState(this.g, giving.id);
    if (state === 'unstarted') {
      this.choice = {
        title: `${npc.name}: "${giving.hook}"`,
        options: ['Accept', 'Not now'],
        onPick: (i) => {
          if (i !== 0) return;
          startQuest(this.g, giving.id);
          sfx.confirm();
          this.dlg.say(giving.accept, npc.name, this.npcPortrait(npc));
        },
      };
      return true;
    }
    if (state === 'active') {
      if (giving.type !== 'deliver' && questReady(this.g, giving.id)) {
        completeQuest(this.g, giving.id);
        this.dlg.say(giving.turnIn, npc.name, this.npcPortrait(npc));
        this.sayReward(giving.reward);
      } else {
        this.dlg.say(giving.reminder, npc.name, this.npcPortrait(npc));
      }
      return true;
    }
    return false; // done — their normal line (and any boss reaction) resumes
  }

  /** completeQuest() already granted all of this — these just narrate it,
   *  matching openChest()'s own terse reward-line style. */
  sayReward(reward) {
    if (reward.gold) this.dlg.say(`${reward.gold} gold.`);
    if (reward.item) this.dlg.say(`Found ${getItem(reward.item).name}.`);
    if (reward.lp) this.dlg.say(`+${reward.lp} LP.`);
  }

  /** An NPC's normal line, unless a `reactions` entry for an already-set
   *  boss flag names a different one — the minimal version of conditional
   *  dialogue this project needs, not a full branching-dialogue system. */
  reactionLine(npc) {
    if (npc.reactions) {
      for (const [flag, text] of Object.entries(npc.reactions)) {
        if (this.g.flag(`boss.${flag}`)) return text;
      }
    }
    return npc.text;
  }

  reviveCost() {
    const fallen = this.g.party.filter((c) => c.hp <= 0);
    const rank = this.g.jobRankOf('pilgrim');
    const base = fallen.reduce((s, c) => s + c.level * 22, 0);
    return Math.max(10, Math.round(base * (1 - 0.3 * rank / 5 * 5 / 5) * (rank ? 1 - 0.3 * rank / 5 : 1)));
  }

  updateChoice(input) {
    if (!this.choiceMenu) {
      this.choiceMenu = new Menu({
        items: this.choice.options, x: 44, y: 0, cellW: W - 100, cellH: 14,
        rows: this.choice.options.length,
      });
    }
    this.choiceMenu.update(1 / 60);
    this.choiceMenu.handle(input);
    if (input.tap('confirm')) {
      sfx.confirm();
      const i = this.choiceMenu.index;
      const cb = this.choice.onPick;
      this.choice = null; this.choiceMenu = null;
      cb?.(i);
    } else if (input.tap('cancel')) {
      sfx.cancel();
      this.choice = null; this.choiceMenu = null;
    }
  }

  completeWarp() {
    const wp = this.pendingWarp;
    this.pendingWarp = null;
    if (!wp) return;
    this.g.mapId = wp.to;
    this.g.x = wp.tx;
    this.g.y = wp.ty;
    this.g.stepsSinceBattle = 0;
    this.encounterCooldown = 3;
    this.banner = 2.2;
    this.fade = 1;
    this.fadeDir = -1;
    this.rollWeather();
    const cart = this.g.party.find((c) => c.jobId === 'cartographer');
    if (cart && !this.g.mapped[wp.to]) {
      this.g.mapped[wp.to] = true;
      const m = this.g.jobTick(cart, 10);
      if (m) this.dlg.say(m);
    }
  }

  /** The scene stack calls this when a pushed scene pops back to us. */
  onResume(result) {
    if (result?.outcome) this.onBattleResult(result);
  }

  // called by the app when a battle finishes
  onBattleResult(result) {
    if (result.outcome === 'defeat') {
      this.app.replace('gameover');
      return;
    }
    this.g.stepsSinceBattle = 0;
    this.encounterCooldown = 4;
    if (result.bossFlag) this.g.setFlag(`boss.${result.bossFlag}`);
    // The battle scene already showed the spoils, level-ups and drops in its own
    // message box. Replaying them here made you read every line twice.
  }

  // --- draw ----------------------------------------------------------------
  camera() {
    const { w, h } = mapSize(this.map);
    const px = this.playerPixel();
    let cx = px.x + TS / 2 - W / 2;
    let cy = px.y + TS / 2 - H / 2;
    cx = w * TS <= W ? (w * TS - W) / 2 : Math.max(0, Math.min(cx, w * TS - W));
    cy = h * TS <= H ? (h * TS - H) / 2 : Math.max(0, Math.min(cy, h * TS - H));
    return { x: Math.round(cx), y: Math.round(cy) };
  }

  playerPixel() {
    if (!this.moving) return { x: this.g.x * TS, y: this.g.y * TS };
    const t = Math.min(1, this.stepT / STEP_TIME);
    return {
      x: (this.g.x + (this.moving.tx - this.g.x) * t) * TS,
      y: (this.g.y + (this.moving.ty - this.g.y) * t) * TS,
    };
  }

  draw(scr) {
    const m = this.map;
    const look = this.look;
    scr.setGrade(look.grade, look.amount);
    scr.vignette = look.vignette;
    scr.bloom = look.dark ? 0.62 : 0.22;

    // the 3D arena (ground, buildings, mass, closed chests, the player and
    // every NPC as camera-facing billboards) renders to its own offscreen
    // canvas and gets blitted in as this frame's whole backdrop — see
    // setup3D/render3D/renderWorldTexture for how that's built.
    this.render3D();
    scr.ctx.drawImage(this.canvas3D, 0, 0, W, H);

    // boss markers — 2D glow/outline overlays, positioned by projecting
    // their tile through the same camera the arena itself rendered with
    for (const key of BOSS_SLOTS) {
      const b = m[key];
      if (!b || this.g.flag(`boss.${b.flag}`)) continue;
      const p = this.tileScreenPos(b.x, b.y);
      const pulse = 0.5 + 0.5 * Math.sin(this.animT * 3);
      scr.light(p.x, p.y, 18 + pulse * 6, 'rgba(255,70,90,0.6)', 0.35 + pulse * 0.25);
      scr.outline(p.x - TS / 2 + 5, p.y - TS / 2 + 5, TS - 10, TS - 10, PAL.red);
    }

    // NPC glyphs (recruit "*", service marks) — same projection, drawn over
    // each NPC's own billboard
    for (const n of m.npcs ?? []) {
      const p = this.tileScreenPos(n.x, n.y);
      drawNpcGlyph(scr, p.x, p.y, n, this.animT, this.g);
    }

    // lighting: a warm pool on the player, torches in the dark, ambient motes
    const pp = this.playerPixel();
    const lp = this.pixelScreenPos(pp.x + TS / 2, pp.y + TS / 2);
    const lx = Math.round(lp.x), ly = Math.round(lp.y);
    if (look.dark) {
      scr.ctx.save();
      scr.ctx.globalCompositeOperation = 'multiply';
      const g = scr.ctx.createRadialGradient(lx, ly, 20, lx, ly, 150);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, look.dark ? '#404058' : '#8890a8');
      scr.ctx.fillStyle = g;
      scr.ctx.fillRect(0, 0, W, H);
      scr.ctx.restore();
      const flick = 0.42 + Math.sin(this.animT * 9) * 0.05 + Math.sin(this.animT * 21) * 0.03;
      scr.light(lx, ly, 74, 'rgba(255,190,110,0.55)', flick);
    } else if (look.warm) {
      scr.light(lx, ly - 6, 46, 'rgba(255,214,150,0.30)', 0.35);
    }
    this.fxp.draw(scr);
    if (this.thunderFlash > 0) scr.fade(this.thunderFlash * 2.5, '#dfe8ff');

    this.drawHud(scr);
    if (this.banner > 0) this.drawBanner(scr);
    if (this.choice) this.drawChoice(scr);
    else this.dlg.draw(scr);
    if (this.fade > 0) scr.fade(this.fade);
  }

  drawHud(scr) {
    const g = this.g;
    const rows = g.party.length;
    const pw = 116, ph = 12 + rows * 17;
    scr.panel(W - pw - 8, 8, pw, ph, { alpha: 0.94 });
    g.party.forEach((ch, i) => {
      const y = 16 + i * 17;
      const s = stats(ch);
      const ratio = ch.hp / s.maxHp;
      scr.text(ch.name.slice(0, 8), W - pw, y, ch.hp > 0 ? PAL.text : PAL.grey);
      scr.textRight(`${ch.hp}`, W - 16, y, hpColor(ratio));
      scr.bar(W - pw, y + 10, pw - 24, 3, ratio, hpColor(ratio));
      scr.bar(W - pw, y + 14, pw - 24, 2, s.maxMp ? ch.mp / s.maxMp : 0, PAL.cyan);
    });
    scr.panel(8, H - 30, 118, 22, { alpha: 0.94 });
    scr.text('G', 18, H - 23, PAL.accentDim);
    scr.text(`${g.gold}`, 28, H - 23, PAL.accent);
    scr.textRight(`Lv ${g.leader.level}`, 118, H - 23, PAL.text);
  }

  drawBanner(scr) {
    const a = Math.min(1, this.banner / 0.5);
    const name = this.map.name;
    const w = Math.max(140, scr.textWidth(name) + 56);
    scr.ctx.save();
    scr.ctx.globalAlpha = a;
    scr.panel(W / 2 - w / 2, 12, w, 26, { accent: true, accentWidth: 20 });
    scr.textCenter(name, W / 2, 22, PAL.text);
    scr.rect(W / 2 - w / 2 + 10, 32, w - 20, 1, 'rgba(240,180,76,0.30)');
    scr.ctx.restore();
  }

  drawChoice(scr) {
    const opts = this.choice.options;
    const h = 20 + opts.length * 14;
    const y = H - h - 12;
    scr.panel(24, y - 40, W - 48, 36, { accent: true, accentWidth: 24 });
    scr.textWrap(this.choice.title, 36, y - 31, W - 72, PAL.text, { maxLines: 2, lineHeight: 11 });
    scr.panel(24, y, W - 48, h);
    if (this.choiceMenu) {
      this.choiceMenu.x = 44; this.choiceMenu.y = y + 10;
      this.choiceMenu.cellW = W - 100; this.choiceMenu.cellH = 14;
      this.choiceMenu.draw(scr);
    }
  }
}

/** Tiles that still want their own stamp drawn over the terrain. */
const FEATURE = new Set(['town', 'cave', 'bridge', 'flower', 'well', 'stall', 'lamp']);

/**
 * A neighbourhood reader for the terrain layer: `sample(dx, dy)` gives the tile
 * name that many cells away, or null off the map. Terrain uses it to work out
 * what it borders, which is the whole reason boundaries can curve.
 */
const sampler = (m, x, y) => (dx, dy) => tileAt(m, x + dx, y + dy)?.tile ?? null;

/** The same, but with building cells reading as the ground they were built on. */
const groundUnder = (m, x, y) => (dx, dy) => {
  const t = tileAt(m, x + dx, y + dy)?.tile ?? null;
  return isStructure(t) ? 'grass' : t;
};

/** A small marker over service NPCs, or a still-recruitable ally — the NPC's
 *  own sprite is a 3D billboard now (see syncFieldBillboards); this just
 *  draws the 2D glyph over wherever that billboard projects to. */
function drawNpcGlyph(scr, x, y, npc, t, g) {
  if (npc.kind === 'recruit') {
    if (!g.flag(`story.recruited.${npc.id}`)) {
      scr.text('*', x + 6, y - 7 + Math.round(Math.sin(t * 3)), PAL.accent);
    }
  } else if (npc.kind !== 'talk') {
    const gm = { shop: '$', inn: 'Z', temple: '+', guild: '!' }[npc.kind] ?? '';
    scr.text(gm, x + 6, y - 7 + Math.round(Math.sin(t * 3)), PAL.gold);
  }
}
