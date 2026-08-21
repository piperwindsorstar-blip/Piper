/**
 * Loads the per-slot suggestions shown in the couple's planner.
 *
 *   npm run db:recommendations
 *
 * Reads scripts/data/recommendations.json, compiled from Pynx planning forms.
 * That file holds songs only — no couple, contact detail or wedding is
 * identifiable from it. Re-running is additive at the database level, so this
 * can be re-run as more forms are compiled.
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { recordRecommendation } from "../src/lib/planning";

type Compiled = {
  compiledFrom: number;
  recommendations: {
    category: string;
    title: string;
    artist: string | null;
    timesPicked: number;
    note: string | null;
  }[];
  commonlyBanned: { title: string; timesBanned: number }[];
};

const dataPath = path.join(process.cwd(), "scripts", "data", "recommendations.json");
const compiled: Compiled = JSON.parse(fs.readFileSync(dataPath, "utf8"));

db(); // create and migrate before writing

const load = db().transaction(() => {
  // Reset so re-running reflects the current compilation rather than stacking
  // counts on top of a previous run.
  db().prepare("DELETE FROM recommendations").run();

  for (const r of compiled.recommendations) {
    for (let i = 0; i < r.timesPicked; i++) {
      recordRecommendation(r.category, r.title, r.artist, r.note);
    }
  }

  // Do-not-play is a prompt, not a suggestion: most couples only remember what
  // they can't stand once they see it named.
  for (const banned of compiled.commonlyBanned) {
    if (banned.timesBanned < 2) continue; // one couple's dislike isn't a pattern
    for (let i = 0; i < banned.timesBanned; i++) {
      recordRecommendation("do_not_play", banned.title, null, "Often ruled out");
    }
  }
});
load();

const total = db().prepare("SELECT COUNT(*) AS n FROM recommendations").get() as { n: number };
const slots = db()
  .prepare("SELECT COUNT(DISTINCT category) AS n FROM recommendations")
  .get() as { n: number };

console.log(
  `${total.n} recommendations across ${slots.n} slots, compiled from ${compiled.compiledFrom} planning forms.`,
);
