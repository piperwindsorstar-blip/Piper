// ============================================================================
//  SKILLS & STATUS
//
//  A class node does not list skills directly — it lists SCHOOLS. A character
//  knows every skill in every school their current class grants, whose `lv` is
//  at or below their level. Promoting keeps old schools only if the new node
//  still lists them, which is how a Berserker forgets how to hold a shield.
//
//  Grid terms (Lufia-style 3x3):
//    range  — how far the skill reaches. Distance is
//             (attacker depth from own front) + (target depth from own front) + 1.
//             Melee weapons are range 2; polearms 3; bows and magic 9.
//    target — 'one' | 'row' | 'col' | 'all' | 'self' | 'ally' | 'allies' | 'random'
// ============================================================================

export const STATUS = {
  poison:   { name: 'Poison',   kind: 'bad',  turns: 5, blurb: 'Loses 8% max HP each turn.' },
  burn:     { name: 'Burn',     kind: 'bad',  turns: 4, blurb: 'Loses 6% max HP each turn; -15% STR.' },
  freeze:   { name: 'Freeze',   kind: 'bad',  turns: 2, blurb: 'Cannot act. Breaks on physical hit.' },
  paralyze: { name: 'Paralyze', kind: 'bad',  turns: 3, blurb: 'Acts only every other turn.' },
  sleep:    { name: 'Sleep',    kind: 'bad',  turns: 4, blurb: 'Cannot act. Breaks on damage.' },
  confuse:  { name: 'Confuse',  kind: 'bad',  turns: 3, blurb: 'Acts randomly, possibly on allies.' },
  fear:     { name: 'Fear',     kind: 'bad',  turns: 3, blurb: '-25% ATK and cannot use Arts.' },
  silence:  { name: 'Silence',  kind: 'bad',  turns: 4, blurb: 'Cannot cast magic.' },
  blind:    { name: 'Blind',    kind: 'bad',  turns: 4, blurb: '-50% physical accuracy.' },
  slow:     { name: 'Slow',     kind: 'bad',  turns: 4, blurb: '-40% AGI.' },
  curse:    { name: 'Curse',    kind: 'bad',  turns: 6, blurb: 'Healing received halved; -20% all resistances.' },
  doom:     { name: 'Doom',     kind: 'bad',  turns: 5, blurb: 'Falls at zero. The counter does not stop.' },
  stone:    { name: 'Stone',    kind: 'bad',  turns: 3, blurb: 'Cannot act; immune to damage.' },
  haste:    { name: 'Haste',    kind: 'good', turns: 5, blurb: '+50% AGI, occasional double turn.' },
  regen:    { name: 'Regen',    kind: 'good', turns: 6, blurb: 'Recovers 7% max HP each turn.' },
  shell:    { name: 'Shell',    kind: 'good', turns: 5, blurb: '-30% magic damage taken.' },
  protect:  { name: 'Protect',  kind: 'good', turns: 5, blurb: '-30% physical damage taken.' },
  might:    { name: 'Might',    kind: 'good', turns: 5, blurb: '+30% STR.' },
  focus:    { name: 'Focus',    kind: 'good', turns: 5, blurb: '+30% INT.' },
  evade:    { name: 'Evade',    kind: 'good', turns: 4, blurb: '+35% evasion.' },
  reflect:  { name: 'Reflect',  kind: 'good', turns: 4, blurb: 'Bounces single-target magic back.' },
  barrier:  { name: 'Barrier',  kind: 'good', turns: 3, blurb: 'Absorbs the next hit entirely.' },
  charm:    { name: 'Charm',    kind: 'bad',  turns: 3, blurb: 'Fights for the other side.' },
};
export const STATUS_IDS = Object.keys(STATUS);

