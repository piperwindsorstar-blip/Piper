// ============================================================================
//  BATTLE SCENE — draws the two facing 3x3 grids and drives Battle.
//
//  The party sits on the right with column 0 nearest the enemy; the enemy sits
//  on the left with its column 0 nearest the party. Cells are drawn as a real
//  grid so the reach rules are visible rather than implied: when you pick a
//  target, everything out of reach for the chosen action is greyed out.
// ============================================================================

import { PAL, W, H } from '../../engine/screen.js';
import { Menu, CommandWheel, hpColor } from '../../engine/ui.js';
import { actorSprite, monsterSprite } from '../../engine/sprites.js';
import { Particles } from '../../engine/particles.js';
import { Battle, PHASE, gridNeighbors } from '../battle.js';
import { stats, usableSkills, awardExp, refreshPromotion, skillElement } from '../character.js';
import { getSkill, STATUS } from '../../data/skills.js';
import { getItem } from '../../data/items.js';
import { ELEMENT_BY_ID } from '../../data/elements.js';
import { sfx, playMusic } from '../../engine/audio.js';
import { BATTLE_THEME, BOSS_THEME, VICTORY_THEME } from '../../data/music.js';
import { mix, shade } from '../../engine/pixel.js';
import * as THREE from '../../vendor/three.module.js';

// The arena, in world units (roughly metres) rather than pixels: lanes run
// along X, rank depth runs along Z, enemies sit at negative Z and the party
// at positive Z so both front ranks (col 0) face each other across Z=0 —
// the exact same "front ranks meet at a seam" arrangement the 2D grid used,
// now with actual depth instead of a screen-space illusion of it.
// Rank spacing must clear a standing sprite's own height (ACTOR_WORLD_H) or
// consecutive ranks' billboards overlap on screen — the original 1.05 was
// smaller than the 1.7-tall sprite standing on it, which is what made a
// full 9-member party read as one overlapping cluster per lane instead of
// three distinct ranks.
// FRONT_Z was 0.5 (a 1.0 gap between the two front ranks) — barely more
// than a sprite's own width, so the two sides read as one huddled cluster
// instead of a battlefield with a gap in it. 1.1 doubles that gap without
// touching rank spacing within a side.
const WORLD_LANE_STEP = 2.0, WORLD_RANK_STEP = 1.9, WORLD_FRONT_Z = 1.1;
// Each back rank stands a literal step higher than the one in front of it —
// real 3D risers (see setup3D), not just a further/smaller billboard. Under
// this orthographic camera, depth alone was reading fairly flat; an actual
// stepped platform with a lit top and a shaded riser face gives the eye
// something with real volume to confirm the depth with.
const RISER_STEP_H = 0.32;
const ACTOR_WORLD_H = 1.7;   // world height of a standard 48px-tall actor sprite
// Orthographic, not perspective, and for the same reason field.js's camera
// is: fitting every rank of a full 9-a-side battle (front to back, both
// sides) is a wide enough world-Z range that a perspective camera close
// enough to feel "angled" either crops the far side or blows up the near
// one. Orthographic keeps every rank a consistent, fully-visible size —
// the tilt alone still reads as depth (the back ranks sit higher and
// tighter on screen), it just doesn't also scale them down.
const CAM_POS = { x: 0, y: 6, z: 5 };
const CAM_LOOK = { x: 0, y: 0, z: 0 };
const BATTLE_VIEW_SIZE = 5.6;

// CELL_W/CELL_H are the nominal 2D box every overlay (HP bars, popups, the
// wheel) is still positioned against — see cellPos/unitPos below for how
// that box now comes from a 3D projection instead of flat pixel math.
const CELL_W = 48, CELL_H = 40;
const SEAM_TOP = Math.round(H * 0.39);   // roughly where the two grids meet on screen; used to place the message strip

// Formation labels: rows A/B/C run front-to-back (column 0 = row A = the
// front rank); lanes 1/2/3 run left-to-right (grid.row = lane index). Only
// one unit per lane may act each round — see Battle.actedLane.
const RANK_LABELS = ['A', 'B', 'C'];
const LANE_LABELS = ['1', '2', '3'];

// a message/status strip straddling the seam, used for turn narration
const MSG_Y = SEAM_TOP - 11, MSG_H = 40;

const MSG_TIME = 0.85;

// Attack animation: a small pull-back, a lunge toward the foe timed to land
// exactly when the hit resolves (so shake/particles/sfx land on the impact
// frame instead of a beat before it), then a settle back to formation.
const ATK_WINDUP = 0.12, ATK_STRIKE = 0.08, ATK_RECOIL = 0.14;

export class BattleScene {
  constructor(app) { this.app = app; }

  enter(opts) {
    this.g = this.app.game;
    this.opts = opts;
    this.battle = new Battle(this.g.party, opts.formationId, {
      preemptive: opts.preemptive, ambushed: opts.ambushed,
    });
    this.state = 'intro';
    this.t = 0;
    this.msgT = 0;
    this.shownLog = [];
    this.pending = [];
    this.popups = [];
    this.actor = null;
    this.action = null;
    this.targetIndex = 0;
    this.targetPool = [];
    this.moveCursor = { row: 1, col: 0 };
    this.flash = 0;
    this.cmdWheel = new CommandWheel({ cell: 32 });
    this.listMenu = new Menu({ items: [], x: 36, y: 120, cellW: 150, cellH: 13, rows: 7 });
    this.fxp = new Particles(360);
    this.moteTimer = 0;
    this.projectiles = [];
    this.deathAnims = new Map();
    this.statusFxT = 0;
    this.leveledUids = new Set();
    this.result = null;
    this.introDur = 1.1;
    this.introT = this.introDur;
    this.hitPause = 0;
    this.setup3D();
    playMusic(this.battle.isBoss ? 'boss' : 'battle', this.battle.isBoss ? BOSS_THEME : BATTLE_THEME);
    // a small impact as the fight opens: a jolt, a white flash, and both
    // sides slide in from off-screen (see unitPos) instead of just appearing
    this.app.screen.addShake(6);
    this.flash = 0.16;
    sfx.encounter();
    this.flushLog();
  }

  /**
   * Builds the 3D arena once per battle: an offscreen WebGL canvas rendered
   * at the same native 480x270 as the rest of the game (so billboards stay
   * pixel-crisp and the arena reads as part of the same chunky-pixel world,
   * not a smoother layer bolted on top), a region-tinted ground and sky, and
   * a lazily-populated billboard per unit. The render is blitted into the
   * normal 2D framebuffer as the backdrop (see render3D/draw); every other
   * piece of UI in this file — HP bars, popups, the command wheel — is still
   * plain 2D, positioned by projecting each unit's 3D position back to
   * screen space (see project/unitPos), so none of that code had to change.
   */
  setup3D() {
    if (!this.canvas3D) this.canvas3D = document.createElement('canvas');
    this.canvas3D.width = W;
    this.canvas3D.height = H;
    this.renderer3D = new THREE.WebGLRenderer({ canvas: this.canvas3D, antialias: false, alpha: false });
    this.renderer3D.setPixelRatio(1);
    this.renderer3D.setSize(W, H, false);

    const scene = new THREE.Scene();
    this.scene3D = scene;
    const aspect = W / H;
    this.camera3D = new THREE.OrthographicCamera(
      -BATTLE_VIEW_SIZE * aspect, BATTLE_VIEW_SIZE * aspect, BATTLE_VIEW_SIZE, -BATTLE_VIEW_SIZE, 0.1, 60,
    );
    this.camera3D.position.set(CAM_POS.x, CAM_POS.y, CAM_POS.z);
    this.camera3D.lookAt(CAM_LOOK.x, CAM_LOOK.y, CAM_LOOK.z);
    // Orthographic view rays are parallel, so every billboard should face
    // the same fixed direction — back along the camera's look vector — not
    // the direction to the camera's literal position (that's a perspective-
    // camera formula). Using per-unit atan2-to-camera-position here was
    // fine near the centre lane (x ~= CAM_POS.x, angle ~= 0) but blew up
    // for units far off to a side *and* deep in a back rank, where it
    // rotated the billboard nearly edge-on to the camera — the "warped
    // diagonal sliver" units in outer lanes/back ranks were rendering as.
    this.billboardYaw = Math.atan2(CAM_POS.x - CAM_LOOK.x, CAM_POS.z - CAM_LOOK.z);

    const T = this.regionPalette();
    scene.background = this.skyTexture(T);
    scene.fog = new THREE.Fog(T.far, 6, 15);

    const sun = new THREE.DirectionalLight(0xfff2df, 1.9);
    sun.position.set(-3, 6, 4);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(T.grade, 0.6));
    scene.add(new THREE.HemisphereLight(T.sky1, T.gdark, 0.5));

