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
// FRONT_Z started at 0.5 (a 1.0 gap), then 1.1 (2.2) — still read as too
// close. 1.8 puts a real 3.6-unit no-man's-land between the front ranks,
// over two sprite-widths, without touching rank spacing within a side.
// LANE_STEP went 2.0 -> 2.6 -> 4.4 for the same kind of reason on the other
// axis: each party member's HP/MP/IP card leans sideways out of its own
// cell (see drawUnit), and the middle lane's card reaching out to the side
// was landing on top of the *next lane's own sprite*, not just its card —
// a 2.6 step still put adjacent lanes' actual sprite art (~26px wide)
// closer together than one card's width plus the gap it leans out from.
// 4.4 gives every card room to end before the next lane's sprite begins;
// see drawUnit's cardW for the matching width that was solved alongside it.
const WORLD_LANE_STEP = 4.4, WORLD_RANK_STEP = 1.9, WORLD_FRONT_Z = 1.8;
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
// Widened twice for more room between the two formations (WORLD_FRONT_Z),
// which also pushed the party's own back rank (C) further toward the
// camera each time — by 1.8 it was landing at screen y~229 out of 270,
// leaving less headroom below it than the message strip needs. Zoomed out
// (5.6 -> 6.6) to buy that room back everywhere at once, rather than
// shaving the strip down to fit a shrinking gap. Every other screen-space
// constant below (ground/horizon plane placement) is re-solved for this
// same view size — see their own comments for the numbers.
const BATTLE_VIEW_SIZE = 6.6;

// CELL_W/CELL_H are the nominal 2D box every overlay (HP bars, popups, the
// wheel) is still positioned against — see cellPos/unitPos below for how
// that box now comes from a 3D projection instead of flat pixel math.
const CELL_W = 48, CELL_H = 40;

// Formation labels: rows A/B/C run front-to-back (column 0 = row A = the
// front rank); lanes 1/2/3 run left-to-right (grid.row = lane index). Only
// one unit per lane may act each round — see Battle.actedLane.
const RANK_LABELS = ['A', 'B', 'C'];
const LANE_LABELS = ['1', '2', '3'];

// The message/target/reposition strip used to sit pinned to a fixed
// fraction of screen height ("roughly where the two grids meet"), back
// when that seam was a fixed 2D line. It isn't anymore — the front-rank
// gap is real 3D depth now and has moved (and grown) every time the
// arena's spacing has been tuned since, so a strip anchored to an old
// guessed seam kept drifting into the enemy formation's own HP bars and
// status icons. Docked to the bottom of the screen instead: the party's
// own ground line is always the screen's lowest occupied point (nothing
// this scene draws sits below it — see unitPos/drawUnit), so a strip
// anchored to the bottom edge can never overlap either formation,
// regardless of how the 3D spacing above it changes again later.
const MSG_H = 40, MSG_Y = H - MSG_H - 8;

const MSG_TIME = 0.85;

// Attack animation: a small pull-back, a lunge toward the foe timed to land
// exactly when the hit resolves (so shake/particles/sfx land on the impact
// frame instead of a beat before it), then a settle back to formation.
const ATK_WINDUP = 0.12, ATK_STRIKE = 0.08, ATK_RECOIL = 0.14;

// Which caster-motion archetype an Art's school plays back as — see
// actionVisual/unit3DPos. Anything not listed defaults to 'lunge', the
// original melee weapon-swing motion; these are just the schools whose
// own fiction (drawing a bow, channelling a spell) reads wrong as a lunge.
const SCHOOL_ANIM = {
  bow: 'draw',
  elem: 'cast', dark: 'cast', hex: 'cast', arcane: 'cast', illusion: 'cast',
  summon: 'cast', spirit: 'cast', transcend: 'cast', apex: 'cast',
  white: 'support', holy: 'support', song: 'support', dance: 'support',
};

