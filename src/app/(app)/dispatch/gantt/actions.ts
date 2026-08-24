"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { asActor } from "@/lib/audit";
import { recordAction, recordChanges, vehicleSubject } from "@/lib/activity";
import { getVehicle } from "@/lib/dispatch";
import { isRunStatus } from "@/lib/dispatch-types";
import {
  clearVehicle,
  createCell,
  cycleDay,
  deleteCell,
  getCell,
  pruneCleared,
  undoClear,
  updateCell,
  type CellState,
} from "@/lib/gantt";

export type GanttState = { error?: string; ok?: string; undoBatch?: string };

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

const isCellState = (v: unknown): v is CellState =>
  isRunStatus(v) && v !== "shop";

/**
 * One click on a day: empty → needed → booked → empty.
 *
 * Nothing here touches the dispatch board. The Gantt is a plan; turning a
 * square yellow must not put a van on somebody's Saturday.
 */
export async function cycleCell(formData: FormData): Promise<void> {
  await requireAdmin();

  const vehicleId = Number(formData.get("vehicle_id"));
  const slot = Number(formData.get("slot") ?? 0);
  const date = formData.get("date");
  if (!Number.isInteger(vehicleId) || !isDate(date)) return;

  const vehicle = getVehicle(vehicleId);
  if (!vehicle) return;
  // A slot that does not exist on this vehicle is not a slot to write into.
  if (!Number.isInteger(slot) || slot < 0 || slot >= Math.max(1, vehicle.slots)) return;

  cycleDay(vehicleId, slot, date);
  revalidatePath("/dispatch/gantt");
}

/** The full dialog: any state, a span of days, and a note. */
export async function saveCell(_prev: GanttState, formData: FormData): Promise<GanttState> {
  const admin = await requireAdmin();

  const vehicleId = Number(formData.get("vehicle_id"));
  const state = formData.get("state");
  const startsOn = formData.get("starts_on");
  const endsOnRaw = formData.get("ends_on");
  const endsOn = isDate(endsOnRaw) ? endsOnRaw : startsOn;

  if (!Number.isInteger(vehicleId)) return { error: "Which vehicle?" };
  if (!isCellState(state)) return { error: "Pick what the day is." };
  if (!isDate(startsOn) || !isDate(endsOn)) return { error: "Those dates aren't real dates." };
  if (endsOn < startsOn) return { error: "It can't end before it starts." };

  const vehicle = getVehicle(vehicleId);
  if (!vehicle) return { error: "That vehicle no longer exists." };

  const note = String(formData.get("note") ?? "").trim() || null;
  const slotRaw = Number(formData.get("slot") ?? 0);
  const slot =
    Number.isInteger(slotRaw) && slotRaw >= 0 && slotRaw < Math.max(1, vehicle.slots)
      ? slotRaw
      : 0;

  const idRaw = formData.get("id");
  const input = {
    vehicle_id: vehicleId,
    state,
    starts_on: startsOn,
    ends_on: endsOn,
    note,
    slot,
  };

  if (idRaw) {
    const id = Number(idRaw);
    const before = getCell(id);
    if (!before) return { error: "That block has already gone." };
    updateCell(id, input);
    recordChanges(vehicleSubject(vehicleId, vehicle.name), asActor(admin), [
      { field: "Plan — state", from: before.state, to: state },
      { field: "Plan — from", from: before.starts_on, to: startsOn },
      { field: "Plan — to", from: before.ends_on, to: endsOn },
      { field: "Plan — note", from: before.note, to: note },
    ]);
  } else {
    createCell(input);
    recordAction(vehicleSubject(vehicleId, vehicle.name), asActor(admin), "planned");
  }

  revalidatePath("/dispatch/gantt");
  return { ok: "Saved." };
}

export async function removeCell(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isInteger(id)) deleteCell(id);
  revalidatePath("/dispatch/gantt");
}

/**
 * Clears everything on one vehicle across the window on screen.
 *
 * Scoped to what is visible on purpose: a button that silently wiped next year
 * as well would be a button nobody dares press. Cells are kept for an undo.
 */
export async function clearRow(_prev: GanttState, formData: FormData): Promise<GanttState> {
  const admin = await requireAdmin();

  const vehicleId = Number(formData.get("vehicle_id"));
  const from = formData.get("from");
  const to = formData.get("to");
  if (!Number.isInteger(vehicleId) || !isDate(from) || !isDate(to)) {
    return { error: "Couldn't work out what to clear." };
  }

  const vehicle = getVehicle(vehicleId);
  if (!vehicle) return { error: "That vehicle no longer exists." };

  pruneCleared();
  const batch = clearVehicle(vehicleId, from, to);
  if (!batch) return { ok: "Nothing to clear on that row." };

  recordAction(vehicleSubject(vehicleId, vehicle.name), asActor(admin), "plan_cleared");
  revalidatePath("/dispatch/gantt");
  return { ok: `Cleared ${vehicle.name}.`, undoBatch: batch };
}

export async function undoClearRow(_prev: GanttState, formData: FormData): Promise<GanttState> {
  await requireAdmin();

  const batch = String(formData.get("batch") ?? "");
  if (!batch) return { error: "Nothing to undo." };

  const restored = undoClear(batch);
  revalidatePath("/dispatch/gantt");
  return restored > 0
    ? { ok: `Put ${restored} back.` }
    : { error: "That undo has expired." };
}
