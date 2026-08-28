// ============================================================================
//  CLASSES — 12 roots, each growing a 10-node promotion tree.
//
//  Promotion happens every 5 levels:
//
//     Lv  5  Tier 1   linear    (1 successor)
//     Lv 10  Tier 2   BRANCH    (choose 1 of 2)
//     Lv 15  Tier 3   linear    (1 successor)
//     Lv 20  Tier 4   BRANCH    (choose 1 of 2)  <- capstone
//
//  So every root reaches one of four distinct capstones, and there are
//  12 x 10 = 120 class nodes in total. Past Lv20 a character keeps their
//  capstone class and continues growing through levels, jobs and gear.
//
//  A node does not carry its own stat table. It carries a BIAS applied to its
//  root's growth profile, scaled by TIER_FACTOR. That keeps 120 nodes honest:
//  a Berserker is always a Warrior who traded defence for violence.
// ============================================================================

export const PROMOTION_LEVELS = [5, 10, 15, 20];
export const BRANCH_TIERS = [2, 4];          // tiers reached at Lv10 and Lv20
export const MAX_TIER = 4;

export const STAT_KEYS = ['hp', 'mp', 'str', 'vit', 'agi', 'int', 'spr', 'lck'];

// per-level growth at tier 0, in STAT_KEYS order
const PROFILES = {
  warrior:   [8.0, 1.0, 3.2, 2.6, 1.6, 0.8, 1.2, 1.2],
  guardian:  [9.5, 1.0, 2.4, 3.4, 1.0, 0.8, 1.6, 1.0],
  monk:      [8.5, 0.8, 3.0, 2.4, 2.4, 0.8, 1.4, 1.4],
  lancer:    [7.5, 1.2, 3.0, 2.4, 2.0, 1.0, 1.2, 1.2],
  thief:     [6.0, 1.2, 2.4, 1.8, 3.6, 1.4, 1.0, 2.4],
  archer:    [6.0, 1.4, 2.6, 1.8, 3.0, 1.6, 1.2, 2.0],
  dancer:    [6.0, 2.0, 2.2, 1.8, 3.2, 1.8, 1.8, 2.2],
  jester:    [5.5, 2.2, 1.8, 1.6, 2.6, 2.0, 1.6, 4.0],
  mage:      [4.5, 3.6, 1.2, 1.4, 1.8, 4.0, 2.0, 1.4],
  cleric:    [5.5, 3.2, 1.6, 2.0, 1.6, 2.6, 3.6, 1.4],
  summoner:  [5.0, 3.8, 1.4, 1.6, 1.6, 3.4, 2.8, 1.6],
  spiritist: [5.0, 3.4, 1.4, 1.6, 2.0, 3.0, 3.0, 2.2],
};

export const TIER_FACTOR = [1.0, 1.22, 1.48, 1.78, 2.12];
export const TIER_NAME = ['Novice', 'Adept', 'Veteran', 'Elite', 'Master'];

// One-time stat award granted the moment a promotion is accepted.
export const PROMOTION_BONUS = [
  null,
  { hp: 24, mp: 10, str: 2, vit: 2, agi: 2, int: 2, spr: 2, lck: 1 },
  { hp: 45, mp: 18, str: 4, vit: 4, agi: 3, int: 4, spr: 4, lck: 2 },
  { hp: 75, mp: 30, str: 6, vit: 6, agi: 5, int: 6, spr: 6, lck: 3 },
  { hp: 120, mp: 48, str: 9, vit: 9, agi: 8, int: 9, spr: 9, lck: 5 },
];

// bias shorthand: { str: 1.3, vit: 0.8 } — anything unlisted is 1.0
const b = (o = {}) => o;

// n(id, name, bias, schools, blurb, [children])
const n = (id, name, bias, schools, blurb, children = []) =>
  ({ id, name, bias, schools, blurb, children });

