/**
 * Loads a year of the dispatch spreadsheet into the Gantt.
 *
 * The sheet is a grid: one row of weekday letters, one of day-of-month
 * numbers, then a row per vehicle whose cells hold the job for that day. The
 * day numbers restart at 1 each month and the sheet never says which month —
 * so the dates come from counting forward from a start date given here, and
 * the count is checked against the numbers in the sheet rather than trusted.
 * A silent off-by-one would move several hundred jobs by a day, which is worse
 * than importing nothing.
 *
 *   npx tsx scripts/import-gantt.ts --file dispatch.tsv --start 2026-01-01
 *
 * That is a dry run: it reads, reports and writes nothing. Add --write when
 * the report looks right. Everything written carries one batch tag, so a bad
 * import comes out again in one statement.
 */

import fs from "node:fs";
import { db } from "../src/lib/db";

type Args = Record<string, string | boolean>;

const args: Args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith("--")) continue;
  const key = a.slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args[key] = next;
    i++;
  } else {
    args[key] = true;
  }
}

const FILE = String(args.file ?? "");
const START = String(args.start ?? "");
const WRITE = args.write === true;
const GROW = args["grow-slots"] === true;
const CREATE = args["create-missing"] === true;

// Only part of the sheet, which is the usual case: the file holds a year and
// what is wanted is the week coming up. The whole grid is still read and still
// checked against the calendar — the filter decides what gets written, not
// what gets counted, so narrowing the range cannot shift a date.
const FROM = typeof args.from === "string" ? args.from : "";
const TO = typeof args.to === "string" ? args.to : "";

if (!FILE || !/^\d{4}-\d{2}-\d{2}$/.test(START)) {
  console.error("Usage: tsx scripts/import-gantt.ts --file sheet.tsv --start YYYY-MM-DD [--write] [--grow-slots]");
  process.exit(1);
}

/**
 * Which vehicle each row of the sheet belongs to, and which of its slots.
 *
 * The sheet numbers its vans; Piper has one row per vehicle with slots
 * underneath. Kept here as a visible table rather than guessed from the text,
 * because "Rental car #2" and "Cube van #2" are only alike in shape and a rule
 * clever enough to read both is a rule nobody can check.
 */
type Target = {
  vehicle: string;
  /** Omitted where the sheet repeats a name: the slot then comes from the
   *  order the rows appear in, so four "Own car" rows fill four slots. */
  slot?: number;
  /** Used only when --create-missing has to invent the vehicle. */
  class?: string;
  ownership?: string;
};

