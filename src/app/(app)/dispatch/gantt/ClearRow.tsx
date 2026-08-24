"use client";

import { useActionState } from "react";
import { clearRow, undoClearRow, type GanttState } from "./actions";

/**
 * Clears one vehicle's plan across the window on screen, with an undo.
 *
 * Scoped to what is visible on purpose. A button that also wiped next year
 * would be a button nobody dares press, and a planning tool people are afraid
 * of stops getting used.
 */
export default function ClearRow({
  vehicles,
  from,
  to,
}: {
  vehicles: { id: number; name: string }[];
  from: string;
  to: string;
}) {
  const [state, clear, clearing] = useActionState<GanttState, FormData>(clearRow, {});
  const [undoState, undo, undoing] = useActionState<GanttState, FormData>(undoClearRow, {});

  if (vehicles.length === 0) return null;

  return (
    <div className="card-body">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {undoState.error && <div className="alert alert-error">{undoState.error}</div>}
      {undoState.ok && <div className="alert alert-ok">{undoState.ok}</div>}

      {state.ok && state.undoBatch && !undoState.ok && (
        <div className="alert alert-info row-between">
          <span>{state.ok}</span>
          <form action={undo}>
            <input type="hidden" name="batch" value={state.undoBatch} />
            <button className="btn btn-sm" type="submit" disabled={undoing}>
              {undoing ? "Undoing…" : "Undo"}
            </button>
          </form>
        </div>
      )}

      <form action={clear} className="row-between">
        <div className="field" style={{ marginBottom: 0, flex: 1 }}>
          <label htmlFor="clear_vehicle">Clear a row</label>
          <select id="clear_vehicle" name="vehicle_id">
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <div className="small faint">Only the dates on screen, and undoable.</div>
        </div>
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name="to" value={to} />
        <button className="btn btn-sm btn-danger" type="submit" disabled={clearing}>
          {clearing ? "Clearing…" : "Clear"}
        </button>
      </form>
    </div>
  );
}
