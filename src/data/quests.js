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
    type: 'item', itemId: 'healherb', count: 3,
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
    type: 'kill', family: 'beast', count: 3,
    reward: { gold: 140, lp: 3 },
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
    type: 'item', itemId: 'mythril', count: 1,
    reward: { gold: 200, lp: 4, item: 'luckycoin' },
  },
  letter: {
    id: 'letter',
    npc: 'Guildmaster Orrin',
    title: 'Letters Across the Ford',
    hook: "The regular courier won't ride the Hollow road while it's Volk's, and I don't blame him. "
      + "You're going that way regardless. Carry a letter to the Guildhall in Kelda for me?",
    accept: "Recorder Ish will know what to do with it. My thanks — the ledgers hate a gap.",
    reminder: "Still carrying that letter? Kelda's Guildhall, whenever you pass through.",
    type: 'deliver', deliverTo: 'Recorder Ish',
    deliverText: "A letter, carried through the Hollow itself. Orrin always did pick messengers with "
      + "more nerve than sense. Here — for the trouble.",
    reward: { gold: 90, lp: 2 },
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
    type: 'item', itemId: 'spiritglass', count: 2,
    reward: { gold: 180, lp: 4 },
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
    type: 'kill', family: 'aberration', count: 3,
    reward: { gold: 260, lp: 5 },
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

/** Mutates state only — spends the item, flips the flags, grants gold/LP/item.
 *  Callers show their own turn-in dialogue around this. */
export function completeQuest(g, id) {
  const q = QUESTS[id];
  if (q.type === 'item') g.removeItem(q.itemId, q.count);
  g.setFlag(`quest.${id}.active`, false);
  g.setFlag(`quest.${id}.done`, true);
  if (q.reward.gold) g.earn(q.reward.gold);
  if (q.reward.lp) g.lp += q.reward.lp;
  if (q.reward.item) g.addItem(q.reward.item);
}
