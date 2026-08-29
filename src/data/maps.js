// ============================================================================
//  MAPS — the overworld, two towns and four dungeon floors.
//
//  Tiles are plain characters so a map is readable as text. `legend` maps each
//  character to a tile sprite and whether it blocks movement.
//
//  Every map declares an `encounter` region (matching a formation region in
//  enemies.js) and a `rate`; towns declare neither, so they are safe.
// ============================================================================

export const LEGEND = {
  '.': { tile: 'grass',    solid: false },
  ',': { tile: 'road',     solid: false },
  'n': { tile: 'sand',     solid: false },
  '~': { tile: 'water',    solid: true, water: true },
  '=': { tile: 'bridge',   solid: false },
  'T': { tile: 'tree',     solid: true },
  '^': { tile: 'mountain', solid: true },
  '#': { tile: 'wall',     solid: true },
  '_': { tile: 'floor',    solid: false },
  'o': { tile: 'town',     solid: false },
  'C': { tile: 'cave',     solid: false },
  's': { tile: 'stairs',   solid: false },
  'H': { tile: 'house',    solid: true },
  'R': { tile: 'roof',     solid: true },
  'D': { tile: 'door',     solid: true },
  'f': { tile: 'flower',   solid: false },
};

export const MAPS = {
  world: {
    id: 'world', name: "The Nine Marches",
    encounter: "greenfield",
    rate: 0.055,
    outdoor: true,
    bg: "#101830",
    tiles: [
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^..^^..^..^^..^..^^.n^..^^..^T.^T..^..^^..^^^',
      '^^^........T........n~~.......TTTTTT^T......^^^^',
      '^^^....TTTTTTTT.....~~.....TTTTT^^^^^^^^.....^^^',
      '^^^^...TTTTTTTTT....~~n....TTTT^^^^^^^^^^^...^^^',
      '^^^^..TTTTTTTTTTT..n~~....TTTT^^^^^.....^^...^^^',
      '^^^..TTTTTTTTTTTTT..~~.....TTT^^^^^.....^^^.^^^^',
      '^^^...TTTTTTTTTTT....~~.....TT^^^^^..C..^^^^^^^^',
      '^^^^..TTTTTTTTT......~~......^^^^^^..,..^^^..^^^',
      '^^^.....TTTTTTT......==n......^^^^^..,..^^^..^^^',
      '^^^......T.T.....C,,,==,,,,,,,,,,,,,,,^^^^...^^^',
      '^^^^.............,..=~..........^^^^^^^^^...^^^^',
      '^^^^.............,..~~n.............^........^^^',
      '^^^..............,.n~~.......................^^^',
      '^^^..............,..==.......................^^^',
      '^^^^.....o,,,,,,,,,,,==,,,,,,,,.............^^^^',
      '^^^.........^^^^^^...~~.......,.............^^^^',
      '^^^.........^^^^^^^..~~n......,..............^^^',
      '^^^^.....^^^^^^^^^^^n~~.n.....,..............^^^',
      '^^^^......^^^^^^^^^.~~.~.n....,..............^^^',
      '^^^........^^^^^^^n~~~~~~~~...,.......T..C..^^^^',
      '^^^......TT...^^...~~~~~~~~~..,....TTTT..,...^^^',
      '^^^^..TTTTTTTT....~~~~~~~~~~~.,....TTTT..,...^^^',
      '^^^.TTTTTTTTTTT..n.~~~~~~~~~.n,...TTTTTTT,T..^^^',
      '^^^TTTTTTTTTTTT...n.~~~~~~~...,..TTTTTTTT,TT^^^^',
      '^^^TTTTTTTTTTTT....n.~~~~..n..,...TTTTTTT,T.^^^^',
      '^^^^TTTTTTTTTTTT....n~~.TT....,...TTTTTTT,T..^^^',
      '^^^..TTTTTTTTT......~~TTTTTT..o,,,,,,,,,,,...^^^',
      '^^^...TTTTTTT....TTT~~TTTTTT.........T.T.....^^^',
      '^^^^....T.T......TTT~~TTTTTT................^^^^',
      '^^^^..^.^..^..^.^.TT~~TTTTTTTTT.^..^..^.^..^.^^^',
      '^^^^^^^^^^^^^^^^^^^TTTTTTTTTTT^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^T^^T^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
    ],
    warps: [
      {"x": 9, "y": 17, "to": "wren", "tx": 12, "ty": 18},
      {"x": 30, "y": 29, "to": "kelda", "tx": 12, "ty": 18},
      {"x": 17, "y": 12, "to": "anvil1", "tx": 18, "ty": 10},
      {"x": 37, "y": 9, "to": "hollow", "tx": 25, "ty": 10},
      {"x": 41, "y": 22, "to": "ruins", "tx": 9, "ty": 14},
    ],
    signs: [
      {"x": 10, "y": 17, "text": "WREN'S FORD - west. THE ANVIL GORGE - north. Travellers are advised to be several people."},
      {"x": 31, "y": 29, "text": "KELDA - here. THE CHOIR RUINS - east. Nobody has come back east with anything but a story."},
    ],
  },

  wren: {
    id: 'wren', name: "Wren's Ford",
    encounter: null,
    rate: 0,
    town: true,
    bg: "#182038",
    tiles: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T..f...................f.T',
      'T..RRRRRR......RRRRRR....T',
      'T..RRRRRR......RRRRRR....T',
      'T..HHDHHH......HHHDHHH...T',
      'T..HHHHHH......HHHHHH....T',
      'T........................T',
      'T,,,,,,,,,,,,,,,,,,,,,,,,T',
      'T........................T',
      'T..RRRRRR......RRRRRR....T',
      'T..RRRRRR......RRRRRR....T',
      'T..HHDHHH......HHHDHHH...T',
      'T..HHHHHH......HHHHHH....T',
      'T........................T',
      'T.....RRRRRR........~~~..T',
      'T.....RRRRRR.......~~~~~.T',
      'T.....HHHDHH.......~~~~..T',
      'T.....HHHHHH.............T',
      'T..........,,......f.....T',
      'TTTTTTTTTTT,,TTTTTTTTTTTTT',
    ],
    warps: [
      {"x": 11, "y": 19, "to": "world", "tx": 9, "ty": 18},
      {"x": 12, "y": 19, "to": "world", "tx": 9, "ty": 18},
    ],
    npcs: [
      {"x": 5, "y": 6, "kind": "shop", "name": "Armsmaster Dell", "shop": "wren_arms", "text": "Iron before ambition. That's the order."},
      {"x": 18, "y": 6, "kind": "shop", "name": "Pedlar Moss", "shop": "wren_items", "text": "Potions, antidotes, and one tent I'd rather not describe."},
      {"x": 5, "y": 13, "kind": "inn", "name": "Innkeeper Rue", "cost": 10, "text": "Ten gold a head. The roof is new."},
      {"x": 18, "y": 13, "kind": "temple", "name": "Sister Yew", "text": "The temple will raise the fallen, and witness a promotion when one is due."},
      {"x": 9, "y": 18, "kind": "guild", "name": "Guildmaster Orrin", "text": "The Guild keeps the rolls. Formation, jobs, the whole ledger of who you are."},
      {"x": 22, "y": 8, "kind": "talk", "name": "Old Fisher", "text": "The wheel turns nine ways and four more nobody counts. Ask a Spiritist about the four."},
      {"x": 2, "y": 8, "kind": "talk", "name": "Boy with a stick", "text": "My brother went to the Gorge. He said the King there used to be a mountain."},
      {"x": 21, "y": 17, "kind": "talk", "name": "Traveller", "text": "Fight in ranks. A spear reaches past the front line; a dagger never will."},
    ],
  },

  kelda: {
    id: 'kelda', name: "Kelda",
    encounter: null,
    rate: 0,
    town: true,
    bg: "#181c30",
    tiles: [
      '^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^..f..................f..^',
      '^..RRRRRR......RRRRRR....^',
      '^..RRRRRR......RRRRRR....^',
      '^..HHDHHH......HHHDHHH...^',
      '^..HHHHHH......HHHHHH....^',
      '^........................^',
      '^,,,,,,,,,,,,,,,,,,,,,,,,^',
      '^........................^',
      '^..RRRRRR......RRRRRR....^',
      '^..RRRRRR......RRRRRR....^',
      '^..HHDHHH......HHHDHHH...^',
      '^..HHHHHH......HHHHHH....^',
      '^........................^',
      '^......RRRRRRRR..........^',
      '^......RRRRRRRR..........^',
      '^......HHDHHHHH..........^',
      '^......HHHHHHHH..........^',
      'T..........,,......f.....T',
      'TTTTTTTTTTT,,TTTTTTTTTTTTT',
    ],
    warps: [
      {"x": 11, "y": 19, "to": "world", "tx": 30, "ty": 30},
      {"x": 12, "y": 19, "to": "world", "tx": 30, "ty": 30},
    ],
    npcs: [
      {"x": 5, "y": 6, "kind": "shop", "name": "Quartermaster Vance", "shop": "kelda_arms", "text": "Everything here has already been somewhere worse."},
      {"x": 18, "y": 6, "kind": "shop", "name": "Alchemist Pell", "shop": "kelda_items", "text": "Flasks. Do not shake them and then ask me questions."},
      {"x": 5, "y": 13, "kind": "inn", "name": "Innkeeper Sabe", "cost": 40, "text": "Forty. We're the last bed before the ruins and we know it."},
      {"x": 18, "y": 13, "kind": "temple", "name": "Brother Cairn", "text": "Kneel, and the ladder will show you where it forks."},
      {"x": 9, "y": 18, "kind": "guild", "name": "Recorder Ish", "text": "Jobs are ranked by use, not by level. Do the work, earn the rank."},
      {"x": 21, "y": 8, "kind": "talk", "name": "Ruin Scholar", "text": "The Choir sings with every voice it has taken. Bring Light, or bring a very large shield."},
      {"x": 2, "y": 13, "kind": "talk", "name": "Retired Lancer", "text": "I stood in the second column for thirty years. Reach is a virtue."},
    ],
  },

  anvil1: {
    id: 'anvil1', name: "The Anvil Gorge",
    encounter: "caverns",
    rate: 0.075,
    bg: "#14101c",
    tiles: [
      '##################################',
      '####################_______#######',
      '##________##########_______#######',
      '##_________________________#######',
      '##________##########_______#######',
      '######_################_##########',
      '######_################_##########',
      '######_########_______#_##########',
      '######_########_______#_#______###',
      '######_########_______#_#______###',
      '###____________________________###',
      '###______######_______###______###',
      '###____________________________###',
      '###______########_################',
      '###______########_################',
      '#################_################',
      '###############____###############',
      '###############____________#######',
      '###############____#####_____#####',
      '########################_____#####',
      '########################_____#####',
      '########################_____#####',
      '##################################',
      '##################################',
    ],
    warps: [
      {"x": 18, "y": 10, "to": "world", "tx": 17, "ty": 13, "exit": true},
      {"x": 26, "y": 20, "to": "anvil2", "tx": 3, "ty": 17, "stairs": true},
    ],
    chests: [
      {"x": 6, "y": 3, "id": "a1c1", "item": "hipotion"},
      {"x": 6, "y": 12, "id": "a1c2", "item": "ironshield"},
      {"x": 17, "y": 17, "id": "a1c3", "gold": 420},
    ],
  },

  anvil2: {
    id: 'anvil2', name: "The Anvil Gorge - Deep",
    encounter: "caverns",
    rate: 0.085,
    bg: "#120e18",
    boss: {"x": 13, "y": 20, "formation": "boss_anvil", "flag": "anvil_king", "intro": "Something the size of a quarry stands up."},
    tiles: [
      '##################################',
      '##################################',
      '#########____#####################',
      '#########____#####################',
      '#########____________________#####',
      '#########____#############_#_#####',
      '##########################_#_#####',
      '##########################_#_#####',
      '##########################_#_#####',
      '##############________####_#_#####',
      '##############_______________#####',
      '##############________####_#_#####',
      '##################_#####_____#####',
      '###__________________________#####',
      '###_##############_#####_____#####',
      '#_____############_#########_#####',
      '#_____############_#########_#####',
      '#_____############_######_______##',
      '#_____############_######_______##',
      '##########_______#_######_______##',
      '##########_________######_______##',
      '##########_______########_______##',
      '##################################',
      '##################################',
    ],
    warps: [
      {"x": 3, "y": 17, "to": "anvil1", "tx": 26, "ty": 20, "stairs": true},
    ],
    chests: [
      {"x": 11, "y": 4, "id": "a2c1", "item": "knightplate"},
      {"x": 28, "y": 19, "id": "a2c2", "item": "mythril"},
    ],
  },

  hollow: {
    id: 'hollow', name: "The Hollow Deep",
    encounter: "caverns",
    rate: 0.07,
    bg: "#101418",
    boss: {"x": 4, "y": 17, "formation": "boss_volk", "flag": "volk", "intro": "A voice from the dark: \"The road is mine. So is everything on it.\""},
    tiles: [
      '####################################',
      '####################################',
      '#____#######################_____###',
      '#____#####_______________________###',
      '#________________________________###',
      '#____#####_______###################',
      '#____#####_______###################',
      '###_######_______###################',
      '###_######_______####________#######',
      '###_#########_#######________#######',
      '###_#########_#######________#######',
      '###_##_____##_#######________#######',
      '###_##_____##_###########_##########',
      '###_##_____##_###########_##########',
      '###_####_####_###########_##########',
      '###_####_####_###########_##########',
      '#________####_###########_##########',
      '#________#______#########_##########',
      '#_______##______#####______#########',
      '##########______#####______#########',
      '##########______#####______#########',
      '##########_________________#########',
      '##########______#####______#########',
      '#####################______#########',
      '####################################',
      '####################################',
    ],
    warps: [
      {"x": 25, "y": 10, "to": "world", "tx": 37, "ty": 10, "exit": true},
    ],
    chests: [
      {"x": 13, "y": 20, "id": "hwc1", "item": "runestaff"},
      {"x": 3, "y": 4, "id": "hwc2", "item": "swiftboots"},
      {"x": 8, "y": 12, "id": "hwc3", "gold": 900},
    ],
  },

  ruins: {
    id: 'ruins', name: "The Choir Ruins",
    encounter: "ruins",
    rate: 0.08,
    bg: "#160f1c",
    boss: {"x": 22, "y": 22, "formation": "boss_choir", "flag": "choir", "intro": "The singing stops. Every voice in it turns to look at you."},
    boss2: {"x": 5, "y": 2, "formation": "boss_aurelith", "flag": "aurelith", "intro": "Gold uncoils from the dark. \"You reached the end of the ladder. Show me.\"", "requires": "choir"},
    tiles: [
      '####################################',
      '##_______###########################',
      '##_______###########_______#########',
      '##_______###########_______#########',
      '#######_######______________########',
      '#######_######_#####________########',
      '####____######_#####________########',
      '####____######_############_########',
      '####____######_############_########',
      '######__######_############_########',
      '######__######_#____#######_########',
      '######__######_#____#######_########',
      '######_________________####_########',
      '######_______#_#____##_________#####',
      '######_______#_#____##_________#####',
      '######_________________________#####',
      '#######_######_#######_________#####',
      '#######_######_#######_________#####',
      '####______####_#######_#############',
      '####______##____######_#############',
      '####______##____######_#############',
      '####______##____####_____###########',
      '####______##_____________###########',
      '####______##____####_____###########',
      '####################################',
      '####################################',
    ],
    warps: [
      {"x": 12, "y": 23, "to": "hollowbetween", "tx": 10, "ty": 11, "stairs": true},
      {"x": 9, "y": 14, "to": "world", "tx": 41, "ty": 23, "exit": true},
    ],
    chests: [
      {"x": 27, "y": 15, "id": "rnc1", "item": "aegisshield"},
      {"x": 14, "y": 21, "id": "rnc2", "item": "shadowgarb"},
      {"x": 18, "y": 12, "id": "rnc3", "item": "elixir"},
      {"x": 7, "y": 21, "id": "rnc4", "gold": 3000},
    ],
  },

  hollowbetween: {
    id: 'hollowbetween', name: 'The Hollow Between',
    encounter: "abyss", rate: 0.085, bg: "#0d0a16",
    tiles: [
      '########################################',
      '############_____##_______####______####',
      '##________##_____##_______####______####',
      '##________##________________________####',
      '##________________________####______####',
      '##________##_____##_______####______####',
      '######_############_______#######_######',
      '######_############_______#######_######',
      '######________########_##########_######',
      '######________########_#####_________###',
      '######________######_____###_________###',
      '######___________________###_________###',
      '######________######_____###_________###',
      '######________######_____#######___#####',
      '######_###############_#########___#####',
      '######_###############_#########___#####',
      '######_############______#######___#####',
      '######_############______#######___#####',
      '#####_________#####______#####________##',
      '#####_________#####______#####________##',
      '#####_________________________________##',
      '#####_________########_#######________##',
      '#####_________########_##########_######',
      '###################_________#####_######',
      '###################_________#####_######',
      '###################_______________######',
      '###################_________############',
      '###################_________############',
      '########################################',
      '########################################',
    ],
    warps: [
      {"x": 10, "y": 11, "to": "ruins", "tx": 9, "ty": 14, "exit": true},
    ],
    chests: [
      {"x": 6, "y": 4, "id": "hbc1", "item": "adamantplate"},
      {"x": 22, "y": 4, "id": "hbc2", "item": "worldstaff"},
      {"x": 33, "y": 3, "id": "hbc3", "item": "phoenixdown"},
      {"x": 14, "y": 3, "id": "hbc4", "gold": 25000},
      {"x": 9, "y": 20, "id": "hbc5", "item": "elixir"},
    ],
    boss: {"x": 32, "y": 11, "formation": "boss_gate", "flag": "gatekeeper", "intro": "Something enormous unfolds from the wall. \"Nobody has been through.\""},
    boss2: {"x": 34, "y": 20, "formation": "boss_worldheart", "flag": "worldheart", "requires": "gatekeeper", "intro": "Every green thing in the world turns to face you at once."},
    boss3: {"x": 23, "y": 25, "formation": "boss_thirteenth", "flag": "thirteenth", "requires": "worldheart", "intro": "\"Nine on the wheel. Four beside it. And then there is me.\""},
  },

};

