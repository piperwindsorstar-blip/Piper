import crypto from "node:crypto";
import { db, nowIso } from "./db";
import { toIso, parseIso } from "./dates";
import { COMMITTED, type RunStatus, type VehicleClass } from "./dispatch-types";
import { layoutRuns, type RunBar, type Vehicle } from "./dispatch";

/**
 * The Gantt: what the shop expects to need, months out.
 *
 * Deliberately a separate table from `dispatch_runs`, because it answers a
 * different question and is written at a different time. The board says what
 * is arranged this week; the Gantt says "three shows that weekend, we'll want
 * the cube and probably a 26" long before anybody has phoned Pencar.
 *
 * Keeping them apart is the whole point. Pencilling a plan must not create a
 * booking somebody will act on, and booking a van must not silently redraw a
 * plan somebody else made. They inform each other — the recommender reads both
 * — but neither writes the other.
 *
 * Cells are soft-deleted so that clearing a vehicle's whole row can be undone
 * after a reload, rather than only while the page is still open.
 */

/** The Gantt uses the same vocabulary as the board, minus the shop day. */
export type CellState = Exclude<RunStatus, "shop">;

export type GanttCell = {
  id: number;
  vehicle_id: number;
  state: CellState;
  starts_on: string;
  ends_on: string;
  note: string | null;
  /** Which of the vehicle's rows this sits in. Fixed, not re-packed. */
  slot: number;
  cleared_at: string | null;
  batch: string | null;
  created_at: string;
};

/* --------------------------------------------------------------- reading */

export function cellsBetween(from: string, to: string): GanttCell[] {
  return db()
    .prepare(
      `SELECT * FROM gantt_cells
        WHERE cleared_at IS NULL AND starts_on <= ? AND ends_on >= ?
        ORDER BY starts_on, id`,
    )
    .all(to, from) as GanttCell[];
}

export function getCell(id: number): GanttCell | null {
  return (
    (db().prepare("SELECT * FROM gantt_cells WHERE id = ?").get(id) as GanttCell | undefined) ?? null
  );
}

/** The live cell in one slot on one day, if any. */
export function cellOn(vehicleId: number, slot: number, date: string): GanttCell | null {
  return (
    (db()
      .prepare(
        `SELECT * FROM gantt_cells
          WHERE cleared_at IS NULL AND vehicle_id = ? AND slot = ?
            AND starts_on <= ? AND ends_on >= ?
          ORDER BY id DESC LIMIT 1`,
      )
      .get(vehicleId, slot, date, date) as GanttCell | undefined) ?? null
  );
}

/* --------------------------------------------------------------- writing */

export type CellInput = {
  vehicle_id: number;
  state: CellState;
  starts_on: string;
  ends_on: string;
  note: string | null;
  slot: number;
};

