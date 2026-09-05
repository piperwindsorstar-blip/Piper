// ============================================================================
//  ACHIEVEMENTS — every entry is pure derived state: `check` reads flags,
//  bestiary, roster and gold that GameState already tracks, so there is
//  nothing new to save. The menu's Achievements page just runs every check
//  live against the current save.
// ============================================================================

import { MAIN_QUEST } from './story.js';
import { QUESTS } from './quests.js';
import { ENEMIES } from './enemies.js';
import { CLASSES } from './classes.js';
import { MAX_LEVEL } from '../game/character.js';
import { MAPS } from './maps.js';

function recruitIds() {
  const ids = [];
  for (const m of Object.values(MAPS)) {
    for (const n of m.npcs ?? []) if (n.kind === 'recruit') ids.push(n.id);
  }
  return ids;
}

// One line per main-quest boss, in story order — reuses MAIN_QUEST rather
// than re-listing the boss flags, so the two can't drift apart.
const BOSS_TITLES = {
  volk: 'Road Cleared',
  anvil_king: 'The Mountain Sits Down',
  choir: 'Silence the Choir',
  aurelith: 'Last of the Wyrms',
  kharos: 'Cinder Quenched',
  gatekeeper: 'Through the Gate',
  nerith: 'Crown Reclaimed',
  worldheart: "World's Heart Stilled",
  vessia: "The Warden's Light, Ended",
  thirteenth: 'Thirteen Counted',
};

export const ACHIEVEMENTS = [
  {
    id: 'firstBlood', name: 'First Blood', desc: 'Win your first battle.',
    check: (g) => Object.keys(g.bestiary).length > 0,
  },
  ...MAIN_QUEST.map((step) => ({
    id: `boss.${step.flag}`,
    name: BOSS_TITLES[step.flag] ?? step.flag,
    desc: `Defeat the boss of ${step.region}.`,
    check: (g) => g.flag(`boss.${step.flag}`),
  })),
  {
    id: 'allSideQuests', name: 'Every Loose End', desc: 'Finish every side quest.',
    check: (g) => Object.keys(QUESTS).every((id) => g.flag(`quest.${id}.done`)),
  },
  {
    id: 'halfBestiary', name: 'Monster Hunter', desc: 'Discover half the bestiary.',
    check: (g) => Object.keys(g.bestiary).length >= Math.ceil(ENEMIES.length / 2),
  },
  {
    id: 'fullBestiary', name: 'Full Compendium', desc: 'Discover every enemy in the bestiary.',
    check: (g) => Object.keys(g.bestiary).length >= ENEMIES.length,
  },
  {
    id: 'maxLevel', name: 'Peak Form', desc: `Reach level ${MAX_LEVEL} with any character.`,
    check: (g) => g.roster.some((ch) => ch.level >= MAX_LEVEL),
  },
  {
    id: 'mythicTier', name: 'Mythic', desc: 'Promote a character all the way to the Apex tier.',
    check: (g) => g.roster.some((ch) => CLASSES[ch.classId]?.tier === 7),
  },
  {
    id: 'fullRoster', name: 'The Whole Guild', desc: 'Recruit every optional party member.',
    check: (g) => {
      const ids = recruitIds();
      return ids.length > 0 && ids.every((id) => g.flag(`story.recruited.${id}`));
    },
  },
  {
    id: 'wealthy', name: 'Coffers Full', desc: 'Hold 100,000 gold at once.',
    check: (g) => g.gold >= 100000,
  },
  {
    id: 'boss.seam', name: 'Nothing Left Unwritten', desc: 'Find and defeat the Hollow Between\'s hidden postgame boss.',
    check: (g) => g.flag('boss.seam'),
  },
];

export function achievementsDone(g) { return ACHIEVEMENTS.filter((a) => a.check(g)); }