// ---------------------------------------------------------------------------
//  THE TWELVE TREES
// ---------------------------------------------------------------------------
const TREES = [
  {
    root: 'warrior', name: 'Warrior', profile: 'warrior',
    role: 'Front-line bruiser',
    blurb: 'A sword, a shield, and no particular gift for talking things out.',
    weapons: ['sword', 'axe', 'spear'], armor: ['heavy'],
    schools: ['sword'],
    tree: n('warrior', 'Warrior', b(), ['sword'], '', [
      n('vanguard', 'Vanguard', b({ str: 1.08, hp: 1.05 }), ['sword'],
        'First through the door, every time.', [
        n('knight', 'Knight', b({ vit: 1.2, spr: 1.15, agi: 0.9 }), ['sword', 'guard'],
          'Discipline given a title and a horse.', [
          n('paladin', 'Paladin', b({ vit: 1.2, spr: 1.3, int: 1.1 }), ['sword', 'guard', 'holy'],
            'An oath that answers back when struck.', [
            n('swordsaint', 'Sword Saint', b({ str: 1.35, agi: 1.2, hp: 0.95 }), ['sword', 'holy', 'arcane'],
              'One cut. There is never a second.'),
            n('templar', 'Templar', b({ vit: 1.3, spr: 1.35, hp: 1.15 }), ['sword', 'guard', 'holy', 'arcane'],
              'The wall the faithful stand behind.'),
          ]),
        ]),
        n('berserker', 'Berserker', b({ str: 1.3, hp: 1.1, vit: 0.8, spr: 0.7 }), ['sword', 'rage'],
          'Trades every defence for one more swing.', [
          n('warlord', 'Warlord', b({ str: 1.35, hp: 1.15, vit: 0.85, spr: 0.75 }), ['sword', 'rage'],
            'Violence, but organised.', [
            n('ravager', 'Ravager', b({ str: 1.6, agi: 1.15, vit: 0.75, spr: 0.6 }), ['rage', 'arcane'],
              'Stops when there is nothing left standing.'),
            n('warbringer', 'Warbringer', b({ str: 1.4, hp: 1.3, vit: 1.1, spr: 0.8 }), ['sword', 'rage', 'guard'],
              'Brings the war with him, wherever he goes.'),
          ]),
        ]),
      ]),
    ]),
  },
  {
    root: 'guardian', name: 'Guardian', profile: 'guardian',
    role: 'Defender / protector',
    blurb: 'Exists so that someone else gets to finish their sentence.',
    weapons: ['sword', 'mace', 'shield'], armor: ['heavy'],
    schools: ['guard'],
    tree: n('guardian', 'Guardian', b(), ['guard'], '', [
      n('sentinel', 'Sentinel', b({ vit: 1.1, hp: 1.08 }), ['guard'],
        'Sleeps standing up, if at all.', [
        n('bulwark', 'Bulwark', b({ vit: 1.25, hp: 1.15, agi: 0.85 }), ['guard'],
          'Not a person so much as a decision to not move.', [
          n('aegisknight', 'Aegis Knight', b({ vit: 1.3, spr: 1.2, hp: 1.2 }), ['guard', 'sword'],
            'The shield learned to strike back.', [
            n('bastion', 'Bastion', b({ vit: 1.55, hp: 1.4, agi: 0.75 }), ['guard', 'arcane'],
              'Sieges are named after the people who failed to take him.'),
            n('sanctuary', 'Sanctuary Knight', b({ spr: 1.5, vit: 1.25, mp: 1.4 }), ['guard', 'holy', 'arcane'],
              'Where he plants his shield, the wounded are safe.'),
          ]),
        ]),
        n('custodian', 'Custodian', b({ spr: 1.2, mp: 1.2, str: 1.05 }), ['guard', 'holy'],
          'Keeper of doors that should stay shut.', [
          n('ironward', 'Ironward', b({ vit: 1.25, spr: 1.3, hp: 1.1 }), ['guard', 'holy'],
            'Wards written in iron filings and stubbornness.', [
            n('colossus', 'Colossus', b({ hp: 1.6, vit: 1.35, agi: 0.7, str: 1.2 }), ['guard', 'rage', 'arcane'],
              'You do not flank a wall this wide.'),
            n('adamantine', 'Adamantine', b({ vit: 1.5, spr: 1.4, hp: 1.25 }), ['guard', 'holy', 'arcane'],
              'Has never once been described as flexible.'),
          ]),
        ]),
      ]),
    ]),
  },
  {
    root: 'monk', name: 'Monk', profile: 'monk',
    role: 'Unarmed striker',
    blurb: 'Owns two fists and a strong opinion about weapons.',
    weapons: ['fist', 'staff'], armor: ['light'],
    schools: ['fist'],
    tree: n('monk', 'Monk', b(), ['fist'], '', [
      n('adept', 'Adept', b({ str: 1.08, agi: 1.08 }), ['fist'],
        'Has stopped counting the push-ups.', [
        n('martialartist', 'Martial Artist', b({ str: 1.25, agi: 1.15, hp: 1.05 }), ['fist'],
          'Every part of the body is a blunt instrument.', [
          n('grandmaster', 'Grandmaster', b({ str: 1.3, agi: 1.25, vit: 1.1 }), ['fist', 'ki'],
            'Teaches by demonstration. It is not gentle.', [
            n('dragonfist', 'Dragon Fist', b({ str: 1.55, agi: 1.3, hp: 1.1 }), ['fist', 'ki', 'arcane'],
              'The strike arrives before the wind-up.'),
            n('ironsaint', 'Iron Saint', b({ vit: 1.4, hp: 1.35, str: 1.25 }), ['fist', 'ki', 'guard'],
              'Breaks weapons with the flat of a palm.'),
          ]),
        ]),
        n('ascetic', 'Ascetic', b({ spr: 1.3, mp: 1.4, hp: 0.95 }), ['fist', 'ki'],
          'Gave up comfort and got something better.', [
          n('enlightened', 'Enlightened', b({ spr: 1.35, mp: 1.45, int: 1.15 }), ['fist', 'ki', 'white'],
            'Fights the way water argues.', [
            n('arhat', 'Arhat', b({ spr: 1.6, mp: 1.6, hp: 1.15 }), ['ki', 'white', 'arcane'],
              'Has counted every breath he has left and is unbothered.'),
            n('voidmonk', 'Void Monk', b({ str: 1.35, spr: 1.4, agi: 1.25 }), ['fist', 'ki', 'arcane'],
              'Strikes at what a thing is, not where it stands.'),
          ]),
        ]),
      ]),
    ]),
  },
  {
    root: 'lancer', name: 'Lancer', profile: 'lancer',
    role: 'Reach fighter',
    blurb: 'Hits the back row from the front row and calls it good manners.',
    weapons: ['spear', 'sword'], armor: ['heavy'],
    schools: ['lance'],
    tree: n('lancer', 'Lancer', b(), ['lance'], '', [
      n('pikeman', 'Pikeman', b({ str: 1.08, vit: 1.05 }), ['lance'],
        'Learned the hard way that the pointy end goes forward.', [
        n('dragoon', 'Dragoon', b({ agi: 1.2, str: 1.2, hp: 1.05 }), ['lance'],
          'Solves most problems by leaving the ground.', [
          n('wyvernknight', 'Wyvern Knight', b({ agi: 1.3, str: 1.25, vit: 1.05 }), ['lance', 'wild'],
            'The wyvern tolerates him. That is the whole relationship.', [
            n('skylancer', 'Sky Lancer', b({ agi: 1.5, str: 1.35, hp: 0.95 }), ['lance', 'wild', 'arcane'],
              'Comes down like weather.'),
            n('wyrmcaller', 'Wyrmcaller', b({ str: 1.3, int: 1.35, mp: 1.4 }), ['lance', 'beast', 'arcane'],
              'Old things answer when he raises the spear.'),
          ]),
        ]),
        n('halberdier', 'Halberdier', b({ vit: 1.2, str: 1.15, agi: 0.95 }), ['lance', 'guard'],
          'Hook, chop, or hold the line. Usually all three.', [
          n('phalanx', 'Phalanx', b({ vit: 1.3, str: 1.2, hp: 1.15 }), ['lance', 'guard'],
            'One man who fights like a formation.', [
            n('impaler', 'Impaler', b({ str: 1.55, vit: 1.1, agi: 1.1 }), ['lance', 'rage', 'arcane'],
              'Reach measured in regrets.'),
            n('stormpike', 'Stormpike', b({ agi: 1.35, str: 1.3, int: 1.2 }), ['lance', 'elem', 'arcane'],
              'The spear draws the lightning down on purpose.'),
          ]),
        ]),
      ]),
    ]),
  },
  {
    root: 'thief', name: 'Thief', profile: 'thief',
    role: 'Speed / larceny',
    blurb: 'Goes first, takes things, apologises never.',
    weapons: ['dagger', 'sword'], armor: ['light'],
    schools: ['steal'],
    tree: n('thief', 'Thief', b(), ['steal'], '', [
      n('cutpurse', 'Cutpurse', b({ agi: 1.1, lck: 1.1 }), ['steal'],
        'Fast hands, faster exits.', [
        n('rogue', 'Rogue', b({ agi: 1.2, str: 1.15, lck: 1.1 }), ['steal', 'shadow'],
          'Has upgraded from pockets to throats.', [
          n('assassin', 'Assassin', b({ agi: 1.3, str: 1.25, lck: 1.15 }), ['shadow', 'steal'],
            'Charges by the second, not the hour.', [
            n('ninja', 'Ninja', b({ agi: 1.55, str: 1.3, int: 1.2 }), ['shadow', 'elem', 'arcane'],
              'Two blades, six ways out of the room.'),
            n('nightblade', 'Nightblade', b({ str: 1.4, agi: 1.35, lck: 1.3 }), ['shadow', 'dark', 'arcane'],
              'The dark holds the knife for him.'),
          ]),
        ]),
        n('prowler', 'Prowler', b({ agi: 1.25, lck: 1.2, spr: 1.05 }), ['steal', 'shadow'],
          'Not stealthy. Simply never where you looked.', [
          n('phantom', 'Phantom', b({ agi: 1.35, lck: 1.25, mp: 1.2 }), ['shadow', 'illusion'],
            'Witnesses disagree about how many there were.', [
            n('shadowdancer', 'Shadowdancer', b({ agi: 1.6, lck: 1.3, str: 1.15 }), ['shadow', 'dance', 'arcane'],
              'Fights in the gaps between torchlight.'),
            n('mirage', 'Mirage', b({ agi: 1.4, int: 1.35, mp: 1.4 }), ['shadow', 'illusion', 'arcane'],
              'You have been fighting a rumour for six turns.'),
          ]),
        ]),
      ]),
    ]),
  },
  {
    root: 'archer', name: 'Archer', profile: 'archer',
    role: 'Ranged damage',
    blurb: 'Prefers conversations that happen at ninety paces.',
    weapons: ['bow', 'dagger'], armor: ['light'],
    schools: ['bow'],
    tree: n('archer', 'Archer', b(), ['bow'], '', [
      n('bowman', 'Bowman', b({ agi: 1.08, str: 1.05 }), ['bow'],
        'Counts arrows the way misers count coins.', [
        n('marksman', 'Marksman', b({ agi: 1.2, str: 1.15, lck: 1.1 }), ['bow'],
          'Picks the target, then picks the spot on the target.', [
          n('sharpshooter', 'Sharpshooter', b({ agi: 1.25, str: 1.25, lck: 1.15 }), ['bow'],
            'Has opinions about wind that are always correct.', [
            n('deadeye', 'Deadeye', b({ str: 1.4, lck: 1.5, agi: 1.2 }), ['bow', 'arcane'],
              'Criticals are not luck. They are scheduling.'),
            n('arbalist', 'Arbalist', b({ str: 1.55, vit: 1.15, agi: 0.95 }), ['bow', 'guard', 'arcane'],
              'Carries something that should require a crew.'),
          ]),
        ]),
        n('ranger', 'Ranger', b({ agi: 1.2, vit: 1.1, spr: 1.1 }), ['bow', 'wild'],
          'At home where there are no homes.', [
          n('pathfinder', 'Pathfinder', b({ agi: 1.3, spr: 1.15, lck: 1.2 }), ['bow', 'wild'],
            'Knows the shortcut. Has always known the shortcut.', [
            n('wildstrider', 'Wildstrider', b({ agi: 1.4, vit: 1.25, spr: 1.25 }), ['bow', 'wild', 'beast', 'arcane'],
              'Arrives with company you cannot negotiate with.'),
            n('windrunner', 'Windrunner', b({ agi: 1.6, lck: 1.25, str: 1.15 }), ['bow', 'wild', 'elem', 'arcane'],
              'Outruns the arrow, occasionally.'),
          ]),
        ]),
      ]),
    ]),
  },
  {
    root: 'dancer', name: 'Dancer', profile: 'dancer',
    role: 'Status / battlefield control',
    blurb: 'Every step is a spell nobody thought to ban.',
    weapons: ['dagger', 'sword', 'whip'], armor: ['light'],
    schools: ['dance'],
    tree: n('dancer', 'Dancer', b(), ['dance'], '', [
      n('performer', 'Performer', b({ agi: 1.08, lck: 1.08 }), ['dance'],
        'Plays to the room, even when the room bites.', [
        n('bladedancer', 'Blade Dancer', b({ str: 1.2, agi: 1.2, vit: 1.05 }), ['dance', 'sword'],
          'The choreography is load-bearing.', [
          n('wardancer', 'War Dancer', b({ str: 1.25, agi: 1.3, hp: 1.1 }), ['dance', 'sword'],
            'Leads the battle line like a chorus.', [
            n('tempestdancer', 'Tempest Dancer', b({ agi: 1.55, str: 1.3, lck: 1.2 }), ['dance', 'elem', 'arcane'],
              'Hits everything in a circle and calls it a finale.'),
            n('sabremuse', 'Sabre Muse', b({ str: 1.4, spr: 1.3, mp: 1.3 }), ['dance', 'song', 'arcane'],
              'The blade keeps time; the song keeps the party alive.'),
          ]),
        ]),
        n('charmer', 'Charmer', b({ spr: 1.25, int: 1.15, mp: 1.25 }), ['dance', 'song'],
          'Wins fights that never quite start.', [
          n('mysticdancer', 'Mystic Dancer', b({ int: 1.25, spr: 1.3, mp: 1.35 }), ['dance', 'song', 'hex'],
            'Dances the enemy out of their own plan.', [
            n('siren', 'Siren', b({ spr: 1.5, mp: 1.5, int: 1.3 }), ['song', 'hex', 'arcane'],
              'Nobody remembers agreeing to anything.'),
            n('dreamweaver', 'Dream Weaver', b({ int: 1.45, mp: 1.45, lck: 1.3 }), ['song', 'illusion', 'arcane'],
              'Fights are shorter when the enemy is asleep.'),
          ]),
        ]),
      ]),
    ]),
  },
  {
    root: 'jester', name: 'Jester', profile: 'jester',
    role: 'Luck / chaos',
    blurb: 'Statistically a liability. Occasionally a legend.',
    weapons: ['dagger', 'whip', 'staff'], armor: ['light'],
    schools: ['luck'],
    tree: n('jester', 'Jester', b(), ['luck'], '', [
      n('fool', 'Fool', b({ lck: 1.15 }), ['luck'],
        'The only party member the dice actually like.', [
        n('gambler', 'Gambler', b({ lck: 1.3, agi: 1.1 }), ['luck'],
          'Has never once hedged a bet.', [
          n('highroller', 'High Roller', b({ lck: 1.4, agi: 1.15, str: 1.1 }), ['luck'],
            'Doubles down on principle.', [
            n('wildcard', 'Wildcard', b({ lck: 1.8, agi: 1.3, str: 1.2 }), ['luck', 'arcane'],
              'The odds are a suggestion and he is not taking it.'),
            n('kingmaker', 'Kingmaker', b({ lck: 1.6, spr: 1.3, mp: 1.3 }), ['luck', 'song', 'arcane'],
              'Never wins. Decides who does.'),
          ]),
        ]),
        n('harlequin', 'Harlequin', b({ int: 1.2, mp: 1.25, lck: 1.2 }), ['luck', 'illusion'],
          'The joke has three layers and one of them is a knife.', [
          n('illusionist', 'Illusionist', b({ int: 1.3, mp: 1.35, lck: 1.25 }), ['illusion', 'hex'],
            'Reality is a consensus and he is voting against.', [
            n('sage', 'Sage', b({ int: 1.5, mp: 1.6, spr: 1.5, lck: 1.2 }), ['elem', 'white', 'illusion', 'arcane'],
              'The old joke: the fool who studied everything.'),
            n('puppetmaster', 'Puppetmaster', b({ int: 1.45, mp: 1.4, lck: 1.35 }), ['illusion', 'hex', 'arcane'],
              'Strings you cannot see, attached to choices you thought were yours.'),
          ]),
        ]),
      ]),
    ]),
  },
  {
    root: 'mage', name: 'Mage', profile: 'mage',
    role: 'Elemental artillery',
    blurb: 'Fragile, expensive, and the reason the wall is gone.',
    weapons: ['staff', 'dagger'], armor: ['cloth'],
    schools: ['elem'],
    tree: n('mage', 'Mage', b(), ['elem'], '', [
      n('magician', 'Magician', b({ int: 1.1, mp: 1.1 }), ['elem'],
        'Two spells and enormous confidence.', [
        n('elementalist', 'Elementalist', b({ int: 1.25, mp: 1.25 }), ['elem'],
          'Speaks to the wheel in its own language.', [
          n('sorcerer', 'Sorcerer', b({ int: 1.35, mp: 1.35, spr: 1.1 }), ['elem'],
            'Casts first. Reads the consequences later.', [
            n('archmage', 'Archmage', b({ int: 1.7, mp: 1.6, spr: 1.2 }), ['elem', 'arcane'],
              'The ceiling of what a person can memorise.'),
            n('elementallord', 'Elemental Lord', b({ int: 1.55, mp: 1.5, vit: 1.2, hp: 1.2 }), ['elem', 'spirit', 'arcane'],
              'Does not cast the element. Is on loan from it.'),
          ]),
        ]),
        n('warlock', 'Warlock', b({ int: 1.3, mp: 1.2, spr: 0.85, hp: 1.1 }), ['elem', 'dark'],
          'Signed something. Won’t say what.', [
          n('necromancer', 'Necromancer', b({ int: 1.4, mp: 1.3, hp: 1.15, spr: 0.85 }), ['dark', 'hex'],
            'Believes death is a staffing problem.', [
            n('deathspeaker', 'Deathspeaker', b({ int: 1.6, mp: 1.5, hp: 1.2 }), ['dark', 'hex', 'arcane'],
              'The dead take instruction well.'),
            n('doomcaller', 'Doomcaller', b({ int: 1.75, mp: 1.55, spr: 0.8, hp: 0.95 }), ['dark', 'elem', 'arcane'],
              'One spell. Everyone in the room is included.'),
          ]),
        ]),
      ]),
    ]),
  },
  {
    root: 'cleric', name: 'Cleric', profile: 'cleric',
    role: 'Healer / protector',
    blurb: 'The reason the rest of you are still arguing about loot.',
    weapons: ['mace', 'staff'], armor: ['medium'],
    schools: ['white'],
    tree: n('cleric', 'Cleric', b(), ['white'], '', [
      n('acolyte', 'Acolyte', b({ spr: 1.1, mp: 1.1 }), ['white'],
        'Still nervous about the blood.', [
        n('priest', 'Priest', b({ spr: 1.25, mp: 1.25 }), ['white'],
          'Keeps a running tally of who owes whom a resurrection.', [
          n('bishop', 'Bishop', b({ spr: 1.35, mp: 1.35, int: 1.1 }), ['white', 'holy'],
            'Authority, and the paperwork to prove it.', [
            n('hierophant', 'Hierophant', b({ spr: 1.7, mp: 1.6, int: 1.25 }), ['white', 'holy', 'arcane'],
              'Heals the whole line without looking up.'),
            n('saint', 'Saint', b({ spr: 1.6, mp: 1.5, vit: 1.25, hp: 1.25 }), ['white', 'holy', 'guard', 'arcane'],
              'Death has been asked, politely, to wait.'),
          ]),
        ]),
        n('exorcist', 'Exorcist', b({ int: 1.25, spr: 1.15, str: 1.1 }), ['white', 'holy'],
          'Treats possession as a trespassing matter.', [
          n('inquisitor', 'Inquisitor', b({ int: 1.3, str: 1.25, spr: 1.15 }), ['holy', 'hex'],
            'Asks questions the answers to which are already written down.', [
            n('purifier', 'Purifier', b({ int: 1.5, spr: 1.4, mp: 1.4 }), ['holy', 'white', 'arcane'],
              'Burns the curse out and most of the surroundings.'),
            n('witchhunter', 'Witch Hunter', b({ str: 1.45, agi: 1.3, spr: 1.3 }), ['holy', 'hex', 'bow', 'arcane'],
              'Specialises in things that thought they were safe.'),
          ]),
        ]),
      ]),
    ]),
  },
  {
    root: 'summoner', name: 'Summoner', profile: 'summoner',
    role: 'Summons / burst',
    blurb: 'Does not fight. Introduces you to something that will.',
    weapons: ['staff', 'whip'], armor: ['cloth'],
    schools: ['summon'],
    tree: n('summoner', 'Summoner', b(), ['summon'], '', [
      n('invoker', 'Invoker', b({ int: 1.1, mp: 1.12 }), ['summon'],
        'Knows three names and pronounces two correctly.', [
        n('evoker', 'Evoker', b({ int: 1.25, mp: 1.3 }), ['summon'],
          'Calls big. Pays for it.', [
          n('conjurer', 'Conjurer', b({ int: 1.35, mp: 1.4, spr: 1.15 }), ['summon', 'elem'],
            'Holds the gate open a little longer each time.', [
            n('espercaller', 'Espercaller', b({ int: 1.65, mp: 1.65, spr: 1.3 }), ['summon', 'elem', 'arcane'],
              'The old powers come when called, and stay a while.'),
            n('aeonbinder', 'Aeon Binder', b({ int: 1.55, mp: 1.55, vit: 1.2, hp: 1.2 }), ['summon', 'spirit', 'arcane'],
              'What is summoned does not leave until the work is done.'),
          ]),
        ]),
        n('beastcaller', 'Beastcaller', b({ str: 1.2, vit: 1.15, int: 1.15 }), ['summon', 'beast'],
          'Prefers company with teeth.', [
          n('beastlord', 'Beastlord', b({ str: 1.3, vit: 1.25, int: 1.2, hp: 1.15 }), ['beast', 'wild'],
            'The pack has opinions and they match his.', [
            n('chimeralord', 'Chimera Lord', b({ str: 1.45, int: 1.4, hp: 1.3 }), ['beast', 'hex', 'arcane'],
              'Builds the monster he needs from the parts available.'),
            n('primalwarden', 'Primal Warden', b({ vit: 1.4, spr: 1.4, hp: 1.35, int: 1.25 }), ['beast', 'spirit', 'arcane'],
              'Speaks for things older than speech.'),
          ]),
        ]),
      ]),
    ]),
  },
  {
    root: 'spiritist', name: 'Spiritist', profile: 'spiritist',
    role: 'Debuff / status magic',
    blurb: 'Wins by making the other side worse at their job.',
    weapons: ['staff', 'dagger', 'whip'], armor: ['cloth'],
    schools: ['hex'],
    tree: n('spiritist', 'Spiritist', b(), ['hex'], '', [
      n('medium', 'Medium', b({ spr: 1.1, mp: 1.1 }), ['hex'],
        'Hears both sides of every conversation.', [
        n('hexer', 'Hexer', b({ int: 1.25, mp: 1.2, lck: 1.1 }), ['hex'],
          'Keeps a list. The list is not flattering.', [
          n('curseweaver', 'Curse Weaver', b({ int: 1.35, mp: 1.3, lck: 1.2 }), ['hex', 'dark'],
            'Ties misfortune into something wearable.', [
            n('anathema', 'Anathema', b({ int: 1.6, mp: 1.45, lck: 1.35 }), ['hex', 'dark', 'arcane'],
              'To be named by her is a status effect.'),
            n('soulbinder', 'Soulbinder', b({ int: 1.5, spr: 1.45, mp: 1.5 }), ['hex', 'spirit', 'arcane'],
              'Holds the thread and decides when to let go.'),
          ]),
        ]),
        n('shaman', 'Shaman', b({ spr: 1.3, mp: 1.25, vit: 1.1 }), ['hex', 'spirit'],
          'Asks the land for a favour and usually gets it.', [
          n('oracle', 'Oracle', b({ spr: 1.35, int: 1.25, mp: 1.35 }), ['spirit', 'white'],
            'Answers the question you should have asked.', [
            n('seer', 'Seer', b({ spr: 1.55, int: 1.4, lck: 1.45 }), ['spirit', 'white', 'arcane'],
              'Acts on information that has not happened yet.'),
            n('worldspeaker', 'Worldspeaker', b({ spr: 1.6, int: 1.5, mp: 1.55, hp: 1.15 }), ['spirit', 'elem', 'arcane'],
              'The wheel itself leans in to listen.'),
          ]),
        ]),
      ]),
    ]),
  },
];