export function createCell(input: CellInput): number {
  const result = db()
    .prepare(
      `INSERT INTO gantt_cells (vehicle_id, state, starts_on, ends_on, note, slot)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(input.vehicle_id, input.state, input.starts_on, input.ends_on, input.note, input.slot);
  return Number(result.lastInsertRowid);
}

export function updateCell(id: number, input: CellInput): void {
  db()
    .prepare(
      `UPDATE gantt_cells SET vehicle_id = ?, state = ?, starts_on = ?, ends_on = ?,
         note = ?, slot = ? WHERE id = ?`,
    )
    .run(
      input.vehicle_id,
      input.state,
      input.starts_on,
      input.ends_on,
      input.note,
      input.slot,
      id,
    );
}

export function deleteCell(id: number): void {
  db().prepare("DELETE FROM gantt_cells WHERE id = ?").run(id);
}

/**
 * One click on a day, cycling through the states the shop uses most.
 *
 * Empty → needed → booked → empty, which is the order the work happens in:
 * you notice you will want something, then you arrange it, then it is done
 * with. The other states exist but live in the dialog, because putting five
 * options on a single-click control means four wrong ones every time.
 *
 * A click on a day inside a multi-day cell edits that whole cell rather than
 * splitting it; splitting a span by clicking one of its middle days is almost
 * never what somebody means, and the dialog can do it deliberately.
 */
export function cycleDay(vehicleId: number, slot: number, date: string): CellState | null {
  const existing = cellOn(vehicleId, slot, date);

  if (!existing) {
    createCell({
      vehicle_id: vehicleId,
      state: "needed",
      starts_on: date,
      ends_on: date,
      note: null,
      slot,
    });
    return "needed";
  }

  if (existing.state === "needed") {
    db().prepare("UPDATE gantt_cells SET state = 'booked' WHERE id = ?").run(existing.id);
    return "booked";
  }

  deleteCell(existing.id);
  return null;
}

/**
 * Clears a vehicle's cells across a window, keeping them for an undo.
 *
 * Returns the batch id, which is what `undoClear` needs — an undo that just
 * restored "whatever was cleared last" would resurrect the wrong row the
 * moment two people were working at once.
 */
export function clearVehicle(vehicleId: number, from: string, to: string): string | null {
  const batch = crypto.randomBytes(8).toString("hex");
  const result = db()
    .prepare(
      `UPDATE gantt_cells SET cleared_at = ?, batch = ?
        WHERE cleared_at IS NULL AND vehicle_id = ? AND starts_on <= ? AND ends_on >= ?`,
    )
    .run(nowIso(), batch, vehicleId, to, from);

  return result.changes > 0 ? batch : null;
}

export function undoClear(batch: string): number {
  const result = db()
    .prepare("UPDATE gantt_cells SET cleared_at = NULL, batch = NULL WHERE batch = ?")
    .run(batch);
  return result.changes;
}

/** Housekeeping: a cleared cell is only useful while an undo is plausible. */
export function pruneCleared(): void {
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().replace("T", " ").slice(0, 19);
  db().prepare("DELETE FROM gantt_cells WHERE cleared_at IS NOT NULL AND cleared_at < ?").run(cutoff);
}

/* ---------------------------------------------------------------- layout */

/**
 * Every vehicle, every slot, whether or not anything is planned in it.
 *
 * The rows are a permanent fixture rather than a list of what happens to have
 * data. A chart that grows and shrinks as blocks are added is a chart you
 * cannot point at across a room — the shop reads this the way it reads a
 * printed sheet, and the fifth row is the 26 ft truck whether or not the 26 ft
 * truck is doing anything this month.
 *
 * Slots come from the vehicle, not from the data: three for a hired class,
 * because three cube vans can be out at once, and one for a vehicle Pynx owns.
 */
export type GanttSlot = { slot: number; bars: RunBar[] };
export type GanttRow = { vehicle: Vehicle; slots: GanttSlot[] };

export function ganttRows(days: string[], vehicles: Vehicle[]): GanttRow[] {
  const cells = cellsBetween(days[0], days[days.length - 1]);

  return vehicles.map((vehicle) => {
    const count = Math.max(1, vehicle.slots);
    const slots: GanttSlot[] = [];

    for (let slot = 0; slot < count; slot++) {
      // layoutRuns wants run-shaped records; a cell is the same shape for the
      // purpose of working out where a bar goes.
      const asRuns = cells
        .filter((c) => c.vehicle_id === vehicle.id && c.slot === slot)
        .map((c) => ({
          ...c,
          event_id: null,
          label: c.note ?? "",
          status: c.state as RunStatus,
          meet_time: null,
          crew: null,
          site: null,
          driver_id: null,
          keys_with: null,
          notes: null,
          vehicle_name: vehicle.name,
          vehicle_class: vehicle.class,
          vehicle_ownership: vehicle.ownership,
          driver_name: null,
          event_date: null,
        }));

      slots.push({ slot, bars: layoutRuns(days, asRuns) });
    }

    return { vehicle, slots };
  });
}

/* ----------------------------------------------------------- recommending */

export type Suggestion = {
  vehicle: Vehicle;
  free: boolean;
  /** How many of this vehicle's slots are still open over the dates. */
  spare: number;
  /** Why not, when it isn't: what is in the way. */
  conflicts: string[];
  classMatch: boolean;
};

/**
 * Which vehicles could take a job on these dates.
 *
 * Reads both surfaces, because either one means the vehicle is spoken for: a
 * booking on the board, or a commitment already pencilled on the Gantt. A
 * 'needed' cell is not a conflict — it is somebody else's unmet want, which is
 * worth mentioning but does not make the vehicle unavailable.
 *
 * Sorted so the useful answer is first: free and the right class, then free,
 * then the rest with their reasons.
 */
export function suggestVehicles(
  vehicles: Vehicle[],
  from: string,
  to: string,
  wanted?: VehicleClass,
): Suggestion[] {
  const runs = db()
    .prepare(
      `SELECT r.vehicle_id, r.label, r.status FROM dispatch_runs r
        WHERE r.starts_on <= ? AND r.ends_on >= ?`,
    )
    .all(to, from) as { vehicle_id: number; label: string; status: RunStatus }[];

  const cells = db()
    .prepare(
      `SELECT vehicle_id, state, note FROM gantt_cells
        WHERE cleared_at IS NULL AND starts_on <= ? AND ends_on >= ?`,
    )
    .all(to, from) as { vehicle_id: number; state: CellState; note: string | null }[];

  const suggestions = vehicles.map((vehicle) => {
    const conflicts: string[] = [];

    for (const run of runs) {
      if (run.vehicle_id !== vehicle.id) continue;
      if (COMMITTED.includes(run.status)) conflicts.push(`booked: ${run.label}`);
    }
    for (const cell of cells) {
      if (cell.vehicle_id !== vehicle.id) continue;
      if (COMMITTED.includes(cell.state as RunStatus)) {
        conflicts.push(`pencilled in${cell.note ? `: ${cell.note}` : ""}`);
      }
    }

    // Slots matter here. Three cube vans can be hired at once, so one booked
    // out of three leaves two — answering "spoken for" because a single
    // commitment exists would send somebody phoning round for nothing.
    const slots = Math.max(1, vehicle.slots);
    const spare = Math.max(0, slots - conflicts.length);

    return {
      vehicle,
      free: spare > 0,
      spare,
      conflicts,
      classMatch: wanted ? vehicle.class === wanted : false,
    };
  });

  return suggestions.sort((a, b) => {
    if (a.free !== b.free) return a.free ? -1 : 1;
    if (a.classMatch !== b.classMatch) return a.classMatch ? -1 : 1;
    return a.vehicle.name.localeCompare(b.vehicle.name);
  });
}

/* ----------------------------------------------------------------- ranges */

/** Three months from the month containing `iso`, for the quarter view. */
export function quarterDays(iso: string): string[] {
  const start = parseIso(iso);
  const first = new Date(start.getFullYear(), start.getMonth(), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);

  const days: string[] = [];
  for (let d = new Date(first); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(toIso(new Date(d)));
  }
  return days;
}
