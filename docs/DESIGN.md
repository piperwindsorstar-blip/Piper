# Design notes

Reasoning behind the numbers, and the places where a rule was bent to make the
game work. The reference material is Dragon Quest III (progression), Lufia: The
Legend Returns (combat), and the modern HD-2D presentation idiom — pixel art
lit, bloomed and graded as if it were a diorama.

---

## 1. Races

### Why race is the choice that touches everything

Classes are chosen once and then re-chosen seven times; elements are a single
permanent tag; jobs drift with play. Race is the only decision that is made once
and then quietly present in every system for eighty levels, so it is the one
worth wiring through all of them:

| Layer | What race contributes |
| --- | --- |
| Stats | a flat `mod` at creation |
| Levelling | a per-stat **growth multiplier**, applied at every level-up |
| Defence | an elemental `resist` table, folded into the same multiplier as element affinity |
| Rules | two traits with real mechanical hooks |
| Jobs | `likes` — three elements that earn 20% faster job EXP |
| Art | `look`: ears, muzzle, tail, wings, horns, build, palettes |

The growth multiplier is the important one. A flat modifier is a rounding error
by level 40; a multiplier on growth compounds. An Elf at 1.30× MP growth and
0.86× HP growth is a visibly different character from a Dwarf at 0.86 and 1.22
by the time both are Mythic, without either of them having a separate stat table.

### Traits are rules, not adjectives

Each race carries exactly two, and each is something the engine actually reads:
Fairy Flight adds 18% evasion **and one column of reach**, which changes what a
Fairy can hit on the battle grid. Automaton Clockwork grants immunity to five
statuses, and its No Repair halves potions — a real cost that pushes the player
toward an Artificer. Revenant Deathless survives a killing blow once per battle.
Ogrekin trade in both directions: Giant's Frame adds 15% physical damage and
stops two-handed weapons slowing them, while Thick Skull buys immunity to
Confusion and Fear at the price of 10% more magic damage taken.

The validator asserts that every race has both traits, a complete eight-stat
growth table, and a `look` the sprite generator can consume.

### Drawing twelve races from one figure

The character sprite is assembled, not stored: base body at the race's `build`
scale, then class kit (helm, body, cape, weapon), then race anatomy on top. The
ordering is deliberate and was arrived at by getting it wrong first — with
anatomy drawn before the kit, helmets swallowed elf ears and capes hid every
tail, and all twelve races rendered as Humans in hats. Tails now sweep down and
back rather than curling up into the cape, and ears, horns and muzzles are drawn
after the headgear.

---

## 2. The class ladder

### Shape

The brief is "promotion every 5 levels, with branching promotions at 10, 20 and
again at 40, 60 and 80". Read literally as a tree, that doubles forever: five
branch points give 32 distinct capstones per root and 384 named classes per root
that nobody would ever see, most of them unreachable in one playthrough.

The fix is to stop treating the late game as a tree. The first four promotions
stay a tree; the last three are a **ring**.

| Level | Tier | Name | Kind | Nodes per root |
| --- | --- | --- | --- | --- |
| 1 | 0 | Novice | start | 1 |
| 5 | 1 | Adept | linear | 1 |
| 10 | 2 | Veteran | **branch** | 2 |
| 15 | 3 | Elite | linear | 2 |
| 20 | 4 | Master | **branch** | 4 |
| 40 | 5 | Ascendant | **branch (ring)** | 4 |
| 60 | 6 | Exalted | **branch (ring)** | 4 |
| 80 | 7 | Mythic | **branch (ring)** | 4 |

Twenty-two nodes per root, **264 in total**.

### The ring

Each root owns four Ascension *paths*, each of which has a name at all three
ring tiers. Node *i* of a tier is offered by predecessors *i* and *i−1*:

