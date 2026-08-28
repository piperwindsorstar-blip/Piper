// ============================================================================
//  JOBS — 20 trades, chosen separately from class.
//
//  A CLASS is how you fight. A JOB is what you actually do for a living, and
//  it pays out in three ways:
//
//    1. `bonus`   — flat stat bonuses, scaled by job rank (1..5)
//    2. `field`   — an ability usable outside battle (the gameplay feature)
//    3. `passive` — a persistent world/economy/battle rule
//
//  Job rank rises with USE, not with level: each time the job's field ability
//  succeeds, or its passive triggers, the job earns EXP. Ranks at 0/40/120/
//  280/600 exp. Rank multiplies the stat bonus and improves the ability.
// ============================================================================

export const JOB_RANK_EXP = [0, 40, 120, 280, 600];
export const MAX_JOB_RANK = 5;
export const RANK_TITLES = ['Apprentice', 'Journeyman', 'Craftsman', 'Expert', 'Master'];

// field ability categories, used by the field menu to group entries
export const FIELD_KIND = {
  CRAFT: 'craft',      // opens a crafting UI
  GATHER: 'gather',    // interacts with a resource node
  UTILITY: 'utility',  // acts on the party/world
  SOCIAL: 'social',    // acts on towns/NPCs
};

const J = (o) => o;