// ---------------------------------------------------------------------------
//  FLATTEN
// ---------------------------------------------------------------------------
const CLASS_MAP = {};
const ROOTS = [];

function walk(node, tree, tier, parent) {
  const growth = {};
  const profile = PROFILES[tree.profile];
  STAT_KEYS.forEach((k, i) => {
    growth[k] = +(profile[i] * TIER_FACTOR[tier] * (node.bias[k] ?? 1)).toFixed(3);
  });
  const entry = {
    id: node.id,
    name: node.name,
    tier,
    tierName: TIER_NAME[tier],
    root: tree.root,
    parent,
    promotions: node.children.map((c) => c.id),
    isBranch: node.children.length > 1,
    promoteLevel: tier < MAX_TIER ? PROMOTION_LEVELS[tier] : null,
    role: tree.role,
    blurb: node.blurb || tree.blurb,
    schools: node.schools.slice(),
    weapons: tree.weapons.slice(),
    armor: tree.armor.slice(),
    growth,
    bias: node.bias,
  };
  CLASS_MAP[node.id] = entry;
  for (const child of node.children) walk(child, tree, tier + 1, node.id);
  return entry;
}

for (const tree of TREES) {
  ROOTS.push(walk(tree.tree, tree, 0, null));
}

export const CLASSES = CLASS_MAP;
export const ROOT_CLASSES = ROOTS;
export const CLASS_IDS = Object.keys(CLASS_MAP);

export function getClass(id) {
  const c = CLASS_MAP[id];
  if (!c) throw new Error(`unknown class: ${id}`);
  return c;
}

/** Class ids from root down to `id`, inclusive. */
export function classLineage(id) {
  const line = [];
  let cur = CLASS_MAP[id];
  while (cur) {
    line.unshift(cur.id);
    cur = cur.parent ? CLASS_MAP[cur.parent] : null;
  }
  return line;
}

/** The promotion a character at `level` in class `id` is owed, or null. */
export function pendingPromotion(id, level) {
  const c = getClass(id);
  if (!c.promotions.length) return null;
  if (level < c.promoteLevel) return null;
  return {
    from: c.id,
    level: c.promoteLevel,
    tier: c.tier + 1,
    branching: c.promotions.length > 1,
    choices: c.promotions.map((p) => CLASS_MAP[p]),
  };
}

/** Every school this class node has access to (its own only — promotion replaces). */
export function classSchools(id) {
  return getClass(id).schools;
}