```
Master 0 ──┬── Ascendant 0 ──┬── Exalted 0 ──┬── Mythic 0
Master 1 ──┴─┬─ Ascendant 1 ─┴─┬─ Exalted 1 ─┴─┬─ Mythic 1
Master 2 ────┴─ Ascendant 2 ───┴─ Exalted 2 ───┴─ Mythic 2
Master 3 ──────┴ Ascendant 3 ────┴ Exalted 3 ────┴ Mythic 3
        (and slot 3 wraps back to slot 0)
```

Every promotion is still a genuine choice between two named successors, every
node is reachable from exactly two predecessors, and the total stays at four per
tier instead of 4 → 8 → 16 → 32. The player gets branching; the content budget
gets a constant. `npm test` asserts the ring shape directly: four nodes per tier
per root, each with in-degree exactly 2, and every root reaching tier 7 by level
80 whichever branch preference the simulated character follows.

Because a ring node has two possible predecessors, a character's class *lineage*
cannot be recomputed from their current class alone. `promotionPath()` walks the
character's stored `classHistory` and only falls back to a derived lineage when
no history exists.

### Why nodes carry a bias, not a stat table

264 hand-written stat tables would drift: someone would eventually make a
Berserker tankier than a Knight without noticing. Instead each root owns a
growth *profile* (per-level gains for eight stats) and each node owns a *bias*
multiplying it, scaled by a per-tier factor:

```
growth[stat] = PROFILE[root][stat] × TIER_FACTOR[tier] × bias[stat]
```

`TIER_FACTOR` is `[1.00, 1.22, 1.48, 1.78, 2.12, 2.58, 3.10, 3.72]`. A
Berserker's bias is `{str: 1.3, hp: 1.1, vit: 0.8, spr: 0.7}` — it *cannot*
accidentally out-defend its Knight sibling, because both are derived from the
same Warrior profile. `npm test` asserts that every promotion is a net growth
increase.

A finished character's stat is therefore the sum of six independent sources:

```
BASE + GROWTH(class bias × tier factor × race multiplier) + RACE mod
     + ELEMENT bias + JOB bonus + EQUIPMENT
```

### Growth accumulates as it is earned

A character banks `growth[stat]` at every level-up using **the class they held at
the time**. Promoting late is therefore permanently worse than promoting on
schedule, which gives the temple visit real weight instead of making it a
formality. There is a regression test for exactly this: a Warrior promoted at 5
and levelled to 10 must end stronger than one who sat at Warrior to 10.

Promotions also pay a one-time flat bonus and fully restore HP/MP, the way a
Dragon Quest class change does.

### Skills come from schools, not from nodes

A node grants *schools*; a character knows every skill in their current schools
whose learn level is at or below their level. This means 264 nodes cost 264 short
school lists rather than 264 skill tables, and it makes the branch choice
legible: the promotion screen shows exactly which schools each option gains and
which it loses. A Berserker really does forget how to hold a shield, because
Bulwark Arts is not on its list. 25 schools cover all 264 nodes.

---

## 3. The element wheel

### Why nine and four rather than thirteen

Thirteen elements in one relationship table is 169 cells nobody can hold in
their head or verify by eye. Splitting them gives a rule instead of a table:

**Nine primes on a ring, each strong against the next two, weak against the
previous two.**

```
Fire → Ice → Nature → Earth → Metal → Lightning → Wind → Poison → Water → (Fire)
```

Every pairing is at least arguable — fire burns nature, ice kills growth, roots
split stone, earth swallows ore and grounds lightning, metal conducts a strike
harmlessly and cuts the gale, storm overpowers wind, wind disperses fumes,
poison taints water and chokes flame, water quenches fire and breaks floes.

Because the table is *generated* from the ring, symmetry is guaranteed rather
than maintained: if A is strong against B then B is weak against A, always. The
validator checks it anyway.

**Four arcane elements** sit off the ring in a short cycle
(Light → Dark → Spirit → Void → Light) and deal neutral damage to the primes:
the Arcane "strives apart from the Wheel".

**Void** is the deliberate exception. Void damage ignores resistance entirely —
it neither gains from weakness nor suffers from resistance, in either direction.
That is its whole identity, and it is why Void's stat bias is the harshest
(+4 LCK, −10 HP, −5 MP).