    // This camera looks down at a steep angle, so a ground plane centred on
    // the origin (the old 30x30, z from -15 to 15) actually covers the
    // *entire* screen top to bottom — orthographic projection has no
    // vanishing point to shrink a distant ground into a horizon, so nothing
    // placed further away was ever visible behind it. Pushed forward here so
    // its far edge stops a bit past the back rank instead of at the world
    // origin, opening an actual strip of sky for the horizon plane below to
    // occupy — still comfortably past the deepest occupied rank (z ~= -4.3).
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshLambertMaterial({ color: T.ground }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 9.8);
    scene.add(ground);

    // Real 3D risers under ranks B and C (rank A stays at ground level) —
    // solid boxes, not another billboard, so the formation reads as
    // standing on an actual stepped platform instead of just being drawn
    // smaller/higher for "depth". A directional key light makes the top and
    // front faces of each step shade differently on their own, no extra
    // texture work needed. Colour matches the ground so it reads as the
    // ground itself stepping up, darkened slightly per step so the risers
    // don't just vanish into the floor.
    const riserWidth = WORLD_LANE_STEP * 3 + 1.2;
    for (const side of ['enemy', 'party']) {
      const sign = side === 'enemy' ? -1 : 1;
      for (let col = 1; col <= 2; col++) {
        const topY = col * RISER_STEP_H;
        const z = sign * (WORLD_FRONT_Z + col * WORLD_RANK_STEP);
        const riser = new THREE.Mesh(
          new THREE.BoxGeometry(riserWidth, topY, WORLD_RANK_STEP * 1.05),
          new THREE.MeshLambertMaterial({ color: shade(T.ground, -0.1 * col) }),
        );
        riser.position.set(0, topY / 2, z);
        scene.add(riser);
      }
    }

    // A jagged skyline silhouette plus a glowing focal orb, filling the sky
    // strip the ground pullback above just opened up. Placed by working
    // backward from where it needs to land on screen (see project()'s
    // linear map from world (y,z) to screen y under this camera) rather than
    // by a "natural" world position — fog is disabled here since the plane
    // sits far enough away that the fog range would otherwise wash the
    // whole silhouette out to a flat colour, defeating the point of it.
    const far = new THREE.Mesh(
      // Width matched to the camera's actual visible span at this depth
      // (~19.9 world units), not left oversized like the ground plane —
      // an oversized plane here would push most of the horizon texture's
      // width outside the frame, clipping the orb and thinning out the
      // skyline to whatever few peaks happened to land in view.
      new THREE.PlaneGeometry(22, 2.96),
      new THREE.MeshLambertMaterial({
        map: this.horizonTexture(T, this.battle.formation.region ?? 'default'),
        transparent: true, alphaTest: 0.04, fog: false,
      }),
    );
    far.position.set(0, -3.74, -9.5);
    scene.add(far);