export const JOBS = [
  J({
    id: 'blacksmith', name: 'Blacksmith', kind: FIELD_KIND.CRAFT,
    blurb: 'Metal does what it is told, eventually.',
    bonus: { str: 2, vit: 2, hp: 8 },
    field: { id: 'forge', name: 'Forge', text: 'At any anvil, upgrade a weapon using ore. +1 tier per upgrade, up to rank.' },
    passive: { id: 'temper', text: 'Weapons you personally forged deal +6% damage in your hands. Gear never breaks.' },
    likes: ['metal', 'fire'],
  }),
  J({
    id: 'armorer', name: 'Armorer', kind: FIELD_KIND.CRAFT,
    blurb: 'Measures everyone twice, in case.',
    bonus: { vit: 3, hp: 12 },
    field: { id: 'plate', name: 'Refit', text: 'At any anvil, upgrade armour and shields using ore and leather.' },
    passive: { id: 'wellfitted', text: 'The whole party ignores 1 point of armour weight penalty per rank.' },
    likes: ['metal', 'earth'],
  }),
  J({
    id: 'alchemist', name: 'Alchemist', kind: FIELD_KIND.CRAFT,
    blurb: 'The explosions are a teaching method.',
    bonus: { int: 3, mp: 8 },
    field: { id: 'brew', name: 'Brew', text: 'Turn herbs and reagents into potions, elixirs and bombs anywhere.' },
    passive: { id: 'potent', text: 'Potions used BY this character restore +50%. Thrown flasks deal +25%.' },
    likes: ['poison', 'water'],
  }),
  J({
    id: 'herbalist', name: 'Herbalist', kind: FIELD_KIND.GATHER,
    blurb: 'Knows which of the pretty ones will kill you.',
    bonus: { spr: 2, hp: 10, mp: 4 },
    field: { id: 'gatherherb', name: 'Gather', text: 'Harvest herb nodes in the field; higher rank finds rarer reagents.' },
    passive: { id: 'greenhands', text: 'Party recovers 1 HP per step outdoors per rank. Antidotes are free.' },
    likes: ['nature', 'water'],
  }),
  J({
    id: 'merchant', name: 'Merchant', kind: FIELD_KIND.SOCIAL,
    blurb: 'Every corpse is inventory that has not been sorted.',
    bonus: { lck: 3, mp: 4 },
    field: { id: 'haggle', name: 'Haggle', text: 'Re-roll a shop\'s stock and unlock its back room.' },
    passive: { id: 'margins', text: 'Buy 8% cheaper and sell 8% dearer per rank. Battles drop +15% gold per rank.' },
    likes: ['metal', 'lightning'],
  }),
  J({
    id: 'appraiser', name: 'Appraiser', kind: FIELD_KIND.UTILITY,
    blurb: 'Can price a thing by the sound it makes when dropped.',
    bonus: { int: 2, lck: 2 },
    field: { id: 'appraise', name: 'Appraise', text: 'Identify unknown items and reveal their true stats and worth.' },
    passive: { id: 'scrutiny', text: 'Enemy HP, weakness and drop table are visible in battle.' },
    likes: ['light', 'metal'],
  }),
  J({
    id: 'chef', name: 'Chef', kind: FIELD_KIND.CRAFT,
    blurb: 'Morale is a resource and this is where it comes from.',
    bonus: { hp: 16, vit: 1 },
    field: { id: 'cook', name: 'Cook', text: 'At a campfire, cook a meal granting the party a buff until the next rest.' },
    passive: { id: 'wellfed', text: 'Resting at camp restores +25% more HP/MP per rank.' },
    likes: ['fire', 'nature'],
  }),
  J({
    id: 'provisioner', name: 'Provisioner', kind: FIELD_KIND.UTILITY,
    blurb: 'Packed for this. Packed for the other thing too.',
    bonus: { vit: 2, hp: 8, lck: 1 },
    field: { id: 'restock', name: 'Restock', text: 'Convert spare gold into consumables anywhere, at a small markup.' },
    passive: { id: 'deeppack', text: 'Party carry limit +10 stacks per rank. Inns cost 20% less.' },
    likes: ['earth', 'nature'],
  }),
  J({
    id: 'miner', name: 'Miner', kind: FIELD_KIND.GATHER,
    blurb: 'Taps the wall. Believes what it says.',
    bonus: { str: 2, vit: 2, hp: 10 },
    field: { id: 'mine', name: 'Mine', text: 'Break ore veins for metal and gems. Rank raises rare-vein yield.' },
    passive: { id: 'stonesense', text: 'False walls and hidden passages glow faintly in caves.' },
    likes: ['earth', 'metal'],
  }),
  J({
    id: 'fisher', name: 'Fisher', kind: FIELD_KIND.GATHER,
    blurb: 'The patient one. Suspiciously patient.',
    bonus: { agi: 1, spr: 2, mp: 6 },
    field: { id: 'fish', name: 'Fish', text: 'Fish any water tile for food, reagents and the occasional sunken relic.' },
    passive: { id: 'seasense', text: 'Water encounters drop 20% and river crossings never fail.' },
    likes: ['water', 'ice'],
  }),
  J({
    id: 'hunter', name: 'Hunter', kind: FIELD_KIND.UTILITY,
    blurb: 'Reads the ground like a duty roster.',
    bonus: { str: 2, agi: 2 },
    field: { id: 'track', name: 'Track', text: 'Raise or suppress the encounter rate at will; hunt a named quarry.' },
    passive: { id: 'butcher', text: 'Beast enemies drop +1 material per rank and take +5% damage per rank.' },
    likes: ['wind', 'nature'],
  }),
  J({
    id: 'scout', name: 'Scout', kind: FIELD_KIND.UTILITY,
    blurb: 'Back before anyone noticed they were gone.',
    bonus: { agi: 3, lck: 1 },
    field: { id: 'survey', name: 'Survey', text: 'Reveal the surrounding map, treasure and stairs from where you stand.' },
    passive: { id: 'firststrike', text: 'Pre-emptive strike chance +8% per rank; the party is never ambushed at rank 5.' },
    likes: ['wind', 'light'],
  }),
  J({
    id: 'cartographer', name: 'Cartographer', kind: FIELD_KIND.UTILITY,
    blurb: 'The map is the point. The treasure is a footnote.',
    bonus: { int: 2, spr: 1, mp: 6 },
    field: { id: 'chart', name: 'Chart', text: 'Auto-map the current floor and mark unopened chests.' },
    passive: { id: 'waypoints', text: 'Fast-travel between any two fully mapped towns.' },
    likes: ['wind', 'spirit'],
  }),
  J({
    id: 'locksmith', name: 'Locksmith', kind: FIELD_KIND.UTILITY,
    blurb: 'Doors are a formality between friends.',
    bonus: { agi: 2, lck: 2 },
    field: { id: 'pick', name: 'Pick Lock', text: 'Open locked chests and doors; disarm traps on them.' },
    passive: { id: 'trapsense', text: 'Traps are revealed one tile early and deal 20% less per rank.' },
    likes: ['dark', 'metal'],
  }),
  J({
    id: 'tamer', name: 'Tamer', kind: FIELD_KIND.UTILITY,
    blurb: 'Names them. That is usually the mistake.',
    bonus: { spr: 2, hp: 8, lck: 1 },
    field: { id: 'tame', name: 'Tame', text: 'Recruit a weakened monster; it fights from the 5th grid cell.' },
    passive: { id: 'kinship', text: 'Your tamed companion gains +10% of its stats per rank and revives after battle.' },
    likes: ['nature', 'spirit'],
  }),
  J({
    id: 'scribe', name: 'Scribe', kind: FIELD_KIND.CRAFT,
    blurb: 'Copies everything. Reads most of it.',
    bonus: { int: 3, mp: 6 },
    field: { id: 'transcribe', name: 'Transcribe', text: 'Copy a known skill onto a scroll any party member can use once.' },
    passive: { id: 'tutor', text: 'The whole party earns +5% EXP per rank. Bestiary fills automatically.' },
    likes: ['light', 'spirit'],
  }),
  J({
    id: 'bard', name: 'Bard', kind: FIELD_KIND.SOCIAL,
    blurb: 'Will absolutely write a song about this.',
    bonus: { spr: 2, lck: 2, mp: 4 },
    field: { id: 'perform', name: 'Perform', text: 'Play in a tavern for gold, rumours and the location of one nearby secret.' },
    passive: { id: 'morale', text: 'Party starts battle with +8 IP per rank and resists Fear and Confusion.' },
    likes: ['wind', 'light'],
  }),
  J({
    id: 'pilgrim', name: 'Pilgrim', kind: FIELD_KIND.SOCIAL,
    blurb: 'Walking somewhere. Has been for years.',
    bonus: { spr: 3, hp: 6 },
    field: { id: 'consecrate', name: 'Consecrate', text: 'Bless a campsite: no ambush, and full revival costs nothing there.' },
    passive: { id: 'grace', text: 'Church revival costs 30% less per rank; the party resists Instant Death.' },
    likes: ['light', 'spirit'],
  }),
  J({
    id: 'artificer', name: 'Artificer', kind: FIELD_KIND.CRAFT,
    blurb: 'It only needs one more spring. It always needs one more spring.',
    bonus: { int: 2, agi: 1, str: 1 },
    field: { id: 'build', name: 'Build', text: 'Assemble bombs, traps and one deployable turret per battle.' },
    passive: { id: 'gearhead', text: 'Construct and Machine enemies take +10% damage per rank; deployables last longer.' },
    likes: ['lightning', 'metal'],
  }),
  J({
    id: 'sailor', name: 'Sailor', kind: FIELD_KIND.UTILITY,
    blurb: 'Has been everywhere and remembers the harbours.',
    bonus: { str: 1, agi: 2, hp: 10 },
    field: { id: 'pilot', name: 'Pilot', text: 'Crew any vessel; navigate storms and shallow reefs safely.' },
    passive: { id: 'seadog', text: 'No sea encounters while at the helm. +1 party movement speed on water.' },
    likes: ['water', 'wind'],
  }),
];