### What an element actually does

Elements are chosen once and never change, so they must matter without being a
trap. Each gives:

- a permanent **stat bias** (Earth +18 HP/+4 VIT/−3 AGI; Wind +5 AGI/+1 LCK/−2 STR)
- a **passive perk** with a real mechanical hook — Fire inflicts Burn on hit,
  Lightning chains 25% damage to an adjacent enemy, Dark restores 10% HP/MP on a
  kill, Water amplifies healing given *or received* by 15%, Wind grants a free
  grid reposition each battle
- the element of `attuned` spells, so a Mage's whole offensive kit is coloured by
  the choice made at creation
- a job-EXP bonus when it is one of the three elements the character's race likes

---

## 4. Jobs

Jobs answer a different question from classes. A class is a combat archetype; a
job is a trade, and it pays in exploration, economy and utility.

Three payouts per job, always:

1. **stat bonus**, scaled by rank
2. **field ability** — the actual gameplay feature (Forge, Brew, Mine, Track,
   Survey, Pick Lock, Tame, Transcribe…)
3. **passive** — a persistent world rule (Merchant prices, Scout ambush
   immunity, Scribe party EXP, Hunter beast damage)

### Ranks come from use

Job rank rises with job *actions*, not with level, at thresholds
`0 / 40 / 120 / 280 / 600`. Rank 1 gives the listed bonus; each further rank adds
60% of it, so rank 5 is about 3.4×. A character whose element is one the job
favours — or one their race favours — earns job EXP faster. That is the one place
all four systems are wired directly into each other.

This keeps jobs from being a second, redundant level-up track: a level 30
character who never sold anything is still an Apprentice Merchant.

---

## 5. Combat on two 3×3 grids

### Reach is the whole system

Lufia: The Legend Returns' grid is the reason this game is not just Dragon
Quest with extra menus. A unit's **effective column** is its column minus its own
side's frontmost *living* column, and distance is

```
effCol(attacker) + effCol(target) + 1
```

The "living" part is what makes it dynamic: killing the enemy front rank pulls
the rank behind it into reach for everyone. Reach values are deliberately coarse
so a player can reason about them without arithmetic — melee 2, polearm 3,
ranged and magic 9. A Fairy's Flight adds one to all of them.

A skill out of range is not selectable. A *basic attack* out of range still
lands, at half power, so a melee character is never left with literally nothing
to do. The battle UI greys out unreachable targets and prints
`range 3/2 — half damage` rather than making you infer it.

Enemy targeting weights `1 / (effCol + 1)`, so the front column genuinely draws
fire and the back column is genuinely safer. Taunt multiplies that weight by 4;
wounded targets by 1.6.

### IP

Also from Lufia. Every unit carries a 0–100 gauge filled by damage dealt and
taken. Some Arts cost IP instead of MP, which gives an out-of-MP character
something to do and rewards a fight that has gone badly. A Bard in the party
starts everyone with bonus IP.

### Damage

```
raw    = (power or magic) × skillPower × spread × statusModifiers
mitig  = K / (K + armor)          K = 110 + 13 × attackerLevel
final  = raw × mitig × elementMult × reachPenalty × variance(0.92–1.08)
```

Element multipliers are 1.5 / 1.0 / 0.5. Criticals are ×1.8. The `K / (K + armor)`
curve is asymptotic rather than subtractive so defence never reaches immunity and
low-level enemies stay relevant slightly longer than they would under flat
reduction.

Two of those terms were added when the ladder was extended to level 80, because
extending the level cap broke both of them:

**Level-scaled softening.** The original constant was a flat `120`. That is fine
while armour values are two digits, but endgame armour approaches and then
passes it, so mitigation asymptotes toward total immunity and every late fight
becomes a stalemate — the final boss ran 237 turns and neither side could close.
Making `K` grow with the attacker's level (`110 + 13 × level`) keeps the *ratio*
of armour to softening roughly constant across the whole eighty-level span, so a
Mythic-tier fight has the same damage texture as a Veteran one.