    this.billboards = new Map();
  }

  /** Releases the offscreen WebGL context and every GPU resource this scene
   *  allocated. Every battle builds its own renderer (see setup3D) rather
   *  than sharing one, and the scene stack doesn't call this on its own —
   *  without it, popping back to the field after a fight leaves the old
   *  context and its textures/geometries permanently allocated, unreachable
   *  and un-freeable by ordinary JS garbage collection. A few battles in,
   *  the browser starts forcibly evicting the oldest live WebGL contexts to
   *  stay under its per-page limit, which is what a corrupted/blank battle
   *  backdrop and a steadily slowing game after a while of play were: not
   *  jank, a real resource leak. The app's scene stack calls this whenever
   *  this scene is popped or replaced — see main.js. */
  dispose3D() {
    this.scene3D.traverse((obj) => {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material].filter(Boolean);
      for (const m of mats) { m.map?.dispose(); m.dispose(); }
    });
    this.scene3D.background?.dispose?.();
    this.renderer3D.dispose();
    this.renderer3D.forceContextLoss();
    this.billboards.clear();
  }

  /** The same region -> palette table the old 2D backdrop used, kept as one
   *  source of truth for both the 3D arena's colours and the post-process
   *  grade/vignette/bloom settings applied on top of it. */
  regionPalette() {
    const region = this.battle.formation.region;
    return {
      // zenith: the top-of-sky colour the banded gradient fades up into.
      // horizon: the skyline silhouette's fill (was "far"'s flat colour).
      // mote/moteUp: the ambient drifting particle's colour and whether it
      // rises (fireflies, sparks) or sinks (falling ash) — the one bit of
      // motion that keeps an otherwise-static backdrop from feeling inert.
      // zenith/horizon are deliberately kept a good distance apart in
      // lightness (not just hue) for every region — the horizon plane's
      // visible sliver is dominated by the zenith band (see horizonTexture),
      // so a moody-but-close pair like a near-black zenith over a near-black
      // horizon reads as nothing at all instead of a silhouette against a
      // glow. Darker regions get a *lifted* zenith (a distant glow — magma,
      // moonlight, whatever fits) rather than a darkened horizon, since
      // there's little room left to darken an already-near-black horizon.
      greenfield: { sky1: '#86a2c4', far: '#2c4a34', ground: '#4a7a3e', gdark: '#2f5029', grade: '#a8d0ff', zenith: '#dff0ff', horizon: '#233d29', mote: '#fff3b0', moteUp: true },
      caverns:    { sky1: '#241d34', far: '#1d1628', ground: '#5a5040', gdark: '#332d24', grade: '#7f9ad8', zenith: '#3a3050', horizon: '#0d0815', mote: '#ffb060', moteUp: true },
      ruins:      { sky1: '#3c2450', far: '#241531', ground: '#4e4860', gdark: '#2d2839', grade: '#b088ff', zenith: '#4a2f66', horizon: '#150a1e', mote: '#c9a2ff', moteUp: true },
      abyss:      { sky1: '#241040', far: '#170a28', ground: '#3a2c52', gdark: '#211838', grade: '#a86cff', zenith: '#3a1a5c', horizon: '#0b0616', mote: '#a86cff', moteUp: false },
      boss:       { sky1: '#3a1834', far: '#200f26', ground: '#403050', gdark: '#241a34', grade: '#ff8ad0', zenith: '#4a1530', horizon: '#160810', mote: '#ff5a8a', moteUp: true },
    }[region] ?? { sky1: '#28284a', far: '#1c1c34', ground: '#4a4458', gdark: '#2c2838', grade: '#9ab0e0', zenith: '#33335c', horizon: '#14142a', mote: '#9ab0e0', moteUp: true };
  }

  /** A banded (posterized) vertical sky gradient — a handful of flat colour
   *  steps rather than a smooth 3D-renderer blend, so the sky reads as part
   *  of the same chunky-pixel style as everything else instead of a smooth
   *  gradient bolted behind pixel art. Built once per battle; the palette
   *  never changes mid-fight. */
  skyTexture(T) {
    const BANDS = 6;
    const cv = document.createElement('canvas');
    cv.width = 1; cv.height = BANDS;
    const ctx = cv.getContext('2d');
    for (let i = 0; i < BANDS; i++) {
      ctx.fillStyle = mix(T.zenith, T.sky1, i / (BANDS - 1));
      ctx.fillRect(0, i, 1, 1);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Replaces the old flat-colour "far" plane with a jagged skyline
   *  silhouette plus one glowing focal orb (sun, moon, or something less
   *  friendly for the boss/abyss arenas) — the single biggest thing a
   *  Octopath-style backdrop has that a flat tinted wall doesn't: a place
   *  for the eye to land. The skyline shape is seeded from the region name
   *  so every region reads as a distinct silhouette, but stays identical
   *  across frames within one battle (only rebuilt in setup3D). */
  horizonTexture(T, region) {
    // Match the canvas's aspect ratio to the far plane's actual world
    // width:height (see setup3D) so the orb renders as a circle rather
    // than getting stretched into an ellipse by a mismatched texture.
    const w = 142, h = 20;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');

    const orbX = w * 0.55, orbY = h * 0.3, orbR = h * 0.34;
    const glow = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, orbR * 2.4);
    glow.addColorStop(0, T.grade);
    glow.addColorStop(0.45, mix(T.grade, T.zenith, 0.7));
    glow.addColorStop(1, `${T.zenith}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = mix(T.grade, '#ffffff', 0.55);
    ctx.beginPath(); ctx.arc(orbX, orbY, orbR * 0.5, 0, Math.PI * 2); ctx.fill();

    // tiny deterministic PRNG seeded from the region name, so the skyline
    // is stable across battles in the same region without a shared seed table
    let seed = 0;
    for (let i = 0; i < region.length; i++) seed = (seed * 31 + region.charCodeAt(i)) >>> 0;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

    ctx.fillStyle = T.horizon;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const peaks = 7;
    for (let i = 0; i <= peaks; i++) {
      const x = (w * i) / peaks;
      const y = h * (0.25 + rand() * 0.35);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Ambient drifting motes (fireflies, embers, falling ash depending on
   *  region) — cheap, screen-space, and reuses the same particle pool hit
   *  sparks and heal plumes already draw through, so no new draw call is
   *  needed. The one bit of constant motion that keeps the backdrop from
   *  reading as a static painting. */
  spawnMote() {
    const T = this.regionPalette();
    const dir = T.moteUp ? -1 : 1;
    this.fxp.spawn({
      x: Math.random() * W, y: T.moteUp ? H + 4 : -4,
      vx: (Math.random() - 0.5) * 6, vy: dir * (16 + Math.random() * 14),
      life: 4 + Math.random() * 3, color: T.mote, size: 1, glow: true, fade: true,
    });
  }

  /** Grid slot -> world position, with no per-unit animation offset — used
   *  both as the base for unit3DPos and directly by cellPos for the empty-
   *  cell ground markers. */
  worldBase(side, row, col) {
    const x = (row - 1) * WORLD_LANE_STEP;
    const sign = side === 'enemy' ? -1 : 1;
    const z = sign * (WORLD_FRONT_Z + col * WORLD_RANK_STEP);
    return { x, y: col * RISER_STEP_H, z };
  }

  /** A unit's current 3D position (feet/ground point, not its visual centre)
   *  — the direct 3D translation of the old 2D unitPos's animation offsets:
   *  the intro slide is now a depth slide, the attack lunge moves along Z
   *  toward the opposing side, and death/victory use height instead of a
   *  vertical pixel nudge. */
  unit3DPos(u) {
    const base = this.worldBase(u.side, u.grid.row, u.grid.col);
    let { x, y, z } = base;
    if (this.state === 'intro') {
      const k = (this.introT / this.introDur) ** 2;
      const dir = u.side === 'enemy' ? -1 : 1;
      z += dir * 3.4 * k;
    }
    if (this.attackAnim && this.attackAnim.uid === u.uid && this.attackAnim.foe) {
      const a = this.attackAnim;
      const dir = u.side === 'party' ? -1 : 1;
      let k = 0;
      if (a.phase === 'windup') k = -0.35 * (a.t / ATK_WINDUP);
      else if (a.phase === 'strike') k = -0.35 + 1.35 * (a.t / ATK_STRIKE);
      else k = 1 - (a.t / ATK_RECOIL);
      z += dir * 0.5 * k;
    }
    const dying = this.deathAnims.get(u.uid);
    if (dying) {
      y -= (dying.t / dying.dur) * 0.3;
    } else if (this.state === 'victoryPose' && u.isPC && u.alive) {
      y += Math.abs(Math.sin(this.victoryT * 9 + x * 3)) * 0.18;
    }
    return { x, y, z };
  }

  /** Projects a 3D world point to 2D screen-space pixels in the same
   *  480x270 buffer the rest of this scene draws into. */
  project(world) {
    const v = new THREE.Vector3(world.x, world.y, world.z);
    v.project(this.camera3D);
    return { x: (v.x * 0.5 + 0.5) * W, y: (1 - (v.y * 0.5 + 0.5)) * H };
  }

  /** The sprite canvas a unit should currently show — factored out of the
   *  old drawUnit so both the 3D billboard and (nowhere else, but kept as
   *  one place) any future 2D fallback pick the same frame. */
  spriteFor(u, isActor) {
    if (u.isPC) {
      const ch = u.ref;
      const hurtFrame = ch.hp / stats(ch).maxHp < 0.25 ? 2 : 0;
      const breathe = Math.round(Math.sin(this.t * 2.2 + u.grid.row) * 0.5);
      return actorSprite({
        classId: ch.classId, raceId: ch.raceId, elementId: ch.elementId,
        skin: ch.skin, hair: ch.hair, equip: ch.equip,
        frame: isActor ? 3 : (hurtFrame || (breathe ? 1 : 0)),
      });
    }
    return monsterSprite(u.def.sprite, Math.floor(this.t * 2.5) % 2);
  }

  /** Creates/updates one billboard mesh per living-or-recently-dead unit: a
   *  camera-facing plane (rotated around Y only, so sprites stay upright —
   *  the standard "cylindrical billboard" HD-2D games use) textured with
   *  that unit's current sprite canvas via a CanvasTexture, nearest-filtered
   *  so the pixel art stays crisp instead of smoothing into a blur. */
  syncBillboards() {
    for (const u of this.battle.units()) {
      const isActor = (this.actor?.uid === u.uid && ['command', 'skill', 'item', 'target', 'move'].includes(this.state))
        || this.attackAnim?.uid === u.uid;
      const cv = this.spriteFor(u, isActor);
      let b = this.billboards.get(u.uid);
      if (!b) {
        const tex = new THREE.CanvasTexture(cv);
        // Nearest magnification keeps pixel edges crisp at native size.
        // Plain nearest *minification* (no mipmaps) is what made a shrunk
        // formation look like noisy smudges — one texel per screen pixel,
        // no averaging, so fine pixel-art detail aliases into shimmer.
        // Linear-filtered mipmaps fix that but *blur* the art instead —
        // exactly the "squishy" softness pixel art can't afford. Nearest-
        // filtered mipmaps keep both: each mip level is still a crisp,
        // blocky pixel-art image, just a properly pre-downsampled one, so
        // a shrunk sprite looks like a smaller clean sprite instead of
        // either shimmering noise or a smear.
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestMipmapNearestFilter;
        tex.generateMipmaps = true;
        tex.colorSpace = THREE.SRGBColorSpace;
        // alphaTest just above zero, not 0.5: these sprite canvases bake in
        // their own soft contact shadow (a ~30% alpha ellipse at the feet)
        // and antialiased silhouette edges. A 0.5 cutoff discarded every
        // pixel that faint, so units rendered as flat, edge-aliased cutouts
        // with no shadow grounding them — a hard-edge look this pixel art
        // was never drawn for. A near-zero threshold still discards the
        // fully transparent padding around the sprite (so the billboard's
        // rectangular bounds don't occlude things behind it) while letting
        // every genuinely-drawn pixel blend at its real alpha.
        const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        this.scene3D.add(mesh);
        b = { mesh, tex, mat, canvas: null };
        this.billboards.set(u.uid, b);
      }
      if (b.canvas !== cv) {
        b.canvas = cv;
        b.tex.image = cv;
        b.tex.needsUpdate = true;
        const worldH = u.isPC ? ACTOR_WORLD_H : ACTOR_WORLD_H * (cv.height / 48);
        b.mesh.scale.set(worldH * (cv.width / cv.height), worldH, 1);
      }
      const dying = this.deathAnims.get(u.uid);
      const dim = this.state === 'target' && this.targetSpec && u.side !== this.actor.side
        && !this.battle.inReach(this.actor, u, this.targetSpec.reach ?? this.targetSpec.range ?? 9);
      b.mat.opacity = dying ? 1 - dying.t / dying.dur : (!u.alive ? 0.25 : dim ? 0.4 : 1);

      const pos = this.unit3DPos(u);
      const worldH = b.mesh.scale.y;
      b.mesh.position.set(pos.x, pos.y + worldH / 2, pos.z);
      b.mesh.rotation.y = this.billboardYaw;
    }
  }

  /** Renders the arena to the offscreen WebGL canvas; draw() blits the
   *  result into the 2D framebuffer as this frame's backdrop. */
  render3D() {
    const T = this.regionPalette();
    this.app.screen.setGrade(T.grade, this.battle.formation.region === 'greenfield' ? 0.08 : 0.18);
    this.app.screen.vignette = this.battle.formation.region === 'greenfield' ? 0.48 : 0.68;
    this.app.screen.bloom = this.battle.formation.region === 'greenfield' ? 0.3 : 0.6;
    this.syncBillboards();
    this.renderer3D.render(this.scene3D, this.camera3D);
  }

  flushLog() {
    while (this.battle.log.length > this.shownLog.length) {
      this.pending.push(this.battle.log[this.shownLog.length]);
      this.shownLog.push(this.battle.log[this.shownLog.length]);
    }
    // capture damage popups
    for (const fx of this.battle.fx) {
      const u = this.battle.units().find((x) => x.uid === fx.uid);
      if (fx.type === 'damage' || fx.type === 'heal') {
        if (!u) continue;
        const p = this.unitPos(u);
        const cx = p.x + CELL_W / 2 - 8, cy = p.y + CELL_H - 26;
        const col = fx.type === 'heal' ? PAL.green : (fx.element && fx.element !== 'none'
          ? ELEMENT_BY_ID[fx.element]?.color ?? PAL.white : PAL.white);
        this.popups.push({
          x: cx, y: cy, life: 1.0,
          text: fx.type === 'heal' ? `+${fx.amount}` : `${fx.amount}`, color: col,
          big: !!fx.crit,
        });
        if (fx.type === 'damage') {
          this.flash = fx.crit ? 0.22 : 0.14;
          this.app.screen.addShake(fx.crit ? 9 : 4);
          this.fxp.burst(cx, cy + 10, col, fx.crit ? 26 : 14, fx.crit ? 130 : 80);
          sfx.hit(fx.crit);
          if (fx.crit) this.hitPause = 0.08;
        } else {
          this.fxp.rise(cx, cy + 12, col, 12, 12);
          sfx.heal();
        }
      } else if (fx.type === 'miss') {
        if (u) {
          const p = this.unitPos(u);
          this.popups.push({
            x: p.x + CELL_W / 2 - 8, y: p.y + CELL_H - 26, life: 1.0, text: 'MISS', color: PAL.textDim,
          });
        }
        sfx.miss();
      } else if (fx.type === 'buff') {
        sfx.buff();
      } else if (fx.type === 'debuff') {
        sfx.debuff();
      } else if (fx.type === 'death') {
        if (u) {
          const p = this.unitPos(u);
          const col = ELEMENT_BY_ID[fx.element]?.color ?? PAL.white;
          this.deathAnims.set(fx.uid, { t: 0, dur: 0.55 });
          this.fxp.burst(p.x + CELL_W / 2 - 4, p.y + CELL_H - 20, col, 22, 70);
        }
      }
    }
    this.battle.fx.length = 0;
  }

  // --- layout ----------------------------------------------------------------
  // Both of these keep their old signature and return shape — {x, y} for the
  // top-left of a nominal CELL_W x CELL_H box, ground line at y+CELL_H,
  // horizontal centre at x+CELL_W/2 — so every 2D overlay call site below
  // (HP bars, popups, the wheel, targeting) needed no changes at all. What
  // changed is where that {x, y} comes from: the 3D world position, run
  // through the same camera the arena itself renders with.
  cellPos(side, row, col) {
    const p = this.project(this.worldBase(side, row, col));
    return { x: p.x - CELL_W / 2, y: p.y - CELL_H };
  }

  unitPos(u) {
    const p = this.project(this.unit3DPos(u));
    return { x: p.x - CELL_W / 2, y: p.y - CELL_H };
  }

  // --- update --------------------------------------------------------------
  update(dt, input) {
    if (this.hitPause > 0) {
      this.hitPause = Math.max(0, this.hitPause - dt);
      dt = 0;   // a brief freeze-frame on a critical hit, for punch
    }
    this.t += dt;
    this.moteTimer -= dt;
    if (this.moteTimer <= 0) { this.spawnMote(); this.moteTimer = 0.5 + Math.random() * 0.6; }
    this.fxp.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.cmdWheel.update(dt);
    this.listMenu.update(dt);
    for (const p of this.popups) { p.life -= dt; p.y -= dt * 22; }
    this.popups = this.popups.filter((p) => p.life > 0);
    for (const pr of this.projectiles) {
      pr.t += dt;
      // a faint trail along the flight path
      const k = Math.min(1, pr.t / pr.dur);
      const x = pr.x0 + (pr.x1 - pr.x0) * k;
      const y = pr.y0 + (pr.y1 - pr.y0) * k - Math.sin(k * Math.PI) * 9;
      this.fxp.spawn({ x, y, life: 0.18, size: 1, color: pr.color, glow: true });
    }
    this.projectiles = this.projectiles.filter((pr) => pr.t < pr.dur);
    for (const [uid, d] of this.deathAnims) {
      d.t += dt;
      if (d.t >= d.dur) this.deathAnims.delete(uid);
    }
    this.updateStatusFx(dt);

    if (this.state === 'intro') {
      this.introT -= dt;
      if (this.introT <= 0 || input.tap('confirm')) { this.state = 'messages'; }
      return;
    }

    if (this.state === 'messages') return this.updateMessages(dt, input);
    if (this.state === 'done') return this.updateDone(dt, input);
    if (this.state === 'attacking') return this.updateAttacking(dt);
    if (this.state === 'victoryPose') return this.updateVictoryPose(dt, input);

    switch (this.state) {
      case 'command': return this.updateCommand(input);
      case 'skill': return this.updateSkillList(input);
      case 'item': return this.updateItemList(input);
      case 'target': return this.updateTarget(input);
      case 'move': return this.updateMove(input);
      default: break;
    }
  }

  /** A slow bubble/ember/frost drift off any unit carrying that status —
   *  cheap, additive, and reuses the same particle language as everything
   *  else in this scene rather than tinting the (cached, shared) sprites. */
  updateStatusFx(dt) {
    this.statusFxT += dt;
    if (this.statusFxT < 0.22) return;
    this.statusFxT = 0;
    for (const u of this.battle.units()) {
      if (!u.alive) continue;
      const p = this.unitPos(u);
      const cx = p.x + CELL_W / 2 - 4, cy = p.y + CELL_H - 16;
      if (u.statuses.poison) {
        this.fxp.spawn({
          x: cx + (Math.random() - 0.5) * 10, y: cy, vx: (Math.random() - 0.5) * 4, vy: -14 - Math.random() * 8,
          life: 0.7, color: '#7ee08a', glow: true, size: 1,
        });
      }
      if (u.statuses.burn) {
        this.fxp.spawn({
          x: cx + (Math.random() - 0.5) * 10, y: cy, vx: (Math.random() - 0.5) * 10, vy: -22 - Math.random() * 14,
          life: 0.4, color: Math.random() < 0.5 ? '#ff8a3c' : '#ffd24a', glow: true, size: 1,
        });
      }
      if (u.statuses.freeze) {
        this.fxp.spawn({
          x: cx + (Math.random() - 0.5) * 14, y: cy + (Math.random() - 0.5) * 10, vx: 0, vy: -4,
          life: 0.5, color: '#bfe8ff', glow: true, size: 1, fade: true,
        });
      }
    }
  }

  updateMessages(dt, input) {
    if (this.pending.length) {
      this.msgT += dt;
      if (input.tap('confirm')) this.msgT = MSG_TIME;
      if (this.msgT >= MSG_TIME) { this.pending.shift(); this.msgT = 0; }
      return;
    }
    // messages drained — resolve battle state or hand the turn on
    const b = this.battle;
    b.checkEnd();
    if (b.phase === PHASE.VICTORY || b.phase === PHASE.DEFEAT || b.phase === PHASE.FLED) {
      this.finish();
      return;
    }
    if (this.needsAdvance) { this.needsAdvance = false; b.advance(); this.flushLog(); }
    b.checkEnd();
    if (b.phase === PHASE.VICTORY || b.phase === PHASE.DEFEAT || b.phase === PHASE.FLED) {
      this.finish();
      return;
    }
    if (this.pending.length) return;
    const u = b.current();
    if (!u) { this.needsAdvance = true; return; }
    this.actor = u;
    if (u.isPC) { this.openCommand(); }
    else {
      this.enemyDelay = (this.enemyDelay ?? 0) + dt;
      if (this.enemyDelay > 0.35) {
        this.enemyDelay = 0;
        this.runAction(u, b.enemyAction(u));
      }
    }
  }

  updateAttacking(dt) {
    const a = this.attackAnim;
    a.t += dt;
    if (a.phase === 'windup' && a.t >= ATK_WINDUP) {
      a.phase = 'strike';
      a.t = 0;
      // resolve right on the strike frame, so the hit fx land on the lunge
      this.battle.act(this.pendingUnit, this.pendingAction);
      this.flushLog();
    } else if (a.phase === 'strike' && a.t >= ATK_STRIKE) {
      a.phase = 'recoil';
      a.t = 0;
    } else if (a.phase === 'recoil' && a.t >= ATK_RECOIL) {
      this.attackAnim = null;
      this.pendingUnit = null;
      this.pendingAction = null;
      this.needsAdvance = true;
      this.state = 'messages';
      this.msgT = 0;
    }
  }

  openCommand() {
    const ch = this.actor.ref;
    const skills = usableSkills(ch);
    // A plus of five, Attack at centre where the cursor starts, with Move
    // filling the one corner a cross shape leaves spare.
    this.cmdWheel.setItems([
      { id: 'skill', label: 'Arts', icon: 'book', pos: [1, 0], disabled: skills.length === 0 },
      { id: 'defend', label: 'Guard', icon: 'shield', pos: [0, 1] },
      { id: 'attack', label: 'Attack', icon: 'sword', pos: [1, 1] },
      { id: 'item', label: 'Item', icon: 'bag', pos: [2, 1], disabled: this.g.usableInBattle().length === 0 },
      { id: 'flee', label: 'Flee', icon: 'boot', pos: [1, 2], disabled: this.battle.isBoss },
      { id: 'move', label: 'Move', icon: 'move', pos: [2, 2] },
    ], { defaultId: 'attack' });
    this.state = 'command';
  }

  updateCommand(input) {
    this.cmdWheel.handle(input);
    const confirmed = input.tap('confirm');
    if (confirmed && this.cmdWheel.disabled()) { sfx.error(); return; }
    if (confirmed) {
      sfx.confirm();
      const id = this.cmdWheel.current.id;
      if (id === 'attack') {
        const a = this.actor.stats();
        this.beginTarget({ target: 'one', range: 9 }, (t) => this.perform({ kind: 'attack', target: t }),
          { reach: a.reach });
      } else if (id === 'skill') {
        this.listMenu.setItems(usableSkills(this.actor.ref).map((k) => ({
          label: k.name, id: k.id,
          note: k.ip ? `${k.ip}IP` : (k.mp ? `${k.mp}MP` : '-'),
        })));
        this.state = 'skill';
      } else if (id === 'item') {
        this.listMenu.setItems(this.g.usableInBattle().map((s) => ({
          label: getItem(s.id).name, id: s.id, note: `x${s.count}`,
        })));
        this.state = 'item';
      } else if (id === 'move') {
        this.moveCursor = { ...this.actor.grid };
        this.state = 'move';
      } else if (id === 'defend') {
        this.perform({ kind: 'defend' });
      } else if (id === 'flee') {
        this.perform({ kind: 'flee' });
      }
    }
  }

  updateSkillList(input) {
    this.listMenu.handle(input);
    if (input.tap('cancel')) { sfx.cancel(); this.state = 'command'; return; }
    if (input.tap('confirm') && this.listMenu.length) {
      sfx.confirm();
      const skill = getSkill(this.listMenu.current.id);
      if (['self', 'allies'].includes(skill.target)) {
        this.perform({ kind: 'skill', skillId: skill.id, target: this.actor });
      } else {
        this.beginTarget(skill, (t) => this.perform({ kind: 'skill', skillId: skill.id, target: t }));
      }
    }
  }

  updateItemList(input) {
    this.listMenu.handle(input);
    if (input.tap('cancel')) { sfx.cancel(); this.state = 'command'; return; }
    if (input.tap('confirm') && this.listMenu.length) {
      sfx.confirm();
      const id = this.listMenu.current.id;
      const it = getItem(id);
      const spec = it.target === 'allies' ? { target: 'allies' }
        : it.target === 'row' ? { target: 'row', range: 9 }
          : { target: 'ally', range: 9 };
      if (spec.target === 'allies') {
        this.g.removeItem(id);
        this.perform({ kind: 'item', itemId: id, target: this.actor });
      } else {
        this.beginTarget(spec, (t) => { this.g.removeItem(id); this.perform({ kind: 'item', itemId: id, target: t }); });
      }
    }
  }

  beginTarget(spec, onPick, extra = {}) {
    const b = this.battle;
    let pool = b.validTargets(this.actor, spec);
    if (spec.target === 'ally' || spec.target === 'allies') {
      pool = this.actor.side === 'party' ? this.battle.party : this.battle.enemies;
      pool = pool.filter((u) => u.alive || spec.revives);
    }
    if (!pool.length) { this.state = 'command'; return; }
    this.targetPool = pool;
    this.targetIndex = 0;
    this.targetSpec = { ...spec, ...extra };
    this.onPickTarget = onPick;
    this.state = 'target';
  }

  updateTarget(input) {
    if (input.tap('cancel')) { sfx.cancel(); this.state = 'command'; return; }
    const d = input.dir();
    if (d.x || d.y) {
      const step = (d.x > 0 || d.y > 0) ? 1 : -1;
      this.targetIndex = (this.targetIndex + step + this.targetPool.length) % this.targetPool.length;
      sfx.move();
    }
    if (input.tap('confirm')) {
      sfx.confirm();
      const t = this.targetPool[this.targetIndex];
      const cb = this.onPickTarget;
      this.onPickTarget = null;
      cb(t);
    }
  }

  updateMove(input) {
    // Depth (rank A/B/C) now runs vertically on screen and lanes (1/2/3) run
    // horizontally, so up/down steps the rank and left/right steps the lane
    // — matching what the cursor actually does on the grid, not the engine's
    // internal row/col naming.
    const d = input.dir();
    if (d.y) { this.moveCursor.col = Math.max(0, Math.min(2, this.moveCursor.col + d.y)); sfx.move(); }
    if (d.x) { this.moveCursor.row = Math.max(0, Math.min(2, this.moveCursor.row + d.x)); sfx.move(); }
    if (input.tap('cancel')) { sfx.cancel(); this.state = 'command'; return; }
    if (input.tap('confirm')) {
      sfx.confirm();
      this.perform({ kind: 'move', row: this.moveCursor.row, col: this.moveCursor.col });
    }
  }

  perform(action) { this.runAction(this.actor, action); }

  /**
   * Resolve one action for `unit`. Attack/skill/item actions get a brief
   * windup-strike-recoil animation first (see updateAttacking) so the sprite
   * visibly closes the distance before the hit lands; anything else (guard,
   * move, flee) resolves immediately as it always did.
   */
  runAction(unit, action) {
    if (['attack', 'skill', 'item'].includes(action.kind)) {
      const t = action.target;
      const foe = !!t && t !== unit && t.side !== unit.side;
      this.attackAnim = { uid: unit.uid, phase: 'windup', t: 0, foe };
      this.pendingUnit = unit;
      this.pendingAction = action;
      this.state = 'attacking';
      if (foe) this.spawnProjectile(unit, t, action);
      return;
    }
    this.battle.act(unit, action);
    this.flushLog();
    this.needsAdvance = true;
    this.state = 'messages';
    this.msgT = 0;
  }

  /**
   * What an action should look like closing the distance: a bow shot, a cast
   * spell or a thrown item flies across the field as a coloured bolt; a
   * weapon swing just lands where the lunge already carried the attacker.
   * `reach >= 9` is this game's own shorthand for "hits from anywhere" (see
   * the how-to-play text), which is exactly the set of things that should
   * read as ranged rather than melee.
   */
  actionVisual(unit, action) {
    if (action.kind === 'attack') {
      const weapon = unit.isPC && unit.ref.equip?.weapon ? getItem(unit.ref.equip.weapon) : null;
      const element = weapon?.element && weapon.element !== 'none' ? weapon.element : null;
      return { element, ranged: unit.stats().reach >= 9 };
    }
    if (action.kind === 'skill') {
      const skill = getSkill(action.skillId);
      const element = unit.isPC ? skillElement(unit.ref, skill)
        : (skill.element === 'attuned' ? unit.element : skill.element);
      return { element, ranged: skill.type !== 'phys' || (skill.range ?? 0) >= 9 };
    }
    if (action.kind === 'item') {
      const it = getItem(action.itemId);
      return { element: it.element && it.element !== 'none' ? it.element : null, ranged: !!it.damage };
    }
    return { element: null, ranged: false };
  }

  /** A small bolt travelling attacker -> target, timed to arrive right
   *  around when the hit resolves. Purely cosmetic — the fixed windup timer
   *  still drives the actual resolution, so a slow bolt never delays a turn. */
  spawnProjectile(unit, target, action) {
    const vis = this.actionVisual(unit, action);
    if (!vis.ranged) return;
    const from = this.unitPos(unit), to = this.unitPos(target);
    const color = vis.element ? (ELEMENT_BY_ID[vis.element]?.color ?? PAL.white) : PAL.white;
    this.projectiles.push({
      x0: from.x + CELL_W / 2 - 8, y0: from.y + CELL_H - 26,
      x1: to.x + CELL_W / 2 - 8, y1: to.y + CELL_H - 26,
      t: 0, dur: 0.2, color,
    });
  }

  // --- resolution ----------------------------------------------------------
  finish() {
    if (this.state === 'done' || this.state === 'victoryPose') return;
    const b = this.battle;
    const msgs = [];
    if (b.result === 'victory') {
      playMusic('victory', VICTORY_THEME);
      sfx.victory();
      const spoils = b.spoils();
      msgs.push(`Victory! ${spoils.exp} EXP, ${spoils.gold} gold and ${spoils.lp} LP.`);
      this.g.earn(spoils.gold);
      this.g.lp += spoils.lp;
      for (const id of spoils.items) {
        if (this.g.addItem(id)) msgs.push(`Found ${getItem(id).name}.`);
      }
      const promos = [];
      const leveledRefs = new Set();
      for (const ch of this.g.party) {
        const r = awardExp(ch, spoils.exp);
        if (r.levels) { msgs.push(`${ch.name} reaches level ${ch.level}!`); leveledRefs.add(ch); }
        if (refreshPromotion(ch)) promos.push(ch);
      }
      if (leveledRefs.size) sfx.levelUp();
      this.leveledUids = new Set(b.party.filter((u) => leveledRefs.has(u.ref)).map((u) => u.uid));
      msgs.push(...this.g.jobTickAll(6));
      // record the bestiary
      for (const e of b.enemies) this.g.bestiary[e.def.id] = (this.g.bestiary[e.def.id] ?? 0) + 1;
      if (promos.length) {
        msgs.push(`${promos.map((c) => c.name).join(', ')} ${promos.length > 1 ? 'are' : 'is'} ready for a promotion.`);
      }
      this.readyPromotions = promos.length > 0;
    } else if (b.result === 'fled') {
      sfx.flee();
      msgs.push('Got away.');
    } else if (b.result === 'defeat') {
      sfx.defeat();
    }
    this.result = {
      outcome: b.result,
      bossFlag: this.opts.bossFlag ?? null,
    };
    this.doneMsgs = msgs;
    this.doneIndex = 0;
    if (b.result === 'victory') {
      this.state = 'victoryPose';
      this.victoryT = 0;
      for (const u of b.livingParty()) {
        const p = this.unitPos(u);
        const leveledUp = this.leveledUids.has(u.uid);
        this.fxp.burst(p.x + CELL_W / 2 - 4, p.y + CELL_H - 20,
          ELEMENT_BY_ID[u.element]?.color ?? PAL.gold, leveledUp ? 30 : 14, leveledUp ? 95 : 55);
        if (leveledUp) this.fxp.rise(p.x + CELL_W / 2 - 4, p.y + CELL_H - 30, PAL.gold, 10, 14);
      }
    } else {
      this.state = 'done';
      this.doneT = 0;
    }
  }

  updateVictoryPose(dt, input) {
    this.victoryT += dt;
    if (this.victoryT > 0.7 || input.tap('confirm')) {
      this.state = 'done';
      this.doneT = 0;
    }
  }

  updateDone(dt, input) {
    this.doneT += dt;
    if (this.doneIndex < (this.doneMsgs?.length ?? 0)) {
      if (this.doneT > MSG_TIME || input.tap('confirm')) { this.doneIndex++; this.doneT = 0; }
      return;
    }
    if (this.doneT < 0.35 && !input.tap('confirm')) return;
    this.app.pop(this.result);
    if (this.result.outcome === 'victory' && this.readyPromotions) {
      this.app.push('promotion', { auto: true });
    }
  }

  // --- draw ----------------------------------------------------------------
  draw(scr) {
    const b = this.battle;
    this.render3D();
    scr.ctx.drawImage(this.canvas3D, 0, 0, W, H);

    this.drawGrid(scr, 'enemy');
    this.drawGrid(scr, 'party');
    this.drawGridLabels(scr, 'enemy');
    this.drawGridLabels(scr, 'party');
    this.drawLaneNumbers(scr);

    // units, back column first so front overlaps
    const all = [...b.enemies, ...b.party].sort((a, z) => z.grid.col - a.grid.col);
    for (const u of all) this.drawUnit(scr, u);

    this.drawProjectiles(scr);
    this.fxp.draw(scr);
    for (const p of this.popups) {
      const a = Math.min(1, p.life / 0.35);
      scr.ctx.save();
      scr.ctx.globalAlpha = a;
      const big = p.big ? 16 : (p.text.length <= 4 ? 12 : 8);
      scr.textCenter(p.text, p.x, p.y, p.color, { size: big });
      scr.ctx.restore();
    }

    if (this.flash > 0) scr.fade(this.flash * 1.4, '#ffffff');

    this.drawUi(scr);

    if (this.state === 'intro') {
      const names = [...new Set(b.enemies.map((e) => e.name))].join(', ');
      this.msgBox(scr, `${names} ${b.enemies.length > 1 ? 'block the way!' : 'blocks the way!'}`);
    } else if (this.state === 'victoryPose') {
      this.msgBox(scr, 'Victory!', PAL.gold);
    }
  }

  drawGrid(scr, side) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const { x, y } = this.cellPos(side, row, col);
        const front = col === this.battle.frontColumn(side);
        // an oval of shadow marking the cell, brighter on the reachable
        // front rank so the reach rule is visible at a glance
        const cx = x + CELL_W / 2 - 4, cy = y + CELL_H - 4;
        scr.shade(cx, cy, 17, front ? 0.34 : 0.2);
        if (front) {
          scr.ctx.save();
          scr.ctx.globalAlpha = 0.30;
          scr.rect(cx - 14, cy - 3, 28, 1, '#9db4f0');
          scr.ctx.restore();
        }
        if (this.state === 'move' && side === this.actor?.side
          && this.moveCursor.row === row && this.moveCursor.col === col) {
          scr.outline(x - 2, y + CELL_H - 9, CELL_W - 2, 9, PAL.gold);
        }
      }
    }
  }

  /** Rank letters (A/B/C, front to back) along the outer edge of one side's
   *  grid, so "row A is the front" is something the player can just read
   *  off the field rather than remember. Positioned off the leftmost file's
   *  own projected ground line, so they track the 3D camera automatically. */
  drawGridLabels(scr, side) {
    for (let col = 0; col < 3; col++) {
      const p = this.cellPos(side, 0, col);
      scr.textCenter(RANK_LABELS[col], p.x + CELL_W / 2 - 44, p.y + CELL_H / 2 - 4, PAL.textFaint);
    }
  }

  /** Lane numbers (1/2/3, left to right) at the seam between the two grids —
   *  a lane already used this round dims out, since only one unit per lane
   *  may act per round (Battle.actedLane). Shown for the party's own lanes,
   *  which is the discipline a player actually has to plan around. The seam
   *  y is the midpoint between each side's own projected front rank, so it
   *  tracks the 3D camera rather than assuming a fixed horizon line. */
  drawLaneNumbers(scr) {
    const b = this.battle;
    for (let lane = 0; lane < 3; lane++) {
      const enemyFront = this.cellPos('enemy', lane, 0).y + CELL_H;
      const partyFront = this.cellPos('party', lane, 0).y + CELL_H;
      const fx = this.cellPos('party', lane, 0).x + CELL_W / 2;
      const locked = b.actedLane.party.has(lane);
      scr.textCenter(LANE_LABELS[lane], fx, (enemyFront + partyFront) / 2, locked ? PAL.textFaint : PAL.accent);
    }
  }

  drawUnit(scr, u) {
    const p = this.unitPos(u);
    const isTarget = this.state === 'target' && this.targetPool[this.targetIndex]?.uid === u.uid;
    const isActor = (this.actor?.uid === u.uid && ['command', 'skill', 'item', 'target', 'move'].includes(this.state))
      || this.attackAnim?.uid === u.uid;

    // a boss winding up telegraphs the coming hit with a pulsing red glow and
    // a warning glyph, so a big attack reads as threat before it lands, not
    // just as a number after the fact
    if (this.attackAnim?.uid === u.uid && this.attackAnim.phase === 'windup' && !u.isPC && u.def?.ai === 'boss') {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 26);
      scr.light(p.x + CELL_W / 2 - 4, p.y + CELL_H - 12, 26 + pulse * 6, 'rgba(255,60,70,0.6)', 0.4 + pulse * 0.3);
      scr.textCenter('!', p.x + CELL_W / 2 - 4, p.y - 10, PAL.red, { size: 12 });
    }

    // the sprite itself is a 3D billboard now (see syncBillboards) — this
    // function only draws the 2D overlays (HP, status, popups, glows) at
    // that same billboard's projected screen position.

    if (this.state === 'victoryPose' && u.alive && this.leveledUids.has(u.uid)) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 12);
      scr.light(p.x + CELL_W / 2 - 4, p.y + CELL_H - 18, 24 + pulse * 4, 'rgba(240,200,80,0.55)', 0.45 + pulse * 0.25);
      scr.textCenter('LEVEL UP!', p.x + CELL_W / 2 - 4, p.y - 14, PAL.gold, { size: 8 });
    }

    if (isTarget) {
      const bob = Math.round(Math.sin(this.t * 8) * 2);
      scr.light(p.x + CELL_W / 2 - 4, p.y + CELL_H - 6, 22, 'rgba(240,180,76,0.55)', 0.5);
      scr.text('▼', p.x + CELL_W / 2 - 6, p.y - 6 + bob, PAL.accent);
    }
    if (isActor) scr.light(p.x + CELL_W / 2 - 4, p.y + CELL_H - 6, 22, 'rgba(92,210,240,0.55)', 0.45);

    // enemy HP pip and status icons
    if (!u.isPC && u.alive) {
      const s = u.stats();
      const showHp = this.g.hasJob('appraiser') || this.battle.revealed;
      if (showHp) scr.bar(p.x + CELL_W / 2 - 18, p.y + CELL_H + 4, 36, 3, u.hp / s.maxHp, PAL.red);
    }
    const st = Object.keys(u.statuses).filter((k) => STATUS[k]);
    st.slice(0, 3).forEach((k, i) => {
      scr.rect(p.x + CELL_W / 2 - 10 + i * 7, p.y + 2, 5, 5, STATUS[k].kind === 'bad' ? PAL.magenta : PAL.cyan);
    });

    // party stat card: name, HP, MP and IP, pinned beside each member's own
    // sprite (leaning outward, away from the centre file, so it never runs
    // off the side of the screen) — replaces the old side roster panel, so
    // the numbers that matter live wherever that character is standing,
    // not off in a corner the player has to glance away to read.
    if (u.isPC) {
      const ch = u.ref;
      const s = u.stats();
      const ratio = ch.hp / s.maxHp;
      const outward = u.grid.row < 1 ? -1 : 1;
      const cardW = 42;
      const cx = outward > 0 ? p.x + CELL_W + 8 : p.x - 8 - cardW;
      const cy = p.y + CELL_H - 32;
      scr.ctx.save();
      if (!u.alive) scr.ctx.globalAlpha = 0.4;
      // a grid-adjacent ally shares a fraction of its own element bias with
      // this unit — a thin tint names which element is currently helping
      const boosters = gridNeighbors(u, this.battle);
      if (boosters.length) {
        scr.rect(cx, cy - 2, cardW, 2, ELEMENT_BY_ID[boosters[0].element]?.color ?? PAL.accent);
      }
      scr.text(ch.name.slice(0, 7), cx, cy, isActor ? PAL.accent : PAL.text);
      scr.bar(cx, cy + 9, cardW, 3, ratio, hpColor(ratio));
      scr.bar(cx, cy + 13, cardW, 2, s.maxMp ? ch.mp / s.maxMp : 0, PAL.cyan);
      scr.bar(cx, cy + 16, cardW, 2, ch.ip / 100, PAL.magenta);
      scr.ctx.restore();
    }
  }

  /** A travelling bolt — an arced streak with a bright glowing head — for
   *  every ranged or magic action currently in flight. */
  drawProjectiles(scr) {
    for (const pr of this.projectiles) {
      const k = Math.min(1, pr.t / pr.dur);
      const x = pr.x0 + (pr.x1 - pr.x0) * k;
      const y = pr.y0 + (pr.y1 - pr.y0) * k - Math.sin(k * Math.PI) * 9;
      scr.light(x, y, 9, pr.color, 0.6);
      scr.rect(Math.round(x) - 1, Math.round(y) - 1, 2, 2, '#ffffff');
    }
  }

  /** A message strip straddling the seam; used by every transient line. */
  msgBox(scr, text, color = PAL.text) {
    scr.panel(12, MSG_Y, W - 24, MSG_H, { accent: true, accentWidth: 22 });
    scr.textWrap(text, 24, MSG_Y + 11, W - 48, color, { maxLines: 2, lineHeight: 12 });
  }

  /**
   * Where the command wheel should sit for whoever is acting: right beside
   * their own sprite, on whichever side of it has room, clamped so it never
   * runs off the edge of the screen. `size` is the wheel's full width/height
   * (three cells square) at the cell size the caller is about to draw it at.
   */
  wheelPosNearActor(size) {
    const p = this.unitPos(this.actor);
    const cx = p.x + CELL_W / 2, cy = p.y + CELL_H / 2;
    let x = cx + 26;
    if (x + size > W - 6) x = cx - 26 - size;
    x = Math.max(6, Math.min(W - 6 - size, x));
    let y = cy - size / 2;
    y = Math.max(6, Math.min(H - 6 - size, y));
    return { x, y };
  }

  drawUi(scr) {
    if (this.state === 'messages' && this.pending.length) {
      this.msgBox(scr, this.pending[0]);
      return;
    }
    if (this.state === 'done') {
      const msg = this.doneMsgs?.[this.doneIndex] ??
        (this.result?.outcome === 'defeat' ? 'The party has fallen...' : 'Press Z.');
      this.msgBox(scr, msg, this.result?.outcome === 'defeat' ? PAL.red : PAL.gold);
      return;
    }

    // The compact, non-interactive wheel shown during target/move selection —
    // just enough to remember what was chosen. The active picker below is a
    // different, bigger rendering entirely, not this box made bigger.
    const cmdBox = () => {
      const cell = 15, size = cell * 3;
      const { x, y } = this.wheelPosNearActor(size);
      scr.panel(x - 6, y - 18, size + 12, size + 24);
      scr.text(this.actor?.name ?? '', x - 2, y - 12, PAL.textDim);
      this.cmdWheel.cell = cell;
      this.cmdWheel.x = x;
      this.cmdWheel.y = y;
      this.cmdWheel.draw(scr, { inactive: true });
    };

    if (this.state === 'command') {
      // The wheel opens right beside whoever's turn it is, at a noticeably
      // bigger size than the reminder box above — this is the picker a
      // player actually spends time reading, so it gets the room.
      const cell = 32, size = cell * 3;
      const { x, y } = this.wheelPosNearActor(size);
      const ch = this.actor.ref;
      scr.panel(x - 8, y - 24, size + 16, size + 34, { accent: true });
      scr.text(this.actor.name, x - 2, y - 18, PAL.accent);
      scr.textRight(ELEMENT_BY_ID[ch.elementId].name, x + size + 6, y - 18, ELEMENT_BY_ID[ch.elementId].color);
      scr.textRight(this.cmdWheel.current?.label ?? '', x + size + 6, y - 6, PAL.text);
      this.cmdWheel.cell = cell;
      this.cmdWheel.x = x;
      this.cmdWheel.y = y;
      this.cmdWheel.draw(scr);
      scr.textCenter('Z select · X back', x + size / 2, y + size + 10, PAL.textFaint);
    } else if (this.state === 'skill' || this.state === 'item') {
      scr.panel(12, 90, 208, 152, { accent: true });
      scr.heading(this.state === 'skill' ? 'ARTS' : 'ITEMS', 26, 100, 180);
      scr.textRight(this.actor.name, 208, 100, PAL.textDim);
      this.listMenu.x = 36; this.listMenu.y = 118;
      this.listMenu.cellW = 172; this.listMenu.rows = 8; this.listMenu.cellH = 14;
      this.listMenu.draw(scr);
      if (this.listMenu.length) {
        scr.panel(228, 90, W - 240, 92, { accent: true });
        const bx = 242, bw = W - 268;
        if (this.state === 'skill') {
          const k = getSkill(this.listMenu.current.id);
          scr.text(k.name, bx, 100, PAL.accent);
          scr.rect(bx, 110, bw, 1, PAL.line);
          scr.textWrap(k.blurb ?? '', bx, 118, bw, PAL.textDim, { lineHeight: 11, maxLines: 3 });
          const el = k.element === 'attuned' ? this.actor.ref.elementId : k.element;
          scr.text(`reach ${k.range}`, bx, 156, PAL.text);
          scr.text(k.target, bx + 76, 156, PAL.text);
          if (el && el !== 'none') scr.textRight(ELEMENT_BY_ID[el].name, bx + bw, 156, ELEMENT_BY_ID[el].color);
        } else {
          const it = getItem(this.listMenu.current.id);
          scr.text(it.name, bx, 100, PAL.accent);
          scr.rect(bx, 110, bw, 1, PAL.line);
          const d = it.heal ? `Restores ${it.heal} HP.` : it.healMp ? `Restores ${it.healMp} MP.`
            : it.cures ? `Cures ${it.cures.join(', ')}.` : it.damage ? `${it.damage} damage.` : '';
          scr.textWrap(d, bx, 118, bw, PAL.textDim, { lineHeight: 11, maxLines: 3 });
        }
      }
    } else if (this.state === 'target') {
      const t = this.targetPool[this.targetIndex];
      scr.panel(12, MSG_Y, W - 24, MSG_H, { accent: true, accentWidth: 22 });
      scr.text('CHOOSE A TARGET', 24, MSG_Y + 9, PAL.accent);
      if (t) {
        scr.text(this.battle.label(t), 24, MSG_Y + 24, PAL.text);
        if (t.element && t.element !== 'none') {
          scr.rect(152, MSG_Y + 25, 4, 6, ELEMENT_BY_ID[t.element].color);
          scr.text(ELEMENT_BY_ID[t.element].name, 160, MSG_Y + 24, ELEMENT_BY_ID[t.element].color);
        }
        if (t.side !== this.actor.side) {
          const dist = this.battle.distance(this.actor, t);
          const reach = this.targetSpec.reach ?? this.targetSpec.range ?? 9;
          const ok = dist <= reach;
          scr.textRight(ok ? `range ${dist} / reach ${reach}`
            : `range ${dist} / reach ${reach} — half damage`,
            W - 24, MSG_Y + 24, ok ? PAL.green : PAL.red);
        }
      }
      cmdBox();
    } else if (this.state === 'move') {
      scr.panel(12, MSG_Y, W - 24, MSG_H, { accent: true, accentWidth: 22 });
      scr.text('REPOSITION', 24, MSG_Y + 9, PAL.accent);
      scr.text('Row A is the front rank: it reaches, and it is reached.', 24, MSG_Y + 24, PAL.textDim);
      scr.textRight(`lane ${LANE_LABELS[this.moveCursor.row]}   row ${RANK_LABELS[this.moveCursor.col]}`, W - 24, MSG_Y + 24, PAL.text);
      cmdBox();
    }
  }
}