export const JOB_BY_ID = Object.fromEntries(JOBS.map((j) => [j.id, j]));
export const JOB_IDS = JOBS.map((j) => j.id);

export function getJob(id) {
  const j = JOB_BY_ID[id];
  if (!j) throw new Error(`unknown job: ${id}`);
  return j;
}

export function jobRankFromExp(exp) {
  let r = 1;
  for (let i = 0; i < JOB_RANK_EXP.length; i++) if (exp >= JOB_RANK_EXP[i]) r = i + 1;
  return Math.min(r, MAX_JOB_RANK);
}

export function jobExpToNext(exp) {
  const r = jobRankFromExp(exp);
  if (r >= MAX_JOB_RANK) return null;
  return JOB_RANK_EXP[r] - exp;
}

/** Stat bonus for a job at a given rank. Rank 1 gives the listed value; each
 *  further rank adds another 60% of it, so rank 5 is ~3.4x. */
export function jobBonus(id, rank) {
  const j = getJob(id);
  const mult = 1 + 0.6 * (Math.max(1, rank) - 1);
  const out = {};
  for (const [k, v] of Object.entries(j.bonus)) out[k] = Math.round(v * mult);
  return out;
}

/** A character whose element matches one the job `likes` earns job exp 25% faster. */
export function jobAffinityBonus(jobId, elementId) {
  return getJob(jobId).likes.includes(elementId) ? 1.25 : 1;
}