// A projectile's shape, arc height, flight duration and trail-particle
// drift, keyed by element — see spawnProjectile/drawProjectileHead. Tuned
// so each element reads as itself at a glance (lightning nearly instant
// and jagged, earth a slow heavy lob, ice a thin cold shard) rather than
// thirteen recolours of one glowing dot arcing the same way.
const ELEMENT_FX = {
  fire:      { shape: 'orb',    arc: 10, dur: 0.20, driftY: -16, spread: 8,  drag: 1.2 },
  ice:       { shape: 'shard',  arc: 7,  dur: 0.16, driftY: 0,   spread: 6,  drag: 2.5 },
  nature:    { shape: 'leaf',   arc: 12, dur: 0.22, driftY: -6,  spread: 10, drag: 1.5 },
  earth:     { shape: 'chunk',  arc: 16, dur: 0.28, driftY: 12,  spread: 5,  drag: 1.5 },
  metal:     { shape: 'chunk',  arc: 6,  dur: 0.15, driftY: 0,   spread: 16, drag: 3 },
  lightning: { shape: 'zigzag', arc: 2,  dur: 0.10, driftY: 0,   spread: 30, drag: 4 },
  wind:      { shape: 'leaf',   arc: 13, dur: 0.16, driftY: 0,   spread: 22, drag: 2 },
  poison:    { shape: 'orb',    arc: 13, dur: 0.24, driftY: 8,   spread: 4,  drag: 1.5 },
  water:     { shape: 'drop',   arc: 9,  dur: 0.20, driftY: 10,  spread: 6,  drag: 1.5 },
  light:     { shape: 'ray',    arc: 6,  dur: 0.14, driftY: -12, spread: 10, drag: 1.2 },
  dark:      { shape: 'wisp',   arc: 8,  dur: 0.22, driftY: 0,   spread: 8,  drag: 2 },
  spirit:    { shape: 'wisp',   arc: 8,  dur: 0.22, driftY: -6,  spread: 6,  drag: 1.8 },
  void:      { shape: 'wisp',   arc: 4,  dur: 0.22, driftY: 0,   spread: 12, drag: 2.5 },
};
const DEFAULT_FX = { shape: 'dot', arc: 9, dur: 0.20, driftY: 0, spread: 6, drag: 1.5 };

