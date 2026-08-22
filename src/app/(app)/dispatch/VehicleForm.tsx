"use client";

import { useActionState, useState } from "react";
import { KIND_LABELS, VEHICLE_KINDS, type VehicleKind } from "@/lib/dispatch-types";
import { saveVehicle, type DispatchState } from "./actions";

export type EditableVehicle = {
  id: number;
  name: string;
  kind: VehicleKind;
  plate: string | null;
  rental_from: string | null;
  rental_due: string | null;
  capacity_note: string | null;
  notes: string | null;
};

/**
 * Adds or edits a vehicle.
 *
 * The hire dates only appear for a rental. An owned van with a "due back" box
 * invites somebody to fill it in, and then the board starts warning that the
 * company's own truck is overdue.
 */
export default function VehicleForm({ vehicle }: { vehicle?: EditableVehicle }) {
  const [state, formAction, pending] = useActionState<DispatchState, FormData>(saveVehicle, {});
  const [kind, setKind] = useState<VehicleKind>(vehicle?.kind ?? "van");

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
            placeholder="Big van, Sprinter, Eric's truck…"
          />
        </div>

        <div className="field">
          <label>Type</label>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as VehicleKind)}>
            {VEHICLE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Plate</label>
          <input name="plate" type="text" defaultValue={vehicle?.plate ?? ""} />
        </div>

        {kind === "rental" && (
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
