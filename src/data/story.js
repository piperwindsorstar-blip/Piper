// ============================================================================
//  STORY — the campaign's connective dialogue. Everything else in this game
//  earns its texture from systems; the story instead rides on data already
//  written for the bosses (see maps.js's BOSS_SLOTS `intro` fields) plus a
//  handful of new lines here: an opening hook, and epilogue text for after
//  the last boss falls. Per-region "aftermath" reactions live directly on
//  the town NPCs they belong to (a `reactions` map keyed by boss flag), kept
//  next to the NPC's own flavor text in maps.js rather than duplicated here.
// ============================================================================

export const STORY = {
  intro: [
    "The wheel has nine sides, and four more besides it — nine that chase each "
    + "other around the ring, and four that stand apart from it.",
    'Guildmaster Orrin used to say a wheel that turns clean doesn\'t need '
    + 'watching. Lately he doesn\'t say it with much confidence.',
    "Something is stirring past the Ford. It's time somebody went and looked.",
  ],
  midpoint: [
    "The Ruins are quiet now the way a held breath is quiet — not empty, just waiting for a reason to let go.",
    "Nine on the wheel, four beside it. Aurelith made thirteen names, and Aurelith is done. The count still doesn't come out even.",
    "Somewhere past all of it, something that was never on the wheel to begin with is still turning it anyway.",
  ],
  epilogue: [
    '"Nine on the wheel. Four beside it. And then there is me."',
    "It said that, and then it was nothing at all — not defeated so much as "
    + "finally, after all of it, counted.",
    "The wheel turns the same as it always did. It just turns like something "
    + "is missing from it now, on purpose, the way a good ring is missing its seam.",
  ],
};
