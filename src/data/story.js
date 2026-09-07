// ============================================================================
//  STORY — the campaign's connective dialogue. Everything else in this game
//  earns its texture from systems; the story instead rides on data already
//  written for the bosses (see maps.js's BOSS_SLOTS `intro` fields) plus a
//  handful of new lines here: an opening hook, and epilogue text for after
//  the last boss falls. Per-region "aftermath" reactions live directly on
//  the town NPCs they belong to (a `reactions` map keyed by boss flag), kept
//  next to the NPC's own flavor text in maps.js rather than duplicated here.
// ============================================================================

// The main story, as a single ordered line — a hint feature (see the menu's
// Quest page) picks the first entry whose boss flag isn't set yet, so the
// world stays fully open to explore in any order while there's always one
// clear next step for a player who just wants to know where the plot goes.
// The order matches the level curve the sim actually plays at (see
// tools/sim.js's BOSS table), not just formation-file order — Volk is the
// intended first stop, not Anvil King, even though neither requires the
// other mechanically.
// `mapId` names the region as data/maps.js actually IDs it, so the menu's
// World page can point at the right spot on the overview without parsing
// the prose `region` string — anvil_king's own boss sits in 'anvil2' (the
// gorge's lower depth) but the overworld only warps to 'anvil1', so that's
// what's named here; same idea for the three Hollow Between bosses.
export const MAIN_QUEST = [
  { flag: 'volk', level: 9, region: 'The Hollow', mapId: 'hollow',
    hint: "The Hollow road is Volk's, and nothing moves past it while that's true. Head to the Hollow and end it." },
  { flag: 'anvil_king', level: 16, region: 'The Anvil Gorge', mapId: 'anvil1',
    hint: "Something the size of a mountain stood up in the Anvil Gorge and never sat back down. Go see why." },
  { flag: 'choir', level: 24, region: 'The Choir Ruins', mapId: 'ruins',
    hint: "The Ruins keep singing whether anyone answers or not. Go find out who — or what — is singing." },
  { flag: 'aurelith', level: 30, region: 'The Choir Ruins', mapId: 'ruins',
    hint: "Something older than the Choir is coiled deeper in the Ruins. Go finish what the Choir started." },
  { flag: 'kharos', level: 37, region: 'Cinderreach', mapId: 'cinderreach',
    hint: "Cinderreach hasn't cooled in years, and lately it's dreaming out loud. Go quiet it." },
  { flag: 'gatekeeper', level: 45, region: 'The Hollow Between', mapId: 'hollowbetween',
    hint: "Something in the Hollow Between has decided nobody gets through. Go prove it wrong." },
  { flag: 'nerith', level: 55, region: 'The Drowned Vale', mapId: 'drownedvale',
    hint: "The Vale's water rose without a current, and it's still rising. Go see what's wearing the crown." },
  { flag: 'worldheart', level: 65, region: 'The Hollow Between', mapId: 'hollowbetween',
    hint: "Every green thing in the world just turned to face the Hollow Between at once. Go see what it's facing." },
  { flag: 'vessia', level: 75, region: 'The Glassfields', mapId: 'glassfields',
    hint: "The Glassfields' light all points one direction now. Go find its warden." },
  { flag: 'thirteenth', level: 85, region: 'The Hollow Between', mapId: 'hollowbetween',
    hint: "Nine on the wheel, four beside it — and something that was never on the wheel at all, still "
      + "turning it. Go end it, in the Hollow Between." },
];

/** The next undone step of the main quest, or null once it's all cleared. */
export function nextStoryHint(g) {
  return MAIN_QUEST.find((step) => !g.flag(`boss.${step.flag}`)) ?? null;
}

export const STORY = {
  intro: [
    "The wheel has nine sides, and four more besides it — nine that chase each "
    + "other around the ring, and four that stand apart from it.",
    "Nobody in Wren's Ford could tell you anymore why it matters — only that "
    + "their grandparents could, and that the answer used to matter enough to carve into the well.",
    'Guildmaster Orrin used to say a wheel that turns clean doesn\'t need '
    + 'watching. Lately he doesn\'t say it with much confidence.',
    "You've never walked the Hollow road yourself. That's about to change.",
    "Something is stirring past the Ford. It's time somebody went and looked.",
  ],
  midpoint: [
    "The Ruins are quiet now the way a held breath is quiet — not empty, just waiting for a reason to let go.",
    "Half the road behind you now reads like a different story than the half still ahead — fewer "
    + "bandits and mountains, more things that were never meant to be counted at all.",
    "Nine on the wheel, four beside it. Aurelith made thirteen names, and Aurelith is done. The count still doesn't come out even.",
    "Whoever kept that count miscounted on purpose, or didn't count itself at all, on purpose. "
    + "Either way, the wheel keeps turning like nothing is wrong with it.",
    "Somewhere past all of it, something that was never on the wheel to begin with is still turning it anyway.",
  ],
  epilogue: [
    '"Nine on the wheel. Four beside it. And then there is me."',
    "It said that, and then it was nothing at all — not defeated so much as "
    + "finally, after all of it, counted.",
    "The wheel turns the same as it always did. It just turns like something "
    + "is missing from it now, on purpose, the way a good ring is missing its seam.",
    "Nobody in Wren's Ford will ever know exactly what happened past the Hollow. "
    + "That was always going to be true, whichever way it went.",
    "But a seam, once you know to look for one, has a way of catching the light. "
    + "Somewhere past everything the wheel ever counted, something is still catching it.",
  ],
  // The true ending — shown once you find and clear the Seam itself, the
  // fourteenth thing the wheel's count never had room for.
  trueEnd: [
    "The wheel doesn't turn different, after. It just turns like a wheel again — "
    + "nothing left standing outside it, keeping its own count on the side.",
    "Whatever the thirteen ever were, they were never the whole of it. Now, for the "
    + "first time since anyone thought to carve a wheel into a well, they are.",
    "Nine on the wheel. Four beside it. Nothing left uncounted at all.",
  ],
};
