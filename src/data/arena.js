// ============================================================================
//  THE COLOSSEUM — an optional side attraction: four gauntlets of back-to-back
//  battles, unlocked by the same story-boss flags the main quest already sets
//  (see data/enemies.js's boss formations). Each tier restores the party
//  between rounds but ends in a guaranteed reward rather than a drop roll —
//  field.js drives the actual round-by-round battle chain; this file only
//  holds what each tier is made of.
// ============================================================================

export const ARENA_TIERS = [
  {
    id: 'bronze', name: 'Bronze Gauntlet', requires: null, lockHint: '',
    rounds: ['gf4', 'cv1', 'gf6'],
    reward: { gold: 900, lp: 10, item: 'brawlersband' },
  },
  {
    id: 'silver', name: 'Silver Gauntlet', requires: 'volk',
    lockHint: "Sealed until the Brigand Chief on the road is dealt with.",
    rounds: ['cv4', 'cv6', 'rn3'],
    reward: { gold: 3400, lp: 20, item: 'gladiatorsigil' },
  },
  {
    id: 'gold', name: 'Gold Gauntlet', requires: 'kharos',
    lockHint: "Sealed until the Cinder Sovereign is quenched.",
    rounds: ['rn7', 'cd4', 'dv3'],
    reward: { gold: 14000, lp: 35, item: 'vanguardcrest' },
  },
  {
    id: 'champion', name: 'Champion Gauntlet', requires: 'vessia',
    lockHint: "Sealed until the Glass Warden's light is ended.",
    rounds: ['gl3', 'ab4', 'boss_arenachampion'],
    reward: { gold: 70000, lp: 70, item: 'championscrown' },
  },
];

export const ARENA_TIER_BY_ID = Object.fromEntries(ARENA_TIERS.map((t) => [t.id, t]));