// A slow drift of colour off any unit carrying a status — see
// updateStatusFx — plus the tint its little icon square draws in (see
// drawUnit). Every status used to share one of two icon colours (bad =
// magenta, good = cyan) and only poison/burn/freeze had any particle at
// all; this covers all of them, so Paralyze doesn't look like Confuse
// doesn't look like Silence.
const STATUS_FX = {
  poison:   { color: '#7ee08a', vy: -14, vy2: 8,  spread: 4,  glow: true,  life: 0.7 },
  burn:     { color: '#ff8a3c', color2: '#ffd24a', vy: -22, vy2: 14, spread: 10, glow: true, life: 0.4 },
  freeze:   { color: '#bfe8ff', vy: -4,  vy2: 0,  spread: 14, glow: true,  life: 0.5, fade: true },
  paralyze: { color: '#fff26a', vy: 0,   vy2: 16, spread: 16, glow: true,  life: 0.22, drag: 3 },
  sleep:    { color: '#b6a8e0', vy: -8,  vy2: 2,  spread: 4,  glow: true,  life: 0.9, fade: true },
  confuse:  { color: '#ff9adf', vy: -6,  vy2: 14, spread: 14, glow: true,  life: 0.5 },
  fear:     { color: '#5a4070', vy: -6,  vy2: 4,  spread: 8,  glow: false, life: 0.6 },
  silence:  { color: '#c8c8d8', vy: -3,  vy2: 2,  spread: 10, glow: false, life: 0.5, fade: true },
  blind:    { color: '#241a1e', vy: -2,  vy2: 4,  spread: 10, glow: false, life: 0.6 },
  slow:     { color: '#8098b0', vy: 4,   vy2: 2,  spread: 6,  glow: false, life: 0.6 },
  curse:    { color: '#7a2c8a', vy: 6,   vy2: 2,  spread: 4,  glow: true,  life: 0.6 },
  doom:     { color: '#c81c2c', vy: -2,  vy2: 2,  spread: 6,  glow: true,  life: 0.35 },
  stone:    { color: '#8a8070', vy: 6,   vy2: 4,  spread: 8,  glow: false, life: 0.4 },
  haste:    { color: '#fff26a', vy: 0,   vy2: 0,  spread: 26, glow: true,  life: 0.18, drag: 4 },
  regen:    { color: '#a0ffb0', vy: -18, vy2: 4,  spread: 6,  glow: true,  life: 0.5 },
  shell:    { color: '#7fc8ff', vy: 0,   vy2: 0,  spread: 12, glow: true,  life: 0.4, fade: true },
  protect:  { color: '#ffb060', vy: 0,   vy2: 0,  spread: 12, glow: true,  life: 0.4, fade: true },
  might:    { color: '#ff5a4a', vy: -6,  vy2: 4,  spread: 8,  glow: true,  life: 0.35 },
  focus:    { color: '#b06aff', vy: -6,  vy2: 4,  spread: 8,  glow: true,  life: 0.35 },
  evade:    { color: '#7ee0ff', vy: 0,   vy2: 0,  spread: 20, glow: true,  life: 0.2, drag: 3 },
  reflect:  { color: '#e8e8f0', vy: 0,   vy2: 0,  spread: 10, glow: true,  life: 0.3 },
  barrier:  { color: '#ffd24a', vy: 0,   vy2: 0,  spread: 10, glow: true,  life: 0.35, fade: true },
  charm:    { color: '#ff8ac8', vy: -8,  vy2: 4,  spread: 8,  glow: true,  life: 0.5 },
};

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
    // occupy — still comfortably past the deepest occupied rank (z ~= -5.6,
    // widened along with WORLD_FRONT_Z above).
    // A flat material colour here read as an empty void once everything
    // around it (sky, risers, characters) had real detail — see
    // groundTexture for the noise-speckled texture that replaces it.
    const groundTex = this.groundTexture(T);
    groundTex.repeat.set(30, 30);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshLambertMaterial({ map: groundTex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 8.7);
    scene.add(ground);

    // Real 3D risers under ranks B and C (rank A stays at ground level) —
    // solid boxes, not another billboard, so the formation reads as
    // standing on an actual stepped platform instead of just being drawn
    // smaller/higher for "depth". Same ground texture (a separate instance,
    // for its own repeat setting — a box's UVs run 0-1 per face regardless
    // of that face's actual size, so it can't share the plane's repeat and
    // still look the same grain size), tinted darker per step via the
    // material's own colour (which multiplies the texture) so the risers
    // read as the ground itself stepping up rather than a different floor.
    const riserWidth = WORLD_LANE_STEP * 3 + 1.2;
    for (const side of ['enemy', 'party']) {
      const sign = side === 'enemy' ? -1 : 1;
      for (let col = 1; col <= 2; col++) {
        const topY = col * RISER_STEP_H;
        const z = sign * (WORLD_FRONT_Z + col * WORLD_RANK_STEP);
        const riserTex = groundTex.clone();
        riserTex.needsUpdate = true;
        riserTex.repeat.set(riserWidth, riserWidth);
        const riser = new THREE.Mesh(
          new THREE.BoxGeometry(riserWidth, topY, WORLD_RANK_STEP * 1.05),
          new THREE.MeshLambertMaterial({ map: riserTex, color: shade('#ffffff', -0.12 * col) }),
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
      // (~23.5 world units at this zoom), not left oversized like the
      // ground plane — an oversized plane here would push most of the
      // horizon texture's width outside the frame, clipping the orb and
      // thinning out the skyline to whatever few peaks happened to land
      // in view.
      new THREE.PlaneGeometry(26, 3.28),
      new THREE.MeshLambertMaterial({
        map: this.horizonTexture(T, this.battle.formation.region ?? 'default'),
        transparent: true, alphaTest: 0.04, fog: false,
      }),
    );
    far.position.set(0, -2.27, -9.5);
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

  /** A small tileable, noise-speckled ground texture — a flat material
   *  colour here read as an empty void once everything around it (sky,
   *  risers, characters) had real detail. Cheap hash-based value noise,
   *  not the overworld's tile-aware groundSprite (that expects a tile
   *  grid with neighbouring materials to blend against; this plane is one
   *  uniform material throughout, so a simpler self-contained generator is
   *  the right tool rather than bending that one to fit). Built once per
   *  battle and shared (via .clone() for a different repeat) between the
   *  ground plane and every riser. */
  groundTexture(T) {
    const size = 64;
    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const ctx = cv.getContext('2d');
    const hash = (x, y) => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      return s - Math.floor(s);
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // a coarse blotchy value (patches of lighter/darker ground) plus a
        // fine per-pixel speckle (individual flecks) layered on top
        const blotch = hash(Math.floor(x / 4), Math.floor(y / 4));
        let color = mix(T.gdark, T.ground, 0.35 + blotch * 0.65);
        const fleck = hash(x + 0.5, y + 0.5);
        if (fleck > 0.965) color = mix(color, '#ffffff', 0.16);
        else if (fleck < 0.035) color = shade(color, -0.35);
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
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
    const w = 142, h = 18;
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
    if (this.attackAnim && this.attackAnim.uid === u.uid) {
      const a = this.attackAnim;
      if (a.anim === 'support') {
        // no foe to close distance with — a gentle rise-and-settle in
        // place reads as channelling a buff/heal instead of the caster
        // just standing inert while the wheel closes
        const k = a.phase === 'windup' ? a.t / ATK_WINDUP
          : a.phase === 'strike' ? 1 : Math.max(0, 1 - a.t / ATK_RECOIL);
        y += Math.sin(k * Math.PI) * 0.12;
      } else if (a.foe) {
        const dir = u.side === 'party' ? -1 : 1;
        let k = 0;
        if (a.anim === 'draw') {
          // pull back to draw/aim, then ease off again — the shot itself
          // is the projectile's job (see ELEMENT_FX), not a forward lunge
          // that would put a bow or a spell in melee range
          if (a.phase === 'windup') k = -(a.t / ATK_WINDUP);
          else if (a.phase === 'strike') k = -(1 - a.t / ATK_STRIKE);
          z += dir * 0.3 * k;
        } else if (a.anim === 'cast') {
          // shorter and slower than a melee lunge, with a small rise —
          // channelling a spell forward, not swinging a weapon
          if (a.phase === 'windup') k = -0.2 * (a.t / ATK_WINDUP);
          else if (a.phase === 'strike') k = -0.2 + 1.2 * (a.t / ATK_STRIKE);
          else k = 1 - (a.t / ATK_RECOIL);
          z += dir * 0.22 * k;
          y += Math.max(0, k) * 0.08;
        } else {
          // 'lunge' — the original melee weapon-swing motion
          if (a.phase === 'windup') k = -0.35 * (a.t / ATK_WINDUP);
          else if (a.phase === 'strike') k = -0.35 + 1.35 * (a.t / ATK_STRIKE);
          else k = 1 - (a.t / ATK_RECOIL);
          z += dir * 0.5 * k;
        }
      }
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
          text: fx.type === 'heal' ? `+${Math.round(fx.amount)}` : `${Math.round(fx.amount)}`, color: col,
          big: !!fx.crit,
        });
        if (fx.type === 'damage') {
          this.flash = fx.crit ? 0.22 : 0.14;
          this.app.screen.addShake(fx.crit ? 9 : 4);
          this.impactBurst(cx, cy + 10, fx.element, col, fx.crit ? 26 : 14, fx.crit ? 130 : 80);
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
          this.impactBurst(p.x + CELL_W / 2 - 4, p.y + CELL_H - 20, fx.element, col, 22, 70);
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
      // a trail along the flight path, drifting per ELEMENT_FX — embers
      // rise behind fire, droplets fall behind water, sparks scatter wide
      // behind lightning, instead of every element leaving the same
      // straight fading dot
      const k = Math.min(1, pr.t / pr.dur);
      const x = pr.x0 + (pr.x1 - pr.x0) * k;
      const y = pr.y0 + (pr.y1 - pr.y0) * k - Math.sin(k * Math.PI) * pr.fx.arc;
      const solid = pr.fx.shape === 'chunk' || pr.fx.shape === 'drop';
      this.fxp.spawn({
        x, y,
        vx: (Math.random() - 0.5) * pr.fx.spread,
        vy: pr.fx.driftY + (Math.random() - 0.5) * pr.fx.spread * 0.5,
        life: 0.16 + Math.random() * 0.08, size: 1, color: pr.color,
        glow: !solid, drag: pr.fx.drag,
      });
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

  /** A slow drift of colour off any unit carrying a status — cheap,
   *  additive, and reuses the same particle language as everything else
   *  in this scene rather than tinting the (cached, shared) sprites.
   *  Shape/colour/drift come from STATUS_FX, covering every status this
   *  game has rather than just the original poison/burn/freeze three. */
  updateStatusFx(dt) {
    this.statusFxT += dt;
    if (this.statusFxT < 0.22) return;
    this.statusFxT = 0;
    for (const u of this.battle.units()) {
      if (!u.alive) continue;
      const p = this.unitPos(u);
      const cx = p.x + CELL_W / 2 - 4, cy = p.y + CELL_H - 16;
      for (const k of Object.keys(u.statuses)) {
        const fx = STATUS_FX[k];
        if (!fx) continue;
        this.fxp.spawn({
          x: cx + (Math.random() - 0.5) * fx.spread,
          y: cy + (Math.random() - 0.5) * fx.spread * 0.5,
          vx: (Math.random() - 0.5) * fx.spread,
          vy: fx.vy - Math.random() * fx.vy2,
          life: fx.life, size: 1,
          color: fx.color2 && Math.random() < 0.5 ? fx.color2 : fx.color,
          glow: fx.glow, fade: fx.fade, drag: fx.drag ?? 0,
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
      const vis = this.actionVisual(unit, action);
      this.attackAnim = { uid: unit.uid, phase: 'windup', t: 0, foe, anim: vis.anim, element: vis.element };
      this.pendingUnit = unit;
      this.pendingAction = action;
      this.state = 'attacking';
      if (foe) this.spawnProjectile(unit, t, vis);
      return;
    }
    this.battle.act(unit, action);
    this.flushLog();
    this.needsAdvance = true;
    this.state = 'messages';
    this.msgT = 0;
  }

  /**
   * What an action should look like: which way the caster's own body moves
   * (see unit3DPos's attackAnim handling) and, if it reaches at range,
   * what its bolt looks like in flight (see spawnProjectile/ELEMENT_FX).
   * `reach >= 9` is this game's own shorthand for "hits from anywhere" (see
   * the how-to-play text), which is exactly the set of things that should
   * read as ranged rather than melee.
   *
   * The caster motion is keyed off the Art's *school* (a handful of
   * archetypes, not one bespoke animation per skill — this game has
   * hundreds of skills across 24 schools, and every sword Art already
   * looks like a different weapon swing because the sprite itself changes;
   * what was missing was Bulwark Arts lunging exactly like High Arcana).
   * Self/ally targets always get 'support' regardless of school, since
   * there's no foe to lunge toward.
   */
  actionVisual(unit, action) {
    if (action.kind === 'attack') {
      const weapon = unit.isPC && unit.ref.equip?.weapon ? getItem(unit.ref.equip.weapon) : null;
      const element = weapon?.element && weapon.element !== 'none' ? weapon.element : null;
      const ranged = unit.stats().reach >= 9;
      return { element, ranged, anim: ranged ? 'draw' : 'lunge' };
    }
    if (action.kind === 'skill') {
      const skill = getSkill(action.skillId);
      const element = unit.isPC ? skillElement(unit.ref, skill)
        : (skill.element === 'attuned' ? unit.element : skill.element);
      const anim = ['self', 'ally', 'allies'].includes(skill.target)
        ? 'support' : (SCHOOL_ANIM[skill.school] ?? 'lunge');
      return { element, ranged: skill.type !== 'phys' || (skill.range ?? 0) >= 9, anim };
    }
    if (action.kind === 'item') {
      const it = getItem(action.itemId);
      const anim = (it.heal || it.healMp || it.cures) ? 'support' : 'lunge';
      return { element: it.element && it.element !== 'none' ? it.element : null, ranged: !!it.damage, anim };
    }
    return { element: null, ranged: false, anim: 'lunge' };
  }

  /** A bolt travelling attacker -> target, timed to arrive right around
   *  when the hit resolves. Purely cosmetic — the fixed windup timer still
   *  drives the actual resolution, so a slow bolt never delays a turn.
   *  Its shape, arc and trail all come from ELEMENT_FX, keyed by the same
   *  element the damage roll itself uses, so a Fire Art actually looks
   *  like fire in flight rather than a recoloured generic dot. */
  spawnProjectile(unit, target, vis) {
    if (!vis.ranged) return;
    const from = this.unitPos(unit), to = this.unitPos(target);
    const el = vis.element ? ELEMENT_BY_ID[vis.element] : null;
    const fx = (vis.element && ELEMENT_FX[vis.element]) || DEFAULT_FX;
    this.projectiles.push({
      x0: from.x + CELL_W / 2 - 8, y0: from.y + CELL_H - 26,
      x1: to.x + CELL_W / 2 - 8, y1: to.y + CELL_H - 26,
      t: 0, dur: fx.dur, color: el?.color ?? PAL.white, color2: el?.color2 ?? '#ffffff',
      fx, seed: Math.random() * 1000,
    });
  }

  /** A damage-impact burst, shaped by the hit's own element (see
   *  ELEMENT_FX) when it has one — fire kicks embers upward, earth throws
   *  heavy debris down and fast, lightning scatters wide, instead of
   *  every element sharing one radial spark spray with only its colour
   *  changed. A physical (non-elemental) hit keeps the plain spark burst
   *  — that generic "impact" read is exactly right for a sword or a fist,
   *  which isn't secretly hiding an element that needs its own look. */
  impactBurst(cx, cy, element, color, count, speed) {
    const fx = element ? ELEMENT_FX[element] : null;
    if (!fx) { this.fxp.burst(cx, cy, color, count, speed); return; }
    const solid = fx.shape === 'chunk' || fx.shape === 'drop';
    const el = ELEMENT_BY_ID[element];
    const n = Math.round(count * (fx.shape === 'zigzag' ? 1.4 : solid ? 0.7 : 1));
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.fxp.spawn({
        x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s + fx.driftY * 0.6,
        ay: solid ? 220 : 100, life: 0.3 + Math.random() * 0.3,
        color: Math.random() < 0.3 ? (el?.color2 ?? color) : color,
        size: Math.random() < 0.25 ? 2 : 1, glow: !solid, drag: fx.drag,
      });
    }
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
    // Tilt-shift the backdrop: sharp across the whole band any character
    // can stand in (enemy back rank down to party back rank), blurred
    // above it (the sky/horizon strip) and in the thin foreground margin
    // below the party's own back rank. Never blurs a character — only the
    // scenery around them — so nothing gameplay-relevant gets harder to
    // read; see Screen.tiltShift.
    scr.tiltShift(this.canvas3D, 35, 218, 2.5);

    this.drawGrid(scr, 'enemy');
    this.drawGrid(scr, 'party');

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

  // Rank letters (A/B/C) and lane numbers (1/2/3) used to float over the
  // live battle grid at all times. Those labels are for the formation-
  // editing UI (see the 'move' state's "lane N row X" readout below) —
  // pinned over the battlefield itself during a normal turn, they were
  // just noise. Removed; the grid still exists, it's just unlabelled now.

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
    if (isActor) {
      // Tinted by the Art's own element while it's actually resolving (not
      // during plain command/target selection, where nothing's been cast
      // yet) — a Fire Art telegraphs amber, not the generic cyan every
      // action used to glow regardless of what it was.
      const animEl = this.attackAnim?.uid === u.uid ? this.attackAnim.element : null;
      const col = animEl ? ELEMENT_BY_ID[animEl]?.color : null;
      scr.light(p.x + CELL_W / 2 - 4, p.y + CELL_H - 6, 22, col ?? 'rgba(92,210,240,0.55)', 0.45);
    }

    // enemy HP pip and status icons
    if (!u.isPC && u.alive) {
      const s = u.stats();
      const showHp = this.g.hasJob('appraiser') || this.battle.revealed;
      if (showHp) scr.bar(p.x + CELL_W / 2 - 18, p.y + CELL_H + 4, 36, 3, u.hp / s.maxHp, PAL.red);
    }
    const st = Object.keys(u.statuses).filter((k) => STATUS[k]);
    st.slice(0, 3).forEach((k, i) => {
      // Its own colour (see STATUS_FX) where one exists, so Paralyze's
      // icon doesn't look like Confuse's — falls back to the old plain
      // bad/good binary only for a status that somehow isn't in the table.
      const col = STATUS_FX[k]?.color ?? (STATUS[k].kind === 'bad' ? PAL.magenta : PAL.cyan);
      scr.rect(p.x + CELL_W / 2 - 10 + i * 7, p.y + 2, 5, 5, col);
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
      // 36, not the old 42 — solved together with WORLD_LANE_STEP above so
      // this card always ends before the next lane's own sprite begins.
      const cardW = 36;
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
      // Packed tighter than the bars' own minimum spacing would need — see
      // WORLD_RANK_STEP: two ranks' cards share a lane's screen column and
      // stack in the gap between their ground lines, which is real but not
      // huge, especially at a closer zoom. Every pixel this card doesn't
      // need is a pixel of margin against the next rank's card.
      scr.text(ch.name.slice(0, 6), cx, cy, isActor ? PAL.accent : PAL.text);
      scr.bar(cx, cy + 8, cardW, 3, ratio, hpColor(ratio));
      scr.bar(cx, cy + 11, cardW, 2, s.maxMp ? ch.mp / s.maxMp : 0, PAL.cyan);
      scr.bar(cx, cy + 13, cardW, 2, ch.ip / 100, PAL.magenta);
      scr.ctx.restore();
    }
  }

  /** A travelling bolt for every ranged or magic action currently in
   *  flight — arc height and head shape come from ELEMENT_FX (see
   *  drawProjectileHead), so a Lightning Art actually zigzags and an
   *  Earth Art actually lobs, not just arrives in a differently-tinted
   *  straight line. */
  drawProjectiles(scr) {
    for (const pr of this.projectiles) {
      const k = Math.min(1, pr.t / pr.dur);
      const x = pr.x0 + (pr.x1 - pr.x0) * k;
      const y = pr.y0 + (pr.y1 - pr.y0) * k - Math.sin(k * Math.PI) * pr.fx.arc;
      this.drawProjectileHead(scr, pr, x, y, k);
    }
  }

  /** Renders one projectile's head in the shape its ELEMENT_FX entry
   *  calls for. Every shape still gets the same soft glow underneath (a
   *  bigger, brighter one for 'ray') so nothing loses the "this is magic"
   *  read the plain dot always had — only the shape drawn on top of it
   *  changes. */
  drawProjectileHead(scr, pr, x, y, k) {
    const { shape } = pr.fx;
    const rx = Math.round(x), ry = Math.round(y);
    if (shape === 'zigzag') {
      // a scatter of bright sparks jittered along the path travelled so
      // far, redrawn fresh every frame — a couple of frames of this on a
      // bolt this short reads as a crackle, not a smooth curve
      scr.light(x, y, 10, pr.color, 0.55);
      for (let i = 0; i < 4; i++) {
        const t = Math.random() * k;
        const jx = Math.round(pr.x0 + (pr.x1 - pr.x0) * t + (Math.random() - 0.5) * 12);
        const jy = Math.round(pr.y0 + (pr.y1 - pr.y0) * t + (Math.random() - 0.5) * 8);
        scr.rect(jx, jy, 1, 2, pr.color2);
      }
      scr.rect(rx - 1, ry - 1, 2, 2, pr.color2);
      return;
    }
    scr.light(x, y, shape === 'ray' ? 13 : 9, pr.color, shape === 'ray' ? 0.75 : 0.6);
    if (shape === 'shard') {
      scr.rect(rx, ry - 2, 1, 5, pr.color2);
      scr.rect(rx - 1, ry, 3, 1, pr.color2);
    } else if (shape === 'chunk') {
      scr.ctx.save();
      scr.ctx.translate(x, y);
      scr.ctx.rotate(pr.t * 9 + pr.seed);
      scr.ctx.fillStyle = pr.color2;
      scr.ctx.fillRect(-2, -2, 4, 4);
      scr.ctx.restore();
    } else if (shape === 'leaf') {
      scr.ctx.save();
      scr.ctx.translate(x, y);
      scr.ctx.rotate(pr.t * 14 + pr.seed);
      scr.ctx.fillStyle = pr.color2;
      scr.ctx.fillRect(-1, -3, 2, 6);
      scr.ctx.restore();
    } else if (shape === 'drop') {
      scr.rect(rx - 1, ry - 2, 2, 3, pr.color2);
      scr.rect(rx, ry + 1, 1, 1, pr.color2);
    } else if (shape === 'wisp') {
      scr.ctx.save();
      scr.ctx.globalAlpha = 0.5;
      scr.rect(rx - 2, ry - 2, 4, 4, pr.color2);
      scr.ctx.restore();
      scr.rect(rx - 1, ry - 1, 2, 2, pr.color);
    } else {
      // 'dot' / 'orb' default
      scr.rect(rx - 1, ry - 1, 2, 2, pr.color2);
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
