// ============================================================================
//  QUESTS — small side objectives layered onto NPCs already standing in the
//  world, using hooks their own flavour text already planted (the Prospector
//  who never found real mythril, the Shepherd's spooked flock) rather than
//  inventing new characters. Tracked entirely through GameState's existing
//  flags and bestiary — no separate quest-state system, no new save shape.
//
//  Three objective shapes:
//    'item'    — carry `count` of `itemId` back to the giver.
//    'kill'    — defeat `count` enemies of `family` after accepting (tracked
//                as a bestiary delta from accept-time, so kills from before
//                accepting don't retroactively count).
//    'deliver' — a pure fetch-and-carry: accepting the giver's line is enough
//                to flag it active, and the named `deliverTo` NPC completes
//                it on their own next conversation.
//
//  `level` is a recommended character level, purely descriptive — nothing
//  gates on it — used only to group quests into brackets for the menu's
//  Quest page and to sort a bracket's quests low to high.
// ============================================================================

import { ENEMIES } from './enemies.js';

export const QUESTS = {
  bandages: {
    id: 'bandages',
    npc: 'Weaver Ada',
    title: 'A Ward Against Fever',
    hook: "The temple's out of clean dressings and I'm out of herbs to weave them from. "
      + "Bring me three Heal Herb and I'll see you're paid for the errand.",
    accept: "Three, whenever you find them. I'm not going anywhere.",
    reminder: "Still three Heal Herb short, if you're passing a peddler.",
    turnIn: "That's the lot. The temple sleeps easier tonight — and so, I expect, will you.",
    type: 'item', itemId: 'healherb', count: 3, level: 3,
    reward: { gold: 60, lp: 2 },
  },
  wolfBounty: {
    id: 'wolfBounty',
    npc: 'Shepherd',
    title: 'Thin the Wolves',
    hook: "Something's been circling the flock at night. Bring back proof — three beasts down — "
      + "and there's coin in it.",
    accept: "Three. I'll be counting.",
    reminder: "Flock's still spooked. Three beasts, remember.",
    turnIn: "Three. The flock already sounds calmer, and that's not something coin usually buys.",
    type: 'kill', family: 'beast', count: 3, level: 9,
    reward: { gold: 140, lp: 3 },
  },
  letter: {
    id: 'letter',
    npc: 'Guildmaster Orrin',
    title: 'Letters Across the Ford',
    hook: "The regular courier won't ride the Hollow road while it's Volk's, and I don't blame him. "
      + "You're going that way regardless. Carry a letter to the Guildhall in Kelda for me?",
    accept: "Recorder Ish will know what to do with it. My thanks — the ledgers hate a gap.",
    reminder: "Still carrying that letter? Kelda's Guildhall, whenever you pass through.",
    type: 'deliver', deliverTo: 'Recorder Ish', level: 10,
    deliverText: "A letter, carried through the Hollow itself. Orrin always did pick messengers with "
      + "more nerve than sense. Here — for the trouble.",
    reward: { gold: 90, lp: 2 },
  },
  prospectorOre: {
    id: 'prospectorOre',
    npc: 'Old Prospector Mabb',
    title: "The Prospector's Ore",
    hook: "Thirty years panning this riverbed and I never once found real mythril. "
      + "You're going places I'm not. Bring me a sample and I'll finally believe it exists.",
    accept: "Mythril. Real mythril, mind — I'll know the difference.",
    reminder: "Still waiting on that mythril. No rush — I've waited thirty years already.",
    turnIn: "...It's real. Thirty years, and it's real. Here — take this. I've no more use for doubt "
      + "than I do for coin.",
    type: 'item', itemId: 'mythril', count: 1, level: 12,
    reward: { gold: 200, lp: 4, item: 'luckycoin' },
  },
  spiritGlass: {
    id: 'spiritGlass',
    npc: 'Ruin Scholar',
    title: "The Ruin Scholar's Study",
    hook: "Everything that sings in that ruin leaves glass behind when it stops. Bring me two pieces "
      + "and I might finally understand what the Choir actually is.",
    accept: "Two pieces. Whole ones, if the fight allows it.",
    reminder: "Two pieces of spirit glass — I'm still short.",
    turnIn: "...I have theories now instead of just questions. That's more progress than I've made "
      + "in a decade.",
    type: 'item', itemId: 'spiritglass', count: 2, level: 18,
    reward: { gold: 180, lp: 4 },
  },
  quarryTools: {
    id: 'quarryTools',
    npc: 'Quarry Foreman',
    title: 'Tools Left in the Rock',
    hook: "We left good tools in that quarry the day it stood up and none of us have the nerve "
      + "to go back for them. Bring back three Iron Ore and I'll believe someone finally did "
      + "the digging instead.",
    accept: "Three Iron Ore. Whatever's still using that quarry for a bed, don't wake it twice.",
    reminder: "Still three Iron Ore short. The quarry isn't going anywhere.",
    turnIn: "Real ore, not just rust and nerve. Feels like the ground's ours again.",
    type: 'item', itemId: 'ironore', count: 3, level: 19,
    reward: { gold: 260, lp: 4 },
  },
  lampVigil: {
    id: 'lampVigil',
    npc: 'Last Lamplighter',
    title: "The Lamplighter's Vigil",
    hook: "Things out past the ruins don't have names I trust. Three of whatever's out there, dead, "
      + "and I'll believe the road's worth lighting again.",
    accept: "Three. I'll be watching the lamp, same as always.",
    reminder: "The lamp's still burning for nobody. Three, remember.",
    turnIn: "Three. I'm putting the lamp out tonight — not because the road's safe, but because I "
      + "finally believe someone's using it.",
    type: 'kill', family: 'aberration', count: 3, level: 25,
    reward: { gold: 260, lp: 5 },
  },
  lancersReach: {
    id: 'lancersReach',
    npc: 'Retired Lancer',
    title: "A Lancer's Reach",
    hook: "Thirty years in the second column taught me reach wins fights the front line never "
      + "sees coming. Bring me three Dragon Scale and I'll know the old lessons still hold "
      + "against whatever's out there now.",
    accept: "Three. Scale, not rumor — I've heard enough rumor to last the rest of my life.",
    reminder: "Still three Dragon Scale short. Whatever's shedding them isn't hard to find, if you look up.",
    turnIn: "Same as it ever was, then. Good. I'd hate to have stood in that column for nothing.",
    type: 'item', itemId: 'dragonscale', count: 3, level: 28,
    reward: { gold: 380, lp: 5 },
  },
  emberWisps: {
    id: 'emberWisps',
    npc: 'Ashfall Warden',
    title: 'Ember-Wisps',
    hook: "The reach breeds these ash-wraiths faster than we can ward them off. Three dead and this "
      + "town gets a quiet night for once.",
    accept: "Three wisps. Watch your hands — they don't cool the way smoke should.",
    reminder: "Still three ash-wraiths short. The reach isn't getting any quieter without you.",
    turnIn: "Three down. First quiet night this reach has had since Kharos started dreaming out loud.",
    type: 'kill', family: 'spirit', count: 3, level: 33,
    reward: { gold: 320, lp: 5 },
  },
  windmereCalm: {
    id: 'windmereCalm',
    npc: 'Windmere Angler',
    title: 'What Troubles the Calm',
    hook: "Water's not as calm as I let on. Something's riled the spirits under it and my nets keep "
      + "coming up empty. Three of whatever's doing the riling, dead, and I'll finally trust the "
      + "water again.",
    accept: "Three. I'll keep casting — badly, until you do.",
    reminder: "Water's still restless. Three spirits, remember.",
    turnIn: "Calm again. Or calm enough. I'll take it — I've had a long time to think about what "
      + "'enough' means out here.",
    type: 'kill', family: 'spirit', count: 3, level: 38,
    reward: { gold: 560, lp: 6 },
  },
  riverToll: {
    id: 'riverToll',
    npc: 'Tidewatch Vigil',
    title: 'The River Toll',
    hook: "Everything the Vale drowns eventually washes up as pearl. Bring me three and I'll tell "
      + "you what the congregation used to trade them for.",
    accept: "Three river pearls. I'll be here — I'm always here.",
    reminder: "Still short on pearls. The Vale isn't shy about giving them up, if you go looking.",
    turnIn: "Three. They used to trade these for absolution, before the Vicar decided he'd rather "
      + "keep both the pearls and the sinners. Small mercy, undoing that.",
    type: 'item', itemId: 'riverpearl', count: 3, level: 50,
    reward: { gold: 420, lp: 6 },
  },
  harrowsSoil: {
    id: 'harrowsSoil',
    npc: 'Harrowed Farmer',
    title: "What Won't Stay Buried",
    hook: "Ground keeps giving up things that should've stayed under it. Three dead things put "
      + "back down properly and maybe this season's crop takes.",
    accept: "Three. Properly down this time, not just quiet for a week.",
    reminder: "Ground's still restless. Three, remember — properly down.",
    turnIn: "Season might take after all. Funny what a field needs to grow, some years.",
    type: 'kill', family: 'undead', count: 3, level: 57,
    reward: { gold: 720, lp: 6 },
  },
  wellDepths: {
    id: 'wellDepths',
    npc: "Well-diggers' Foreman",
    title: 'Unfilling the Well',
    hook: "We filled that well back in rather than find out what we'd struck. I still want to know. "
      + "Two of whatever's down in wells and dark water, dead, and I'll finally believe it's "
      + "safe to dig again.",
    accept: "Two. I'll be here, not digging, same as always.",
    reminder: "Still two short. The well stays filled until you are.",
    turnIn: "Two down. Digging again tomorrow — carefully.",
    type: 'kill', family: 'aberration', count: 2, level: 60,
    reward: { gold: 820, lp: 7 },
  },
  duskwellLight: {
    id: 'duskwellLight',
    npc: 'Duskwell Keeper',
    title: 'What the Light Left Behind',
    hook: "Nobody looks at the light in the Hollow Between and nobody touches what falls out of it "
      + "either. I'll make an exception for you. Bring me two Adamantite and I might finally "
      + "understand what's actually down there.",
    accept: "Two. Don't look at it longer than you have to.",
    reminder: "Still two short. The light isn't going anywhere, unfortunately.",
    turnIn: "...I still don't understand it. But I'm holding it now, and that's new.",
    type: 'item', itemId: 'adamantite', count: 2, level: 68,
    reward: { gold: 980, lp: 7 },
  },
  lastVigilLight: {
    id: 'lastVigilLight',
    npc: 'Glazier Enna',
    title: "What the Fields Grow",
    hook: "Four of whatever's out there in the Fields, dead, and brought back whole enough to prove "
      + "it. I want to know if Vessia's warden-shapes still count as her subjects with her gone.",
    accept: "Four. Whole enough to study, if the fight allows it.",
    reminder: "Still four short. The Fields aren't running out of them any time soon.",
    turnIn: "They still count. Whatever she was warden of, it didn't end when she did. That's either "
      + "reassuring or the opposite — I haven't decided.",
    type: 'kill', family: 'aberration', count: 4, level: 74,
    reward: { gold: 900, lp: 8 },
  },
  reliquaryVigil: {
    id: 'reliquaryVigil',
    npc: 'Old Reliquary Keeper',
    title: 'Keeping the Thirteenth Lit',
    hook: "This shrine has burned for all thirteen my whole life and I've never had to explain the "
      + "thirteenth candle to anyone before. Two things that shouldn't exist, ended anyway, and "
      + "I'll finally have something honest to tell the pilgrims.",
    accept: "Two. I'll keep the candle lit either way.",
    reminder: "Still two short. The candle burns regardless.",
    turnIn: "There. Now when they ask about the thirteenth candle, I'll have an answer instead of a shrug.",
    type: 'kill', family: 'aberration', count: 2, level: 88,
    reward: { gold: 1400, lp: 9 },
  },
};