**Spread penalty.** Multi-target actions were paying full per-target damage,
which makes any party-wide spell strictly better than a single-target one as soon
as there are two enemies — and made a boss with a group nuke able to end the
fight on turn one. Damage is now scaled by how widely the action spreads: `0.55`
for all-targets, `0.78` for a row or column, `0.70` for random multi-hits.
Bosses still take two actions per round, but the second is restricted to a single
target, so a boss opens hard without opening lethally.

### Balance, and how it is checked

`tools/simulate.js` drives the real engine headless with a near-optimal party AI
(heals below 50%, otherwise casts the strongest reachable skill), gearing the
party from a gold budget derived from actual encounter rewards.

At the intended level per region, trash resolves in 0–8 turns at ~100%. Bosses
run 68–100% over 12–42 turns, rising through the game: Volk 75% at Lv9, the Anvil
68% at Lv16, and the Thirteenth 98% over 42 turns at Lv85. Bosses sit high on
purpose — the simulated party never wastes a turn, so 70% for the harness is a
real fight for a person. The property that actually matters is that difficulty
*responds*: at three levels under, the same party loses those fights outright.

Enemies have no equipment, so their raw attack is scaled harder than a player's
to land in the same damage band as a geared party member.

---

## 6. Presentation

The look is HD-2D — pixel figures treated as objects in a lit scene rather than
as a flat tile grid — reached with no image assets at all.

### The frame

A **480×270** framebuffer, upscaled nearest-neighbour to fill the window. That is
exactly quarter-scale 1080p, so every source pixel lands on an integer 4×4 block
on a common display and nothing shimmers. Pixel work happens at 480×270; the
compositing happens after.

### The post pass

Three stages run over the finished frame, per scene:

1. **Bloom.** Highlights are isolated by multiplying the frame by itself twice —
   cubing each channel, which crushes midtones toward zero and leaves only near-
   white — then blurred and added back. The first attempt used a flat grey
   multiply as a threshold, which kept about half of *every* pixel and washed the
   whole frame out; a real threshold was the fix.
2. **Colour grade.** A per-location tint composited in `overlay`: warm gold in
   town, cold blue underground, sick green in the Hollow.
3. **Vignette.** A radial darkening that closes the corners and puts the eye in
   the middle of the frame.

Scenes set `bloom`, `vignette` and `setGrade()` themselves, so the field can be
warm and bright while a dungeon is dim and blue-shifted without either knowing
about the other.

### Sprites

Every sprite is traced with a one-pixel dark outline, given cheap ambient
occlusion where forms meet, and a rim light from the upper left, then shaded in
three tones per material. Without the outline, pixel figures read as flat blocks
against a background instead of as figures in front of it; without the rim light,
they read as stickers rather than as objects under a lamp.

Monsters come from eight body plans over a three-colour ramp. Two lessons are
baked into that code: a `scale` argument must scale the *creature*, not just the
canvas (bosses were rendering at trash-mob size), and wings have to be drawn as a
lens widest through the middle rows or they read as paper darts.

### Font

A hand-drawn 5×7 proportional bitmap font with a hard one-pixel drop shadow.
This is the single highest-impact detail in the whole renderer: system text
rendered by the browser reads as a *terminal* no matter what else is on screen,
and a real bitmap font reads as a game immediately. Advance width is measured
from each glyph's rightmost lit column, so `I` is tight and `W` is wide.

### Terrain, and why the first two attempts looked blocky

Interiors — walls, floors, roofs, doors — are per-cell 24×24 stamps, and that is
correct: architecture *is* square.

Outdoor terrain is not, and drawing it that way was the mistake behind two
rejected art passes. A stamp cached by name cannot know what it borders, so every
coastline came out a staircase, every mountain range came out a row of identical
triangles, and a forest came out a grid of identical blobs. Adding detail to the
stamps could never have fixed it, because the blockiness was in the *structure*.

`src/engine/terrain.js` replaces them with two layers, both computed in world
space rather than tile space:

- **Ground** is a priority ladder — water < sand < grass < road. A cell fills
  with its own material, then every higher-priority material in its
  neighbourhood bleeds in wherever a distance field says it is close enough,
  with the threshold wobbled a few pixels by value noise. Distance does all the
  work: an orthogonal neighbour yields a soft edge, a diagonal one yields a
  rounded corner, and a concave corner fills itself — no 47-tile blob set, no
  case analysis. Where land meets water a sand beach is laid slightly proud of
  the land, so a shore reads as a shore.
- **Masses** — mountains and forest — are signed fields: negative inside,
  positive outside, measured to an *inset* square so the outline can cut into a
  cell as well as bulge out of it. Every cell draws every mass that touches it,
  clipped to its own bounds, so a peak rises into the sky above it and a canopy
  closes over a cell border.

Two numbers in that second layer are load-bearing and were wrong at first. For
neighbouring cells to join into one mass rather than a bead necklace of
per-tile lumps, the bridge between their inset squares has to stay covered at
its narrowest: `reach - |wobble|max > inset`. Break it and a range falls apart
into exactly the blockiness the module exists to remove.

Relief comes from overlapping forms, not from noise — a mass filled with noise
is flat grey paint however good the noise is. Peaks and treetop crowns are
placed on a jittered grid in *world* space, so the texture never lines up with
the cells beneath it.

Because every material is a colour as a function of world position, nothing
repeats: a field of grass is one continuous field rather than the same stamp
four hundred times. The cost is 0.68 ms per newly seen cell, cached after.

### Particles

Dust drifting across the overworld, embers over lava, motes in the Hollow, and a
flickering torch radius underground that is both a light source for the grade and
the reason a dungeon feels like a dungeon.

### Battle

A backdrop palette per region — sky gradient, ridge silhouette, textured ground
with scanlines that open up toward the viewer. Ranks are staggered rather than
square, because three sprites in one column on a strict grid overlap into a totem
pole; offsetting each row outward reads as depth.

Commands are picked from a cross of six icon tiles rather than a scrolling
text list — a plus shape with Attack at its centre, the default selection, and
Move filling the one corner a cross leaves spare. `src/engine/icons.js` draws
each glyph (sword, book, shield, satchel, boot, compass) the same way every
other sprite in the engine is built: painter primitives, cached by `make()`,
no image assets. `CommandWheel` in `src/engine/ui.js` navigates it by finding
the nearest item that shares the current row or column, so an irregular
five-plus-one layout still feels like a d-pad cross rather than a maze.

The party's status cards grow a small bust portrait — the same `actorSprite()`
the field and menu scenes already generate, cropped to head and shoulders —
whenever the active command panel is on screen and has the room for one; the
plain HP/MP/IP rows underneath are unchanged.

### A second region palette

Not every outdoor tile wants to look like Wren's Ford. `terrain.js`'s `MAT`
table and `building.js`'s wall/roof palette are both keyed by a `theme` string
now (`'green'`, the original countryside; `'desert'`, dusty and sun-baked),
read from the map's own `theme` field the same way `field.js` already reads
`m.town` or `m.outdoor`. Nothing about the bleed or the signed-field logic
changes — a theme is purely a different set of colour functions plumbed
through the same shapes.

A domed watchtower rides on top of this: `roofdome` is a tile like `roof`, but
`drawDome()` renders it as a hemisphere on a cylindrical drum rather than a
pitch. The first attempt made the dome's cap span the tower's whole height,
which stretches a hemisphere into a spike — a dome only reads as a dome when
its cap height is close to its own radius, with a plain drum taking up
whatever height is left below it.

### What static checks cannot catch

Every layout bug in this project was found by screenshotting a real browser, not
by a test. Moving from 256×224 to 480×270 broke the status page, the class
ladder, the shop and the promotion screen in four different ways, and all four
imported cleanly and passed all 80 data checks while doing it. The Playwright
harnesses that drive the actual game and dump PNGs are the only tool that finds
a panel overflowing its box.