const MAP: Record<string, Target> = {
  "pynx cargo": { vehicle: "Pynx Cargo", slot: 0 },
  "pynx suv": { vehicle: "Passenger vehicle", slot: 0 },

  "cube van #1": { vehicle: "Cube van", slot: 0 },
  "cube van #2": { vehicle: "Cube van", slot: 1 },
  "cube van #3": { vehicle: "Cube van", slot: 2 },
  // The sheet writes this one with a space after the hash. Matched as it is
  // written rather than tidied, because the sheet is the thing being read.
  "cube van # 4": { vehicle: "Cube van", slot: 3 },
  "cube van #4": { vehicle: "Cube van", slot: 3 },

  "cargo van #1": { vehicle: "Cargo van", slot: 0 },
  "cargo van #2": { vehicle: "Cargo van", slot: 1 },
  "cargo van #3": { vehicle: "Cargo van", slot: 2 },
  "cargo van #4": { vehicle: "Cargo van", slot: 3 },

  "26' truck #1": { vehicle: "26 ft truck", slot: 0 },
  "26' truck #2": { vehicle: "26 ft truck", slot: 1 },
  "26' truck #3": { vehicle: "26 ft truck", slot: 2 },

  "rental car #1": { vehicle: "Rental car", slot: 0, class: "passenger", ownership: "rental" },
  "rental car #2": { vehicle: "Rental car", slot: 1, class: "passenger", ownership: "rental" },
  "rental car #3": { vehicle: "Rental car", slot: 2, class: "passenger", ownership: "rental" },

  minivan: { vehicle: "Mini van", slot: 0 },
  "minivan 2": { vehicle: "Mini van", slot: 1 },

  // Four rows, all called the same thing — somebody's own car, whoever is
  // driving. No slot here, so they take one each in the order they appear.
  "own car": { vehicle: "Own car", class: "passenger", ownership: "personal" },

  "penske cube van": { vehicle: "Penske cube van", slot: 0, class: "cube_van", ownership: "rental" },
  "u-haul cube van": { vehicle: "U-Haul cube van", slot: 0, class: "cube_van", ownership: "rental" },
  "did logistics": { vehicle: "DID Logistics", class: "other", ownership: "other" },
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ------------------------------------------------------------------ read */

const lines = fs.readFileSync(FILE, "utf8").replace(/\r\n?/g, "\n").split("\n");

// The header is the first row whose cells are mostly small numbers starting
// at 1 — found rather than assumed at a fixed line, because exports differ in
// how many blank or title rows they put on top.
let headerAt = -1;
for (let i = 0; i < Math.min(lines.length, 12); i++) {
  const cells = lines[i].split("\t").map((c) => c.trim());
  const nums = cells.filter((c) => /^\d{1,2}$/.test(c));
  if (nums.length > 25 && nums[0] === "1") {
    headerAt = i;
    break;
  }
}
if (headerAt === -1) {
  console.error("Could not find the row of day numbers. Is this the right file, tab-separated?");
  process.exit(1);
}

const dayCells = lines[headerAt].split("\t").map((c) => c.trim());

/*
 * The date for every column, walked forward from --start.
 *
 * Each column's day number has to match the day the walk has reached. When it
 * does not, the sheet and the calendar have diverged — a missing column, an
 * extra one, or the wrong start date — and the run stops rather than filing
 * everything after that point a day out.
 */
const dateFor: (string | null)[] = [];
const cursor = new Date(`${START}T00:00:00`);
let firstCol = -1;

for (let c = 0; c < dayCells.length; c++) {
  const cell = dayCells[c];
  if (!/^\d{1,2}$/.test(cell)) {
    dateFor.push(null);
    continue;
  }
  if (firstCol === -1) firstCol = c;
  if (Number(cell) !== cursor.getDate()) {
    console.error(
      `Column ${c} says day ${cell} but counting from ${START} reaches ` +
        `${iso(cursor)}. The sheet and the calendar disagree — check --start, ` +
        `or whether a column is missing. Nothing written.`,
    );
    process.exit(1);
  }
  dateFor.push(iso(cursor));
  cursor.setDate(cursor.getDate() + 1);
}

const dated = dateFor.filter(Boolean).length;
console.log(`Header on line ${headerAt + 1}: ${dated} days, ${dateFor[firstCol]} to ${iso(new Date(cursor.getTime() - 86400000))}`);

/* -------------------------------------------------------------- vehicles */

/*
 * Which database, said out loud.
 *
 * db() takes PIPER_DATA_DIR or falls back to ./data — so a run on the droplet
 * that forgets it writes to an empty copy inside the checkout, reports
 * eighteen jobs filed, and changes nothing anybody can see. Printing the path
 * and what is already in it makes that obvious in the dry run instead of after
 * the write.
 */
const DB_DIR = process.env.PIPER_DATA_DIR ?? `${process.cwd()}/data`;
console.log(`Database: ${DB_DIR}/piper.db`);

const conn = db();
const already = conn.prepare("SELECT COUNT(*) c FROM gantt_cells WHERE cleared_at IS NULL").get() as { c: number };
const vehicleCount = conn.prepare("SELECT COUNT(*) c FROM vehicles").get() as { c: number };
console.log(`          ${vehicleCount.c} vehicles, ${already.c} jobs already on the Gantt\n`);

const vehicles = conn.prepare("SELECT id, name, slots FROM vehicles").all() as {
  id: number;
  name: string;
  slots: number;
}[];
const byName = new Map(vehicles.map((v) => [v.name.toLowerCase(), v]));

/* ---------------------------------------------------------------- parse */

type Cell = { vehicle: string; slot: number; label: string; from: string; to: string };
const cells: Cell[] = [];
const unmapped = new Map<string, number>();
const taken = new Map<string, number>();
let rows = 0;

for (let i = headerAt + 1; i < lines.length; i++) {
  const raw = lines[i].split("\t");
  // The vehicle name is the last non-empty cell before the dated columns.
  const name = raw.slice(0, firstCol).map((c) => c.trim()).filter(Boolean).pop() ?? "";
  if (!name) continue;

  const key = name.toLowerCase().replace(/\s+/g, " ").trim();
  const target = MAP[key];
  if (!target) {
    unmapped.set(name, (unmapped.get(name) ?? 0) + 1);
    continue;
  }
  rows++;

  // A slot the map did not name is handed out in row order, so the sheet's
  // four identically named rows do not all land on top of each other.
  const used = taken.get(target.vehicle) ?? 0;
  const slot = target.slot ?? used;
  taken.set(target.vehicle, Math.max(used, slot + 1));

  // Consecutive days with the same job are one bar, not five. That is how the
  // Gantt already draws a multi-day run, and it is how somebody reading the
  // sheet sees it: one job that lasts a week.
  let run: { label: string; from: string; to: string } | null = null;
  const flush = () => {
    if (run) cells.push({ vehicle: target.vehicle, slot, ...run });
    run = null;
  };

  for (let c = firstCol; c < dateFor.length; c++) {
    const on = dateFor[c];
    if (!on) continue;
    const label = (raw[c] ?? "").trim();
    if (!label) {
      flush();
      continue;
    }
    if (run && run.label === label) run.to = on;
    else {
      flush();
      run = { label, from: on, to: on };
    }
  }
  flush();
}

console.log(`${rows} vehicle rows read, ${cells.length} jobs found in the whole sheet.`);

// Applied after the runs are built, so a job that starts before the window and
// carries into it comes in whole rather than being clipped to the Monday.
const wanted = cells.filter((c) => (!FROM || c.to >= FROM) && (!TO || c.from <= TO));
if (FROM || TO) {
  console.log(`${wanted.length} of them touch ${FROM || "the start"} to ${TO || "the end"}.`);
  cells.length = 0;
  cells.push(...wanted);
}
if (unmapped.size) {
  console.log(`\nRows skipped, no mapping for the name:`);
  for (const [u, n] of unmapped) console.log(`  "${u}"${n > 1 ? ` (${n} rows)` : ""}`);
  console.log(`Add them to MAP at the top of this script if they should come in.`);
}

/* ------------------------------------------------------- check the fleet */

const need = new Map<string, number>();
for (const c of cells) need.set(c.vehicle, Math.max(need.get(c.vehicle) ?? 0, c.slot + 1));

let blocked = false;
const toCreate: { name: string; slots: number; cls: string; own: string }[] = [];
console.log("");
for (const [name, slots] of need) {
  const v = byName.get(name.toLowerCase());
  if (!v) {
    const spec = Object.values(MAP).find((m) => m.vehicle === name);
    if (CREATE && spec) {
      console.log(`  "${name}" does not exist — will add it (${spec.class}, ${spec.ownership}) with ${slots} slots`);
      toCreate.push({ name, slots, cls: spec.class ?? "other", own: spec.ownership ?? "other" });
    } else {
      console.log(`  MISSING vehicle "${name}" — nothing in Piper by that name${spec ? " (pass --create-missing)" : ""}`);
      blocked = true;
    }
  } else if (v.slots < slots) {
    console.log(`  "${name}" has ${v.slots} slots, the sheet needs ${slots}${GROW ? " — will grow it" : " (pass --grow-slots)"}`);
    if (!GROW) blocked = true;
  } else {
    console.log(`  "${name}" ok — ${slots} of ${v.slots} slots used`);
  }
}

console.log("\nFirst ten, to check the dates against the sheet by eye:");
for (const c of cells.slice(0, 10)) {
  console.log(`  ${c.from}${c.to !== c.from ? ` to ${c.to}` : "        "}  ${c.vehicle} slot ${c.slot}  ${c.label}`);
}

if (blocked) {
  console.error("\nStopping: fix the above first. Nothing written.");
  process.exit(1);
}

if (!WRITE) {
  console.log(`\nDry run. Nothing written. Add --write to file these ${cells.length} jobs.`);
  process.exit(0);
}

/* ---------------------------------------------------------------- write */

const batch = `import-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}`;
const grow = conn.prepare("UPDATE vehicles SET slots = ? WHERE id = ?");
const insert = conn.prepare(
  `INSERT INTO gantt_cells (vehicle_id, state, starts_on, ends_on, show_name, slot, batch)
   VALUES (?, 'booked', ?, ?, ?, ?, ?)`,
);

const addVehicle = conn.prepare(
  `INSERT INTO vehicles (name, class, ownership, home_base, slots) VALUES (?, ?, ?, 'Shop', ?)`,
);

const run = conn.transaction(() => {
  for (const v of toCreate) {
    const id = addVehicle.run(v.name, v.cls, v.own, v.slots).lastInsertRowid as number;
    byName.set(v.name.toLowerCase(), { id, name: v.name, slots: v.slots });
  }
  for (const [name, slots] of need) {
    const v = byName.get(name.toLowerCase());
    if (v && v.slots < slots) grow.run(slots, v.id);
  }
  for (const c of cells) {
    const v = byName.get(c.vehicle.toLowerCase())!;
    insert.run(v.id, c.from, c.to, c.label, c.slot, batch);
  }
});
run();

console.log(`\nWrote ${cells.length} jobs, tagged ${batch}.`);
console.log(`To undo the whole import:`);
console.log(`  sqlite3 /var/lib/piper/piper.db "DELETE FROM gantt_cells WHERE batch = '${batch}'"`);
