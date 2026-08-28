# Design notes

Reasoning behind the numbers, and the places where a rule was bent to make the
game work. The reference material is Dragon Quest III (progression), Lufia: The
Legend Returns (combat), and Final Fantasy VI (presentation).

---

## 1. The class ladder

### Shape

The brief is "promotion every 5 levels, with a branching promotion every 10".
Read literally that gives branch points at 10, 20, 30, 40 … and a tree that
doubles forever: by level 40 a single root would own 32 distinct capstones and
the game would need 12 × 62 = 744 named classes nobody would ever see.

So the ladder **caps at level 20**, four promotions deep:

| Level | Tier | Kind | Nodes per root |
| --- | --- | --- | --- |
| 1 | 0 | start | 1 |
| 5 | 1 | linear | 1 |
| 10 | 2 | **branch** | 2 |
| 15 | 3 | linear | 2 |
| 20 | 4 | **branch** | 4 |

Ten nodes per root, 120 in total, four distinct masteries per class. Both branch
points survive, every node is reachable, and every name is one a player can
actually arrive at. Past level 20 a character keeps their mastery and continues
growing through levels, job ranks and equipment.

### Why nodes carry a bias, not a stat table

120 hand-written stat tables would drift: someone would eventually make a
Berserker tankier than a Knight without noticing. Instead each root owns a
growth *profile* (per-level gains for eight stats) and each node owns a *bias*
multiplying it, scaled by a per-tier factor:

```
growth[stat] = PROFILE[root][stat] × TIER_FACTOR[tier] × bias[stat]
```

`TIER_FACTOR` is `[1.00, 1.22, 1.48, 1.78, 2.12]`. A Berserker's bias is
`{str: 1.3, hp: 1.1, vit: 0.8, spr: 0.7}` — it *cannot* accidentally out-defend
its Knight sibling, because both are derived from the same Warrior profile.
`npm test` asserts that every promotion is a net growth increase.

### Growth accumulates as it is earned

A character banks `growth[stat]` at every level-up using **the class they held at
the time**. Promoting late is therefore permanently worse than promoting on
schedule, which gives the temple visit real weight instead of making it a
formality. There is a regression test for exactly this: a Warrior promoted at 5
and levelled to 10 must end stronger than one who sat at Warrior to 10.

Promotions also pay a one-time flat bonus (tier 4 is +120 HP, +48 MP, +9 to each
main stat) and fully restore HP/MP, the way a Dragon Quest class change does.

### Skills come from schools, not from nodes

A node grants *schools*; a character knows every skill in their current schools
whose learn level is at or below their level. This means 120 nodes cost 120 short
school lists rather than 120 skill tables, and it makes the branch choice
legible: the promotion screen shows exactly which schools each option gains and
which it loses. A Berserker really does forget how to hold a shield, because
Bulwark Arts is not on its list.

---

## 2. The element wheel

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

---

## 3. Jobs

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
favours earns job EXP 25% faster — the one place the three systems are wired
directly into each other.

This keeps jobs from being a second, redundant level-up track: a level 30
character who never sold anything is still an Apprentice Merchant.

---

## 4. Combat on two 3×3 grids

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
ranged and magic 9.

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
raw    = (power or magic) × skillPower × statusModifiers
mitig  = 120 / (120 + armor)                    armor reduced by pierce
final  = raw × mitig × elementMult × reachPenalty × variance(0.92–1.08)
```

Element multipliers are 1.5 / 1.0 / 0.5. Criticals are ×1.8. The `120 /
(120 + armor)` curve is asymptotic rather than subtractive so defence never
reaches immunity and low-level enemies stay relevant slightly longer than they
would under flat reduction.

### Balance, and how it is checked

`tools/simulate.js` drives the real engine headless with a near-optimal party AI
(heals below 50%, otherwise casts the strongest reachable skill), gearing the
party from a gold budget derived from actual encounter rewards.

At the intended level per region: trash resolves in 1–8 turns at ~100%; bosses
run 11–17 turns at 90–100%. Bosses sit high on purpose — the simulated party
never wastes a turn, so 90% for the harness is a real fight for a person. The
property that actually matters is that difficulty *responds*: at three levels
under, the same party loses those fights outright.

Enemies have no equipment, so their raw attack is scaled harder than a player's
(×3.0, ×3.4 for bosses) to land in the same damage band as a geared party
member. Bosses take two turns per round rather than being given inflated stats,
which keeps their damage numbers readable.

---

## 5. Presentation

The look is Final Fantasy VI, reached with no image assets at all.

- **Font.** A hand-drawn 5×7 proportional bitmap font with a hard one-pixel drop
  shadow. This is the single highest-impact detail: rendered system text reads as
  a terminal no matter what else is on screen, and a real bitmap font reads as a
  SNES immediately. Advance width is measured from each glyph's rightmost lit
  column, so `I` is tight and `W` is wide.
- **Windows.** Three rings — a near-black outer keyline with its four corner
  pixels knocked out, a light periwinkle bevel brighter along the top and left,
  and an inner rule — over a three-stop blue gradient.
- **Sprites.** Everything is traced with a one-pixel dark outline and shaded in
  three tones per material, lit from the upper left. Without the outline, pixel
  figures read as flat blocks against a background instead of as figures in front
  of it.
- **Tiles.** Fixed 16×16 patterns (never randomised, so they tile seamlessly)
  built from a 4–5 tone ramp. The field renderer picks continuation variants from
  a tile's neighbours, so a run of mountains becomes a ridge with a continuous
  skyline and its interior becomes solid rock, a block of trees becomes closed
  canopy, and water grows a sand lip wherever it meets land.
- **Battle.** A backdrop palette per region — sky gradient, ridge silhouette,
  textured ground with scanlines that open up toward the viewer. Ranks are
  staggered rather than square, because three sprites in one column on a strict
  grid overlap into a totem pole; offsetting each row outward reads as depth,
  which is how FFVI lines a party up.
