// ============================================================================
//  FIELD — walking the overworld, towns and dungeons.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { sharpenDownscale } from '../../engine/pixel.js';
import { plateImage, plateKeyForMap } from '../../engine/plates.js';
import { Dialogue, Menu, hpColor } from '../../engine/ui.js';
import { tileSprite, actorSprite, npcSprite, TS, SPRITE_WORLD_W, SPRITE_WORLD_H } from '../../engine/sprites.js';
import { groundSprite, massSprite, hasMass, isOutdoor } from '../../engine/terrain.js';
import { buildingSprite, hasStructure, isStructure } from '../../engine/building.js';
import { citySprite, pitstopSprite, CITY_W, CITY_H, PITSTOP_W, PITSTOP_H } from '../../engine/townmarker.js';
import { towerSprite, TOWER_W, TOWER_H } from '../../engine/labyrinthmarker.js';
import { caveSprite, CAVE_W, CAVE_H } from '../../engine/cavemarker.js';
import { minimapSprite, MM_W, MM_H } from '../../engine/minimap.js';
import { Particles } from '../../engine/particles.js';
import {
  getMap, tileAt, isSolid, mapSize, warpAt, npcAt, chestAt, signAt, bossAt, BOSS_SLOTS, SHOPS, themeAt,
  resetDungeonFloors, WORLD_ENTRY_BY_MAP,
} from '../../data/maps.js';
import { formationsForRegion, regionLevelSpan } from '../../data/enemies.js';
import { getItem, forgeUpgrade } from '../../data/items.js';
import { ARENA_TIERS } from '../../data/arena.js';
import { stats, canPromote, jobRank } from '../character.js';
import { getJob } from '../../data/jobs.js';
import { rng } from '../../engine/rng.js';
import { STORY } from '../../data/story.js';
import { sfx, playMusic } from '../../engine/audio.js';
import { FIELD_THEME, TOWN_THEME } from '../../data/music.js';
import { QUESTS, questState, questReady, questAvailable, startQuest, completeQuest } from '../../data/quests.js';
import { getPartyHudVisible, togglePartyHudVisible } from '../../engine/settings.js';
import * as PIXI from '../../vendor/pixi.module.js';
// HD-2D finish lives in Screen.present() (every scene) — see screenPost.js.

