// ============================================================================
//  THE SHIFTING DEPTHS — a Lufia-style bonus dungeon: every floor is rolled
//  fresh (rooms, corridors, chests) rather than hand-authored, and difficulty
//  climbs with depth rather than by region. Nothing here imports data/maps.js
//  — maps.js calls generateDungeonFloor() lazily from getMap() and caches the
//  result, so a floor's layout stays fixed for as long as it stays cached,
//  but two different dives never see the same Floor 1 twice.
//
//  Every floor keeps its up-stairs and entry point at the SAME local tile
//  (2,3 / 3,3) on purpose: it lets one floor's down-stairs hardcode the next
//  floor's arrival point without generating that floor first to find out
//  what it is, and it lets the up-stairs on floor N point at floor N-1's
//  entry without either floor needing to know anything about the other.
// ============================================================================

import { rng } from '../engine/rng.js';

const GW = 26, GH = 18;
const ENTRY = { x: 3, y: 3 };
const DOOR = { x: 2, y: 3 };
// A fixed, non-random room at the top-left corner of every floor — see the
// file header for why its position never varies.
const ENTRY_ROOM = { x: 1, y: 1, w: 4, h: 4 };

/** Regions climb roughly the same ladder the main quest's own bosses do,
 *  repeating the endgame band forever past floor 28 rather than running out
 *  of enemies to draw from. */
function regionForDepth(depth) {
  if (depth <= 3) return 'greenfield';
  if (depth <= 7) return 'caverns';
  if (depth <= 12) return 'ruins';
  if (depth <= 17) return 'cinder';
  if (depth <= 22) return 'drowned';
  if (depth <= 27) return 'glass';
  return 'abyss';
}

/** Chest contents: mostly gold that scales with depth, sometimes an item
 *  drawn from a pool that gets better the deeper the floor. */
function depthLoot(depth) {
  if (rng.chance(0.45)) {
    return { gold: Math.round((70 + depth * 30) * rng.float(0.75, 1.35)) };
  }
  const bands = [
    { max: 5, items: ['potion', 'antidote', 'healherb', 'tent'] },
    { max: 10, items: ['hipotion', 'ether', 'ironore', 'leather', 'silkthread'] },
    { max: 16, items: ['xpotion', 'mythril', 'manaflower', 'goldneedle', 'revivalleaf'] },
    { max: 22, items: ['elixir', 'adamantite', 'spiritglass', 'dragonscale', 'holywater'] },
    { max: Infinity, items: ['voidring', 'quicksilver', 'aeonpendant', 'titanring', 'elixir'] },
  ];
  const pool = bands.find((b) => depth <= b.max).items;
  return { item: rng.pick(pool) };
}

/** Deeper floors start locking and trapping their chests — the Locksmith's
 *  own reason to come down here rather than just carry the rank passively.
 *  A chest can be both at once; a Locksmith clears either without incident,
 *  and everyone else pays the trap's damage but still gets the loot. */
function chestSecurity(depth) {
  const out = {};
  if (rng.chance(Math.min(0.5, 0.05 + depth * 0.015))) out.locked = true;
  if (rng.chance(Math.min(0.4, 0.04 + depth * 0.012))) out.trap = { dmg: Math.round(12 + depth * 3.5) };
  return out;
}

// The one floor in the endless climb that isn't just a harder repeat of
// something you've already beaten — see bossForDepth below.
export const DEPTHS_CAPSTONE_DEPTH = 50;

/** Every 5th floor gets a set-piece fight instead of just tougher trash —
 *  reusing a labyrinth's own floor-5 formation (by depth tier, capped at
 *  the deepest labyrinth once the climb runs past it) rather than
 *  inventing a whole new cast. The flag carries a random suffix rolled
 *  fresh every generation: a labyrinth's own `laby{n}_f5` flag would mark
 *  that labyrinth's real progress complete without ever setting foot in
 *  it, and a fixed flag would only ever fire on a player's very first
 *  visit to this depth, since floors regenerate every dive but flags
 *  never clear. A random one can never collide with either.
 *
 *  DEPTHS_CAPSTONE_DEPTH is the one exception: a purpose-built fight and
 *  drop instead of a reused labyrinth boss, still on the same randomized-
 *  flag/repeatable footing as every other floor here — it's the climb's
 *  destination, not a one-time cutscene. Its flag gets its own `depthscap_`
 *  prefix (still randomized) so field.js can tell the two apart for the
 *  achievement that specifically wants the capstone, not just any floor. */
