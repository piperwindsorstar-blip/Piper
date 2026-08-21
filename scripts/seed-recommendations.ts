/**
 * Loads the recommendations shown beside each slot in the couple's planner.
 *
 *   npm run db:recommendations
 *
 * Compiled from Pynx planning forms. Deliberately aggregate: a song and how
 * often it was chosen, never which couple chose it. Re-running is additive —
 * counts go up, nothing is duplicated — so this can be re-run as more forms
 * are read.
 */
import { db } from "../src/lib/db";
import { recordRecommendation } from "../src/lib/planning";

type Pick = [category: string, title: string, artist: string | null, note?: string];

/**
 * Compiled from planning forms. Note how few processionals are the original
 * recording — couples overwhelmingly choose instrumental or string covers, so
 * the suggestions reflect that rather than the radio version.
 */
const PICKS: Pick[] = [
  // Ceremony ---------------------------------------------------------------
  ["guest_arrival", "Instrumental covers — pop and country", null, "A common answer: familiar songs, no vocals"],
  ["guest_arrival", "Instrumental pop playlist", null],
  ["guest_arrival", "Enya", null, "Chosen as a tribute to a grandparent"],

  ["bridal_party_processional", "Wildest Dreams", "Ana Done & Swift Strings", "String cover"],
  ["bridal_party_processional", "Everywhere, Everything (Piano)", "Lucio Belmonte"],
  ["bridal_party_processional", "Levels — Wedding Entrance (Piano)", "Paul Hankinson"],
  ["bridal_party_processional", "Can't Help Falling in Love", "Haley Reinhart"],
  ["bridal_party_processional", "Dreams (Instrumental)", null],

  ["bride_processional", "Young and Beautiful (Violin)", "Dramatica"],
  ["bride_processional", "Tenerife Sea (Instrumental)", "Stven C"],
  ["bride_processional", "Wherever You Will Go (Piano)", "Marc Ato"],
  ["bride_processional", "Unconditionally (Piano Version)", "Katy Perry"],

  ["groom_processional", "Can't Help Falling in Love (Violin)", "Alan Ng"],
  ["groom_processional", "Beautiful Things", "Benson Boone", "Cued to land on the chorus"],

  ["flower_girls", "Pure Imagination", "Gene Wilder"],

  ["signing_registry", "Birds of a Feather (Wedding Violin)", "Ana Done"],
  ["signing_registry", "Simply the Best", "Billanne"],
  ["signing_registry", "Same Ole Me", "George Strait"],

  ["recessional", "Signed, Sealed, Delivered", "Stevie Wonder"],
  ["recessional", "Mr. Blue Sky", "Electric Light Orchestra"],
  ["recessional", "Beautiful Day", "U2", "Started around 0:55"],
  ["recessional", "Everywhere, Everything", "Noah Kahan & Gracie Abrams"],

  // Reception --------------------------------------------------------------
  ["grand_entrance_party", "Pump It", "Black Eyed Peas"],
  ["grand_entrance_party", "Fireball", "Pitbull ft. John Ryan"],
  ["grand_entrance_party", "These Words (Remix)", "Natasha Bedingfield"],

  ["grand_entrance_couple", "Renegade", "Styx", "Announced over the build, in on the drop"],
  ["grand_entrance_couple", "Can't Take My Eyes Off You", "Frankie Valli"],
  ["grand_entrance_couple", "Gimme Gimme Gimme", "Syzz"],

  ["first_dance", "In Case You Didn't Know", "Brett Young"],
  ["first_dance", "Lover (First Dance Remix)", "Taylor Swift"],
  ["first_dance", "Steady Heart (Wedding Version)", "Kameron Marlowe"],
  ["first_dance", "Steep", "Jordyn"],

  ["father_daughter", "My Little Girl", "Tim McGraw"],
  ["father_daughter", "Butterfly Kisses", "Bob Carlisle"],
  ["father_daughter", "Drive (For Daddy Gene)", "Alan Jackson"],

  ["mother_son", "My Wish", "Rascal Flatts"],

  ["combined_parent_dance", "Count on Me", "Bruno Mars"],

  ["cake_cutting", "How Sweet It Is (To Be Loved By You)", "James Taylor"],
  ["cake_cutting", "Kiss Me", "Sixpence None the Richer"],

  ["open_dancing", "Yeah!", "Usher"],
  ["open_dancing", "Dancing Queen", "ABBA"],
  ["open_dancing", "Hey Ya!", "OutKast"],

  ["last_dance", "Glad You Came", "The Wanted"],

  ["dinner", "Acoustic love songs people know", null],
  ["dinner", "A mix of decades, clean versions", null],

  ["cocktail", "A mix of decades, clean versions", null],
];

/**
 * Songs that keep appearing on do-not-play lists. Shown as a prompt rather
 * than a suggestion — the point is to jog the couple's memory, since most
 * only remember what they hate once they see it named.
 */
const COMMONLY_BANNED: Pick[] = [
  ["do_not_play", "Wedding cheese generally", null, "Said by most couples in some form"],
  ["do_not_play", "YMCA", "Village People"],
  ["do_not_play", "Macarena", "Los del Río"],
  ["do_not_play", "Cha-Cha Slide", "DJ Casper"],
  ["do_not_play", "Cupid Shuffle", "Cupid"],
  ["do_not_play", "Sweet Caroline", "Neil Diamond"],
  ["do_not_play", "Happy", "Pharrell Williams"],
  ["do_not_play", "Who Let the Dogs Out", "Baha Men"],
  ["do_not_play", "Chicken Dance", null],
];

db(); // create and migrate before writing

const load = db().transaction(() => {
  for (const [category, title, artist, note] of [...PICKS, ...COMMONLY_BANNED]) {
    recordRecommendation(category, title, artist, note ?? null);
  }
});
load();

const total = db().prepare("SELECT COUNT(*) AS n FROM recommendations").get() as { n: number };
const slots = db()
  .prepare("SELECT category, COUNT(*) AS n FROM recommendations GROUP BY category ORDER BY category")
  .all() as { category: string; n: number }[];

console.log(`${total.n} recommendations across ${slots.length} slots:`);
for (const slot of slots) console.log(`  ${slot.category.padEnd(28)} ${slot.n}`);
