# Quest of the Thirteen

A 16-bit turn-based RPG that borrows deliberately:

| From | What |
| --- | --- |
| **Dragon Quest III** | vocation-style class promotion, a party you build yourself at the guild, front-view battles, a temple that witnesses your advancement |
| **Lufia: The Legend Returns** | two facing 3×3 battle grids where your column decides what you can reach, and IP gauges that fill from damage |
| **Final Fantasy VI** | the presentation — bitmap menu font, bevelled blue windows, outlined sprites, layered battle backdrops |

Runs in any modern browser. No build step, no dependencies.

```bash
npm start          # serves on http://localhost:8080
npm test           # 66 data-integrity checks
npm run sim        # headless battle balance simulation
npm run check      # both
```

**Controls** — arrows/WASD walk · `Z`/Enter confirm · `X`/Esc cancel · `C`/Tab party menu · `Shift` context action (random name, unequip, auto-formation, delete save). Touch controls appear automatically on touch devices.

---

## The three systems

### 12 classes, promoting every 5 levels

Each of the twelve root classes grows a ten-node tree. Promotions land on levels
5, 10, 15 and 20; **the ones at 10 and 20 are branch points where you choose
between two successors**, and the choice at 10 determines which pair of
masteries you can reach at 20.

```
Lv 1   Warrior
Lv 5   └─ Vanguard
Lv10      ├─ Knight ─────── Lv15 Paladin ─── Lv20 ┬ Sword Saint
          │                                        └ Templar
          └─ Berserker ──── Lv15 Warlord ─── Lv20 ┬ Ravager
                                                   └ Warbringer
```

12 roots × 10 nodes = **120 class nodes**, all with distinct names, growth and
skill schools. A class node does not carry a hand-written stat table; it carries
a *bias* applied to its root's growth profile, scaled by tier. A Berserker is
always a Warrior who traded defence for violence.

Growth accumulates **as it is earned**, so promoting late permanently costs you
the levels you spent growing at the lower rate. The validator asserts this.

### 13 elements on a wheel

Nine **prime** elements sit on a ring where each is strong against the two that
follow it and weak against the two that precede it — so the affinity table is
symmetric by construction rather than by hand-checking:

```
Fire → Ice → Nature → Earth → Metal → Lightning → Wind → Poison → Water → (Fire)
```

Four **arcane** elements sit off the ring in their own cycle
(Light → Dark → Spirit → Void), dealing neutral damage to the primes. Void is
the exception in the other direction: **Void damage ignores resistance entirely,
in both directions.**

An element is chosen once at creation and never changes. It grants a permanent
stat bias and a passive perk — Fire inflicts Burn, Wind gets evasion and a free
battle-grid reposition, Dark heals on kills, Water amplifies all healing.

### 20 jobs, ranked by use

A class is how you fight; a **job** is what you do for a living. Each job pays
out three ways: a rank-scaled stat bonus, a field ability, and a passive world
rule.

Jobs rank 1→5 **by use, not by level.** Sell things as a Merchant and your
prices improve; open chests as a Locksmith and traps start revealing themselves.
A character whose element is one the job favours ranks up 25% faster.

Blacksmith · Armorer · Alchemist · Herbalist · Merchant · Appraiser · Chef ·
Provisioner · Miner · Fisher · Hunter · Scout · Cartographer · Locksmith ·
Tamer · Scribe · Bard · Pilgrim · Artificer · Sailor

---

## Combat

Two facing 3×3 grids. A unit's **effective column** is measured from its own
side's frontmost *living* rank, so killing the enemy front rank pulls the rank
behind it into reach. Distance between two units is

```
effCol(attacker) + effCol(target) + 1
```

and reach decides everything: daggers, fists, swords and maces reach 2; spears
and whips reach 3; bows, staves and every spell reach anywhere. A skill you
cannot reach with is not selectable; a basic attack that overreaches lands at
half power. Standing in the back column is safer — the enemy AI weights its
targeting toward whatever is in front.

**IP** fills from damage dealt and taken. Some Arts cost IP instead of MP, which
is what lets a Berserker out of MP still do something frightening.

Bosses take two turns per round.

---

## Layout

```
index.html            entry point
src/
  main.js             scene stack + fixed-step loop
  engine/
    screen.js         256x224 framebuffer, FFVI window chrome, bars, fades
    font.js           hand-drawn 5x7 proportional bitmap font
    sprites.js        ALL art, generated: characters, monsters, NPCs, tiles
    input.js  ui.js  rng.js  save.js
  data/
    elements.js       13 elements; the wheel builds its own affinity table
    classes.js        12 trees flattened to 120 nodes
    jobs.js           20 jobs
    skills.js         23 schools, 137 skills, 23 status effects
    items.js          96 items      enemies.js  30 enemies, 23 formations
    maps.js           overworld, 2 towns, 4 dungeon floors
  game/
    character.js      stats, levelling, promotion, jobs, equipment, status
    battle.js         the grid combat engine
    state.js          party, inventory, flags, save/load
    scenes/           title creation field battle menu shop promotion gameover
tools/
  validate.js         66 data-integrity checks
  simulate.js         headless battle balance harness
  serve.js            zero-dependency static server
  spritesheet.html    contact sheet of every generated sprite and tile
```

### There are no image assets

Every sprite and tile is drawn procedurally at load. A party sprite is assembled
from a class *kit* (helm, body, cape, weapon) tinted by the character's element,
with promoted tiers gaining an element-tinted aura; monsters come from eight
body plans and a three-colour ramp. Everything is traced with a one-pixel
outline and shaded in three tones per material, lit from the upper left, which
is what makes it sit in the SNES idiom.

`tools/spritesheet.html` renders the whole set on one page for review.

---

## Testing

`npm test` checks every claim this README makes: that there are exactly 13
elements and the affinity table is symmetric, that the class tree is 12/12/24/24/48
across its tiers with branch points only at tiers 1 and 3, that all 20 jobs have
a field ability and a passive, that no skill, item, drop, shop entry or map warp
points at something that does not exist, and that every NPC, chest and boss on
every map is reachable by flood fill from that map's entrance.

`npm run sim` drives the real battle engine headless. At the intended level for
each region, trash encounters resolve in 1–8 turns and bosses run 11–17 turns at
90–100% against a near-optimal AI; an under-levelled party reliably loses, which
is the property that matters.
