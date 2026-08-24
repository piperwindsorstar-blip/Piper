"use client";

import { useActionState, useState } from "react";
import {
  CLASS_LABELS,
  defaultSlotsFor,
  HIRED,
  MAX_SLOTS,
  OWNERSHIP_LABELS,
  OWNERSHIPS,
  VEHICLE_CLASSES,
  type Ownership,
  type VehicleClass,
} from "@/lib/dispatch-types";
import { saveVehicle, type DispatchState } from "./actions";

export type EditableVehicle = {
  id: number;
  name: string;
  class: VehicleClass;
  ownership: Ownership;
  plate: string | null;
  home_base: string | null;
  weight_capacity: string | null;
  passenger_capacity: number | null;
  rental_from: string | null;
  rental_due: string | null;
  capacity_note: string | null;
  notes: string | null;
  slots: number;
};

/**
 * Adds or edits a vehicle.
 *
 * A vehicle answers two separate questions, so it gets two separate fields.
 * What it is — a cube van, a 26 ft truck — is what gets booked. Where it comes
 * from is who to phone about it, and Pencar is a hire company rather than a
 * yard, so a Pencar unit is a hire like any other.
 *
 * The hire dates follow from that: they appear for anything hired, from Pencar
 * or elsewhere, and not for a crew member's own car. A vehicle that never goes
 * back with a "due back" box invites somebody to fill it in, and then the
 * board starts warning that a crew member's own car is overdue.
 */
export default function VehicleForm({ vehicle }: { vehicle?: EditableVehicle }) {
  const [state, formAction, pending] = useActionState<DispatchState, FormData>(saveVehicle, {});
  const [ownership, setOwnership] = useState<Ownership>(vehicle?.ownership ?? "pencar");
  const hired = HIRED.includes(ownership);

  return (
    <form action={formAction} className="card-body">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}

      {vehicle && <input type="hidden" name="id" value={vehicle.id} />}

      <div className="form-grid cols-3">
        <div className="field">
          <label>Name *</label>
          <input
            name="name"
            type="text"
            required
            defaultValue={vehicle?.name ?? ""}
            placeholder="Cube 1, Sprinter, Eric's truck…"
          />
        </div>

        <div className="field">
          <label>What it is</label>
          <select name="class" defaultValue={vehicle?.class ?? "cargo_van"}>
            {VEHICLE_CLASSES.map((c) => (
              <option key={c} value={c}>
                {CLASS_LABELS[c]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Comes from</label>
          <select
            name="ownership"
            value={ownership}
            onChange={(e) => setOwnership(e.target.value as Ownership)}
          >
            {OWNERSHIPS.map((o) => (
              <option key={o} value={o}>
                {OWNERSHIP_LABELS[o]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Plate</label>
          <input name="plate" type="text" defaultValue={vehicle?.plate ?? ""} />
        </div>

        <div className="field">
          <label>Home base</label>
          <input
            name="home_base"
            type="text"
            defaultValue={vehicle?.home_base ?? ""}
            placeholder="Where it sits when it's not out"
          />
        </div>

        <div className="field">
          <label>Weight capacity</label>
          {/* Free text on purpose: crews say "1 ton", not 907 kilograms. */}
          <input
            name="weight_capacity"
            type="text"
            defaultValue={vehicle?.weight_capacity ?? ""}
            placeholder="1 ton, 3500 lb…"
          />
        </div>

        <div className="field">
          <label>Seats</label>
          <input
            name="passenger_capacity"
            type="number"
            min={0}
            max={99}
            defaultValue={vehicle?.passenger_capacity ?? ""}
          />
        </div>

        {hired && (
          <>
            <div className="field">
              <label>Picked up</label>
              <input name="rental_from" type="date" defaultValue={vehicle?.rental_from ?? ""} />
            </div>
            <div className="field">
              <label>Due back</label>
              <input name="rental_due" type="date" defaultValue={vehicle?.rental_due ?? ""} />
            </div>
          </>
        )}

        <div className="field">
          <label>How many at once</label>
          <input
            name="slots"
            type="number"
            min={1}
            max={MAX_SLOTS}
            defaultValue={vehicle?.slots ?? defaultSlotsFor(ownership)}
            key={vehicle ? vehicle.slots : ownership}
          />
          <div className="small faint">
            {hired
              ? "Rows on the plan — three hired at once needs three."
              : "One row: there is only one of it."}
          </div>
        </div>

        <div className="field">
          <label>What it holds</label>
          <input
            name="capacity_note"
            type="text"
            defaultValue={vehicle?.capacity_note ?? ""}
            placeholder="Full rig plus booth"
          />
        </div>
      </div>

      <div className="field">
        <label>Notes</label>
        <textarea name="notes" rows={2} defaultValue={vehicle?.notes ?? ""} />
      </div>

      <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
        {pending ? "Saving…" : vehicle ? "Save" : "Add vehicle"}
      </button>
    </form>
  );
}