function bossForDepth(depth) {
  if (depth % 5 !== 0) return null;
  if (depth === DEPTHS_CAPSTONE_DEPTH) {
    return {
      formation: 'depths_capstone',
      flag: `depthscap_${rng.int(0, 999999)}`,
      intro: [
        'The floor here was never random. It was waiting for you to notice.',
        'Something rises out of the dark that has been counting your steps since floor one.',
      ],
    };
  }
  const tier = Math.min(6, Math.ceil(depth / 5));
  return {
    formation: `laby${tier}_f5`,
    flag: `depths_${depth}_${rng.int(0, 999999)}`,
    intro: 'Something down here is not random at all.',
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.w + 1 && a.x + a.w + 1 > b.x && a.y < b.y + b.h + 1 && a.y + a.h + 1 > b.y;
}

function carveRoom(grid, rm) {
  for (let y = rm.y; y < rm.y + rm.h; y++) for (let x = rm.x; x < rm.x + rm.w; x++) grid[y][x] = '_';
}

function carveCorridor(grid, a, b) {
  const ax = a.x + (a.w >> 1), ay = a.y + (a.h >> 1);
  const bx = b.x + (b.w >> 1), by = b.y + (b.h >> 1);
  if (rng.chance(0.5)) {
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) grid[ay][x] = '_';
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) grid[y][bx] = '_';
  } else {
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) grid[y][ax] = '_';
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) grid[by][x] = '_';
  }
}

/** One randomly-laid-out floor, `depth` levels down. */
export function generateDungeonFloor(depth) {
  const grid = Array.from({ length: GH }, () => Array(GW).fill('#'));
  const rooms = [ENTRY_ROOM];
  for (let attempt = 0; attempt < 60 && rooms.length < 9; attempt++) {
    const rw = rng.int(3, 6), rh = rng.int(3, 5);
    const rx = rng.int(1, GW - rw - 1), ry = rng.int(1, GH - rh - 1);
    const cand = { x: rx, y: ry, w: rw, h: rh };
    if (rooms.some((o) => overlaps(cand, o))) continue;
    rooms.push(cand);
  }
  for (const rm of rooms) carveRoom(grid, rm);
  for (let i = 1; i < rooms.length; i++) carveCorridor(grid, rooms[i - 1], rooms[i]);

  const downRoom = rooms[rooms.length - 1];
  const down = { x: downRoom.x + (downRoom.w >> 1), y: downRoom.y + (downRoom.h >> 1) };
  grid[down.y][down.x] = 's';
  grid[DOOR.y][DOOR.x] = 'D';

  const chests = [];
  const lootRooms = rng.shuffle(rooms.slice(1, -1));
  const chestCount = Math.min(lootRooms.length, rng.int(2, 4));
  for (let i = 0; i < chestCount; i++) {
    const rm = lootRooms[i];
    const cx = rng.int(rm.x, rm.x + rm.w - 1), cy = rng.int(rm.y, rm.y + rm.h - 1);
    if (grid[cy][cx] !== '_') continue;
    chests.push({ x: cx, y: cy, id: `depths${depth}_c${i}`, ...depthLoot(depth), ...chestSecurity(depth) });
  }

  const bossInfo = bossForDepth(depth);
  // the entry room's own top-left corner: always floor, and — since every
  // room is at least 3 wide/tall — never the same tile the down-stairs
  // took at the room's center.
  const boss = bossInfo ? { x: downRoom.x, y: downRoom.y, ...bossInfo } : undefined;

  return {
    id: `depths_${depth}`,
    name: `The Shifting Depths — B${depth}`,
    encounter: regionForDepth(depth),
    rate: Math.min(0.2, 0.07 + depth * 0.003),
    dungeonDepth: depth,
    bg: '#0e0c16',
    tiles: grid.map((row) => row.join('')),
    // exit/stairs flags mirror the hand-authored labyrinths' own convention
    // (data/maps.js): the one warp leading back to this dungeon's own
    // "surface" is `exit`, every other floor-to-floor connection is
    // `stairs` — field.js's draw() uses these to label each tile Exit,
    // Up or Down instead of leaving it looking like plain floor.
    warps: [
      {
        x: DOOR.x, y: DOOR.y,
        to: depth === 1 ? 'depths_entrance' : `depths_${depth - 1}`,
        tx: depth === 1 ? 5 : ENTRY.x, ty: depth === 1 ? 4 : ENTRY.y,
        exit: depth === 1,
        stairs: depth !== 1,
      },
      { x: down.x, y: down.y, to: `depths_${depth + 1}`, tx: ENTRY.x, ty: ENTRY.y, stairs: true },
    ],
    chests,
    boss,
  };
}
