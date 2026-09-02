"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth";
import { asActor } from "@/lib/audit";
import { recordAction, recordChanges, vehicleSubject } from "@/lib/activity";
import { COMMITTED } from "@/lib/dispatch-types";
import { daysBetween } from "@/lib/dates";
import { listDjs } from "@/lib/team";
import {
  clashesFor,
  createRun,
  createVehicle,
  deleteRun,
  getRun,
  getVehicle,
  runDays,
  setVehicleActive,
  updateRun,
  updateVehicle,
  type RunDay,
  type RunInput,
  type VehicleInput,
} from "@/lib/dispatch";
import {
  defaultSlotsFor,
  HIRED,
  isOwnership,
  MAX_SLOTS,
  isRunStatus,
  isVehicleClass,
  STATUS_SHORT,
  type Ownership,
  type RunStatus,
} from "@/lib/dispatch-types";

export type DispatchState = { error?: string; ok?: string };

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim() || null;

const isDate = (value: string | null) => value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);

/* ---------------------------------------------------------------- vehicles */

function readVehicle(formData: FormData): VehicleInput | null {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return null;

  const raw = formData.get("ownership");
  const ownership: Ownership = isOwnership(raw) ? raw : "other";
  const rawClass = formData.get("class");
  const seats = text(formData, "passenger_capacity");
  const hired = HIRED.includes(ownership);

  // How many of this can be out at once, which is how many rows it gets on the
  // Gantt. Blank falls back to what the ownership implies rather than to one:
  // a hired class with a single row cannot express two cube vans on a Saturday,
  // which is the situation the chart exists for.
  const slotsRaw = text(formData, "slots");
  const slots =
    slotsRaw !== null && /^\d+$/.test(slotsRaw)
      ? Math.min(Math.max(Number(slotsRaw), 1), MAX_SLOTS)
      : defaultSlotsFor(ownership);

  return {
    name,
    class: isVehicleClass(rawClass) ? rawClass : "other",
    ownership,
    plate: text(formData, "plate"),
    home_base: text(formData, "home_base"),
    weight_capacity: text(formData, "weight_capacity"),
    passenger_capacity: seats !== null && /^\d+$/.test(seats) ? Number(seats) : null,
    // Hire dates only mean anything on a hire; keeping them on a crew member's
    // own car would put a "due back" date on something that never goes back.
    // Pencar counts — it is a hire company, not the yard.
    rental_from: hired ? text(formData, "rental_from") : null,
    rental_due: hired ? text(formData, "rental_due") : null,
    capacity_note: text(formData, "capacity_note"),
    notes: text(formData, "notes"),
    slots,
  };
}

export async function saveVehicle(
  _prev: DispatchState,
  formData: FormData,
): Promise<DispatchState> {
  const admin = await requireArea("dispatch", "edit");

  const input = readVehicle(formData);
  if (!input) return { error: "Give the vehicle a name — whatever the crew calls it." };

  for (const [field, label] of [
    ["rental_from", "picked up"],
    ["rental_due", "due back"],
  ] as const) {
    const value = input[field];
    if (value !== null && !isDate(value)) return { error: `The ${label} date isn't a real date.` };
  }
  if (input.rental_from && input.rental_due && input.rental_due < input.rental_from) {
    return { error: "It can't be due back before it's picked up." };
  }

  const idRaw = formData.get("id");
  if (idRaw) {
    const id = Number(idRaw);
    const before = getVehicle(id);
    if (!before) return { error: "That vehicle no longer exists." };

    updateVehicle(id, input);
    recordChanges(vehicleSubject(id, input.name), asActor(admin), [
      { field: "Name", from: before.name, to: input.name },
      { field: "Class", from: before.class, to: input.class },
      { field: "Comes from", from: before.ownership, to: input.ownership },
      { field: "Plate", from: before.plate, to: input.plate },
      { field: "Home base", from: before.home_base, to: input.home_base },
      { field: "Weight capacity", from: before.weight_capacity, to: input.weight_capacity },
      { field: "Slots on the plan", from: String(before.slots), to: String(input.slots) },
      {
        field: "Seats",
        from: before.passenger_capacity === null ? null : String(before.passenger_capacity),
        to: input.passenger_capacity === null ? null : String(input.passenger_capacity),
      },
      { field: "Due back", from: before.rental_due, to: input.rental_due },
      { field: "Notes", from: before.notes, to: input.notes },
    ]);
  } else {
    const id = createVehicle(input);
    recordAction(vehicleSubject(id, input.name), asActor(admin), "added");
  }

  revalidatePath("/dispatch");
  revalidatePath("/dispatch/vehicles");
  return { ok: "Saved." };
}

