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
    chests.push({ x: cx, y: cy, id: `depths${depth}_c${i}`, ...depthLoot(depth) });
  }

  return {
    id: `depths_${depth}`,
    name: `The Shifting Depths — B${depth}`,
    encounter: regionForDepth(depth),
    rate: Math.min(0.2, 0.07 + depth * 0.003),
    dungeonDepth: depth,
    bg: '#0e0c16',
    tiles: grid.map((row) => row.join('')),
    warps: [
      {
        x: DOOR.x, y: DOOR.y,
        to: depth === 1 ? 'depths_entrance' : `depths_${depth - 1}`,
        tx: depth === 1 ? 5 : ENTRY.x, ty: depth === 1 ? 4 : ENTRY.y,
      },
      { x: down.x, y: down.y, to: `depths_${depth + 1}`, tx: ENTRY.x, ty: ENTRY.y },
    ],
    chests,
  };
}