export const SCHOOLS = {
  sword:    { name: 'Sword Arts',      kind: 'phys', blurb: 'Forms drilled until they stop being thought.' },
  rage:     { name: 'Fury',            kind: 'phys', blurb: 'Costs HP. Pays in damage.' },
  guard:    { name: 'Bulwark Arts',    kind: 'phys', blurb: 'The art of being in the way.' },
  lance:    { name: 'Lance Arts',      kind: 'phys', blurb: 'Reach, and what to do with it.' },
  fist:     { name: 'Martial Arts',    kind: 'phys', blurb: 'No weapon, no excuses.' },
  ki:       { name: 'Inner Ki',        kind: 'hyb',  blurb: 'Breath as a weapon and a bandage.' },
  shadow:   { name: 'Shadow Arts',     kind: 'phys', blurb: 'Angles, silence, and the back of the neck.' },
  steal:    { name: 'Larceny',         kind: 'phys', blurb: 'Combat as an acquisition strategy.' },
  bow:      { name: 'Marksmanship',    kind: 'phys', blurb: 'Distance is a defensive stat.' },
  wild:     { name: 'Wildcraft',       kind: 'hyb',  blurb: 'Borrowed tricks from things with claws.' },
  dance:    { name: 'Dances',          kind: 'hyb',  blurb: 'Movement that rewrites the battlefield.' },
  song:     { name: 'Songs',           kind: 'mag',  blurb: 'Sustained effects, sustained notes.' },
  luck:     { name: 'Fortune',         kind: 'hyb',  blurb: 'Wildly variable. Occasionally decisive.' },
  illusion: { name: 'Illusion',        kind: 'mag',  blurb: 'Wins arguments with reality.' },
  elem:     { name: 'Elemental Magic', kind: 'mag',  blurb: 'The nine primes, spoken correctly.' },
  dark:     { name: 'Dark Magic',      kind: 'mag',  blurb: 'Expensive in ways that are not MP.' },
  white:    { name: 'White Magic',     kind: 'mag',  blurb: 'Keeping people alive, professionally.' },
  holy:     { name: 'Holy Arts',       kind: 'hyb',  blurb: 'Conviction with a damage roll.' },
  summon:   { name: 'Summoning',       kind: 'mag',  blurb: 'Delegation, at enormous cost.' },
  beast:    { name: 'Beastcalling',    kind: 'hyb',  blurb: 'Claws on retainer.' },
  hex:      { name: 'Hexcraft',        kind: 'mag',  blurb: 'Makes the enemy worse at existing.' },
  spirit:   { name: 'Spirit Arts',     kind: 'mag',  blurb: 'Negotiations with the invisible.' },
  arcane:   { name: 'High Arcana',     kind: 'mag',  blurb: 'Reserved for those who reached the top of a tree.' },
};
export const SCHOOL_IDS = Object.keys(SCHOOLS);

// s(id, name, school, lv, mp, type, power, target, range, extra)
const s = (id, name, school, lv, mp, type, power, target, range, extra = {}) =>
  ({ id, name, school, lv, mp, type, power, target, range, element: 'none', ...extra });

