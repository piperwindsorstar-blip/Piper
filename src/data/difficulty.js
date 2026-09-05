// ============================================================================
//  DIFFICULTY — a single enemy-stat multiplier, chosen once at creation and
//  stored on GameState. Normal is exactly 1x, so an existing save (and
//  tools/simulate.js, which never sets a difficulty) plays out with exactly
//  today's numbers — only Easy and Hard actually change anything, and only
//  for the enemy side (see enemyUnit in game/battle.js).
// ============================================================================

export const DIFFICULTIES = [
  { id: 'easy', name: 'Easy', scale: 0.75,
    blurb: 'For the story, not the struggle. Enemies hit and endure noticeably less.' },
  { id: 'normal', name: 'Normal', scale: 1,
    blurb: 'The fight as designed.' },
  { id: 'hard', name: 'Hard', scale: 1.35,
    blurb: 'Enemies hit harder and take more killing. No safety net.' },
];

export const DIFFICULTY_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));