export async function toggleVehicle(formData: FormData): Promise<void> {
  const admin = await requireArea("dispatch", "edit");

  const id = Number(formData.get("id"));
  const activate = formData.get("activate") === "1";
  const vehicle = getVehicle(id);
  if (!vehicle) return;

  setVehicleActive(id, activate);
  recordAction(
    vehicleSubject(id, vehicle.name),
    asActor(admin),
    activate ? "reactivated" : "deactivated",
  );

  revalidatePath("/dispatch");
  revalidatePath("/dispatch/vehicles");
}

/* -------------------------------------------------------------------- runs */

const yes = (formData: FormData, key: string) => {
  const raw = String(formData.get(key) ?? "");
  return raw === "yes" || raw === "on" || raw === "1" || raw === "true";
};

/**
 * The driver, typed rather than picked.
 *
 * A name that matches a Piper user exactly becomes that user, so the who-drove
 * search keeps finding them. Anything else is kept as written — half the
 * drivers on a busy Saturday are a hire company's, and refusing to record them
 * because they have no login is how a board stops being the real one.
 */
function readDriver(
  typed: string | null,
  drivers: { id: number; name: string }[],
): { driver_id: number | null; driver_text: string | null } {
  if (!typed) return { driver_id: null, driver_text: null };
  const match = drivers.find((d) => d.name.toLowerCase() === typed.toLowerCase());
  return match ? { driver_id: match.id, driver_text: null } : { driver_id: null, driver_text: typed };
}

/**
 * The per-day rows, when a run spans days and is not the same each day.
 *
 * "Same as the first day" is stored as no rows at all rather than as a flag,
 * so nothing can drift out of step with it. A day whose fields all come back
 * empty is dropped for the same reason: an empty row and no row mean the same
 * thing, and keeping the empty one would be a second way to say it.
 */
function readRunDays(
  formData: FormData,
  days: string[],
  drivers: { id: number; name: string }[],
): RunDay[] {
  if (yes(formData, "days_same")) return [];

  const rows: RunDay[] = [];
  // The first day is the run's own values, so per-day rows start at the second.
  for (const day of days.slice(1)) {
    const at = (field: string) => text(formData, `day_${day}_${field}`);
    const driver = readDriver(at("driver"), drivers);
    const row: RunDay = {
      day,
      pickup_from: at("pickup_from"),
      dropoff_to: at("dropoff_to"),
      pickup_time: at("pickup_time"),
      keys_at_shop: yes(formData, `day_${day}_keys_at_shop`) ? 1 : 0,
      keys_back_to_shop: yes(formData, `day_${day}_keys_back_to_shop`) ? 1 : 0,
      // A day row records the name as typed. Attributing a day of a run to a
      // user is the run's business, not a day's.
      driver_text: driver.driver_text ?? at("driver"),
      meeting_on_site: at("meeting_on_site"),
    };

    const empty =
      !row.pickup_from &&
      !row.dropoff_to &&
      !row.pickup_time &&
      row.keys_back_to_shop === 0 &&
      !row.driver_text &&
      !row.meeting_on_site &&
      row.keys_at_shop === 0;
    if (!empty) rows.push(row);
  }
  return rows;
}