const STEP_TIME = 0.15;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** How deep into its own dungeon a map sits — labyrinth floor 1 has no
 *  "_fN" suffix (it's the implicit floor 1), a Shifting Depths floor
 *  carries its own `dungeonDepth`, and the antechamber above depths_1 is
 *  floor 0. Used only to tell an `exit`-less stairs warp apart as Up or
 *  Down (see draw()'s stairs-label loop) — never for gameplay. */
function floorDepthOf(m) {
  if (m.dungeonDepth != null) return m.dungeonDepth;
  if (m.id === 'depths_entrance') return 0;
  const fm = /_f(\d+)$/.exec(m.id);
  return fm ? Number(fm[1]) : 1;
}

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

// This "camera" never moves and never rotates (see the comment above), and
// an orthographic projection has no perspective divide — so the whole thing
// is a fixed linear map from world space to screen space, not something
// that needs an actual 3D camera/renderer to evaluate every frame. right/up
// are that camera's basis vectors in world space (derived the same way
// THREE's own Camera.lookAt does it, and checked against THREE's actual
// output for this exact setup to within 1e-13px before THREE.js was
// dropped from this file); project() below is the closed form.
function normalize3(v) { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; }
function cross3(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
const CAM_BACK = normalize3(FIELD_CAM_POS); // looks at the origin, so "back" is just its own direction from there
const CAM_RIGHT = normalize3(cross3({ x: 0, y: 1, z: 0 }, CAM_BACK));
const CAM_UP = normalize3(cross3(CAM_BACK, CAM_RIGHT));
const PX_PER_WORLD = H / (2 * FIELD_VIEW_SIZE);
// Ground and billboards both convert world units to screen pixels through
// this same fixed camera, but a ground point only ever moves in world X/Z
// (it's flat, y=0) while a billboard's height runs along world Y — so the
// ground's vertical scale (depth foreshortening) and a billboard's vertical
// scale (height foreshortening) are two different projections of the same
// tilt and need their own constants.
const GROUND_SCALE_X = PX_PER_WORLD / TS;
const GROUND_SCALE_Z = PX_PER_WORLD * Math.abs(CAM_UP.z) / TS;
const BILLBOARD_SCALE_Y = PX_PER_WORLD * CAM_UP.y / TS;

// A full day/night cycle, in real seconds of played time — long enough that
// it reads as weather rather than a strobing gimmick, short enough to see
// more than one phase in a normal session.
const DAY_LEN = 300;

// The four full cities (many buildings apiece: smithy, pedlar, inn, temple,
// guildhall, two cottages) get the grand gated-arch marker on the world
// map; every other town:true destination is a smaller pitstop with just a
// store and a home, and gets the plain signpost marker instead.
const CITY_TOWNS = new Set(['wren', 'kelda', 'harrowsrest', 'glasshaven']);

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
    this.g.visitedMaps[this.g.mapId] = true;
    if (this.g.map.town) this.g.lastTownId = this.g.mapId;
    this.dlg = new Dialogue();
    this.fxp = new Particles(220);
    this.ambientT = 0;
    this.moving = null;
    this.stepT = 0;
    this.animT = 0;
    this.banner = 2.2;
    this.bannerText = this.map.name;
    this.pendingWarp = null;
    this.fade = opts.fadeIn ? 1 : 0;
    this.fadeDir = opts.fadeIn ? -1 : 0;
    this.choice = null;
    this.gauntlet = null;
    this.pendingGauntletFormation = null;
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
      this.pendingNGPlusChoice = true;
    } else if (this.g.flag('boss.seam') && !this.g.flag('story.trueEnd')) {
      this.g.setFlag('story.trueEnd');
      for (const line of STORY.trueEnd) this.dlg.say(line);
    } else if (this.g.flag('boss.aurelith') && !this.g.flag('story.midpoint')) {
      this.g.setFlag('story.midpoint');
      for (const line of STORY.midpoint) this.dlg.say(line);
    }
  }

  get map() { return this.g.map; }

  /**
   * Builds the field's backdrop renderer once per scene push: a Pixi
   * application driving an offscreen canvas at the native 480x270, a ground
   * sprite, and a lazily-populated billboard per NPC/player. The ground
   * sprite's texture is *baked from the existing 2D tile renderer* —
   * renderWorldTexture below is the old draw()'s ground/mass/building/chest
   * passes, verbatim, just retargeted at a dedicated canvas instead of the
   * screen buffer — so terrain.js/building.js/tileSprite never had to change
   * at all. The angled "camera" this scene is built around never moves (all
   * scrolling already happens by re-baking the texture at a new camera()
   * offset each frame, exactly as the flat 2D version scrolled it) and is
   * orthographic, so — see the CAM_RIGHT/CAM_UP/PX_PER_WORLD comment above —
   * its entire projection is the fixed scale project() applies; there's no
   * real 3D scene to build here, just a couple of correctly-scaled sprites.
   *
   * PIXI.Application.init() is async, but scene.enter() (which calls this)
   * isn't awaited by the scene stack — so this kicks it off and every other
   * method here checks pixiReady rather than assuming it's done. In
   * practice it resolves well within the entry fade, so there's nothing to
   * see during that window regardless.
   */
  setup3D() {
    if (!this.canvas3D) this.canvas3D = document.createElement('canvas');
    this.canvas3D.width = W;
    this.canvas3D.height = H;
    this.fieldBillboards = new Map();
    this.pixiReady = false;

    if (!this.worldCanvas) this.worldCanvas = document.createElement('canvas');
    this.worldCanvas.width = W + MARGIN_PX * 2;
    this.worldCanvas.height = H + MARGIN_PX * 2;

    this.pixiApp = new PIXI.Application();
    this.pixiApp.init({
      canvas: this.canvas3D, width: W, height: H,
      antialias: false, resolution: 1, autoDensity: false,
      backgroundAlpha: 1, background: '#0b0e18', powerPreference: 'low-power',
    }).then(() => {
      this.groundTex = PIXI.Texture.from(this.worldCanvas);
      this.groundTex.source.scaleMode = 'nearest';
      this.groundTex.source.autoGenerateMipmaps = false;
      this.groundSprite = new PIXI.Sprite(this.groundTex);
      this.groundSprite.anchor.set(0.5);
      this.groundSprite.position.set(W / 2, H / 2);
      this.groundSprite.scale.set(GROUND_SCALE_X, GROUND_SCALE_Z);

      this.bgSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
      this.bgSprite.width = W;
      this.bgSprite.height = H;

      this.billboardLayer = new PIXI.Container();
      this.billboardLayer.sortableChildren = true;

      this.pixiApp.stage.addChild(this.bgSprite, this.groundSprite, this.billboardLayer);
      this.pixiReady = true;
    });
  }

  /** Releases the offscreen WebGL context and every GPU resource this scene
   *  allocated. This field scene is usually reused across map warps (setup3D
   *  only runs once per push), so it leaks far less often in practice than a
   *  battle does, but it still needs disposing on the rarer full exits (e.g.
   *  game over). The app's scene stack calls this whenever this scene is
   *  popped or replaced — see main.js. Guarded on pixiApp existing: a warp
   *  away before PIXI.Application.init() resolves would otherwise throw here
   *  on a stage/renderer that was never actually built. */
  dispose3D() {
    if (!this.pixiApp) return;
    this.pixiApp.destroy(true, { children: true, texture: true });
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
   *  still draw on top of the backdrop, and for placing the billboards that
   *  make up part of that backdrop in the first place. Closed-form, not an
   *  actual camera — see the CAM_RIGHT/CAM_UP/PX_PER_WORLD comment up top. */
  project(world) {
    const dx = world.x - FIELD_CAM_POS.x, dy = world.y - FIELD_CAM_POS.y, dz = world.z - FIELD_CAM_POS.z;
    const right = dx * CAM_RIGHT.x + dy * CAM_RIGHT.y + dz * CAM_RIGHT.z;
    const up = dx * CAM_UP.x + dy * CAM_UP.y + dz * CAM_UP.z;
    return { x: W / 2 + PX_PER_WORLD * right, y: H / 2 - PX_PER_WORLD * up };
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
    const m = this.map;
    const cam = this.camera();
    // Re-baking this whole (margin-padded, larger-than-screen) canvas
    // uploads it to the GPU as a fresh texture — real cost that was
    // paid every single frame even standing still, since nothing here
    // ever changed except when the camera actually moves or a chest
    // opens (which calls markWorldTextureDirty itself). Skipping the
    // redraw whenever neither has happened turns a several-hundred-tile
    // repaint-and-reupload into a no-op for most frames.
    const bakeKey = `${m.id}|${cam.x}|${cam.y}`;
    if (bakeKey === this._worldTexBakeKey) return;

    const ctx = this.worldCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
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

    // Every tile position here is cached by absolute (map, x, y) — see
    // groundSprite/massSprite/buildingSprite — so a position already drawn
    // once anywhere is a cheap cache hit forever after. But the FIRST time
    // through a freshly-warped-into area, this margin-padded window (well
    // past 800 tiles) is entirely cache misses, and each one paints a whole
    // material-blended, blurred tile from scratch: measured well over 4
    // real seconds of unbroken main-thread work for a single warp into
    // unexplored ground, reading as the game hanging rather than loading.
    // A wall-clock budget below bails out of both loops once a frame has
    // done enough fresh painting, leaving whatever's left as the map's own
    // background fill (already there from the clear above) rather than
    // finishing the burst in one shot. Crucially the bake key is only
    // recorded once a pass actually reaches the end uninterrupted, so a
    // bailed-out frame doesn't get mistaken for a finished one — the very
    // next frame retries the same window, and since every tile this frame
    // did manage is now a cache hit, it gets further before its own budget
    // runs out, converging over a handful of frames instead of one freeze.
    const BUDGET_MS = 8;
    const deadline = performance.now() + BUDGET_MS;
    let complete = true;

    outer1:
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if ((x & 7) === 0 && performance.now() > deadline) { complete = false; break outer1; }
        const t = tileAt(m, x, y);
        if (!t) continue;
        const theme = themeAt(m, x, y);
        const px = x * TS - ox, py = y * TS - oy;
        if (isOutdoor(t.tile)) {
          ctx.drawImage(groundSprite(`${m.id}|${x}|${y}`, sampler(m, x, y), theme), px, py);
        } else if (isStructure(t.tile)) {
          ctx.drawImage(groundSprite(`${m.id}|${x}|${y}`, groundUnder(m, x, y), theme), px, py);
        } else {
          ctx.drawImage(tileSprite(t.tile), px, py);
        }
      }
    }
    if (complete) {
      outer2:
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if ((x & 7) === 0 && performance.now() > deadline) { complete = false; break outer2; }
          const t = tileAt(m, x, y);
          if (!t) continue;
          const theme = themeAt(m, x, y);
          const px2 = x * TS - ox, py2 = y * TS - oy;
          const smp = sampler(m, x, y);
          if (hasStructure(smp)) {
            ctx.drawImage(buildingSprite(`${m.id}|${x}|${y}`, smp, theme), px2, py2);
          }
          if (!isOutdoor(t.tile)) continue;
          const px = x * TS - ox, py = y * TS - oy;
          if (hasMass(smp)) {
            ctx.drawImage(massSprite(`${m.id}|${x}|${y}`, smp, theme), px, py);
          }
          if (FEATURE.has(t.tile)) ctx.drawImage(tileSprite(t.tile), px, py);
        }
      }
    }
    if (complete) {
      for (const c of m.chests ?? []) {
        if (this.g.flag(`chest.${c.id}`)) continue;
        ctx.drawImage(tileSprite('chest'), c.x * TS - ox, c.y * TS - oy);
      }
      this._worldTexBakeKey = bakeKey;
    }
    if (this.groundTex) this.groundTex.source.update();
  }

  /** The sprite canvas + billboard feet position for one field actor (the
   *  player or an NPC) — factored out so syncFieldBillboards treats both
   *  the same way. */
  billboardFor(cv, pixelX, pixelY) {
    const cam = this.camera();
    const world = this.worldFromScreenPx(pixelX - cam.x, pixelY - cam.y);
    return { feet: this.project(world) };
  }

  /** Creates/updates one flat sprite per NPC plus the player, keyed by a
   *  stable id, anchored at its feet so it sits on the ground exactly where
   *  billboardFor's projection says that tile is. */
  syncFieldBillboards() {
    const seen = new Set();
    const sync = (key, cv, pixelX, pixelY, zIndex) => {
      seen.add(key);
      const { feet } = this.billboardFor(cv, pixelX, pixelY);
      let b = this.fieldBillboards.get(key);
      if (!b) {
        // actorSprite's canvas is baked at 144x192 (AW/AH — see actor.js,
        // sized for battle's much bigger portraits) but this only ever
        // displays at the 36x48 SPRITE_WORLD footprint, a flat 4x
        // minification a GPU can only cover with mipmaps — which, on
        // high-contrast pixel art, box-average whole regions toward grey
        // and read as "faded". dsCanvas below does that resize once in 2D
        // with a quality (not nearest-neighbour — that under-represents
        // dark shading pixels at this ratio, reading as too pale instead)
        // resize, so the uploaded texture already matches the sprite's
        // screen size and the GPU never has to minify or magnify it.
        //
        // That quality resize is still a box-average, though, and at 4x
        // the ink linework this art is built from gets blended straight
        // into the surrounding skin/cloth fill — measured on real sprites,
        // fully-opaque interior pixels lose over half their saturation
        // even with the mipmap step removed, and a much larger share of
        // the sprite's total area ends up semi-transparent than at full
        // size (an anti-aliased edge keeps roughly its on-screen width as
        // the art shrinks around it), reading as the sprite fading into
        // whatever's behind it. sharpenDownscale() below (see pixel.js)
        // undoes both: a radius-1 unsharp mask puts local contrast and
        // saturation back in proportion to what that pixel actually lost,
        // and an alpha gamma pulls edge pixels back toward opaque. A flat
        // saturate() filter was tried first and had to be scrapped — it
        // was tuned against one low-saturation costume and overshot a
        // high-saturation one by 60%+, since it corrects by a fixed
        // multiplier instead of by how much detail a pixel actually lost.
        const dsCanvas = document.createElement('canvas');
        dsCanvas.width = SPRITE_WORLD_W;
        dsCanvas.height = SPRITE_WORLD_H;
        const tex = PIXI.Texture.from(dsCanvas);
        tex.source.scaleMode = 'nearest';
        tex.source.autoGenerateMipmaps = false;
        const sprite = new PIXI.Sprite(tex);
        sprite.anchor.set(0.5, 1);
        sprite.scale.set(GROUND_SCALE_X, BILLBOARD_SCALE_Y);
        this.billboardLayer.addChild(sprite);
        b = { sprite, tex, dsCanvas, dsCtx: dsCanvas.getContext('2d'), canvas: null };
        this.fieldBillboards.set(key, b);
      }
      if (b.canvas !== cv) {
        b.canvas = cv;
        b.dsCtx.imageSmoothingEnabled = true;
        b.dsCtx.imageSmoothingQuality = 'high';
        b.dsCtx.clearRect(0, 0, SPRITE_WORLD_W, SPRITE_WORLD_H);
        b.dsCtx.drawImage(cv, 0, 0, SPRITE_WORLD_W, SPRITE_WORLD_H);
        sharpenDownscale(b.dsCtx, SPRITE_WORLD_W, SPRITE_WORLD_H);
        b.tex.source.update();
      }
      b.sprite.position.set(feet.x, feet.y);
      // Farther-north (smaller world Z, smaller feet.y) sprites sit behind
      // closer ones — ordinary painter's-algorithm depth sort, same idea as
      // battle.js's own unit sort.
      b.sprite.zIndex = zIndex;
    };

    for (const n of this.map.npcs ?? []) {
      const cv = npcSprite(n.kind, (n.x + n.y) % 4, Math.floor(this.animT * 1.6 + n.x * 0.7 + n.y * 0.3) % 2);
      sync(`npc:${n.x},${n.y}`, cv, n.x * TS + TS / 2, n.y * TS + TS, n.y);
    }
    const leader = this.g.leader;
    const frame = this.moving
      ? (Math.floor(this.animT * 8) % 2 === 0 ? 1 : 4)
      : (Math.floor(this.animT * 1.35) % 2 === 0 ? 0 : 5);
    const pp = this.playerPixel();
    const face = this.g.facing === 'left' ? 'left' : 'right';
    const hero = actorSprite({
      classId: leader.classId,
      raceId: leader.raceId,
      elementId: leader.elementId,
      skin: leader.skin,
      hair: leader.hair,
      frame,
      face,
      equip: leader.equip,
    });
    // billboardFor/worldFromScreenPx treat the pixel it's given as the
    // sprite's own centre, but pp.x (like n.x*TS above) is the tile's LEFT
    // edge — every field billboard rendered a half-tile west of the tile it
    // was actually standing on, invisible over open ground but glaring next
    // to a door or chest baked into the ground texture at its true position.
    sync('player', hero, pp.x + TS / 2, pp.y + TS, this.g.y);

    for (const [key, b] of this.fieldBillboards) {
      if (!seen.has(key)) { this.billboardLayer.removeChild(b.sprite); b.tex.destroy(true); this.fieldBillboards.delete(key); }
    }
  }

  /** Re-bakes the ground texture, syncs billboards and renders the backdrop
   *  to the offscreen canvas; draw() blits the result in as this frame's
   *  backdrop. The player/NPC sprites are unlit and get their night/dusk
   *  darkening from draw()'s 2D grade/vignette pass over the whole blitted
   *  frame instead of their own light — see syncFieldBillboards. */
  render3D() {
    this.renderWorldTexture();
    if (!this.pixiReady) return;
    this.syncFieldBillboards();
    // fills anywhere past the (deliberately oversized) ground sprite's edge
    // — matches the map's own background colour instead of showing through
    // as flat black
    const plateKey = plateKeyForMap(this.map);
    const plate = plateImage(plateKey);
    if (plate && plate.complete && plate.naturalWidth) {
      if (this._plateKey !== plateKey) {
        this.bgSprite.texture = PIXI.Texture.from(plate);
        this._plateKey = plateKey;
      }
      this.bgSprite.tint = 0xffffff;
    } else {
      this.bgSprite.texture = PIXI.Texture.WHITE;
      this.bgSprite.tint = this.map.bg ?? '#0b0e18';
      this._plateKey = null;
    }
    this.pixiApp.renderer.render(this.pixiApp.stage);
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

  /** What a battle started from right here should know about the sky —
   *  same outdoor/town gate as `look` and rollWeather, so a fight picked
   *  up in a cave or the Colosseum's arena floor never inherits either. */
  battleWeather() {
    const m = this.map;
    if (!m.outdoor && !m.town) return { night: false, rain: false };
    return { night: this.nightAmount() > 0.5, rain: this.raining };
  }

  /** Look for the current map, driving grade, lights and ambient particles.
   *  Caves and the abyss keep their own fixed dark palette — night and
   *  weather are an outdoor/town condition only. A plain building interior
   *  (an inn, shop, temple, home — `encounter: null`, unlike a real dungeon
   *  which always names a region) is lit like the town around it, not like
   *  the dungeons that happen to share its wall/floor tiles: nobody lives in
   *  the dark. */
  get look() {
    const m = this.map;
    const base = m.town ? { grade: '#ffb46a', amount: 0.09, vignette: 0.40, motes: '#ffd9a0', warm: true }
      : m.outdoor ? { grade: '#9ecdff', amount: 0.07, vignette: 0.36, motes: '#dff2ff' }
        : m.encounter === 'abyss' ? { grade: '#a06cff', amount: 0.22, vignette: 0.74, motes: '#c8a0ff', dark: true }
          : m.encounter === null ? { grade: '#ffcf94', amount: 0.10, vignette: 0.38, motes: '#ffe6b8', warm: true }
            : { grade: '#5a7cc0', amount: 0.17, vignette: 0.68, motes: '#9ab4e0', dark: true };
    if (!m.outdoor && !m.town) return base;

    const night = this.nightAmount();
    const wet = this.raining ? 0.55 : 0;
    const dk = Math.min(1, night * 0.9 + wet * 0.4);
    if (dk <= 0) return base;
    return {
      ...base,
      grade: mixHex(base.grade, this.raining ? '#33415e' : '#16224a', Math.min(1, night * 0.85 + wet)),
      amount: Math.min(0.28, base.amount + dk * 0.14),
      vignette: Math.min(0.55, base.vignette + dk * 0.18),
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
          this.app.push('battle', { formationId: boss.formation, bossFlag: boss.flag, ...this.battleWeather() });
        } else if (emptied && this.pendingGauntletFormation) {
          const formationId = this.pendingGauntletFormation;
          this.pendingGauntletFormation = null;
          this.app.push('battle', { formationId, ...this.battleWeather() });
        } else if (emptied && this.pendingNGPlusChoice) {
          this.pendingNGPlusChoice = false;
          this.choice = {
            title: 'Begin New Game+? The roster, its gear and gold carry over — the story and map reset, '
              + 'and every enemy hits harder.',
            options: ['Not yet', 'Begin New Game+'],
            onPick: (i) => { if (i === 1) this.beginNewGamePlus(); },
          };
        }
      }
      return;
    }

    if (input.tap('menu')) { this.app.push('menu'); return; }
    if (input.tap('list')) { sfx.confirm(); togglePartyHudVisible(); return; }
    if (input.tap('shift')) { this.swapLeader(); return; }

    if (this.moving) {
      this.stepT += dt;
      if (this.stepT >= STEP_TIME) {
        const cam = this.camera();
        this.fxp.dust(this.g.x * TS + TS / 2 - cam.x, this.g.y * TS + TS - 2 - cam.y,
          this.map.outdoor ? '#6a8a58' : '#7a7284', 6);
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
      for (const line of Array.isArray(boss.intro) ? boss.intro : [boss.intro]) this.dlg.say(line);
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
    // The Shifting Depths climbs in difficulty by floor rather than by
    // region alone — see data/dungeon.js — so a floor deeper than its own
    // region's usual ceiling still hits harder than the same formation
    // would on the surface.
    const enemyScaleBonus = m.dungeonDepth ? 1 + 0.05 * m.dungeonDepth : 1;
    this.app.push('battle', { formationId: f.id, preemptive, ambushed, enemyScaleBonus, ...this.battleWeather() });
  }

  /** Rotates the party so the next member leads — the field only ever shows
   *  one avatar (see syncFieldBillboards), so this is how a player controls
   *  someone other than whoever they started the game with. Reuses the
   *  map-name banner's timer/box for the "now controlling" callout since the
   *  two never need the screen at once. */
  swapLeader() {
    const party = this.g.party;
    if (party.length < 2) return;
    party.push(party.shift());
    sfx.confirm();
    this.banner = 1.4;
    this.bannerText = `Now controlling: ${this.g.leader.name}`;
  }

  // --- interaction ---------------------------------------------------------
  interact() {
    const m = this.map;
    const [dx, dy] = DIRS[this.g.facing];
    const x = this.g.x + dx, y = this.g.y + dy;

    const sign = signAt(m, x, y);
    if (sign) { this.dlg.say(sign.text); return; }

    if (tileAt(m, x, y)?.tile === 'anvil') { this.openForge(); return; }

    const chest = chestAt(m, x, y) ?? chestAt(m, this.g.x, this.g.y);
    if (chest && !this.g.flag(`chest.${chest.id}`)) { this.openChest(chest); return; }

    const npc = npcAt(m, x, y);
    if (npc) { this.talkTo(npc); return; }

    // standing on the exit of a town
    const wp = warpAt(m, this.g.x, this.g.y);
    if (wp) { sfx.door(); this.pendingWarp = wp; this.fadeDir = 1; }
  }

  /** Forces the next renderWorldTexture() call to actually re-bake, for the
   *  rare cases (a chest opening) that change what's baked into the ground
   *  texture without the camera itself having moved. */
  markWorldTextureDirty() { this._worldTexBakeKey = null; }

  openChest(chest) {
    const locked = chest.locked && !this.g.hasJob('locksmith');
    if (locked) { this.dlg.say('Locked. A Locksmith could open this.'); return; }
    // trapsense: "deals 20% less per rank" — a rank-scaled reduction, not
    // the flat full-disarm-at-any-rank this used to give any Locksmith
    // regardless of how junior.
    if (chest.trap) {
      const smith = this.g.party.find((c) => c.jobId === 'locksmith');
      const reduction = smith ? Math.min(1, 0.2 * jobRank(smith)) : 0;
      const dmg = Math.round(chest.trap.dmg * (1 - reduction));
      if (dmg > 0) {
        for (const ch of this.g.party) if (ch.hp > 0) ch.hp = Math.max(1, ch.hp - dmg);
        sfx.error();
        this.dlg.say(`A trap! The party takes ${dmg} damage each.`);
      } else {
        this.dlg.say('A trap, disarmed before it could spring.');
      }
    }
    this.g.setFlag(`chest.${chest.id}`);
    this.markWorldTextureDirty();
    if (chest.gold) {
      sfx.chest();
      this.g.earn(chest.gold);
      this.dlg.say(`${chest.gold} gold.`);
    } else if (chest.item) {
      const it = getItem(chest.item);
      if (this.g.addItem(chest.item)) { sfx.chest(); this.dlg.say(`Found ${it.name}.`); }
      else { this.g.setFlag(`chest.${chest.id}`, false); sfx.error(); this.dlg.say('The pack is full.'); }
    }
    if (chest.locked || chest.trap) {
      const smith = this.g.party.find((c) => c.jobId === 'locksmith');
      if (smith) { const m = this.g.jobTick(smith, 12); if (m) this.dlg.say(m); }
    }
  }

  /** Forge (Blacksmith, weapons) and Refit (Armorer, armour/shields) — every
   *  smithy's own anvil tile, previously just floor dressing. Scans the
   *  WHOLE party for the first upgradeable piece in the right slots rather
   *  than only the smith's own gear, so a party of one blacksmith can still
   *  improve everyone's weapon, not just their own. */
  openForge() {
    const findable = (jobId, slots) => {
      const smith = this.g.party.find((c) => c.jobId === jobId);
      if (!smith) return null;
      const rank = jobRank(smith);
      for (const holder of this.g.party) {
        for (const slot of slots) {
          const id = holder.equip[slot];
          if (!id) continue;
          const up = forgeUpgrade(id);
          if (up && rank >= up.tier) return { smith, holder, slot, from: id, up };
        }
      }
      return null;
    };
    const found = findable('blacksmith', ['weapon']) ?? findable('armorer', ['body', 'head', 'offhand']);
    if (!found) { this.dlg.say('Nothing here is ready to forge.'); return; }
    const { smith, holder, slot, from, up } = found;
    const fromItem = getItem(from), toItem = getItem(up.to);
    const costText = up.leather ? `${up.ore} Iron Ore, ${up.leather} Cured Leather` : `${up.ore} Iron Ore`;
    this.choice = {
      title: `${holder.name}'s ${fromItem.name} into a ${toItem.name}, for ${costText}?`,
      options: ['Forge it', 'Not now'],
      onPick: (i) => {
        if (i !== 0) return;
        if (this.g.countItem('ironore') < up.ore || (up.leather && this.g.countItem('leather') < up.leather)) {
          this.dlg.say('Not enough materials.');
          return;
        }
        this.g.removeItem('ironore', up.ore);
        if (up.leather) this.g.removeItem('leather', up.leather);
        holder.equip[slot] = up.to;
        sfx.chest();
        this.dlg.say(`${holder.name}'s ${fromItem.name} becomes a ${toItem.name}!`);
        const m = this.g.jobTick(smith, 15);
        if (m) this.dlg.say(m);
      },
    };
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
      case 'arena': {
        const options = ARENA_TIERS.map((t) => {
          const locked = t.requires && !this.g.flag(`boss.${t.requires}`);
          const cleared = this.g.flag(`arena.${t.id}.cleared`);
          return locked ? `${t.name} — Sealed` : `${t.name}${cleared ? ' (cleared)' : ''}`;
        });
        options.push('Leave');
        this.choice = {
          title: `${npc.name}: "${npc.text}"`,
          options,
          onPick: (i) => {
            const tier = ARENA_TIERS[i];
            if (!tier) return;
            if (tier.requires && !this.g.flag(`boss.${tier.requires}`)) {
              this.dlg.say(`"Not yet." ${tier.lockHint}`);
              return;
            }
            if (this.g.livingParty().length === 0) { this.dlg.say('"Come back when your party can stand."'); return; }
            this.startGauntlet(tier);
          },
        };
        break;
      }
      case 'guild':
        this.dlg.say(this.reactionLine(npc), npc.name, this.npcPortrait(npc));
        this.dlg.say('(Open the party menu with C or TAB for Formation, Jobs and the class ladder.)');
        break;
      case 'recruit': {
        const flag = `story.recruited.${npc.id}`;
        if (this.g.flag(flag)) { this.dlg.say(this.reactionLine(npc), npc.name, this.npcPortrait(npc)); break; }
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

    // An NPC can hold more than one quest in a chain — the active one takes
    // priority (there's ever only one at a time), otherwise the first
    // unstarted one whose `requires` gate (if any) has actually opened.
    // A chain's later parts stay invisible — same as no quest at all —
    // until the one before them is done.
    const givable = Object.values(QUESTS).filter((q) => q.npc === npc.name);
    const giving = givable.find((q) => questState(this.g, q.id) === 'active')
      ?? givable.find((q) => questState(this.g, q.id) === 'unstarted' && questAvailable(this.g, q.id));
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
    if (reward.lp) this.dlg.say(`+${reward.lp} LP each.`);
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
    // Pilgrim's grace: "costs 30% less per rank" — linear to 30% off at
    // max rank (5). This used to multiply the same discount factor by
    // itself, squaring it into a ~51% discount at max rank instead.
    return Math.max(10, Math.round(base * (1 - 0.3 * rank / 5)));
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

  /** GameState.startNewGamePlus() does the actual state reset; this just
   *  restarts the field scene fresh once it has, the same way booting a
   *  save does — no separate transition machinery to get wrong. */
  beginNewGamePlus() {
    this.g.startNewGamePlus();
    this.app.replace('field', { fadeIn: true });
  }

  completeWarp() {
    const wp = this.pendingWarp;
    this.pendingWarp = null;
    if (!wp) return;
    if (wp.regenDungeon) resetDungeonFloors();
    this.g.mapId = wp.to;
    this.g.x = wp.tx;
    this.g.y = wp.ty;
    this.g.visitedMaps[wp.to] = true;
    if (getMap(wp.to)?.town) this.g.lastTownId = wp.to;
    const depthMatch = /^depths_(\d+)$/.exec(wp.to);
    if (depthMatch) this.g.deepestDepth = Math.max(this.g.deepestDepth, Number(depthMatch[1]));
    this.g.stepsSinceBattle = 0;
    this.encounterCooldown = 3;
    this.banner = 2.2;
    this.bannerText = this.map.name;
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
    else if (result?.fastTravel) this.beginFastTravel(result.fastTravel);
  }

  /** Cartographer's waypoints passive: the Atlas page (menu.js) hands back
   *  a town id once a fully-mapped destination is confirmed there. Reuses
   *  the exact fade-and-warp machinery any door already uses (see
   *  completeWarp) and the overworld's own landing point for that town, so
   *  arriving this way looks and lands exactly like walking there would. */
  beginFastTravel(mapId) {
    const entry = WORLD_ENTRY_BY_MAP[mapId];
    if (!entry) return;
    sfx.door();
    this.pendingWarp = { to: mapId, tx: entry.tx, ty: entry.ty };
    this.fadeDir = 1;
    const cart = this.g.party.find((c) => c.jobId === 'cartographer');
    if (cart) { const m = this.g.jobTick(cart, 10); if (m) this.dlg.say(m); }
  }

  // --- the Colosseum ---------------------------------------------------------
  startGauntlet(tier) {
    this.gauntlet = { tierId: tier.id, round: 0 };
    this.g.restParty();
    this.app.push('battle', { formationId: tier.rounds[0], ...this.battleWeather() });
  }

  /** Advances or ends the current gauntlet after a round's result. Returns
   *  true if it handled the result (so onBattleResult stops there). */
  handleGauntletResult(result) {
    const tier = ARENA_TIERS.find((t) => t.id === this.gauntlet.tierId);
    if (result.outcome === 'fled') {
      this.gauntlet = null;
      this.dlg.say('The gauntlet ends — you fled the ring.');
      return true;
    }
    this.gauntlet.round++;
    if (this.gauntlet.round < tier.rounds.length) {
      this.g.restParty();
      this.pendingGauntletFormation = tier.rounds[this.gauntlet.round];
      this.dlg.say(`Round ${this.gauntlet.round} cleared! The crowd roars for more.`);
      return true;
    }
    this.g.setFlag(`arena.${tier.id}.cleared`);
    const r = tier.reward;
    if (r.gold) this.g.earn(r.gold);
    if (r.lp) for (const ch of this.g.party) ch.lp += r.lp;
    const parts = [`${r.gold} gold`];
    if (r.lp) parts.push(`${r.lp} LP each`);
    let packFull = false;
    if (r.item) {
      if (this.g.addItem(r.item)) parts.push(getItem(r.item).name);
      // Same rule as a chest with no room: don't mark it cleared, so the
      // reward is still there to collect once there's space for it.
      else { this.g.setFlag(`arena.${tier.id}.cleared`, false); packFull = true; }
    }
    this.gauntlet = null;
    const counted = parts.length > 1
      ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
      : parts[0];
    const tail = packFull ? ' — but the pack is full' : '';
    this.dlg.say(`${tier.name} cleared! The steward counts out ${counted}${tail}.`);
    return true;
  }

  // called by the app when a battle finishes
  onBattleResult(result) {
    if (result.outcome === 'defeat') {
      this.gauntlet = null;
      this.app.replace('gameover');
      return;
    }
    this.g.stepsSinceBattle = 0;
    this.encounterCooldown = 4;
    if (result.bossFlag) {
      this.g.setFlag(`boss.${result.bossFlag}`);
      // Depths boss flags carry a random suffix (see data/dungeon.js) so they
      // can never be checked directly by an achievement — these two stable
      // flags are what Achievements actually reads instead.
      if (result.bossFlag.startsWith('depthscap_')) this.g.setFlag('depths.capstoneCleared', true);
      else if (result.bossFlag.startsWith('depths_')) this.g.setFlag('depths.bossCleared', true);
      // one closing beat on the spot where the boss just fell, distinct from
      // (and shorter than) any broader reflection the story shows once you
      // leave and warp somewhere new — see resume()'s epilogue/midpoint/
      // trueEnd triggers above.
      const boss = BOSS_SLOTS.map((k) => this.map[k]).find((b) => b?.flag === result.bossFlag);
      if (boss?.victory) this.dlg.say(boss.victory);
    }
    if (this.gauntlet) { this.handleGauntletResult(result); return; }
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
    // The HD-2D pass nearly doubled this (0.22/0.62 before it), enough
    // haze bleeding off every edge to read as the game gone soft-focus
    // rather than lit — pixel art needs its edges back more than it needs
    // extra glow. Back to what this scene was tuned at.
    scr.bloom = look.dark ? 0.62 : 0.22;

    // the backdrop (ground, buildings, mass, closed chests, the player and
    // every NPC as flat sprites) renders to its own offscreen canvas and
    // gets blitted in as this frame's whole backdrop — see
    // setup3D/render3D/renderWorldTexture for how that's built.
    this.render3D();
    // Tilt-shift the backdrop the same way battle.js does: sharp in a band
    // centred on the player (who this camera always keeps at screen centre,
    // W/2,H/2 — see setup3D), softening toward the top and bottom edges for
    // the same "miniature diorama" look. Kept gentler and the band wider
    // than battle's — chests, signs and NPCs the player hasn't reached yet
    // still need to read clearly near the edges of the visible window.
    scr.tiltShift(this.canvas3D, 70, 200, 2);

    // dusk / dawn wash over the outdoor sky so night is not a binary flip
    if (m.outdoor || m.town) {
      const night = this.nightAmount();
      if (night > 0.1 && night < 0.78) {
        const peak = night < 0.4 ? night / 0.4 : (0.78 - night) / 0.38;
        const a = Math.max(0, Math.min(0.24, peak * 0.24));
        scr.vgrad(0, 0, W, 86, `rgba(255,150,70,${a.toFixed(3)})`, 'rgba(255,150,70,0)');
      }
    }

    // dungeon exits — a warm daylight glow and label on the one tile that
    // leads back out, so it doesn't blend into a floor tile identical to
    // every other one in the room. Every warp flagged `exit` is the way
    // out of the current area (back to the world, or back a segment for
    // a multi-part dungeon), never a way deeper in.
    for (const wp of m.warps ?? []) {
      if (!wp.exit) continue;
      const p = this.tileScreenPos(wp.x, wp.y);
      const pulse = 0.5 + 0.5 * Math.sin(this.animT * 2);
      scr.light(p.x, p.y, 16 + pulse * 4, 'rgba(255,214,150,0.55)', 0.3 + pulse * 0.15);
      scr.textCenter('Exit', p.x, p.y - 15, PAL.gold);
    }

    // stairs to another floor of the SAME dungeon — every other floor-to-
    // floor connection a labyrinth or the Shifting Depths has, labelled Up
    // or Down (by comparing floorDepthOf against the destination) the same
    // way the exit warp above reads at a glance rather than looking like
    // one more floor tile identical to the rest of the room.
    if (m.tower || m.dungeonDepth != null) {
      for (const wp of m.warps ?? []) {
        if (!wp.stairs) continue;
        const dest = getMap(wp.to);
        if (!dest) continue;
        const p = this.tileScreenPos(wp.x, wp.y);
        const pulse = 0.5 + 0.5 * Math.sin(this.animT * 2);
        scr.light(p.x, p.y, 16 + pulse * 4, 'rgba(150,200,255,0.5)', 0.3 + pulse * 0.15);
        const goingDown = floorDepthOf(dest) > floorDepthOf(m);
        scr.textCenter(goingDown ? 'Down' : 'Up', p.x, p.y - 15, PAL.cyan);
      }
    }

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

    // town markers — bigger, labelled entrances so a destination reads as
    // one from a screen away instead of blending into the ground tile
    // underneath it; the four full cities get the grand arch, every other
    // town gets the plain roadside signpost (see CITY_TOWNS). Scoped to the
    // world map itself, same as the cave/tower loops below: a building's
    // own warp back out to its town is an exit, not a town entrance, and
    // drawing a full gated arch over the door inside a tiny inn room was
    // exactly that bug.
    if (m.id === 'world') {
      for (const wp of m.warps ?? []) {
        const dest = getMap(wp.to);
        if (!dest?.town) continue;
        const isCity = CITY_TOWNS.has(wp.to);
        const sprite = isCity ? citySprite() : pitstopSprite();
        const w = isCity ? CITY_W : PITSTOP_W, h = isCity ? CITY_H : PITSTOP_H;
        const p = this.tileScreenPos(wp.x, wp.y);
        const baseY = p.y + 10;
        scr.ctx.drawImage(sprite, Math.round(p.x - w / 2), Math.round(baseY - h), w, h);
        scr.textCenter(dest.name, p.x, baseY - h - 10, isCity ? PAL.gold : PAL.text);
      }
    }

    // cave/dungeon entrances on the overworld — a bigger rocky mouth than
    // the ground itself can show, labelled with the region's normal-
    // encounter level span so a dungeon reads as a threat estimate before
    // stepping in without spoiling which enemies actually wait inside.
    // Scoped to the world map itself: a dungeon's own warps back out (or
    // on to a linked segment) aren't "entrances" to mark. A labyrinth is
    // its own kind of dungeon (see the tower markers below), not a cave,
    // so it's excluded here.
    if (m.id === 'world') {
      for (const wp of m.warps ?? []) {
        const dest = getMap(wp.to);
        if (!dest || dest.town || dest.tower || !dest.encounter) continue;
        const p = this.tileScreenPos(wp.x, wp.y);
        const baseY = p.y + 10;
        const sprite = caveSprite();
        scr.ctx.drawImage(sprite, Math.round(p.x - CAVE_W / 2), Math.round(baseY - CAVE_H), CAVE_W, CAVE_H);
        const span = regionLevelSpan(dest.encounter);
        if (span) scr.textCenter(`Lv ${span[0]}-${span[1]}`, p.x, baseY - CAVE_H - 10, PAL.red);
      }
    }

    // labyrinth entrances — a tall tower, deliberately distinct from a
    // cave's mouth, labelled with its name and the same kind of level-span
    // estimate a cave gets.
    if (m.id === 'world') {
      for (const wp of m.warps ?? []) {
        const dest = getMap(wp.to);
        if (!dest?.tower) continue;
        const p = this.tileScreenPos(wp.x, wp.y);
        const baseY = p.y + 10;
        const sprite = towerSprite();
        scr.ctx.drawImage(sprite, Math.round(p.x - TOWER_W / 2), Math.round(baseY - TOWER_H), TOWER_W, TOWER_H);
        scr.textCenter(dest.name, p.x, baseY - TOWER_H - 20, PAL.magenta);
        const span = regionLevelSpan(dest.encounter);
        if (span) scr.textCenter(`Lv ${span[0]}-${span[1]}`, p.x, baseY - TOWER_H - 10, PAL.red);
      }
    }

    // NPC glyphs (recruit "*", service marks) — same projection, drawn over
    // each NPC's own billboard
    for (const n of m.npcs ?? []) {
      const p = this.tileScreenPos(n.x, n.y);
      drawNpcGlyph(scr, p.x, p.y, n, this.animT, this.g);
    }

    // lighting: lamps and candles in the visible window, then a warm pool
    // on the player, torches in the dark, ambient motes
    {
      const { w: mw, h: mh } = mapSize(m);
      const cam = this.camera();
      const x0 = Math.max(0, Math.floor(cam.x / TS) - 1);
      const y0 = Math.max(0, Math.floor(cam.y / TS) - 1);
      const x1 = Math.min(mw - 1, Math.ceil((cam.x + W) / TS) + 1);
      const y1 = Math.min(mh - 1, Math.ceil((cam.y + H) / TS) + 1);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const name = tileAt(m, tx, ty)?.tile;
          if (name !== 'lamp' && name !== 'candle') continue;
          const p = this.tileScreenPos(tx, ty);
          const flick = 0.38 + Math.sin(this.animT * 7 + tx * 1.7 + ty) * 0.08
            + Math.sin(this.animT * 19 + ty) * 0.04;
          const warm = name === 'candle' ? 'rgba(255,186,110,0.70)' : 'rgba(255,210,140,0.62)';
          scr.light(p.x, p.y - 6, name === 'candle' ? 22 : 36, warm, flick);
        }
      }
    }
    const pp = this.playerPixel();
    const lp = this.pixelScreenPos(pp.x + TS / 2, pp.y + TS / 2);
    const lx = Math.round(lp.x), ly = Math.round(lp.y);
    // A non-finite player position (this.g.x/y gone bad — a malformed warp
    // target is the one way that's happened) used to crash createRadialGradient
    // outright and take the whole frame down with it; skip the vignette
    // for that one frame instead; scr.light() below already guards itself.
    if (look.dark && Number.isFinite(lx) && Number.isFinite(ly)) {
      scr.ctx.save();
      scr.ctx.globalCompositeOperation = 'multiply';
      const g = scr.ctx.createRadialGradient(lx, ly, 20, lx, ly, 150);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, look.dark ? '#767690' : '#8890a8');
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
    if (m.id === 'world') this.drawMinimap(scr);
    else if (m.dungeonDepth && this.g.hasJob('cartographer')) this.drawDungeonChart(scr);
    if (this.banner > 0) this.drawBanner(scr);
    if (this.choice) this.drawChoice(scr);
    else this.dlg.draw(scr);
    if (this.fade > 0) scr.fade(this.fade);
  }

  drawHud(scr) {
    const g = this.g;
    // The party list (name/HP/MP per member) can run to nine rows and cover
    // real ground on both the overworld and a dungeon floor — the 'list'
    // button (L, or the on-screen LIST pad next to Menu/Shift) hides it, and
    // a small tag stands in its place so the control is never a surprise.
    if (getPartyHudVisible()) {
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
    } else {
      scr.panel(W - 32, 8, 24, 16, { alpha: 0.7 });
      scr.textCenter('L', W - 20, 12, PAL.textFaint);
    }
    scr.panel(8, H - 30, 118, 22, { alpha: 0.94 });
    scr.text('G', 18, H - 23, PAL.accentDim);
    scr.text(`${g.gold}`, 28, H - 23, PAL.accent);
    scr.textRight(`Lv ${g.leader.level}`, 118, H - 23, PAL.text);
  }

  /** A small always-on overview of the overworld in the top-left corner —
   *  the party HUD already owns the top-right. The terrain and every town/
   *  dungeon dot come from a cached bake (see minimap.js); only the
   *  player's own blip is redrawn each frame. */
  drawMinimap(scr) {
    const { w, h } = mapSize(this.map);
    const x = 8, y = 8;
    scr.panel(x - 3, y - 3, MM_W + 6, MM_H + 6, { alpha: 0.9 });
    scr.ctx.drawImage(minimapSprite(this.map), x, y);
    scr.outline(x, y, MM_W, MM_H, 'rgba(0,0,0,0.45)');
    const px = x + Math.round(this.g.x / w * MM_W);
    const py = y + Math.round(this.g.y / h * MM_H);
    const pulse = 0.55 + 0.45 * Math.sin(this.animT * 6);
    scr.ctx.save();
    scr.ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    scr.ctx.fillRect(px - 1, py - 1, 3, 3);
    scr.ctx.restore();
  }

  /** Chart, worked passively rather than as a one-off action: the current
   *  dungeon floor's own layout, in the same corner the overworld minimap
   *  uses (the two never show at once — one is `m.id === 'world'`, this is
   *  `m.dungeonDepth`), plus a marker over every chest still unopened. Nothing
   *  here is hidden behind a fog of war to lift, so the real value is seeing
   *  the whole floor's shape and loot at a glance instead of piecing it
   *  together by walking it — "auto-map the floor and mark unopened chests,"
   *  read literally for a game with no fog to begin with. */
  drawDungeonChart(scr) {
    const m = this.map;
    const rows = m.tiles;
    const w = rows[0].length, h = rows.length;
    const cell = 3;
    const x = 8, y = 8;
    scr.panel(x - 3, y - 3, w * cell + 6, h * cell + 6, { alpha: 0.9 });
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const c = rows[ty][tx];
        const col = c === '#' ? 'rgba(20,22,34,0.9)'
          : c === 's' ? PAL.cyan : c === 'D' ? PAL.accentDim : 'rgba(150,175,235,0.35)';
        scr.rect(x + tx * cell, y + ty * cell, cell, cell, col);
      }
    }
    for (const c of m.chests ?? []) {
      if (this.g.flag(`chest.${c.id}`)) continue;
      scr.rect(x + c.x * cell - 1, y + c.y * cell - 1, cell + 2, cell + 2, PAL.gold);
    }
    if (m.boss && !this.g.flag(`boss.${m.boss.flag}`)) {
      scr.rect(x + m.boss.x * cell - 1, y + m.boss.y * cell - 1, cell + 2, cell + 2, PAL.red);
    }
    const px = x + Math.round(this.g.x * cell + cell / 2) - 1;
    const py = y + Math.round(this.g.y * cell + cell / 2) - 1;
    const pulse = 0.55 + 0.45 * Math.sin(this.animT * 6);
    scr.ctx.save();
    scr.ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    scr.ctx.fillRect(px, py, 2, 2);
    scr.ctx.restore();
  }

  drawBanner(scr) {
    const a = Math.min(1, this.banner / 0.5);
    const name = this.bannerText ?? this.map.name;
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
// 'town' and 'cave' aren't drawn here — their overlay markers (see
// CITY_TOWNS and the cave-marker loop below) own those tiles' whole
// visual, bigger and labelled instead of a 24px prop that'd otherwise
// double up underneath it.
const FEATURE = new Set(['bridge', 'flower', 'well', 'stall', 'lamp']);

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
 *  own sprite is drawn by the backdrop renderer (see syncFieldBillboards);
 *  this just draws the 2D glyph over wherever that sprite projects to. */
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
