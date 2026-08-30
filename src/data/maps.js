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
  'O': { tile: 'roofdome', solid: true },
  'D': { tile: 'door',     solid: false },
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
      '^^^...TTTTTTTTTTT....~~.....TT^^^^^o.C..^^^^^^^^',
      '^^^^..TTTTTTTTT......~~......^^^^^^..,..^^^..^^^',
      '^^^.....TTTTTTT......==n......^^^^^..,..^^^..^^^',
      '^^^......T.T...o.C,,,==,,,,,,,,,,,,,,,^^^^...^^^',
      '^^^^.............,..=~..........^^^^^^^^^...^^^^',
      '^^^^.............,..~~n.............^........^^^',
      '^^^..............,.n~~.......................^^^',
      '^^^..............,..==.......................^^^',
      '^^^^.....o,,,,,,,,,,,==,,,,,,,,.............^^^^',
      '^^^.........^^^^^^...~~.......,.....o.......^^^^',
      '^^^.........^^^^^^^..~~n......,..............^^^',
      '^^^^.....^^^^^^^^^^^n~~.n.....,..............^^^',
      '^^^^......^^^^^^^^^.~~.~.n....,..............^^^',
      '^^^........^^^^^^^n~~~~~~~~...,.......To.C..^^^^',
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
      {"x": 35, "y": 9, "to": "millhollow", "tx": 7, "ty": 8},
      {"x": 15, "y": 12, "to": "ashquarry", "tx": 7, "ty": 8},
      {"x": 36, "y": 17, "to": "farview", "tx": 7, "ty": 8},
      {"x": 39, "y": 22, "to": "valesend", "tx": 7, "ty": 8},
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
      'T..HHHHHH......HHHHHHH...T',
      'T..HHDHHH......HHHDHH....T',
      'T........................T',
      'T,,,,,,,,,,,,,,,,,,,,,,,,T',
      'T........................T',
      'T..RRRRRR......RRRRRR....T',
      'T..RRRRRR......RRRRRR....T',
      'T..HHHHHH......HHHHHHH...T',
      'T..HHDHHH......HHHDHH....T',
      'T........................T',
      'T.....RRRRRR........~~~..T',
      'T.....RRRRRR.......~~~~~.T',
      'T.....HHHHHH.......~~~~..T',
      'T.....HHHDHH.............T',
      'T..........,,......f.....T',
      'TTTTTTTTTTT,,TTTTTTTTTTTTT',
    ],
    warps: [
      {"x": 11, "y": 19, "to": "world", "tx": 9, "ty": 18},
      {"x": 12, "y": 19, "to": "world", "tx": 9, "ty": 18},
      {"x": 5, "y": 5, "to": "wren_smithy", "tx": 4, "ty": 4},
      {"x": 18, "y": 5, "to": "wren_pedlar", "tx": 4, "ty": 4},
      {"x": 5, "y": 12, "to": "wren_inn", "tx": 4, "ty": 4},
      {"x": 18, "y": 12, "to": "wren_temple", "tx": 4, "ty": 4},
      {"x": 9, "y": 17, "to": "wren_guildhall", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 22, "y": 8, "kind": "talk", "name": "Old Fisher",
        "text": "The wheel turns nine ways and four more nobody counts. Ask a Spiritist about the four.",
        "reactions": { "thirteenth": "Well. Now we all count the four. I don't know if that's better." }},
      {"x": 2, "y": 8, "kind": "talk", "name": "Boy with a stick",
        "text": "My brother went to the Gorge. He said the King there used to be a mountain.",
        "reactions": { "anvil_king": "That was my brother's mountain. You brought it down. He can come home now." }},
      {"x": 21, "y": 17, "kind": "talk", "name": "Traveller",
        "text": "Fight in ranks. A spear reaches past the front line; a dagger never will.",
        "reactions": { "volk": "Heard the road's clear past the Hollow now. First good news out of there in years." }},
      {"x": 12, "y": 6, "kind": "recruit", "id": "fenn", "name": "Fenn",
        "hook": "I've watched the Hollow road longer than anyone still breathing. Point me at whatever you're hunting.",
        "text": "Still with you. Still watching the road, just a longer one now.",
        "recruit": { "name": "Fenn", "classId": "thief", "raceId": "lupine", "elementId": "wind", "jobId": "scout" }},
    ],
  },

  // Five enterable interiors for Wren's Ford's five buildings, all sharing
  // one small room template (see the identical `tiles` shape) — walk onto
  // the door tile from outside to warp in, walk onto it again from inside
  // to warp back out one step clear of the door.
  wren_smithy: {
    id: 'wren_smithy', name: "Armsmaster Dell's",
    encounter: null, rate: 0, bg: "#182038",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "wren", "tx": 5, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Armsmaster Dell", "shop": "wren_arms", "text": "Iron before ambition. That's the order."},
    ],
  },
  wren_pedlar: {
    id: 'wren_pedlar', name: "Pedlar Moss's",
    encounter: null, rate: 0, bg: "#182038",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "wren", "tx": 18, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Pedlar Moss", "shop": "wren_items", "text": "Potions, antidotes, and one tent I'd rather not describe."},
    ],
  },
  wren_inn: {
    id: 'wren_inn', name: "The Ford Inn",
    encounter: null, rate: 0, bg: "#182038",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "wren", "tx": 5, "ty": 13}],
    npcs: [
      {"x": 4, "y": 2, "kind": "inn", "name": "Innkeeper Rue", "cost": 10, "text": "Ten gold a head. The roof is new."},
    ],
  },
  wren_temple: {
    id: 'wren_temple', name: "Wren's Ford Temple",
    encounter: null, rate: 0, bg: "#182038",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "wren", "tx": 18, "ty": 13}],
    npcs: [
      {"x": 4, "y": 2, "kind": "temple", "name": "Sister Yew", "text": "The temple will raise the fallen, and witness a promotion when one is due."},
    ],
  },
  wren_guildhall: {
    id: 'wren_guildhall', name: "Wren's Ford Guildhall",
    encounter: null, rate: 0, bg: "#182038",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "wren", "tx": 9, "ty": 18}],
    npcs: [
      {"x": 4, "y": 2, "kind": "guild", "name": "Guildmaster Orrin", "text": "The Guild keeps the rolls. Formation, jobs, the whole ledger of who you are."},
    ],
  },

  kelda: {
    id: 'kelda', name: "Kelda",
    encounter: null,
    rate: 0,
    town: true,
    theme: 'desert',
    bg: "#302418",
    tiles: [
      '^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^..f..................f..^',
      '^..RRRRRR......RRRRRR....^',
      '^..RRRRRR......RRRRRR....^',
      '^..HHHHHH......HHHHHHH...^',
      '^..HHDHHH......HHHDHH....^',
      '^........................^',
      '^,,,,,,,,,,,,,,,,,,,,,,,,^',
      '^........................^',
      '^..RRRRRR......RRRRRR....^',
      '^..RRRRRR......RRRRRR....^',
      '^..HHHHHH......HHHHHHH...^',
      '^..HHDHHH......HHHDHH....^',
      '^.........O..............^',
      // the guild hall keeps a watchtower — a domed column rising a row above
      // the ridgeline, standing in for one of the roof's own tiles
      '^......RRRORRRR..........^',
      '^......RRRORRRR..........^',
      '^......HHHHHHHH..........^',
      '^......HHDHHHHH..........^',
      'T..........,,......f.....T',
      'TTTTTTTTTTT,,TTTTTTTTTTTTT',
    ],
    warps: [
      {"x": 11, "y": 19, "to": "world", "tx": 30, "ty": 30},
      {"x": 12, "y": 19, "to": "world", "tx": 30, "ty": 30},
      {"x": 5, "y": 5, "to": "kelda_smithy", "tx": 4, "ty": 4},
      {"x": 18, "y": 5, "to": "kelda_pedlar", "tx": 4, "ty": 4},
      {"x": 5, "y": 12, "to": "kelda_inn", "tx": 4, "ty": 4},
      {"x": 18, "y": 12, "to": "kelda_temple", "tx": 4, "ty": 4},
      {"x": 9, "y": 17, "to": "kelda_guildhall", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 21, "y": 8, "kind": "talk", "name": "Ruin Scholar",
        "text": "The Choir sings with every voice it has taken. Bring Light, or bring a very large shield.",
        "reactions": { "choir": "The Choir's gone quiet. I keep waiting for it to start again. It hasn't." }},
      {"x": 2, "y": 13, "kind": "talk", "name": "Retired Lancer",
        "text": "I stood in the second column for thirty years. Reach is a virtue.",
        "reactions": { "aurelith": "A wyrm that old, gone. I served under men who weren't born when it was." }},
      {"x": 12, "y": 6, "kind": "recruit", "id": "rasha", "name": "Rasha",
        "hook": "Everyone here has already lost something to the desert. I'd rather lose it fighting.",
        "text": "The sand keeps its dead quiet. I'd rather make some noise with you instead.",
        "recruit": { "name": "Rasha", "classId": "archer", "raceId": "draconian", "elementId": "fire", "jobId": "hunter" }},
    ],
  },

  kelda_smithy: {
    id: 'kelda_smithy', name: "Quartermaster Vance's",
    encounter: null, rate: 0, bg: "#302418",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "kelda", "tx": 5, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Quartermaster Vance", "shop": "kelda_arms", "text": "Everything here has already been somewhere worse."},
    ],
  },

  kelda_pedlar: {
    id: 'kelda_pedlar', name: "Alchemist Pell's",
    encounter: null, rate: 0, bg: "#302418",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "kelda", "tx": 18, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Alchemist Pell", "shop": "kelda_items", "text": "Flasks. Do not shake them and then ask me questions."},
    ],
  },

  kelda_inn: {
    id: 'kelda_inn', name: "Kelda Inn",
    encounter: null, rate: 0, bg: "#302418",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "kelda", "tx": 5, "ty": 13}],
    npcs: [
      {"x": 4, "y": 2, "kind": "inn", "name": "Innkeeper Sabe", "cost": 40, "text": "Forty. We're the last bed before the ruins and we know it."},
    ],
  },

  kelda_temple: {
    id: 'kelda_temple', name: "Kelda Temple",
    encounter: null, rate: 0, bg: "#302418",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "kelda", "tx": 18, "ty": 13}],
    npcs: [
      {"x": 4, "y": 2, "kind": "temple", "name": "Brother Cairn", "text": "Kneel, and the ladder will show you where it forks."},
    ],
  },

  kelda_guildhall: {
    id: 'kelda_guildhall', name: "Kelda Guildhall",
    encounter: null, rate: 0, bg: "#302418",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "kelda", "tx": 9, "ty": 18}],
    npcs: [
      {"x": 4, "y": 2, "kind": "guild", "name": "Recorder Ish", "text": "Jobs are ranked by use, not by level. Do the work, earn the rank."},
    ],
  },

  // Four small waypost settlements, each holding one recruitable ally, added
  // near the road to a region's own threat rather than invented geography —
  // Millhollow watches the road to Volk's territory, Ashquarry sits in the
  // Anvil King's shadow, Farview is the open-plains stop between the two
  // main towns, and Vale's End is the last safe ground before the ruins.
  millhollow: {
    id: 'millhollow', name: "Millhollow",
    encounter: null,
    rate: 0,
    town: true,
    bg: "#1c2230",
    tiles: [
      'TTTTTTTTTTTTTTTT',
      'T..............T',
      'T.RRRRRR.......T',
      'T.RRRRRR.......T',
      'T.HHHHHH.......T',
      'T.HHDHHH.......T',
      'T..............T',
      'T..........f...T',
      'T......,,......T',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [
      {"x": 7, "y": 9, "to": "world", "tx": 35, "ty": 10},
      {"x": 8, "y": 9, "to": "world", "tx": 35, "ty": 10},
      {"x": 4, "y": 5, "to": "millhollow_home", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 11, "y": 6, "kind": "talk", "name": "Miller's Widow",
        "text": "Volk took the mill's grain three winters running. Whatever's left of him, I hope it's cold.",
        "reactions": { "volk": "Cold, then. Good. Sit, eat something — the mill owes you at least that." }},
    ],
  },

  millhollow_home: {
    id: 'millhollow_home', name: "Garrick's Watch",
    encounter: null, rate: 0, bg: "#1c2230",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "millhollow", "tx": 4, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "recruit", "id": "garrick", "name": "Garrick",
        "hook": "I held a shield on that road for nine years before I stopped believing anyone was coming to relieve me. You're the first who looked like they might.",
        "text": "Off the road and still standing. That's new for me.",
        "recruit": { "name": "Garrick", "classId": "guardian", "raceId": "human", "elementId": "metal", "jobId": "hunter" }},
    ],
  },

  ashquarry: {
    id: 'ashquarry', name: "Ashquarry",
    encounter: null,
    rate: 0,
    town: true,
    bg: "#241c14",
    tiles: [
      'TTTTTTTTTTTTTTTT',
      'T..............T',
      'T.RRRRRR.......T',
      'T.RRRRRR.......T',
      'T.HHHHHH.......T',
      'T.HHDHHH.......T',
      'T..............T',
      'T..........f...T',
      'T......,,......T',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [
      {"x": 7, "y": 9, "to": "world", "tx": 15, "ty": 13},
      {"x": 8, "y": 9, "to": "world", "tx": 15, "ty": 13},
      {"x": 4, "y": 5, "to": "ashquarry_home", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 11, "y": 6, "kind": "talk", "name": "Quarry Foreman",
        "text": "We stopped digging the day it stood up. Nobody's gone back for their tools.",
        "reactions": { "anvil_king": "Sent a crew back for the tools this morning. First time in years this quarry's felt like ours." }},
    ],
  },

  ashquarry_home: {
    id: 'ashquarry_home', name: "Doran's Workshop",
    encounter: null, rate: 0, bg: "#241c14",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "ashquarry", "tx": 4, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "recruit", "id": "doran", "name": "Doran",
        "hook": "I've drawn every plate on that golem twice over from a safe distance. I would very much like to see the inside of it, and I would very much like you to arrange that.",
        "text": "Still cataloguing. There's more inside these quarries than the King ever was.",
        "recruit": { "name": "Doran", "classId": "mage", "raceId": "gnome", "elementId": "metal", "jobId": "artificer" }},
    ],
  },

  farview: {
    id: 'farview', name: "Farview",
    encounter: null,
    rate: 0,
    town: true,
    bg: "#182818",
    tiles: [
      'TTTTTTTTTTTTTTTT',
      'T..............T',
      'T.RRRRRR.......T',
      'T.RRRRRR.......T',
      'T.HHHHHH.......T',
      'T.HHDHHH.......T',
      'T..............T',
      'T..........f...T',
      'T......,,......T',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [
      {"x": 7, "y": 9, "to": "world", "tx": 36, "ty": 18},
      {"x": 8, "y": 9, "to": "world", "tx": 36, "ty": 18},
      {"x": 4, "y": 5, "to": "farview_home", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 11, "y": 6, "kind": "talk", "name": "Shepherd",
        "text": "Quietest crossing on the whole road. We like it that way.",
        "reactions": { "gatekeeper": "Heard something enormous fell open past the ruins. Doesn't feel quiet anymore, does it." }},
    ],
  },

  farview_home: {
    id: 'farview_home', name: "Wyn's Cottage",
    encounter: null, rate: 0, bg: "#182818",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "farview", "tx": 4, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "recruit", "id": "wyn", "name": "Wyn",
        "hook": "I've followed these flocks along every safe path there is. I'm told you're headed somewhere that isn't one. I'd like to see it anyway.",
        "text": "The flock's fine without me a while longer. This is more interesting.",
        "recruit": { "name": "Wyn", "classId": "dancer", "raceId": "elf", "elementId": "nature", "jobId": "herbalist" }},
    ],
  },

  valesend: {
    id: 'valesend', name: "Vale's End",
    encounter: null,
    rate: 0,
    town: true,
    bg: "#201830",
    tiles: [
      'TTTTTTTTTTTTTTTT',
      'T..............T',
      'T.RRRRRR.......T',
      'T.RRRRRR.......T',
      'T.HHHHHH.......T',
      'T.HHDHHH.......T',
      'T..............T',
      'T..........f...T',
      'T......,,......T',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [
      {"x": 7, "y": 9, "to": "world", "tx": 39, "ty": 23},
      {"x": 8, "y": 9, "to": "world", "tx": 39, "ty": 23},
      {"x": 4, "y": 5, "to": "valesend_home", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 11, "y": 6, "kind": "talk", "name": "Last Lamplighter",
        "text": "I light the same lamp every night so the road home is findable. Nobody's used it in a year.",
        "reactions": { "thirteenth": "Somebody used the lamp again last night. First time since I started counting." }},
    ],
  },

  valesend_home: {
    id: 'valesend_home', name: "Mireth's Rest",
    encounter: null, rate: 0, bg: "#201830",
    tiles: [
      '#########',
      '#_______#',
      '#_______#',
      '#_______#',
      '#_______#',
      '#___D___#',
      '#########',
    ],
    warps: [{"x": 4, "y": 5, "to": "valesend", "tx": 4, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "recruit", "id": "mireth", "name": "Mireth",
        "hook": "I have been dead longer than this vale has had a name for me, and I still don't understand what sings in that Choir. Take me with you and let's finally find out.",
        "text": "The ruins keep fewer secrets from me now. Not none. Fewer.",
        "recruit": { "name": "Mireth", "classId": "spiritist", "raceId": "revenant", "elementId": "spirit", "jobId": "scribe" }},
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