export const SKILLS = [
  // --- Sword Arts ----------------------------------------------------------
  s('slash', 'Hard Slash', 'sword', 1, 0, 'phys', 1.25, 'one', 2, { ip: 8, blurb: 'A heavier swing than strictly polite.' }),
  s('crossslash', 'Cross Slash', 'sword', 6, 0, 'phys', 1.7, 'one', 2, { ip: 18, blurb: 'Two cuts, one motion.' }),
  s('windcleave', 'Wind Cleave', 'sword', 10, 8, 'phys', 1.2, 'row', 3, { element: 'wind', blurb: 'The edge arrives ahead of the blade.' }),
  s('riposte', 'Riposte', 'sword', 13, 6, 'buff', 0, 'self', 0, { grants: 'counter', blurb: 'Invites the attack. Answers it.' }),
  s('bladestorm', 'Bladestorm', 'sword', 18, 0, 'phys', 1.0, 'all', 2, { ip: 45, blurb: 'Everyone in reach, in one breath.' }),
  s('finisher', 'Finishing Blow', 'sword', 24, 14, 'phys', 2.6, 'one', 2, { blurb: 'Damage scales with how hurt the target already is.', execute: true }),

  // --- Fury ----------------------------------------------------------------
  s('recklessblow', 'Reckless Blow', 'rage', 1, 0, 'phys', 1.6, 'one', 2, { hpCost: 0.08, blurb: 'Costs blood. Worth it.' }),
  s('warcry', 'War Cry', 'rage', 5, 0, 'debuff', 0, 'all', 9, { status: 'fear', ip: 20, blurb: 'A sound with a damage type.' }),
  s('frenzy', 'Frenzy', 'rage', 9, 0, 'buff', 0, 'self', 0, { status: 'might', hpCost: 0.12, blurb: 'Stops thinking. Starts hitting.' }),
  s('rendarmor', 'Rend Armour', 'rage', 12, 0, 'phys', 1.3, 'one', 2, { sunder: 0.3, hpCost: 0.06, blurb: 'Removes the target\'s reason for confidence.' }),
  s('bloodrush', 'Blood Rush', 'rage', 17, 0, 'phys', 2.2, 'one', 2, { drain: 0.4, hpCost: 0.15, blurb: 'Takes back more than it spends, if it lands.' }),
  s('laststand', 'Last Stand', 'rage', 23, 0, 'buff', 0, 'self', 0, { ip: 70, blurb: 'Cannot fall below 1 HP for three turns.' }),

  // --- Bulwark Arts --------------------------------------------------------
  s('guardstance', 'Guard Stance', 'guard', 1, 0, 'buff', 0, 'self', 0, { status: 'protect', blurb: 'Roots. Waits.' }),
  s('cover', 'Cover', 'guard', 4, 4, 'buff', 0, 'ally', 9, { grants: 'covered', blurb: 'Takes the hit meant for someone smaller.' }),
  s('taunt', 'Taunt', 'guard', 7, 4, 'debuff', 0, 'all', 9, { grants: 'taunted', blurb: 'Makes himself the most attractive option in the room.' }),
  s('shieldbash', 'Shield Bash', 'guard', 10, 6, 'phys', 1.1, 'one', 2, { status: 'paralyze', blurb: 'Blunt argument, immediate conclusion.' }),
  s('ironwall', 'Iron Wall', 'guard', 15, 12, 'buff', 0, 'allies', 0, { status: 'protect', blurb: 'The whole line hardens at once.' }),
  s('unyielding', 'Unyielding', 'guard', 21, 18, 'buff', 0, 'allies', 0, { status: 'barrier', blurb: 'One free mistake, for everyone.' }),

  // --- Lance Arts ----------------------------------------------------------
  s('thrust', 'Piercing Thrust', 'lance', 1, 0, 'phys', 1.2, 'one', 3, { ip: 8, blurb: 'Reaches past the front rank.' }),
  s('sweep', 'Sweeping Haft', 'lance', 5, 4, 'phys', 0.95, 'row', 3, { blurb: 'Clears a rank in one arc.' }),
  s('jump', 'Jump', 'lance', 8, 0, 'phys', 1.9, 'one', 9, { ip: 25, delay: 1, blurb: 'Leaves the field. Comes back badly.' }),
  s('impale', 'Impale', 'lance', 12, 8, 'phys', 1.5, 'col', 4, { blurb: 'One line, all the way through.' }),
  s('dragondive', 'Dragon Dive', 'lance', 18, 16, 'phys', 2.4, 'one', 9, { delay: 1, element: 'wind', blurb: 'Descends with the weather behind it.' }),
  s('skewer', 'Heaven Skewer', 'lance', 24, 22, 'phys', 2.0, 'col', 9, { blurb: 'Ignores 40% of the target\'s defence.', pierce: 0.4 }),

  // --- Martial Arts --------------------------------------------------------
  s('jab', 'Rapid Jab', 'fist', 1, 0, 'phys', 0.62, 'one', 2, { hits: 3, blurb: 'Three, before you have finished blinking.' }),
  s('palmstrike', 'Palm Strike', 'fist', 5, 4, 'phys', 1.5, 'one', 2, { knockback: true, blurb: 'Sends the target one column back.' }),
  s('pressure', 'Pressure Point', 'fist', 9, 6, 'phys', 1.0, 'one', 2, { status: 'paralyze', blurb: 'Finds the switch and flips it.' }),
  s('whirlkick', 'Whirl Kick', 'fist', 13, 8, 'phys', 1.1, 'all', 2, { blurb: 'A full rotation with follow-through.' }),
  s('hundredfists', 'Hundred Fists', 'fist', 19, 0, 'phys', 0.5, 'random', 2, { hits: 6, ip: 55, blurb: 'Accuracy by volume.' }),
  s('dragonpunch', 'Dragon Punch', 'fist', 25, 20, 'phys', 3.0, 'one', 2, { blurb: 'The one they train the whole life for.' }),

  // --- Inner Ki ------------------------------------------------------------
  s('breathe', 'Centre Breath', 'ki', 1, 0, 'heal', 0.2, 'self', 0, { blurb: 'Heals for 20% of max HP.' }),
  s('kiblast', 'Ki Blast', 'ki', 5, 6, 'mag', 1.3, 'one', 9, { element: 'spirit', useStat: 'spr', blurb: 'Breath sent further than it should go.' }),
  s('mendspirit', 'Mend Spirit', 'ki', 9, 8, 'heal', 0.3, 'ally', 9, { blurb: 'Someone else\'s wounds, closed by will.' }),
  s('inneriron', 'Inner Iron', 'ki', 12, 10, 'buff', 0, 'self', 0, { status: 'shell', blurb: 'Turns thought into armour.' }),
  s('chakra', 'Open Chakra', 'ki', 17, 14, 'heal', 0.25, 'allies', 0, { cleanse: true, blurb: 'Clears every ailment on the line.' }),
  s('transcend', 'Transcend', 'ki', 24, 26, 'buff', 0, 'self', 0, { status: 'haste', extraStatus: 'regen', blurb: 'Stops arguing with the body.' }),

  // --- Shadow Arts ---------------------------------------------------------
  s('backstab', 'Backstab', 'shadow', 1, 0, 'phys', 1.4, 'one', 2, { ip: 10, crit: 0.25, blurb: 'Prefers a target that is looking elsewhere.' }),
  s('smoke', 'Smoke Bomb', 'shadow', 5, 6, 'buff', 0, 'allies', 0, { status: 'evade', blurb: 'The fight briefly loses track of everyone.' }),
  s('vanish', 'Vanish', 'shadow', 8, 8, 'buff', 0, 'self', 0, { grants: 'vanished', blurb: 'Untargetable until you strike.' }),
  s('poisonblade', 'Envenom', 'shadow', 11, 6, 'phys', 1.2, 'one', 2, { status: 'poison', element: 'poison', blurb: 'The cut is the delivery mechanism.' }),
  s('shadowstep', 'Shadow Step', 'shadow', 16, 10, 'phys', 1.8, 'one', 9, { reposition: true, blurb: 'Arrives anywhere on the grid, then stays there.' }),
  s('assassinate', 'Assassinate', 'shadow', 22, 24, 'phys', 2.2, 'one', 2, { instantChance: 0.15, blurb: 'Sometimes the fight simply ends.' }),

  // --- Larceny -------------------------------------------------------------
  s('steal', 'Steal', 'steal', 1, 0, 'special', 0, 'one', 2, { blurb: 'Takes an item. Takes it now.' }),
  s('mug', 'Mug', 'steal', 6, 4, 'phys', 1.1, 'one', 2, { steals: true, blurb: 'Both halves of the transaction.' }),
  s('goldtoss', 'Gold Toss', 'steal', 10, 0, 'phys', 1.0, 'all', 9, { goldCost: 60, blurb: 'Damage proportional to money thrown.' }),
  s('pilfer', 'Pilfer Gold', 'steal', 13, 4, 'special', 0, 'one', 2, { blurb: 'They were not using it.' }),
  s('escape', 'Escape Artist', 'steal', 17, 6, 'special', 0, 'allies', 0, { blurb: 'Guarantees the next flee attempt.' }),
  s('grandtheft', 'Grand Theft', 'steal', 23, 18, 'special', 0, 'one', 2, { rare: true, blurb: 'Goes for the thing they were not going to drop.' }),

  // --- Marksmanship --------------------------------------------------------
  s('aimshot', 'Aimed Shot', 'bow', 1, 0, 'phys', 1.35, 'one', 9, { ip: 10, blurb: 'Slower. Lands.' }),
  s('doubleshot', 'Double Shot', 'bow', 5, 4, 'phys', 0.8, 'one', 9, { hits: 2, blurb: 'Two on the string at once.' }),
  s('cripple', 'Cripple', 'bow', 9, 6, 'phys', 1.0, 'one', 9, { status: 'slow', blurb: 'Aims at the ability to leave.' }),
  s('volley', 'Volley', 'bow', 13, 10, 'phys', 0.9, 'row', 9, { blurb: 'Arcs over the front rank entirely.' }),
  s('pinning', 'Pinning Shot', 'bow', 17, 12, 'phys', 1.4, 'one', 9, { status: 'paralyze', blurb: 'Fixes them where they stand.' }),
  s('heartseeker', 'Heartseeker', 'bow', 23, 20, 'phys', 2.5, 'one', 9, { crit: 0.5, blurb: 'One arrow, kept for exactly this.' }),

  // --- Wildcraft -----------------------------------------------------------
  s('trapset', 'Set Snare', 'wild', 1, 4, 'debuff', 0, 'one', 9, { status: 'slow', blurb: 'The ground was not like that a moment ago.' }),
  s('beastcall', 'Beast Call', 'wild', 6, 8, 'phys', 1.4, 'one', 9, { element: 'nature', blurb: 'Something in the treeline agrees to help.' }),
  s('camouflage', 'Camouflage', 'wild', 10, 8, 'buff', 0, 'allies', 0, { status: 'evade', blurb: 'The party stops looking like a party.' }),
  s('survival', 'Field Dressing', 'wild', 13, 8, 'heal', 0.25, 'ally', 9, { cleanse: true, blurb: 'Ugly work. Effective work.' }),
  s('predator', 'Predator Sense', 'wild', 18, 10, 'buff', 0, 'self', 0, { status: 'focus', extraStatus: 'haste', blurb: 'Everything slows down except him.' }),
  s('wildhunt', 'Wild Hunt', 'wild', 24, 22, 'phys', 1.5, 'all', 9, { element: 'nature', blurb: 'The whole treeline agrees to help.' }),

  // --- Dances --------------------------------------------------------------
  s('stepdance', 'Quickstep', 'dance', 1, 4, 'buff', 0, 'allies', 0, { status: 'haste', blurb: 'Everybody moves a little sooner.' }),
  s('bladewaltz', 'Blade Waltz', 'dance', 5, 6, 'phys', 0.9, 'row', 2, { hits: 2, blurb: 'Two passes down the rank.' }),
  s('luredance', 'Lure Dance', 'dance', 9, 8, 'debuff', 0, 'one', 9, { status: 'charm', blurb: 'They change their mind about sides.' }),
  s('mirrordance', 'Mirror Dance', 'dance', 13, 10, 'buff', 0, 'self', 0, { status: 'reflect', blurb: 'Steps into the reflection and stays there.' }),
  s('stormdance', 'Storm Dance', 'dance', 18, 16, 'phys', 1.3, 'all', 2, { element: 'wind', blurb: 'The finale, and it hurts.' }),
  s('finaldance', 'Last Waltz', 'dance', 24, 24, 'phys', 1.6, 'all', 9, { status: 'sleep', blurb: 'The room forgets what it was doing.' }),

  // --- Songs ---------------------------------------------------------------
  s('marchsong', 'Marching Song', 'song', 1, 6, 'buff', 0, 'allies', 0, { status: 'might', blurb: 'Puts the party in step.' }),
  s('lullaby', 'Lullaby', 'song', 5, 8, 'debuff', 0, 'all', 9, { status: 'sleep', blurb: 'Deeply unwelcome, extremely effective.' }),
  s('hymn', 'Restoring Hymn', 'song', 9, 12, 'heal', 0.22, 'allies', 0, { blurb: 'Held note, closing wounds.' }),
  s('dirge', 'Dirge', 'song', 13, 12, 'debuff', 0, 'all', 9, { status: 'curse', blurb: 'Sung for people who are still standing.' }),
  s('anthem', 'Anthem of Iron', 'song', 18, 18, 'buff', 0, 'allies', 0, { status: 'protect', extraStatus: 'shell', blurb: 'Nobody breaks while it is playing.' }),
  s('requiem', 'Requiem', 'song', 24, 28, 'mag', 1.8, 'all', 9, { element: 'spirit', useStat: 'spr', blurb: 'For the ones about to be.' }),

  // --- Fortune -------------------------------------------------------------
  s('coinflip', 'Coin Flip', 'luck', 1, 0, 'phys', 2.2, 'one', 9, { missChance: 0.5, blurb: 'Doubles up or does nothing at all.' }),
  s('wildswing', 'Wild Swing', 'luck', 5, 0, 'phys', 1.2, 'random', 2, { hits: 3, blurb: 'Hits three things. Possibly friends.' }),
  s('jackpot', 'Jackpot', 'luck', 9, 10, 'special', 0, 'all', 9, { blurb: 'A random effect from a very long table.' }),
  s('luckycharm', 'Lucky Charm', 'luck', 13, 8, 'buff', 0, 'allies', 0, { grants: 'lucky', blurb: 'Everyone crits a little more for a while.' }),
  s('allin', 'All In', 'luck', 18, 0, 'phys', 3.4, 'one', 9, { hpCost: 0.4, missChance: 0.3, blurb: 'The correct play, roughly a third of the time.' }),
  s('fatesdice', 'Fate\'s Dice', 'luck', 24, 30, 'special', 0, 'all', 9, { blurb: 'Rerolls the battle. Nobody is sure how.' }),

  // --- Illusion ------------------------------------------------------------
  s('blindmist', 'Blinding Mist', 'illusion', 1, 6, 'debuff', 0, 'row', 9, { status: 'blind', blurb: 'Removes the argument\'s visual aid.' }),
  s('doubles', 'Doubles', 'illusion', 5, 8, 'buff', 0, 'self', 0, { status: 'evade', blurb: 'Three of him, two of them wrong.' }),
  s('confound', 'Confound', 'illusion', 9, 10, 'debuff', 0, 'one', 9, { status: 'confuse', blurb: 'Rearranges the target\'s idea of the room.' }),
  s('phantasm', 'Phantasm', 'illusion', 13, 14, 'mag', 1.5, 'all', 9, { element: 'dark', blurb: 'Damage from something that was never there.' }),
  s('unmake', 'Unmake', 'illusion', 18, 18, 'debuff', 0, 'one', 9, { dispel: true, sunder: 0.4, blurb: 'Argues the target\'s buffs out of existence.' }),
  s('dreamfall', 'Dreamfall', 'illusion', 24, 30, 'mag', 2.2, 'all', 9, { status: 'sleep', element: 'spirit', blurb: 'Everyone lies down. Not everyone gets up.' }),

  // --- Elemental Magic -----------------------------------------------------
  s('spark', 'Spark', 'elem', 1, 4, 'mag', 1.2, 'one', 9, { element: 'attuned', blurb: 'Cast in the caster\'s own element.' }),
  s('primebolt', 'Prime Bolt', 'elem', 5, 8, 'mag', 1.7, 'one', 9, { element: 'attuned', blurb: 'The same idea, said louder.' }),
  s('wheelturn', 'Turn the Wheel', 'elem', 9, 12, 'mag', 1.4, 'row', 9, { element: 'attuned', blurb: 'Strikes a rank with whatever it is weakest to.', adaptive: true }),
  s('elemward', 'Elemental Ward', 'elem', 12, 12, 'buff', 0, 'allies', 0, { status: 'shell', blurb: 'The wheel is asked to look away.' }),
  s('cataclysm', 'Cataclysm', 'elem', 18, 24, 'mag', 2.0, 'all', 9, { element: 'attuned', blurb: 'Every enemy, in the caster\'s colour.' }),
  s('primeforce', 'Prime Force', 'elem', 25, 34, 'mag', 3.1, 'one', 9, { element: 'attuned', pierce: 0.3, blurb: 'The element, undiluted.' }),

  // --- Dark Magic ----------------------------------------------------------
  s('drain', 'Drain', 'dark', 1, 6, 'mag', 1.1, 'one', 9, { element: 'dark', drain: 0.5, blurb: 'Moves health from column to column.' }),
  s('wither', 'Wither', 'dark', 5, 8, 'debuff', 0, 'one', 9, { status: 'curse', element: 'dark', blurb: 'Ages the target three bad years.' }),
  s('bonespear', 'Bone Spear', 'dark', 9, 12, 'mag', 1.8, 'col', 9, { element: 'dark', blurb: 'Comes up through the floor.' }),
  s('raise', 'Raise Thrall', 'dark', 13, 18, 'special', 0, 'self', 0, { summonsThrall: true, blurb: 'Fills the fifth grid cell with something obedient.' }),
  s('darkpact', 'Dark Pact', 'dark', 18, 0, 'buff', 0, 'self', 0, { hpCost: 0.3, status: 'focus', blurb: 'Trades HP for a very large idea.' }),
  s('oblivion', 'Oblivion', 'dark', 25, 36, 'mag', 2.8, 'all', 9, { element: 'dark', status: 'doom', blurb: 'Sets a clock on everyone opposite.' }),

  // --- White Magic ---------------------------------------------------------
  s('heal', 'Heal', 'white', 1, 5, 'heal', 0.28, 'ally', 9, { blurb: 'The first spell anyone should learn.' }),
  s('cure', 'Cure Ailment', 'white', 4, 6, 'heal', 0, 'ally', 9, { cleanse: true, blurb: 'Whatever it is, it stops.' }),
  s('healall', 'Healing Light', 'white', 8, 14, 'heal', 0.3, 'allies', 0, { blurb: 'The whole line, at once.' }),
  s('shield', 'Divine Shield', 'white', 12, 12, 'buff', 0, 'allies', 0, { status: 'protect', extraStatus: 'shell', blurb: 'Two layers, no arguments.' }),
  s('revive', 'Revive', 'white', 16, 24, 'heal', 0.5, 'ally', 9, { revives: true, blurb: 'Not a miracle. A procedure.' }),
  s('fullrestore', 'Full Restore', 'white', 24, 40, 'heal', 1.0, 'allies', 0, { cleanse: true, blurb: 'Everything, everyone, all of it.' }),

  // --- Holy Arts -----------------------------------------------------------
  s('smite', 'Smite', 'holy', 1, 5, 'mag', 1.3, 'one', 2, { element: 'light', useStat: 'spr', blurb: 'Conviction, applied at close range.' }),
  s('sanctify', 'Sanctify', 'holy', 5, 8, 'mag', 1.5, 'all', 9, { element: 'light', undeadBonus: 2.0, blurb: 'Very bad news for the recently deceased.' }),
  s('oathguard', 'Oathguard', 'holy', 9, 10, 'buff', 0, 'ally', 9, { status: 'barrier', blurb: 'A promise standing in front of someone.' }),
  s('judgement', 'Judgement', 'holy', 14, 16, 'mag', 2.0, 'one', 9, { element: 'light', blurb: 'Brief, formal, final.' }),
  s('consecration', 'Consecration', 'holy', 19, 20, 'buff', 0, 'allies', 0, { status: 'regen', extraStatus: 'shell', blurb: 'The ground itself takes a side.' }),
  s('exalt', 'Exaltation', 'holy', 25, 34, 'mag', 2.7, 'all', 9, { element: 'light', blurb: 'The sky opens and does not apologise.' }),

  // --- Summoning -----------------------------------------------------------
  s('lesser', 'Lesser Summon', 'summon', 1, 8, 'mag', 1.5, 'all', 9, { element: 'attuned', blurb: 'Something small arrives and does its best.' }),
  s('sylph', 'Call Sylph', 'summon', 6, 14, 'mag', 1.7, 'all', 9, { element: 'wind', extraStatus: 'haste', blurb: 'Fast, thin, and gone again.' }),
  s('golem', 'Call Golem', 'summon', 10, 18, 'buff', 0, 'allies', 0, { status: 'protect', extraStatus: 'barrier', blurb: 'Stands in front of everyone for a while.' }),
  s('leviathan', 'Call Leviathan', 'summon', 15, 26, 'mag', 2.3, 'all', 9, { element: 'water', blurb: 'The room fills. Briefly.' }),
  s('phoenix', 'Call Phoenix', 'summon', 20, 34, 'heal', 0.6, 'allies', 0, { revives: true, element: 'fire', blurb: 'Everyone gets up. Everyone is on fire.' }),
  s('esper', 'Espercall', 'summon', 26, 48, 'mag', 3.4, 'all', 9, { element: 'attuned', blurb: 'The old powers, called by their true names.' }),

  // --- Beastcalling --------------------------------------------------------
  s('houndcall', 'Hound Call', 'beast', 1, 6, 'phys', 1.3, 'one', 9, { element: 'nature', blurb: 'Something arrives at a run.' }),
  s('packtactics', 'Pack Tactics', 'beast', 6, 8, 'buff', 0, 'allies', 0, { status: 'might', blurb: 'Fight like there are more of you.' }),
  s('maul', 'Maul', 'beast', 10, 12, 'phys', 1.9, 'one', 3, { status: 'fear', blurb: 'Teeth, and the memory of teeth.' }),
  s('bondbeast', 'Bond Beast', 'beast', 14, 16, 'special', 0, 'self', 0, { summonsThrall: true, blurb: 'The companion joins the grid properly.' }),
  s('stampede', 'Stampede', 'beast', 19, 22, 'phys', 1.6, 'all', 9, { element: 'earth', blurb: 'Nothing personal. Simply a lot of hooves.' }),
  s('primalroar', 'Primal Roar', 'beast', 25, 30, 'debuff', 0, 'all', 9, { status: 'fear', sunder: 0.35, blurb: 'Older than language, and clearer.' }),

  // --- Hexcraft ------------------------------------------------------------
  s('jinx', 'Jinx', 'hex', 1, 4, 'debuff', 0, 'one', 9, { status: 'blind', blurb: 'Small misfortune, precisely placed.' }),
  s('sap', 'Sap Will', 'hex', 5, 8, 'debuff', 0, 'row', 9, { sunder: 0.25, blurb: 'Takes the edge off an entire rank.' }),
  s('silencehex', 'Silence', 'hex', 8, 8, 'debuff', 0, 'one', 9, { status: 'silence', blurb: 'The spell was going to be excellent.' }),
  s('rot', 'Rot', 'hex', 12, 12, 'mag', 1.4, 'one', 9, { element: 'poison', status: 'poison', blurb: 'Works after the fight, too.' }),
  s('doomhex', 'Doom', 'hex', 18, 22, 'debuff', 0, 'one', 9, { status: 'doom', blurb: 'A number, counting down, visible to everyone.' }),
  s('anathemahex', 'Anathema', 'hex', 25, 32, 'debuff', 0, 'all', 9, { status: 'curse', sunder: 0.4, blurb: 'Names them all. None of it is kind.' }),

  // --- Spirit Arts ---------------------------------------------------------
  s('spiritlink', 'Spirit Link', 'spirit', 1, 6, 'buff', 0, 'ally', 9, { grants: 'linked', blurb: 'Shares damage between two willing people.' }),
  s('elemshift', 'Elemental Shift', 'spirit', 5, 8, 'buff', 0, 'ally', 9, { shiftsElement: true, blurb: 'Changes an ally\'s element for the battle.' }),
  s('ancestor', 'Ancestral Aid', 'spirit', 9, 12, 'heal', 0.25, 'allies', 0, { blurb: 'Help from people who are no longer available.' }),
  s('soulsight', 'Soul Sight', 'spirit', 13, 10, 'debuff', 0, 'all', 9, { reveals: true, sunder: 0.2, blurb: 'Sees exactly what each of them is afraid of.' }),
  s('worldvoice', 'World Voice', 'spirit', 19, 24, 'mag', 2.1, 'all', 9, { element: 'attuned', adaptive: true, blurb: 'Asks the wheel to lean on everyone.' }),
  s('soulbind', 'Soulbind', 'spirit', 25, 36, 'debuff', 0, 'one', 9, { status: 'stone', blurb: 'Holds the thread still.' }),

  // --- High Arcana (capstone school) --------------------------------------
  s('overdrive', 'Overdrive', 'arcane', 20, 0, 'buff', 0, 'self', 0, { ip: 100, blurb: 'Spends the whole IP gauge for one enormous turn.' }),
  s('breakpoint', 'Breakpoint', 'arcane', 20, 20, 'phys', 2.4, 'one', 9, { pierce: 0.5, blurb: 'Finds the seam and opens it.' }),
  s('grandsigil', 'Grand Sigil', 'arcane', 22, 30, 'mag', 2.4, 'all', 9, { element: 'attuned', blurb: 'A circle drawn a very long time ago.' }),
  s('apotheosis', 'Apotheosis', 'arcane', 26, 40, 'buff', 0, 'self', 0, { status: 'haste', extraStatus: 'might', blurb: 'Briefly, more than the sum of the sheet.' }),
  s('finalhour', 'Final Hour', 'arcane', 30, 55, 'mag', 3.8, 'all', 9, { element: 'attuned', blurb: 'The last thing on the list.' }),
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((k) => [k.id, k]));
export const SKILL_IDS = SKILLS.map((k) => k.id);

export function getSkill(id) {
  const k = SKILL_BY_ID[id];
  if (!k) throw new Error(`unknown skill: ${id}`);
  return k;
}

export function skillsForSchools(schools, level) {
  return SKILLS.filter((k) => schools.includes(k.school) && k.lv <= level);
}

export function skillsInSchool(school) {
  return SKILLS.filter((k) => k.school === school).sort((a, b) => a.lv - b.lv);
}