export const SHOPS = {
  wren_arms: {
    name: "Dell's Arms",
    stock: ['bronzesword', 'handaxe', 'club', 'bronzedagger', 'wraps', 'shortspear',
            'leatherwhip', 'shortbow', 'oakstaff', 'woodshield', 'clothrobe',
            'leatherarmor', 'leathercap'],
  },
  wren_items: {
    name: "Moss's Sundries",
    stock: ['potion', 'antidote', 'eyedrops', 'echoherb', 'tent', 'wingfeather'],
  },
  kelda_arms: {
    name: 'Kelda Quartermaster',
    stock: ['ironsword', 'battleaxe', 'warhammer', 'mainGauche', 'ironclaws', 'halberd',
            'chainwhip', 'longbow', 'runestaff', 'ironshield', 'silkrobe', 'studded',
            'chainmail', 'ironplate', 'ironhelm', 'circlet', 'powerband', 'swiftboots',
            'sagering', 'wardamulet'],
  },
  kelda_items: {
    name: "Pell's Flasks",
    stock: ['potion', 'hipotion', 'ether', 'antidote', 'goldneedle', 'holywater',
            'revivalleaf', 'firebomb', 'frostbomb', 'boltbomb', 'smokebomb', 'tent'],
  },
};

export function getMap(id) {
  const m = MAPS[id];
  if (!m) throw new Error(`unknown map: ${id}`);
  return m;
}

export function tileAt(map, x, y) {
  if (y < 0 || y >= map.tiles.length) return null;
  const row = map.tiles[y];
  if (x < 0 || x >= row.length) return null;
  return LEGEND[row[x]] ?? LEGEND['.'];
}

export function isSolid(map, x, y) {
  const t = tileAt(map, x, y);
  return !t || t.solid;
}

export function mapSize(map) {
  return { w: map.tiles[0].length, h: map.tiles.length };
}

export function warpAt(map, x, y) {
  return (map.warps ?? []).find((wp) => wp.x === x && wp.y === y) ?? null;
}

export function npcAt(map, x, y) {
  return (map.npcs ?? []).find((n) => n.x === x && n.y === y) ?? null;
}

export function chestAt(map, x, y) {
  return (map.chests ?? []).find((c) => c.x === x && c.y === y) ?? null;
}

export function signAt(map, x, y) {
  return (map.signs ?? []).find((s) => s.x === x && s.y === y) ?? null;
}

export const BOSS_SLOTS = ['boss', 'boss2', 'boss3'];

export function bossAt(map, x, y) {
  for (const key of BOSS_SLOTS) {
    const b = map[key];
    if (b && b.x === x && b.y === y) return b;
  }
  return null;
}
