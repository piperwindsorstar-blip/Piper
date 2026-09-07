// ============================================================================
//  LORE — the menu's Codex page. A handful of entries are visible from the
//  start (the kind of thing any traveler passing through Wren's Ford could
//  ask about); the rest unlock as the boss they're about falls, so reading
//  the Codex becomes a reward for progress rather than a spoiler for it.
//  Nothing here contradicts the in-the-moment boss intro/victory lines in
//  maps.js — it fills in the history around them instead of repeating it.
// ============================================================================

export const LORE = [
  {
    id: 'wheel',
    title: "The Wheel of Wren's Ford",
    unlock: null,
    text: "Carved into the stone lip of the town well, worn nearly smooth: a ring of nine "
      + "spokes, and four marks standing outside the ring entirely. No one now living carved "
      + "it, and no one now living can say for certain what it was meant to count. Only that "
      + "it was important enough to put where every traveler drinking from that well would "
      + "see it first.",
  },
  {
    id: 'guild',
    title: "The Guild's Rolls",
    unlock: null,
    text: "Four guildhalls, one ledger, endlessly copied by hand between them — Formation, "
      + "Jobs, and the long climb of the class ladder, recorded the same way in the Ford as "
      + "in Glasshaven, so a soldier's whole certified life could in principle be "
      + "reconstructed from paper alone if every soldier who ever lived it vanished tomorrow. "
      + "Guildmaster Orrin finds this either comforting or unbearable, depending on the week.",
  },
  {
    id: 'ninemarches',
    title: "The Nine Marches",
    unlock: null,
    text: "The world has had other names. This is only the one that stuck, borrowed from an "
      + "old military habit of numbering the roads out of Wren's Ford before anyone bothered "
      + "naming the places those roads actually led. Nobody making maps today remembers why "
      + "nine, specifically. Draw your own conclusions.",
  },
  {
    id: 'marchthrone',
    title: "The Marchwarden's Throne",
    unlock: null,
    text: "Wren's Ford keeps a King the way it keeps the wheel carved into its well — out of "
      + "habit, and a vague sense the carving mattered once. The title is older than the town "
      + "remembers clearly: Warden of the Nine Marches, from back when the roads out of the "
      + "Ford were numbered because nobody had gotten around to naming where they led. The "
      + "roads got names eventually. The title never did.",
  },
  {
    id: 'thethirteen',
    title: "The Thirteen",
    unlock: 'volk',
    text: "Nine that circle, chasing each other around a ring without ever quite catching up. "
      + "Four that stand apart from the ring, unmoving, watching it turn. Together, by every "
      + "old count anyone still remembers, they make thirteen. Nobody has ever agreed on "
      + "which is which — only that something is always, always turning the wheel.",
  },
  {
    id: 'volk',
    title: "Volk, Warden of the Hollow",
    unlock: 'volk',
    text: "Before he was a voice in the dark demanding toll, Volk held the Hollow road "
      + "against worse things than travelers — for so long that the town forgot there was "
      + "ever a 'before,' and started calling the tollbooth a curse instead of a post. "
      + "Whether he stopped guarding and started hoarding, or whether there was never a "
      + "difference to him, is a question the road doesn't answer anymore.",
  },
  {
    id: 'anvil_king',
    title: "The Anvil King",
    unlock: 'anvil_king',
    text: "Not a king who commanded a gorge, but a gorge that eventually stood up and "
      + "decided it was one. The old miners of Anvil Gorge tell it as a warning about "
      + "digging too deep for too long: eventually the mountain notices you're still there, "
      + "and starts to mind.",
  },
  {
    id: 'choir',
    title: "The Choir Ruins",
    unlock: 'choir',
    text: "The Ruins hummed with voices long before anyone built walls around the sound to "
      + "call it a temple. Scholars who've studied the Choir agree on exactly one thing: it "
      + "was never singing FOR anyone. The listening was always incidental. That's precisely "
      + "why it was so easy to mistake for worship.",
  },
  {
    id: 'aurelith',
    title: "Aurelith, Who Counted",
    unlock: 'aurelith',
    text: "Older than the Choir it slept beneath, Aurelith kept a private ledger the way a "
      + "dragon keeps gold — jealously, uselessly, forever. Thirteen names, it claimed, and "
      + "would not say more, the way a hoard is worth more sight unseen. Whether it invented "
      + "the count or only inherited it is the one thing its death didn't answer.",
  },
  {
    id: 'kharos',
    title: "Kharos and the Cinderreach",
    unlock: 'kharos',
    text: "Cinderreach was a forge before it was a wound, worked by smiths clever enough to "
      + "bind fire into something that could think, and not quite clever enough to ask "
      + "whether it wanted to stop thinking once the forge went cold. Kharos never went "
      + "cold. That was rather the whole problem.",
  },
  {
    id: 'gatekeeper',
    title: "The Gatekeeper of the Hollow Between",
    unlock: 'gatekeeper',
    text: "The Hollow Between isn't between two places so much as between two IDEAS of a "
      + "place — the world as it was, and the world as whatever built the Gatekeeper decided "
      + "it should stay. It kept that promise literally: nobody went through. Not one "
      + "traveler, not one season, not one single grain of the hourglass on the far side, "
      + "until you.",
  },
  {
    id: 'nerith',
    title: "Nerith, the Risen Crown",
    unlock: 'nerith',
    text: "The Drowned Vale drowned slowly, over generations, and every generation blamed "
      + "the last flood instead of noticing the water never fully left. Nerith didn't cause "
      + "the flooding. Nerith was what the flooding was for — a crown with no head, waiting "
      + "patiently, for centuries, for enough water to finally wear one.",
  },
  {
    id: 'worldheart',
    title: "The Worldheart",
    unlock: 'worldheart',
    text: "Every hedge-witch and herbalist agrees that green things listen, in their slow "
      + "way, to something. Most assume it's the sun. The Worldheart was the actual answer, "
      + "and the actual answer had opinions — and on one particular day it decided to share "
      + "exactly one of them with the entire world at once.",
  },
  {
    id: 'vessia',
    title: "Vessia, Warden of Light",
    unlock: 'vessia',
    text: "The Glassfields were sand before something fused every grain of it into a single "
      + "lens pointed at one spot in the sky. Vessia called herself a warden and meant it "
      + "sincerely — the trouble is she never finished deciding what she was warding the "
      + "light from, only that the answer justified watching everyone else just as closely.",
  },
  {
    id: 'thirteenth',
    title: "The Thirteenth",
    unlock: 'thirteenth',
    text: "The wheel's spokes were never meant to be counted one at a time — that was always "
      + "the trick of it, the reason nine chasing four never resolved into a number anyone "
      + "could hold onto. The Thirteenth was the hub the spokes turned around, plainly "
      + "visible the entire time to anyone willing to stop counting the rim and look at the "
      + "center instead.",
  },
  {
    id: 'seam',
    title: "The Seam",
    unlock: 'seam',
    text: "Not a fourteenth spoke, and not a fourteenth mark beside the wheel either — a "
      + "seam doesn't add to what it joins, it just admits that two things were ever "
      + "separate to begin with. Whatever the wheel actually is, it was built, and anything "
      + "built has a seam somewhere, usually exactly where you'd least expect to find a "
      + "door.",
  },
];

export function loreUnlocked(entry, g) {
  return !entry.unlock || g.flag(`boss.${entry.unlock}`);
}