function readRun(
  formData: FormData,
  drivers: { id: number; name: string }[],
): RunInput | null {
  const vehicleId = Number(formData.get("vehicle_id"));
  const startsOn = text(formData, "starts_on");
  if (!Number.isInteger(vehicleId) || !isDate(startsOn) || startsOn === null) return null;

  // A single-day job is the common case, so an empty end date means "same day"
  // rather than an error to correct.
  const endsOn = text(formData, "ends_on") ?? startsOn;
  const eventIdRaw = formData.get("event_id");
  const eventId = eventIdRaw && String(eventIdRaw) !== "" ? Number(eventIdRaw) : null;

  const statusRaw = formData.get("status");
  const status: RunStatus = isRunStatus(statusRaw) ? statusRaw : "booked";

  const driver = readDriver(text(formData, "driver"), drivers);

  // The show is usually the day the van goes out, so a blank show date means
  // the pickup date rather than nothing.
  const showDate = text(formData, "show_date");

  return {
    vehicle_id: vehicleId,
    event_id: eventId,
    label: String(formData.get("label") ?? "").trim(),
    status,
    starts_on: startsOn,
    ends_on: endsOn,
    meet_time: text(formData, "meet_time"),
    crew: text(formData, "crew"),
    site: text(formData, "site"),
    driver_id: driver.driver_id,
    driver_text: driver.driver_text,
    keys_with: text(formData, "keys_with"),
    show_date: isDate(showDate) ? showDate : startsOn,
    pickup_from: text(formData, "pickup_from"),
    dropoff_to: text(formData, "dropoff_to"),
    pickup_time: text(formData, "pickup_time"),
    keys_at_shop: yes(formData, "keys_at_shop"),
    keys_back_to_shop: yes(formData, "keys_back_to_shop"),
    meeting_on_site: text(formData, "meeting_on_site"),
    notes: text(formData, "notes"),
    days: isDate(endsOn) && endsOn > startsOn
      ? readRunDays(formData, daysBetween(startsOn, endsOn), drivers)
      : [],
  };
}

/**
 * Books a vehicle out.
 *
 * An overlap beyond what the vehicle has is refused, not warned about. That is
 * not what this originally did — the first version reported the clash and
 * saved anyway, on the reasoning that an app which says no teaches people to
 * keep the real schedule somewhere else. The shop's own board forbids it and
 * asked for that twice while being built, which settles it: a van cannot be in
 * two places, and a board that lets you say it can is not worth a glance.
 *
 * "Beyond what the vehicle has" rather than "at all", because a row is a class
 * as often as it is a vehicle: three cube vans can be hired for one Saturday,
 * and a row with three slots must be allowed to say so. A Pynx-owned van has
 * one slot and behaves exactly as before.
 *
 * Only real commitments collide. A day marked 'needed' is the absence of an
 * arrangement, and idle and shop days are the vehicle sitting still, so those
 * coexist with anything.
 */
