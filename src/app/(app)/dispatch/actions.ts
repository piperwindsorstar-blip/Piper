"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { asActor } from "@/lib/audit";
import { recordAction, recordChanges, vehicleSubject } from "@/lib/activity";
import { COMMITTED } from "@/lib/dispatch-types";
import {
  clashesFor,
  createRun,
  createVehicle,
  deleteRun,
  getRun,
  getVehicle,
  setVehicleActive,
  updateRun,
  updateVehicle,
  type RunInput,
  type VehicleInput,
} from "@/lib/dispatch";
import {
  isOwnership,
  isRunStatus,
  STATUS_SHORT,
  type Ownership,
  type RunStatus,
} from "@/lib/dispatch-types";

export type DispatchState = { error?: string; ok?: string; warning?: string };

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim() || null;

const isDate = (value: string | null) => value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);

/* ---------------------------------------------------------------- vehicles */

function readVehicle(formData: FormData): VehicleInput | null {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return null;

  const raw = formData.get("ownership");
  const ownership: Ownership = isOwnership(raw) ? raw : "other";
  const seats = text(formData, "passenger_capacity");

  return {
    name,
    ownership,
    plate: text(formData, "plate"),
    home_base: text(formData, "home_base"),
    weight_capacity: text(formData, "weight_capacity"),
    passenger_capacity: seats !== null && /^\d+$/.test(seats) ? Number(seats) : null,
    // Hire dates only mean anything on a hire; keeping them on an owned unit
    // would put a "due back" date on something that never goes back.
    rental_from: ownership === "rental" ? text(formData, "rental_from") : null,
    rental_due: ownership === "rental" ? text(formData, "rental_due") : null,
    capacity_note: text(formData, "capacity_note"),
    notes: text(formData, "notes"),
  };
}

export async function saveVehicle(
  _prev: DispatchState,
  formData: FormData,
): Promise<DispatchState> {
  const admin = await requireAdmin();

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
      { field: "Belongs to", from: before.ownership, to: input.ownership },
      { field: "Plate", from: before.plate, to: input.plate },
      { field: "Home base", from: before.home_base, to: input.home_base },
      { field: "Weight capacity", from: before.weight_capacity, to: input.weight_capacity },
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
  const admin = await requireAdmin();

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

function readRun(formData: FormData): RunInput | null {
  const vehicleId = Number(formData.get("vehicle_id"));
  const startsOn = text(formData, "starts_on");
  if (!Number.isInteger(vehicleId) || !isDate(startsOn) || startsOn === null) return null;

  // A single-day job is the common case, so an empty end date means "same day"
  // rather than an error to correct.
  const endsOn = text(formData, "ends_on") ?? startsOn;
  const eventIdRaw = formData.get("event_id");
  const eventId = eventIdRaw && String(eventIdRaw) !== "" ? Number(eventIdRaw) : null;
  const driverRaw = formData.get("driver_id");
  const driverId = driverRaw && String(driverRaw) !== "" ? Number(driverRaw) : null;

  const statusRaw = formData.get("status");
  const status: RunStatus = isRunStatus(statusRaw) ? statusRaw : "booked";

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
    driver_id: driverId,
    keys_with: text(formData, "keys_with"),
    notes: text(formData, "notes"),
  };
}

/**
 * Books a vehicle out.
 *
 * A clash is reported, not refused. Two runs on one van genuinely happens —
 * a morning delivery and an evening show — and an app that simply says no
 * teaches people to work around it in a spreadsheet. Saying "this is already
 * out, here's what for" leaves the judgement where it belongs.
 */
export async function saveRun(_prev: DispatchState, formData: FormData): Promise<DispatchState> {
  const admin = await requireAdmin();

  const input = readRun(formData);
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

  // Only real commitments clash. A day marked 'needed' is the absence of an
  // arrangement, and an idle or shop day is the vehicle sitting still — warning
  // that a booking collides with either would be noise on every second save.
  const clashes = clashesFor(
    input.vehicle_id,
    input.starts_on,
    input.ends_on,
    id ?? undefined,
  ).filter((c) => COMMITTED.includes(c.status) && COMMITTED.includes(input.status));

  if (id) {
    if (!getRun(id)) return { error: "That run has already been removed." };
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
  if (input.event_id) revalidatePath(`/events/${input.event_id}`);

  const warning =
    clashes.length > 0
      ? `Saved — but ${vehicle.name} is also out for ${clashes
          .map((c) => c.label)
          .join(", ")} over those dates.`
      : undefined;

  return warning ? { ok: "Saved.", warning } : { ok: "Saved." };
}

export async function removeRun(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

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
  if (run.event_id) revalidatePath(`/events/${run.event_id}`);
}
