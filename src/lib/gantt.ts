import { db } from "./db";
import { toIso, parseIso } from "./dates";
import { type RunStatus } from "./dispatch-types";
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
 */

/** The Gantt uses the same vocabulary as the board, minus the shop day. */
export type CellState = Exclude<RunStatus, "shop">;

export type GanttCell = {
  id: number;
  vehicle_id: number;
  state: CellState;
  starts_on: string;
  ends_on: string;
  /** The show it is for, when it has a name. This is what the bar says. */
  show_name: string | null;
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
  show_name: string | null;
  note: string | null;
  slot: number;
};

export function createCell(input: CellInput): number {
  const result = db()
    .prepare(
      `INSERT INTO gantt_cells (vehicle_id, state, starts_on, ends_on, show_name, note, slot)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.vehicle_id,
      input.state,
      input.starts_on,
      input.ends_on,
      input.show_name,
      input.note,
      input.slot,
    );
  return Number(result.lastInsertRowid);
}

export function updateCell(id: number, input: CellInput): void {
  db()
    .prepare(
      `UPDATE gantt_cells SET vehicle_id = ?, state = ?, starts_on = ?, ends_on = ?,
         show_name = ?, note = ?, slot = ? WHERE id = ?`,
    )
    .run(
      input.vehicle_id,
      input.state,
      input.starts_on,
      input.ends_on,
      input.show_name,
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
      show_name: null,
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
/**
 * A laid-out bar, still carrying the cell it came from.
 *
 * `layoutRuns` is shared with the board and speaks in runs, so a cell has to
 * be dressed up as one to get its column and span worked out. The cell rides
 * along rather than being looked up again afterwards: the chart needs the show
 * and the note as separate things, and a run has only the one label.
 */
export type GanttBar = RunBar & { cell: GanttCell };
export type GanttSlot = { slot: number; bars: GanttBar[] };
export type GanttRow = { vehicle: Vehicle; slots: GanttSlot[] };

export function ganttRows(days: string[], vehicles: Vehicle[]): GanttRow[] {
  const cells = cellsBetween(days[0], days[days.length - 1]);

  return vehicles.map((vehicle) => {
    const count = Math.max(1, vehicle.slots);
    const slots: GanttSlot[] = [];

    for (let slot = 0; slot < count; slot++) {
      const mine = cells.filter((c) => c.vehicle_id === vehicle.id && c.slot === slot);
      const byId = new Map(mine.map((c) => [c.id, c]));

      // layoutRuns wants run-shaped records; a cell is the same shape for the
      // purpose of working out where a bar goes.
      const asRuns = mine
        .map((c) => ({
          ...c,
          event_id: null,
          // The bar says the show when there is one. A note is for the thing
          // that is not the show — "needs the big speakers" — and it would
          // crowd out the name it is qualifying.
          label: c.show_name ?? c.note ?? "",
          status: c.state as RunStatus,
          meet_time: null,
          crew: null,
          site: null,
          driver_id: null,
          driver_text: null,
          keys_with: null,
          show_date: null,
          pickup_from: null,
          dropoff_to: null,
          pickup_time: null,
          keys_at_shop: 0,
          meeting_on_site: null,
          notes: null,
          vehicle_name: vehicle.name,
          vehicle_class: vehicle.class,
          vehicle_ownership: vehicle.ownership,
          driver_name: null,
          event_date: null,
        }));

      const bars = layoutRuns(days, asRuns).flatMap((bar) => {
        const cell = byId.get(bar.run.id);
        return cell ? [{ ...bar, cell }] : [];
      });
      slots.push({ slot, bars });
    }

    return { vehicle, slots };
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
