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
  'w': { tile: 'well',     solid: true },
  'k': { tile: 'stall',    solid: true },
  'l': { tile: 'lamp',     solid: true },
  'm': { tile: 'sign_smithy', solid: true },
  'p': { tile: 'sign_pedlar', solid: true },
  'b': { tile: 'sign_inn',    solid: true },
  'y': { tile: 'sign_temple', solid: true },
  'g': { tile: 'sign_guild',  solid: true },
  'c': { tile: 'sign_store',  solid: true },
};

export const MAPS = {
  world: {
    id: 'world', name: "The Nine Marches",
    encounter: "greenfield",
    rate: 0.055,
    outdoor: true,
    bg: "#101830",
    tiles: [
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^..^^..^..^^..^..^^.n^..^^..^T.^T..^..^^..^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^........T........n~~.......TTTTTT^T......^^^^^^...........................^',
      '^^^....TTTTTTTT.....~~.....TTTTT^^^^^^^^.....^^^^^...........................^',
      '^^^^...TTTTTTTTT....~~n....TTTT^^^^^^^^^^^...^^^^^...........................^',
      '^^^^..TTTTTTTTTTT..n~~....TTTT^^^^^.....^^...^^^^^...........................^',
      '^^^..TTTTTTTTTTTTT..~~.....TTT^^^^^.....^^^.^^^^^^........~~~~~~.............^',
      '^^^...TTTTTTTTTTT....~~.....TT^^^^^o.C..^^^^^^^^^^........~~~~~~.............^',
      '^^^^..TTTTTTTTT......~~......^^^^^^..,..^^^..^^^^^........~~~~~~......o......^',
      '^^^.....TTTTTTT......==n......^^^^^..,..^^^..^^^^^........~~~~~~.............^',
      '^^^......T.T...o.C,,,==,,,,,,,,,,,,,,,^^^^...^^^^^...o.C..~~~~~~.............^',
      '^^^^.............,..=~..........^^^^^^^^^...^^^^^^........~~~~~~.............^',
      '^^^^.............,..~~n.............^........^^^^^........~~~~~~.............^',
      '^^^..............,.n~~.......................^^^^^...........................^',
      '^^^..............,..==.......................^^^^^...........................^',
      '^^^^.....o,,,,,,,,,,,==,,,,,,,,.............,,,,,,...........................^',
      '^^^.........^^^^^^...~~.......,.....o.......^^^^^^................TTTTTTT....^',
      '^^^.........^^^^^^^..~~n......,..............^^^^^................TTTTTTT....^',
      '^^^^.....^^^^^^^^^^^n~~.n.....,..............^^^^^................TTTTTTT....^',
      '^^^^......^^^^^^^^^.~~.~.n....,..............^^^^^................TTTTTTT....^',
      '^^^........^^^^^^^n~~~~~~~~...,.......To.C..^^^^^^..TTTTT.........TTTTTTT....^',
      '^^^......TT...^^...~~~~~~~~~..,....TTTT..,...^^^^^..TTTTT.........TTTTTTT....^',
      '^^^^..TTTTTTTT....~~~~~~~~~~~.,....TTTT..,...^^^^^..TTTTT.........TTTTTTT....^',
      '^^^.TTTTTTTTTTT..n.~~~~~~~~~.n,...TTTTTTT,T..^^^^^..TTTTT....................^',
      '^^^TTTTTTTTTTTT...n.~~~~~~~...,..TTTTTTTT,TT^^^^^^..TTTTT....................^',
      '^^^TTTTTTTTTTTT....n.~~~~..n..,...TTTTTTT,T.^^^^^^...........................^',
      '^^^^TTTTTTTTTTTT....n~~.TT....,...TTTTTTT,T..^^^^^...........................^',
      '^^^..TTTTTTTTT......~~TTTTTT..o,,,,,,,,,,,...^^^^^...........................^',
      '^^^...TTTTTTT....TTT~~TTTTTT.........T.T.....^^^^^...........................^',
      '^^^^....T.T......TTT~~TTTTTT................^^^^^^...........................^',
      '^^^^..^.^..^..^.^.TT~~TTTTTTTTT.^..^..^.^..^.^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^TTTTTTTTTTT^^^^^^^^,,,^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^T^^T^^^^^^^^^^^,,,^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^,,,^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^,,,^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^,,,^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^,,,^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^......................................................................^^^^',
      '^^^^........o.............................................................^^^^',
      '^^^^.........................................TTTTTTTT.....................^^^^',
      '^^^^..........................o..............TTTTTTTT.....................^^^^',
      '^^^^..~~~~~~~~~~~~~..........................TTTTTTTT.........o...........^^^^',
      '^^^^..~~~~~~~~~~~~~..........................TTTTTTTT.....................^^^^',
      '^^^^..~~~~~~~~~~~~~..........................TTTTTTTT.....................^^^^',
      '^^^^..~~~~~~~~~~~~~.C........................TTTTTTTT.............C.......^^^^',
      '^^^^..~~~~~~~~~~~~~..........................TTTTTTTT.....................^^^^',
      '^^^^..~~~~~~~~~~~~~.......................................................^^^^',
      '^^^^..~~~~~~~~~~~~~.......................................TTTTTTTT........^^^^',
      '^^^^..~~~~~~~~~~~~~.......................................TTTTTTTT........^^^^',
      '^^^^..~~~~~~~~~~~~~.......................o...............TTTTTTTT........^^^^',
      '^^^^......................................................TTTTTTTT........^^^^',
      '^^^^......................................................TTTTTTTT........^^^^',
      '^^^^......................................................TTTTTTTT........^^^^',
      '^^^^......................................................................^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
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
      {"x": 53, "y": 12, "to": "ashfall", "tx": 7, "ty": 8},
      {"x": 55, "y": 12, "to": "cinderreach", "tx": 10, "ty": 10},
      {"x": 70, "y": 10, "to": "windmere", "tx": 7, "ty": 8},
      {"x": 12, "y": 41, "to": "tidewatch", "tx": 7, "ty": 8},
      {"x": 20, "y": 47, "to": "drownedvale", "tx": 25, "ty": 15},
      {"x": 30, "y": 43, "to": "harrowsrest", "tx": 12, "ty": 18},
      {"x": 42, "y": 52, "to": "duskwell", "tx": 7, "ty": 8},
      {"x": 62, "y": 44, "to": "glasshaven", "tx": 12, "ty": 18},
      {"x": 66, "y": 47, "to": "glassfields", "tx": 10, "ty": 15},
    ],
    signs: [
      {"x": 10, "y": 17, "text": "WREN'S FORD - west. THE ANVIL GORGE - north. Travellers are advised to be several people."},
      {"x": 31, "y": 29, "text": "KELDA - here. THE CHOIR RUINS - east. Nobody has come back east with anything but a story."},
      {"x": 52, "y": 12, "text": "ASHFALL - here. CINDERREACH - east. The sky past the ridge hasn't gone dark in longer than anyone can remember."},
      {"x": 29, "y": 43, "text": "HARROW'S REST - here. A long way from anywhere, and glad of it."},
      {"x": 61, "y": 44, "text": "GLASSHAVEN - here. THE GLASSFIELDS - south. They say the ground out there remembers shapes and keeps them."},
    ],
  },

  wren: {
    id: 'wren', name: "Wren's Ford",
    encounter: null,
    rate: 0,
    town: true,
    bg: "#182038",
    tiles: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T..f...................f......l......T',
      'T..RRRRRR......RRRRRR.......RRRR.....T',
      'T..RRRRRR......RRRRRR.......RRRR.....T',
      'T..HHmHHH......HHHpHHH......HHHH.....T',
      'T..HHDHHH......HHHDHH.......HDHH.....T',
      'T.............................w......T',
      'T,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,T',
      'T............................k.......T',
      'T..RRRRRR......RRRRRR.......RRRR.....T',
      'T..RRRRRR......RRRRRR.......RRRR.....T',
      'T..HHbHHH......HHHyHHH......HHHH.....T',
      'T..HHDHHH......HHHDHH.......HDHH.....T',
      'T..............................l.....T',
      'T.....RRRRRR........~~~..............T',
      'T.....RRRRRR.......~~~~~....f........T',
      'T.....HHHgHH.......~~~~..............T',
      'T.....HHHDHH.........................T',
      'T..........,,......f............f....T',
      'TTTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      {"x": 11, "y": 19, "to": "world", "tx": 9, "ty": 18},
      {"x": 12, "y": 19, "to": "world", "tx": 9, "ty": 18},
      {"x": 5, "y": 5, "to": "wren_smithy", "tx": 4, "ty": 4},
      {"x": 18, "y": 5, "to": "wren_pedlar", "tx": 4, "ty": 4},
      {"x": 5, "y": 12, "to": "wren_inn", "tx": 4, "ty": 4},
      {"x": 18, "y": 12, "to": "wren_temple", "tx": 4, "ty": 4},
      {"x": 9, "y": 17, "to": "wren_guildhall", "tx": 4, "ty": 4},
      {"x": 29, "y": 5, "to": "wren_cottage1", "tx": 4, "ty": 4},
      {"x": 29, "y": 12, "to": "wren_cottage2", "tx": 4, "ty": 4},
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

  wren_cottage1: {
    id: 'wren_cottage1', name: "Weaver Ada's Cottage",
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
    warps: [{"x": 4, "y": 5, "to": "wren", "tx": 29, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "talk", "name": "Weaver Ada",
        "text": "I weave what the temple can't afford not to have. Bandages, mostly, these days.",
        "reactions": { "choir": "The choir's silence reached us even here. I finally sleep through the night." }},
    ],
  },
  wren_cottage2: {
    id: 'wren_cottage2', name: "The Old Carter's House",
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
    warps: [{"x": 4, "y": 5, "to": "wren", "tx": 29, "ty": 13}],
    npcs: [
      {"x": 4, "y": 2, "kind": "talk", "name": "Retired Carter",
        "text": "Forty years driving that road and I never once looked up. Didn't want to know what was circling.",
        "reactions": { "aurelith": "They say a wyrm's shadow doesn't cross the sky anymore. The horses believed it before I did." }},
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
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '^..f..................f.......l......^',
      '^..RRRRRR......RRRRRR.......RRRR.....^',
      '^..RRRRRR......RRRRRR.......RRRR.....^',
      '^..HHmHHH......HHHpHHH......HHHH.....^',
      '^..HHDHHH......HHHDHH.......HDHH.....^',
      '^.............................w......^',
      '^,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,^',
      '^............................k.......^',
      '^..RRRRRR......RRRRRR.......RRRR.....^',
      '^..RRRRRR......RRRRRR.......RRRR.....^',
      '^..HHbHHH......HHHyHHH......HHHH.....^',
      '^..HHDHHH......HHHDHH.......HDHH.....^',
      // the guild hall keeps a watchtower — a domed column rising a row above
      // the ridgeline, standing in for one of the roof's own tiles
      '^.........O....................l.....^',
      '^......RRRORRRR......................^',
      '^......RRRORRRR.............f........^',
      '^......HHgHHHHH......................^',
      '^......HHDHHHHH......................^',
      'T..........,,......f............f....T',
      'TTTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      {"x": 11, "y": 19, "to": "world", "tx": 30, "ty": 30},
      {"x": 12, "y": 19, "to": "world", "tx": 30, "ty": 30},
      {"x": 5, "y": 5, "to": "kelda_smithy", "tx": 4, "ty": 4},
      {"x": 18, "y": 5, "to": "kelda_pedlar", "tx": 4, "ty": 4},
      {"x": 5, "y": 12, "to": "kelda_inn", "tx": 4, "ty": 4},
      {"x": 18, "y": 12, "to": "kelda_temple", "tx": 4, "ty": 4},
      {"x": 9, "y": 17, "to": "kelda_guildhall", "tx": 4, "ty": 4},
      {"x": 29, "y": 5, "to": "kelda_cottage1", "tx": 4, "ty": 4},
      {"x": 29, "y": 12, "to": "kelda_cottage2", "tx": 4, "ty": 4},
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

  kelda_cottage1: {
    id: 'kelda_cottage1', name: "Yael's Waystation",
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
    warps: [{"x": 4, "y": 5, "to": "kelda", "tx": 29, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "talk", "name": "Caravan Broker Yael",
        "text": "I book passage for anyone with coin and nowhere safer to be. Business is always good out here.",
        "reactions": { "volk": "First caravan through the Hollow road in a decade didn't lose a single wagon. I raised prices anyway." }},
    ],
  },
  kelda_cottage2: {
    id: 'kelda_cottage2', name: "Old Prospector Mabb's",
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
    warps: [{"x": 4, "y": 5, "to": "kelda", "tx": 29, "ty": 13}],
    npcs: [
      {"x": 4, "y": 2, "kind": "talk", "name": "Old Prospector Mabb",
        "text": "Panned every riverbed near the Gorge for thirty years. Never once found what I was actually looking for.",
        "reactions": { "anvil_king": "The riverbed's running clear again. Whatever that thing was doing to the water, it's stopped." }},
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
      'T............l.T',
      'T.RRRRRR.RRRR..T',
      'T.RRRRRR.RRRR..T',
      'T.HHHHHH.HcHH..T',
      'T.HHDHHH.HDHH..T',
      'T..............T',
      'T..........f...T',
      'T......,,......T',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [
      {"x": 7, "y": 9, "to": "world", "tx": 35, "ty": 10},
      {"x": 8, "y": 9, "to": "world", "tx": 35, "ty": 10},
      {"x": 4, "y": 5, "to": "millhollow_home", "tx": 4, "ty": 4},
      {"x": 10, "y": 5, "to": "millhollow_store", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 11, "y": 6, "kind": "talk", "name": "Miller's Widow",
        "text": "Volk took the mill's grain three winters running. Whatever's left of him, I hope it's cold.",
        "reactions": { "volk": "Cold, then. Good. Sit, eat something — the mill owes you at least that." }},
    ],
  },

  millhollow_store: {
    id: 'millhollow_store', name: "Peddler Joss's",
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
    warps: [{"x": 4, "y": 5, "to": "millhollow", "tx": 10, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Peddler Joss", "shop": "millhollow_store", "text": "Nothing fancy. Just what a body needs before the road gets long."},
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
      'T............l.T',
      'T.RRRRRR.RRRR..T',
      'T.RRRRRR.RRRR..T',
      'T.HHHHHH.HcHH..T',
      'T.HHDHHH.HDHH..T',
      'T..............T',
      'T..........f...T',
      'T......,,......T',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [
      {"x": 7, "y": 9, "to": "world", "tx": 15, "ty": 13},
      {"x": 8, "y": 9, "to": "world", "tx": 15, "ty": 13},
      {"x": 4, "y": 5, "to": "ashquarry_home", "tx": 4, "ty": 4},
      {"x": 10, "y": 5, "to": "ashquarry_store", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 11, "y": 6, "kind": "talk", "name": "Quarry Foreman",
        "text": "We stopped digging the day it stood up. Nobody's gone back for their tools.",
        "reactions": { "anvil_king": "Sent a crew back for the tools this morning. First time in years this quarry's felt like ours." }},
    ],
  },

  ashquarry_store: {
    id: 'ashquarry_store', name: "Sutler Renn's",
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
    warps: [{"x": 4, "y": 5, "to": "ashquarry", "tx": 10, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Sutler Renn", "shop": "ashquarry_store", "text": "Quarry work eats potions faster than it pays. I keep both in stock."},
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
      'T............l.T',
      'T.RRRRRR.RRRR..T',
      'T.RRRRRR.RRRR..T',
      'T.HHHHHH.HcHH..T',
      'T.HHDHHH.HDHH..T',
      'T..............T',
      'T..........f...T',
      'T......,,......T',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [
      {"x": 7, "y": 9, "to": "world", "tx": 36, "ty": 18},
      {"x": 8, "y": 9, "to": "world", "tx": 36, "ty": 18},
      {"x": 4, "y": 5, "to": "farview_home", "tx": 4, "ty": 4},
      {"x": 10, "y": 5, "to": "farview_store", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 11, "y": 6, "kind": "talk", "name": "Shepherd",
        "text": "Quietest crossing on the whole road. We like it that way.",
        "reactions": { "gatekeeper": "Heard something enormous fell open past the ruins. Doesn't feel quiet anymore, does it." }},
    ],
  },

  farview_store: {
    id: 'farview_store', name: "Drover Sil's",
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
    warps: [{"x": 4, "y": 5, "to": "farview", "tx": 10, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Drover Sil", "shop": "farview_store", "text": "Flocks pass through, travellers pass through, and I keep both fed."},
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
      'T............l.T',
      'T.RRRRRR.RRRR..T',
      'T.RRRRRR.RRRR..T',
      'T.HHHHHH.HcHH..T',
      'T.HHDHHH.HDHH..T',
      'T..............T',
      'T..........f...T',
      'T......,,......T',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [
      {"x": 7, "y": 9, "to": "world", "tx": 39, "ty": 23},
      {"x": 8, "y": 9, "to": "world", "tx": 39, "ty": 23},
      {"x": 4, "y": 5, "to": "valesend_home", "tx": 4, "ty": 4},
      {"x": 10, "y": 5, "to": "valesend_store", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 11, "y": 6, "kind": "talk", "name": "Last Lamplighter",
        "text": "I light the same lamp every night so the road home is findable. Nobody's used it in a year.",
        "reactions": {
          "thirteenth": "Somebody used the lamp again last night. First time since I started counting.",
          "worldheart": "Something enormous came apart past the ruins last week. The lamp's stayed lit an hour longer every night since."
        }},
    ],
  },

  valesend_store: {
    id: 'valesend_store', name: "Charm-seller Perrin's",
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
    warps: [{"x": 4, "y": 5, "to": "valesend", "tx": 10, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Charm-seller Perrin", "shop": "valesend_store", "text": "Everyone passing this close to the ruins buys a little more insurance than usual."},
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
    boss: {"x": 32, "y": 11, "formation": "boss_gate", "flag": "gatekeeper", "intro": "Something enormous unfolds from the wall. \"Nobody has been through.\"", "requires": "kharos"},
    boss2: {"x": 34, "y": 20, "formation": "boss_worldheart", "flag": "worldheart", "requires": "nerith", "intro": "Every green thing in the world turns to face you at once."},
    boss3: {"x": 23, "y": 25, "formation": "boss_thirteenth", "flag": "thirteenth", "requires": "vessia", "intro": "\"Nine on the wheel. Four beside it. And then there is me.\""},
    boss4: {"x": 34, "y": 3, "formation": "boss_seam", "flag": "seam", "requires": "thirteenth",
      "intro": "The room was never on any map of this place. It was always going to be exactly this empty."},
  },

  cinderreach: {
    id: 'cinderreach', name: "Cinderreach",
    encounter: "cinder", rate: 0.08, bg: "#2a1408",
    tiles: [
      '####################################',
      '####################################',
      '###_____#######################____#',
      '###_______________________#####____#',
      '###________________________________#',
      '###################_______#####____#',
      '###################_______#####____#',
      '###################_______######_###',
      '#######________####_______######_###',
      '#######________#######_#########_###',
      '#######________#######_#########_###',
      '#######________#######_##_____##_###',
      '##########_###########_##_____##_###',
      '##########_###########_##_____##_###',
      '##########_###########_####_####_###',
      '##########_###########_####_####_###',
      '##########_###########_####________#',
      '##########_#########______#________#',
      '#########______#####______##_______#',
      '#########______#####______##########',
      '#########______#####______##########',
      '#########_________________##########',
      '#########______#####______##########',
      '#########______#####################',
      '####################################',
      '####################################',
    ],
    warps: [
      {"x": 10, "y": 10, "to": "world", "tx": 55, "ty": 13, "exit": true},
    ],
    chests: [
      {"x": 22, "y": 20, "id": "cdc1", "item": "adamantplate"},
      {"x": 32, "y": 4, "id": "cdc2", "item": "elixir"},
      {"x": 27, "y": 12, "id": "cdc3", "gold": 8000},
    ],
    boss: {"x": 31, "y": 17, "formation": "boss_kharos", "flag": "kharos", "requires": "aurelith", "intro": "The forge-heat rises off the walls. Something vast turns to face you, wreathed in embers."},
  },

  drownedvale: {
    id: 'drownedvale', name: "The Drowned Vale",
    encounter: "drowned", rate: 0.08, bg: "#0a1a24",
    tiles: [
      '####################################',
      '####################################',
      '#####################______#########',
      '##########______#####______#########',
      '##########_________________#########',
      '##########______#####______#########',
      '##########______#####______#########',
      '#_______##______#####______#########',
      '#________#______#########_##########',
      '#________####_###########_##########',
      '###_####_####_###########_##########',
      '###_####_####_###########_##########',
      '###_##_____##_###########_##########',
      '###_##_____##_###########_##########',
      '###_##_____##_#######________#######',
      '###_#########_#######________#######',
      '###_#########_#######________#######',
      '###_######_______####________#######',
      '###_######_______###################',
      '#____#####_______###################',
      '#____#####_______###################',
      '#________________________________###',
      '#____#####_______________________###',
      '#____#######################_____###',
      '####################################',
      '####################################',
    ],
    warps: [
      {"x": 25, "y": 15, "to": "world", "tx": 20, "ty": 48, "exit": true},
    ],
    chests: [
      {"x": 13, "y": 5, "id": "dvc1", "item": "dragonmail"},
      {"x": 3, "y": 21, "id": "dvc2", "item": "elixir"},
      {"x": 8, "y": 13, "id": "dvc3", "gold": 20000},
    ],
    boss: {"x": 4, "y": 8, "formation": "boss_nerith", "flag": "nerith", "requires": "gatekeeper", "intro": "The water goes still, then rises without a current, gathering into a shape wearing a crown."},
  },

  glassfields: {
    id: 'glassfields', name: "The Glassfields",
    encounter: "glass", rate: 0.08, bg: "#1c2028",
    tiles: [
      '####################################',
      '####################################',
      '#########______#####################',
      '#########______#####______##########',
      '#########_________________##########',
      '#########______#####______##########',
      '#########______#####______##########',
      '#########______#####______##_______#',
      '##########_#########______#________#',
      '##########_###########_####________#',
      '##########_###########_####_####_###',
      '##########_###########_####_####_###',
      '##########_###########_##_____##_###',
      '##########_###########_##_____##_###',
      '#######________#######_##_____##_###',
      '#######________#######_#########_###',
      '#######________#######_#########_###',
      '#######________####_______######_###',
      '###################_______######_###',
      '###################_______#####____#',
      '###################_______#####____#',
      '###________________________________#',
      '###_______________________#####____#',
      '###_____#######################____#',
      '####################################',
      '####################################',
    ],
    warps: [
      {"x": 10, "y": 15, "to": "world", "tx": 66, "ty": 48, "exit": true},
    ],
    chests: [
      {"x": 22, "y": 5, "id": "glc1", "item": "titanplate"},
      {"x": 32, "y": 21, "id": "glc2", "item": "elixir"},
      {"x": 27, "y": 13, "id": "glc3", "gold": 70000},
    ],
    boss: {"x": 31, "y": 8, "formation": "boss_vessia", "flag": "vessia", "requires": "worldheart", "intro": "Every reflection off the glass sand turns at once, pointing to the same warden of light."},
  },

  ashfall: {
    id: 'ashfall', name: "Ashfall",
    encounter: null, rate: 0, town: true, bg: "#241812",
    tiles: [
      'TTTTTTTTTTTTTTTT',
      'T............l.T',
      'T.RRRRRR.RRRR..T',
      'T.RRRRRR.RRRR..T',
      'T.HHHHHH.HcHH..T',
      'T.HHDHHH.HDHH..T',
      'T..............T',
      'T..........f...T',
      'T......,,......T',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [
      {"x": 7, "y": 9, "to": "world", "tx": 53, "ty": 13},
      {"x": 8, "y": 9, "to": "world", "tx": 53, "ty": 13},
      {"x": 4, "y": 5, "to": "ashfall_home", "tx": 4, "ty": 4},
      {"x": 10, "y": 5, "to": "ashfall_store", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 11, "y": 6, "kind": "talk", "name": "Ashfall Warden",
        "text": "Fire's had a champion since before the wheel had a name. Kharos guards the reach; nothing gets past him without asking first.",
        "reactions": { "kharos": "Kharos guards nothing anymore. Fire answers to whoever's strong enough to ask twice." }},
    ],
  },

  ashfall_store: {
    id: 'ashfall_store', name: "Cinderwright Tavik's", encounter: null, rate: 0, bg: "#241812",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "ashfall", "tx": 10, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Cinderwright Tavik", "shop": "ashfall_store", "text": "Everything I sell has been through the reach at least once. So have I."},
    ],
  },

  ashfall_home: {
    id: 'ashfall_home', name: "Ondra's Forge", encounter: null, rate: 0, bg: "#241812",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "ashfall", "tx": 4, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "recruit", "id": "ondra", "name": "Ondra",
        "hook": "I've beaten swords out of stone that fell from Kharos's own reach. Whatever's still up there, I want to see it cool.",
        "text": "The reach doesn't scorch what I forge from it anymore. Neither does he.",
        "recruit": { "name": "Ondra", "classId": "warrior", "raceId": "ogrekin", "elementId": "fire", "jobId": "miner" }},
    ],
  },

  windmere: {
    id: 'windmere', name: "Windmere",
    encounter: null, rate: 0, town: true, bg: "#182430",
    tiles: [
      'TTTTTTTTTTTTTTTT',
      'T............l.T',
      'T.RRRRRR.RRRR..T',
      'T.RRRRRR.RRRR..T',
      'T.HHHHHH.HcHH..T',
      'T.HHDHHH.HDHH..T',
      'T..............T',
      'T..........f...T',
      'T......,,......T',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [
      {"x": 7, "y": 9, "to": "world", "tx": 70, "ty": 11},
      {"x": 8, "y": 9, "to": "world", "tx": 70, "ty": 11},
      {"x": 4, "y": 5, "to": "windmere_home", "tx": 4, "ty": 4},
      {"x": 10, "y": 5, "to": "windmere_store", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 11, "y": 6, "kind": "talk", "name": "Windmere Angler",
        "text": "Calmest water on the whole coast. Good for thinking. I've had a long time to think about the wheel — nine spokes, four more nobody paints on, and one hub nobody names.",
        "reactions": { "thirteenth": "So the hub had a name after all. I almost preferred not knowing." }},
    ],
  },

  windmere_store: {
    id: 'windmere_store', name: "Chandler Bett's", encounter: null, rate: 0, bg: "#182430",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "windmere", "tx": 10, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Chandler Bett", "shop": "windmere_store", "text": "Rope, oil, and whatever the last boat left behind. Take your pick."},
    ],
  },

  windmere_home: {
    id: 'windmere_home', name: "Iona's Berth", encounter: null, rate: 0, bg: "#182430",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "windmere", "tx": 4, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "recruit", "id": "iona", "name": "Iona",
        "hook": "I know every current from here to the Vale. I've been waiting for a reason to use that for something other than fishing.",
        "text": "Still reading the water. It tells you more than the shore ever will.",
        "recruit": { "name": "Iona", "classId": "dancer", "raceId": "merfolk", "elementId": "water", "jobId": "sailor" }},
    ],
  },

  tidewatch: {
    id: 'tidewatch', name: "Tidewatch",
    encounter: null, rate: 0, town: true, bg: "#101c28",
    tiles: [
      'TTTTTTTTTTTTTTTT',
      'T............l.T',
      'T.RRRRRR.RRRR..T',
      'T.RRRRRR.RRRR..T',
      'T.HHHHHH.HcHH..T',
      'T.HHDHHH.HDHH..T',
      'T..............T',
      'T..........f...T',
      'T......,,......T',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [
      {"x": 7, "y": 9, "to": "world", "tx": 12, "ty": 42},
      {"x": 8, "y": 9, "to": "world", "tx": 12, "ty": 42},
      {"x": 4, "y": 5, "to": "tidewatch_home", "tx": 4, "ty": 4},
      {"x": 10, "y": 5, "to": "tidewatch_store", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 11, "y": 6, "kind": "talk", "name": "Tidewatch Vigil",
        "text": "We keep the lamps lit and the doors shut after dark. Whatever the Vicar drowned down there, it still remembers being a congregation.",
        "reactions": { "nerith": "The lamps stay lit out of habit now, not fear. Come sit — the doors can stay open tonight." }},
    ],
  },

  tidewatch_store: {
    id: 'tidewatch_store', name: "Netmender Course's", encounter: null, rate: 0, bg: "#101c28",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "tidewatch", "tx": 10, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Netmender Course", "shop": "tidewatch_store", "text": "Holy water sells better here than anywhere else on the coast. Wonder why."},
    ],
  },

  tidewatch_home: {
    id: 'tidewatch_home', name: "Corvin's Watchpost", encounter: null, rate: 0, bg: "#101c28",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "tidewatch", "tx": 4, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "recruit", "id": "corvin", "name": "Corvin",
        "hook": "I was raised on prayers to something that turned out to be the Vicar wearing a congregation's faith like a coat. I'd like new prayers. Better ones.",
        "text": "Still finding the words. They're mine to choose now, at least.",
        "recruit": { "name": "Corvin", "classId": "spiritist", "raceId": "merfolk", "elementId": "water", "jobId": "fisher" }},
    ],
  },

  duskwell: {
    id: 'duskwell', name: "Duskwell",
    encounter: null, rate: 0, town: true, bg: "#141020",
    tiles: [
      'TTTTTTTTTTTTTTTT',
      'T............l.T',
      'T.RRRRRR.RRRR..T',
      'T.RRRRRR.RRRR..T',
      'T.HHHHHH.HcHH..T',
      'T.HHDHHH.HDHH..T',
      'T..............T',
      'T..........f...T',
      'T......,,......T',
      'TTTTTTT,,TTTTTTT',
    ],
    warps: [
      {"x": 7, "y": 9, "to": "world", "tx": 42, "ty": 53},
      {"x": 8, "y": 9, "to": "world", "tx": 42, "ty": 53},
      {"x": 4, "y": 5, "to": "duskwell_home", "tx": 4, "ty": 4},
      {"x": 10, "y": 5, "to": "duskwell_store", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 11, "y": 6, "kind": "talk", "name": "Duskwell Keeper",
        "text": "Closest anyone lives to the Hollow Between and stays sane. We don't look at the light down there. We especially don't look at what's between the lights.",
        "reactions": { "worldheart": "Every green thing in the world turned to face something, they say. It didn't turn toward us. Small mercies." }},
    ],
  },

  duskwell_store: {
    id: 'duskwell_store', name: "Warden Ilse's", encounter: null, rate: 0, bg: "#141020",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "duskwell", "tx": 10, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Warden Ilse", "shop": "duskwell_store", "text": "Nobody passes through Duskwell without a full tent and a spare antidote. I make sure of it."},
    ],
  },

  duskwell_home: {
    id: 'duskwell_home', name: "Nyx's Lock-room", encounter: null, rate: 0, bg: "#141020",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "duskwell", "tx": 4, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "recruit", "id": "nyx", "name": "Nyx",
        "hook": "I've picked every lock the Hollow Between ever grew, and it keeps growing new ones. I want to see what's behind the last one.",
        "text": "Still picking locks. The last one's just further out than I thought.",
        "recruit": { "name": "Nyx", "classId": "thief", "raceId": "automaton", "elementId": "dark", "jobId": "locksmith" }},
    ],
  },

  harrowsrest: {
    id: 'harrowsrest', name: "Harrow's Rest",
    encounter: null, rate: 0, town: true, bg: "#1c2214",
    tiles: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T..f...................f......l......T',
      'T..RRRRRR......RRRRRR.......RRRR.....T',
      'T..RRRRRR......RRRRRR.......RRRR.....T',
      'T..HHmHHH......HHHpHHH......HHHH.....T',
      'T..HHDHHH......HHHDHH.......HDHH.....T',
      'T.............................w......T',
      'T,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,T',
      'T............................k.......T',
      'T..RRRRRR......RRRRRR.......RRRR.....T',
      'T..RRRRRR......RRRRRR.......RRRR.....T',
      'T..HHbHHH......HHHyHHH......HHHH.....T',
      'T..HHDHHH......HHHDHH.......HDHH.....T',
      'T..............................l.....T',
      'T.....RRRRRR........~~~..............T',
      'T.....RRRRRR.......~~~~~....f........T',
      'T.....HHHgHH.......~~~~..............T',
      'T.....HHHDHH.........................T',
      'T..........,,......f............f....T',
      'TTTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      {"x": 11, "y": 19, "to": "world", "tx": 30, "ty": 44},
      {"x": 12, "y": 19, "to": "world", "tx": 30, "ty": 44},
      {"x": 5, "y": 5, "to": "harrowsrest_smithy", "tx": 4, "ty": 4},
      {"x": 18, "y": 5, "to": "harrowsrest_pedlar", "tx": 4, "ty": 4},
      {"x": 5, "y": 12, "to": "harrowsrest_inn", "tx": 4, "ty": 4},
      {"x": 18, "y": 12, "to": "harrowsrest_temple", "tx": 4, "ty": 4},
      {"x": 9, "y": 17, "to": "harrowsrest_guildhall", "tx": 4, "ty": 4},
      {"x": 29, "y": 5, "to": "harrowsrest_cottage1", "tx": 4, "ty": 4},
      {"x": 29, "y": 12, "to": "harrowsrest_cottage2", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 22, "y": 8, "kind": "talk", "name": "Harrowed Farmer",
        "text": "We named it Harrow's Rest the year the King in the Gorge fell quiet. Figured we'd earned a season without digging.",
        "reactions": { "anvil_king": "Same King. Same quiet. Just us saying it out loud instead of hoping." }},
      {"x": 2, "y": 8, "kind": "talk", "name": "Well-diggers' Foreman",
        "text": "Struck something down there that wasn't water. Filled the well back in. Some things aren't worth the drink.",
        "reactions": { "volk": "Word is the road's clear past the Hollow. Might unfill that well after all." }},
    ],
  },

  harrowsrest_smithy: {
    id: 'harrowsrest_smithy', name: "Smith Talia's", encounter: null, rate: 0, bg: "#1c2214",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "harrowsrest", "tx": 5, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Smith Talia", "shop": "harrowsrest_arms", "text": "Better than the Ford sells, worse than what waits past the Gate. Fair price for the difference."},
    ],
  },
  harrowsrest_pedlar: {
    id: 'harrowsrest_pedlar', name: "Pedlar Once's", encounter: null, rate: 0, bg: "#1c2214",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "harrowsrest", "tx": 18, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Pedlar Once", "shop": "harrowsrest_items", "text": "Bought this stock twice already. Bandits took it once. I don't ask questions anymore, I just restock."},
    ],
  },
  harrowsrest_inn: {
    id: 'harrowsrest_inn', name: "The Harrow Inn", encounter: null, rate: 0, bg: "#1c2214",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "harrowsrest", "tx": 5, "ty": 13}],
    npcs: [
      {"x": 4, "y": 2, "kind": "inn", "name": "Innkeeper Fenna", "cost": 14, "text": "Fourteen gold. The well's fine again, before you ask."},
    ],
  },
  harrowsrest_temple: {
    id: 'harrowsrest_temple', name: "Harrow's Rest Temple", encounter: null, rate: 0, bg: "#1c2214",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "harrowsrest", "tx": 18, "ty": 13}],
    npcs: [
      {"x": 4, "y": 2, "kind": "temple", "name": "Brother Cale", "text": "We raise the fallen here same as anywhere. Prayer doesn't care how far you are from the Ford."},
    ],
  },
  harrowsrest_guildhall: {
    id: 'harrowsrest_guildhall', name: "Harrow's Rest Guildhall", encounter: null, rate: 0, bg: "#1c2214",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "harrowsrest", "tx": 9, "ty": 18}],
    npcs: [
      {"x": 4, "y": 2, "kind": "guild", "name": "Registrar Voss", "text": "A satellite ledger. Everything gets copied back to Orrin's rolls at the Ford eventually."},
    ],
  },
  harrowsrest_cottage1: {
    id: 'harrowsrest_cottage1', name: "Sable's House", encounter: null, rate: 0, bg: "#1c2214",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "harrowsrest", "tx": 29, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "recruit", "id": "sable", "name": "Sable",
        "hook": "I've dug wells in this ground my whole life and never once liked what I found at the bottom. I'd rather dig somewhere that at least tells me what it is.",
        "text": "Still digging. Better company down here than there used to be.",
        "recruit": { "name": "Sable", "classId": "guardian", "raceId": "dwarf", "elementId": "earth", "jobId": "miner" }},
    ],
  },
  harrowsrest_cottage2: {
    id: 'harrowsrest_cottage2', name: "Petra's Loft", encounter: null, rate: 0, bg: "#1c2214",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "harrowsrest", "tx": 29, "ty": 13}],
    npcs: [
      {"x": 4, "y": 2, "kind": "recruit", "id": "petra", "name": "Petra",
        "hook": "I've mapped every road out of Harrow's Rest and every one of them dead-ends at a story I haven't finished. Let me finish one.",
        "text": "Still mapping. The roads keep getting longer, which I've decided to enjoy.",
        "recruit": { "name": "Petra", "classId": "thief", "raceId": "gnome", "elementId": "earth", "jobId": "cartographer" }},
    ],
  },

  glasshaven: {
    id: 'glasshaven', name: "Glasshaven",
    encounter: null, rate: 0, town: true, bg: "#20242c",
    tiles: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T..f...................f......l......T',
      'T..RRRRRR......RRRRRR.......RRRR.....T',
      'T..RRRRRR......RRRRRR.......RRRR.....T',
      'T..HHmHHH......HHHpHHH......HHHH.....T',
      'T..HHDHHH......HHHDHH.......HDHH.....T',
      'T.............................w......T',
      'T,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,T',
      'T............................k.......T',
      'T..RRRRRR......RRRRRR.......RRRR.....T',
      'T..RRRRRR......RRRRRR.......RRRR.....T',
      'T..HHbHHH......HHHyHHH......HHHH.....T',
      'T..HHDHHH......HHHDHH.......HDHH.....T',
      'T..............................l.....T',
      'T.....RRRRRR........~~~..............T',
      'T.....RRRRRR.......~~~~~....f........T',
      'T.....HHHgHH.......~~~~..............T',
      'T.....HHHDHH.........................T',
      'T..........,,......f............f....T',
      'TTTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    warps: [
      {"x": 11, "y": 19, "to": "world", "tx": 62, "ty": 45},
      {"x": 12, "y": 19, "to": "world", "tx": 62, "ty": 45},
      {"x": 5, "y": 5, "to": "glasshaven_smithy", "tx": 4, "ty": 4},
      {"x": 18, "y": 5, "to": "glasshaven_pedlar", "tx": 4, "ty": 4},
      {"x": 5, "y": 12, "to": "glasshaven_inn", "tx": 4, "ty": 4},
      {"x": 18, "y": 12, "to": "glasshaven_temple", "tx": 4, "ty": 4},
      {"x": 9, "y": 17, "to": "glasshaven_guildhall", "tx": 4, "ty": 4},
      {"x": 29, "y": 5, "to": "glasshaven_cottage1", "tx": 4, "ty": 4},
      {"x": 29, "y": 12, "to": "glasshaven_cottage2", "tx": 4, "ty": 4},
    ],
    npcs: [
      {"x": 22, "y": 8, "kind": "talk", "name": "Glazier Enna",
        "text": "The Glassfields grow the sand and we grow the town. Vessia's stood warden over both since before Glasshaven had a name.",
        "reactions": { "vessia": "The fields still shine. Nobody's watching them anymore. We've decided that's an improvement." }},
      {"x": 2, "y": 8, "kind": "talk", "name": "Old Reliquary Keeper",
        "text": "Nine on the wheel, four beside it, and a hub nobody paints. I've kept this town's shrine to all thirteen my whole life. Never met the thirteenth in person. Small mercies, I used to think.",
        "reactions": {
          "seam": "There was never a fourteenth candle to light. I lit one anyway. Didn't feel wrong.",
          "thirteenth": "Met it, then. The shrine stays lit either way — you don't stop tending a wheel just because you've finally seen its hub."
        }},
    ],
  },

  glasshaven_smithy: {
    id: 'glasshaven_smithy', name: "Armourer Kest's", encounter: null, rate: 0, bg: "#20242c",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "glasshaven", "tx": 5, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Armourer Kest", "shop": "glasshaven_arms", "text": "The best steel this side of the Fields. Past the Fields, you're on your own."},
    ],
  },
  glasshaven_pedlar: {
    id: 'glasshaven_pedlar', name: "Pedlar Sorin's", encounter: null, rate: 0, bg: "#20242c",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "glasshaven", "tx": 18, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "shop", "name": "Pedlar Sorin", "shop": "glasshaven_items", "text": "Elixirs, sold openly, for the first time in this town's history. Business is good."},
    ],
  },
  glasshaven_inn: {
    id: 'glasshaven_inn', name: "The Reliquary Inn", encounter: null, rate: 0, bg: "#20242c",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "glasshaven", "tx": 5, "ty": 13}],
    npcs: [
      {"x": 4, "y": 2, "kind": "inn", "name": "Innkeeper Odalys", "cost": 40, "text": "Forty gold. You're paying for the view of the Fields as much as the bed."},
    ],
  },
  glasshaven_temple: {
    id: 'glasshaven_temple', name: "Glasshaven Reliquary", encounter: null, rate: 0, bg: "#20242c",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "glasshaven", "tx": 18, "ty": 13}],
    npcs: [
      {"x": 4, "y": 2, "kind": "temple", "name": "High Reliquary Sana", "text": "This shrine has stood watch over all thirteen since before anyone here could name them. We raise the fallen. We always have."},
    ],
  },
  glasshaven_guildhall: {
    id: 'glasshaven_guildhall', name: "Glasshaven Guildhall", encounter: null, rate: 0, bg: "#20242c",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "glasshaven", "tx": 9, "ty": 18}],
    npcs: [
      {"x": 4, "y": 2, "kind": "guild", "name": "Master Registrar Thane", "text": "The furthest ledger from the Ford, and the busiest. Everyone passes through Glasshaven eventually."},
    ],
  },
  glasshaven_cottage1: {
    id: 'glasshaven_cottage1', name: "Selwyn's Rest", encounter: null, rate: 0, bg: "#20242c",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "glasshaven", "tx": 29, "ty": 6}],
    npcs: [
      {"x": 4, "y": 2, "kind": "recruit", "id": "selwyn", "name": "Selwyn",
        "hook": "I was built to keep vigil over the Fields until Vessia woke, judged, and dismissed me. I would like a purpose that isn't waiting.",
        "text": "Still keeping vigil. Just not alone anymore, and not for her.",
        "recruit": { "name": "Selwyn", "classId": "cleric", "raceId": "automaton", "elementId": "light", "jobId": "pilgrim" }},
    ],
  },
  glasshaven_cottage2: {
    id: 'glasshaven_cottage2', name: "Iskra's Hall", encounter: null, rate: 0, bg: "#20242c",
    tiles: ['#########','#_______#','#_______#','#_______#','#_______#','#___D___#','#########'],
    warps: [{"x": 4, "y": 5, "to": "glasshaven", "tx": 29, "ty": 13}],
    npcs: [
      {"x": 4, "y": 2, "kind": "recruit", "id": "iskra", "name": "Iskra",
        "hook": "I've sung the Warden's vigil at every shrine from here to the Fields. I'd rather sing about what comes after her than keep singing to her.",
        "text": "New verses. Turns out the ending needed one after all.",
        "recruit": { "name": "Iskra", "classId": "archer", "raceId": "saurian", "elementId": "light", "jobId": "bard" }},
    ],
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
  millhollow_store: {
    name: "Peddler Joss's",
    stock: ['potion', 'antidote', 'tent'],
  },
  ashquarry_store: {
    name: "Sutler Renn's",
    stock: ['potion', 'antidote', 'tent'],
  },
  farview_store: {
    name: "Drover Sil's",
    stock: ['potion', 'antidote', 'tent'],
  },
  valesend_store: {
    name: "Charm-seller Perrin's",
    stock: ['potion', 'antidote', 'tent'],
  },
  ashfall_store: {
    name: "Cinderwright Tavik's",
    stock: ['potion', 'hipotion', 'antidote', 'firebomb', 'tent'],
  },
  windmere_store: {
    name: "Chandler Bett's",
    stock: ['potion', 'antidote', 'tent', 'wingfeather'],
  },
  tidewatch_store: {
    name: "Netmender Course's",
    stock: ['potion', 'hipotion', 'antidote', 'holywater', 'tent'],
  },
  duskwell_store: {
    name: "Warden Ilse's",
    stock: ['potion', 'hipotion', 'antidote', 'goldneedle', 'tent'],
  },
  harrowsrest_arms: {
    name: "Smith Talia's",
    stock: ['flametongue', 'frostbrand', 'ruinaxe', 'shadowedge', 'wyvernlance',
            'stormrod', 'aegisshield', 'knightplate', 'bishopvest', 'greathelm'],
  },
  harrowsrest_items: {
    name: "Pedlar Once's",
    stock: ['potion', 'hipotion', 'ether', 'antidote', 'goldneedle', 'holywater',
            'revivalleaf', 'tent', 'elemcharm', 'voidring', 'ipband'],
  },
  glasshaven_arms: {
    name: "Armourer Kest's",
    stock: ['sunblade', 'dragonfists', 'gungnir', 'worldstaff', 'artemisbow',
            'adamantplate', 'crownofstars', 'scalemail'],
  },
  glasshaven_items: {
    name: "Pedlar Sorin's",
    stock: ['hipotion', 'xpotion', 'ether', 'elixir', 'revivalleaf', 'holywater',
            'goldneedle', 'tent'],
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

// Every named region a player can actually travel to, in the order the
// overworld's own warps list them (roughly the order a player encounters
// them) — 'hollowbetween' is appended on its own since it's the one region
// reached through a sub-warp (from the Choir Ruins) rather than directly
// off the world map, but is just as worth surfacing on a world overview.
export const REGIONS = [...MAPS.world.warps.map((w) => w.to), 'hollowbetween'];

export const BOSS_SLOTS = ['boss', 'boss2', 'boss3', 'boss4'];

export function bossAt(map, x, y) {
  for (const key of BOSS_SLOTS) {
    const b = map[key];
    if (b && b.x === x && b.y === y) return b;
  }
  return null;
}
