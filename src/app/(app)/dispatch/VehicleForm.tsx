"use client";

import { useActionState, useState } from "react";
import { OWNERSHIP_LABELS, OWNERSHIPS, type Ownership } from "@/lib/dispatch-types";
import { saveVehicle, type DispatchState } from "./actions";

export type EditableVehicle = {
  id: number;
  name: string;
  ownership: Ownership;
  plate: string | null;
  home_base: string | null;
  weight_capacity: string | null;
  passenger_capacity: number | null;
  rental_from: string | null;
  rental_due: string | null;
  capacity_note: string | null;
  notes: string | null;
};

/**
 * Adds or edits a vehicle.
 *
 * Vehicles are filed by whose they are rather than what shape they are, which
 * is how the shop already talks about them — a Pencar unit, a hire, somebody's
 * own car. Shape never comes up; who has to give it back does.
 *
 * The hire dates appear only for a hire. An owned unit with a "due back" box
 * invites somebody to fill it in, and then the board starts warning that the
 * company's own truck is overdue.
 */
export default function VehicleForm({ vehicle }: { vehicle?: EditableVehicle }) {
  const [state, formAction, pending] = useActionState<DispatchState, FormData>(saveVehicle, {});
  const [ownership, setOwnership] = useState<Ownership>(vehicle?.ownership ?? "pencar");

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
            placeholder="Cube, Sprinter, Eric's truck…"
          />
        </div>

        <div className="field">
          <label>Belongs to</label>
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

        {ownership === "rental" && (
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