export async function saveRun(_prev: DispatchState, formData: FormData): Promise<DispatchState> {
  const admin = await requireArea("dispatch", "edit");

  const input = readRun(formData, listDjs().map((d) => ({ id: d.id, name: d.name })));
  if (!input) return { error: "Pick a vehicle and a date." };
  if (!isDate(input.ends_on)) return { error: "The end date isn't a real date." };
  if (input.ends_on < input.starts_on) return { error: "It can't come back before it goes out." };
  // An idle or shop day is a statement about the vehicle, not a job, so it
  // needs no label — the status already says everything there is to say.
  if (!input.label) {
    if (input.status === "idle" || input.status === "shop") {
      input.label = STATUS_SHORT[input.status];
    } else {
      return { error: "Say what it's going out for." };
    }
  }

  const vehicle = getVehicle(input.vehicle_id);
  if (!vehicle) return { error: "That vehicle no longer exists." };

  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : null;
  if (id && !getRun(id)) return { error: "That run has already been removed." };

  const clashes = clashesFor(
    input.vehicle_id,
    input.starts_on,
    input.ends_on,
    id ?? undefined,
  ).filter((c) => COMMITTED.includes(c.status) && COMMITTED.includes(input.status));

  const slots = Math.max(1, vehicle.slots);
  if (clashes.length >= slots) {
    const when = clashes
      .map((c) =>
        c.starts_on === c.ends_on
          ? `${c.label} on ${c.starts_on}`
          : `${c.label} from ${c.starts_on} to ${c.ends_on}`,
      )
      .join(", ");
    return {
      error:
        slots === 1
          ? `${vehicle.name} is already out for ${when}. ` +
            `Pick another vehicle, or change those dates first.`
          : // Named, because "All 3 are already out" on a board of six rows
            // leaves somebody hunting for which three.
            `${vehicle.name}: all ${slots} are already out for ${when}. ` +
            `Pick another vehicle, or change those dates first.`,
    };
  }

  if (id) {
    updateRun(id, input);
  } else {
    createRun(input);
  }

  recordAction(
    vehicleSubject(input.vehicle_id, vehicle.name),
    asActor(admin),
    id ? "updated" : "added",
  );

  revalidatePath("/dispatch");
  revalidatePath("/dashboard");
  revalidatePath("/board");
  if (input.event_id) revalidatePath(`/events/${input.event_id}`);

  return { ok: "Saved." };
}

export async function removeRun(formData: FormData): Promise<void> {
  const admin = await requireArea("dispatch", "edit");

  const id = Number(formData.get("id"));
  const run = getRun(id);
  if (!run) return;

  const vehicle = getVehicle(run.vehicle_id);
  deleteRun(id);
  recordAction(
    vehicleSubject(run.vehicle_id, vehicle?.name ?? "A vehicle"),
    asActor(admin),
    "removed",
  );

  revalidatePath("/dispatch");
  revalidatePath("/dashboard");
  revalidatePath("/board");
  if (run.event_id) revalidatePath(`/events/${run.event_id}`);
}


/**
 * Moves one end of a run by dragging its edge on the board.
 *
 * Deliberately narrow: it changes two dates and nothing else. The full form
 * exists for everything else, and an action that could rewrite a run from a
 * drag would be one bad drag away from losing the crew and the meet time.
 *
 * The overlap rule is the same one the form enforces — a drag is not a way
 * around it.
 */
export async function resizeRun(formData: FormData): Promise<void> {
  const admin = await requireArea("dispatch", "edit");

  const id = Number(formData.get("id"));
  const startsOn = text(formData, "starts_on");
  const endsOn = text(formData, "ends_on");
  if (!Number.isInteger(id) || !isDate(startsOn) || !isDate(endsOn)) return;
  if (startsOn === null || endsOn === null || endsOn < startsOn) return;

  const run = getRun(id);
  if (!run) return;
  if (run.starts_on === startsOn && run.ends_on === endsOn) return;

  if (COMMITTED.includes(run.status)) {
    const clashes = clashesFor(run.vehicle_id, startsOn, endsOn, id).filter((c) =>
      COMMITTED.includes(c.status),
    );
    if (clashes.length > 0) return;
  }

  updateRun(id, {
    ...run,
    starts_on: startsOn,
    ends_on: endsOn,
    keys_at_shop: run.keys_at_shop === 1,
    keys_back_to_shop: run.keys_back_to_shop === 1,
    // A drag moves two dates and nothing else, so the per-day rows come along
    // as they are. `writeRunDays` drops any that now fall outside the run.
    days: runDays(id).filter((d) => d.day >= startsOn && d.day <= endsOn),
  });

  const vehicle = getVehicle(run.vehicle_id);
  recordChanges(
    vehicleSubject(run.vehicle_id, vehicle?.name ?? "A vehicle"),
    asActor(admin),
    [
      { field: `${run.label} — out on`, from: run.starts_on, to: startsOn },
      { field: `${run.label} — back on`, from: run.ends_on, to: endsOn },
    ],
  );

  revalidatePath("/dispatch");
  revalidatePath("/dashboard");
  revalidatePath("/board");
}