function familyKills(g, family) {
  return ENEMIES.filter((e) => e.family === family)
    .reduce((sum, e) => sum + (g.bestiary[e.id] ?? 0), 0);
}

export function questState(g, id) {
  if (g.flag(`quest.${id}.done`)) return 'done';
  if (g.flag(`quest.${id}.active`)) return 'active';
  return 'unstarted';
}

export function startQuest(g, id) {
  const q = QUESTS[id];
  g.setFlag(`quest.${id}.active`, true);
  if (q.type === 'kill') g.setFlag(`quest.${id}.baseline`, familyKills(g, q.family));
}

/** {have, need} — meaningless for 'deliver' quests, which have no partial state. */
export function questProgress(g, id) {
  const q = QUESTS[id];
  if (q.type === 'item') return { have: g.countItem(q.itemId), need: q.count };
  if (q.type === 'kill') {
    const baseline = g.flags[`quest.${id}.baseline`] ?? 0;
    return { have: Math.max(0, familyKills(g, q.family) - baseline), need: q.count };
  }
  return { have: 0, need: 0 };
}

export function questReady(g, id) {
  const q = QUESTS[id];
  if (q.type === 'deliver') return g.flag(`quest.${id}.active`);
  const p = questProgress(g, id);
  return p.have >= p.need;
}

/** Every quest, sorted low to high by its recommended level — the order
 *  the menu's Quest page lists them in. */
export function questsByLevel() {
  return Object.values(QUESTS).sort((a, b) => a.level - b.level);
}

/** The top of this quest's 10-level bracket, e.g. level 28 -> 30, for
 *  grouping quests into "a few per 10 levels" bands in the UI. */
export function questBand(level) { return Math.min(90, Math.ceil(level / 10) * 10); }

/** Mutates state only — spends the item, flips the flags, grants gold/LP/item.
 *  Callers show their own turn-in dialogue around this. */
export function completeQuest(g, id) {
  const q = QUESTS[id];
  if (q.type === 'item') g.removeItem(q.itemId, q.count);
  g.setFlag(`quest.${id}.active`, false);
  g.setFlag(`quest.${id}.done`, true);
  if (q.reward.gold) g.earn(q.reward.gold);
  if (q.reward.lp) for (const ch of g.party) ch.lp += q.reward.lp;
  if (q.reward.item) g.addItem(q.reward.item);
}
