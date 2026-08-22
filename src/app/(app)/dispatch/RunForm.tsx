"use client";

import { useActionState, useState } from "react";
import { RUN_STATUSES, STATUS_LABELS, type RunStatus } from "@/lib/dispatch-types";
import { saveRun, type DispatchState } from "./actions";

export type RunFormVehicle = { id: number; name: string };
export type RunFormEvent = { id: number; label: string; event_date: string };
export type RunFormDriver = { id: number; name: string };

/**
 * Books a vehicle out for a span of days.
 *
 * Picking a booking fills in the label and the date, because in practice the
 * run *is* the booking nine times in ten and retyping the couple's name into a
 * second field is how two records drift apart. Everything stays editable
 * afterwards — a load-out that leaves the day before is still that booking's
 * run, just not on that booking's date.
 */
export default function RunForm({
  vehicles,
  events,
  drivers,
  defaultDate,
}: {
  vehicles: RunFormVehicle[];
  events: RunFormEvent[];
  drivers: RunFormDriver[];
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState<DispatchState, FormData>(saveRun, {});
  const [label, setLabel] = useState("");
  const [startsOn, setStartsOn] = useState(defaultDate);
  const [status, setStatus] = useState<RunStatus>("booked");

  // An idle or shop day is a statement about the vehicle, not a job. Asking who
  // is driving it and where it is going would be asking about a trip nobody is
  // taking.
  const isJob = status !== "idle" && status !== "shop";

  function pickEvent(id: string) {
    const chosen = events.find((e) => String(e.id) === id);
    if (!chosen) return;
    setLabel(chosen.label);
    setStartsOn(chosen.event_date);
  }

  if (vehicles.length === 0) {
    return (
      <div className="empty">
        Add a vehicle to the fleet first — there is nothing to send out yet.
      </div>
    );
  }

  return (
    <form action={formAction} className="card-body">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && !state.warning && <div className="alert alert-ok">{state.ok}</div>}
      {state.warning && <div className="alert alert-info">{state.warning}</div>}

      <div className="form-grid cols-3">
        <div className="field">
          <label htmlFor="vehicle_id">Vehicle *</label>
          <select id="vehicle_id" name="vehicle_id" required>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="status">The day is</label>
          <select
            id="status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as RunStatus)}
          >
            {RUN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="event_id">For a booking</label>
          <select id="event_id" name="event_id" onChange={(e) => pickEvent(e.target.value)}>
            <option value="">Something else</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="label">What for {isJob ? "*" : ""}</label>
          <input
            id="label"
            name="label"
            type="text"
            required={isJob}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={isJob ? "Service, warehouse move, a wedding…" : "Optional"}
          />
        </div>

        <div className="field">
          <label htmlFor="starts_on">Out on *</label>
          <input
            id="starts_on"
            name="starts_on"
            type="date"
            required
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="ends_on">Back on</label>
          <input id="ends_on" name="ends_on" type="date" />
          <div className="small faint">Leave blank for a single day</div>
        </div>

        {isJob && (
          <div className="field">
            <label htmlFor="meet_time">Crew meets at</label>
            <input id="meet_time" name="meet_time" type="time" />
          </div>
        )}

        {isJob && (
          <div className="field">
            <label htmlFor="site">City or site</label>
            <input id="site" name="site" type="text" placeholder="Port Colborne" />
          </div>
        )}

        {isJob && (
          <div className="field">
            <label htmlFor="crew">Crew</label>
            <input id="crew" name="crew" type="text" placeholder="Whoever is on it" />
          </div>
        )}

        <div className="field">
          <label htmlFor="driver_id">Driver</label>
          <select id="driver_id" name="driver_id">
            <option value="">Not decided</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="keys_with">Keys with</label>
          <input id="keys_with" name="keys_with" type="text" placeholder="Whoever has them" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="notes">Notes</label>
        <input id="notes" name="notes" type="text" placeholder="Loaded Thursday, tailgate sticks…" />
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : isJob ? "Send it out" : "Mark the day"}
      </button>
    </form>
  );
}
