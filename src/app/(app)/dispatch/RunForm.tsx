"use client";

import { useActionState, useMemo, useState } from "react";
import { RUN_STATUSES, STATUS_LABELS, type RunStatus } from "@/lib/dispatch-types";
import { daysBetween, formatDayHeading } from "@/lib/dates";
import { saveRun, type DispatchState } from "./actions";

export type RunFormVehicle = { id: number; name: string };
export type RunFormEvent = { id: number; label: string; event_date: string };
export type RunFormDriver = { id: number; name: string };

/**
 * Books a vehicle out for a show.
 *
 * Picking a booking fills in the name and the date, because in practice the
 * run *is* the booking nine times in ten and retyping the couple's name into a
 * second field is how two records drift apart. Everything stays editable
 * afterwards — a load-out that leaves the day before is still that booking's
 * run, just not on that booking's date.
 *
 * The show and the vehicle are two different spans. A Saturday wedding can be
 * a Friday pickup and a Monday return, so the show has its own date and the
 * pickup and drop-off dates are what the board draws.
 *
 * When those dates cover more than one day, each day after the first can be
 * given its own pickup, driver and meeting — or, far more often, left alone.
 * "Same as the first day" is on by default and the per-day fields stay out of
 * the way until somebody turns it off.
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
  const [showDate, setShowDate] = useState(defaultDate);
  const [startsOn, setStartsOn] = useState(defaultDate);
  const [endsOn, setEndsOn] = useState("");
  const [status, setStatus] = useState<RunStatus>("booked");
  const [keysAtShop, setKeysAtShop] = useState(false);
  const [sameEachDay, setSameEachDay] = useState(true);

  // An idle or shop day is a statement about the vehicle, not a job. Asking who
  // is driving it and where it is going would be asking about a trip nobody is
  // taking.
  const isJob = status !== "idle" && status !== "shop";

  // The days after the first, which are the ones that can differ. A drop-off
  // before the pickup is a typo somebody is mid-way through fixing, so it
  // simply shows nothing rather than an error.
  const extraDays = useMemo(
    () => (endsOn && endsOn > startsOn ? daysBetween(startsOn, endsOn).slice(1) : []),
    [startsOn, endsOn],
  );

  function pickEvent(id: string) {
    const chosen = events.find((e) => String(e.id) === id);
    if (!chosen) return;
    setLabel(chosen.label);
    setShowDate(chosen.event_date);
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
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}

      <datalist id="driver-names">
        {drivers.map((d) => (
          <option key={d.id} value={d.name} />
        ))}
      </datalist>

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
          <label htmlFor="label">Show name {isJob ? "*" : ""}</label>
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
          <label htmlFor="show_date">Show date</label>
          <input
            id="show_date"
            name="show_date"
            type="date"
            value={showDate}
            onChange={(e) => setShowDate(e.target.value)}
          />
          <div className="small faint">The day of the show, not of the van</div>
        </div>

        {isJob && (
          <div className="field">
            <label htmlFor="site">City or site</label>
            <input id="site" name="site" type="text" placeholder="Port Colborne" />
          </div>
        )}

        <div className="field">
          <label htmlFor="starts_on">Pick-up date *</label>
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
          <label htmlFor="ends_on">Drop-off date</label>
          <input
            id="ends_on"
            name="ends_on"
            type="date"
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
          <div className="small faint">Leave blank for a single day</div>
        </div>

        <div className="field">
          <label htmlFor="pickup_time">Vehicle pick-up time</label>
          <input id="pickup_time" name="pickup_time" type="time" />
        </div>

        <div className="field">
          <label htmlFor="pickup_from">Pick-up location</label>
          <input
            id="pickup_from"
            name="pickup_from"
            type="text"
            placeholder="Pencar Cambridge, the shop…"
          />
        </div>

        <div className="field">
          <label htmlFor="dropoff_to">Drop-off location</label>
          <input id="dropoff_to" name="dropoff_to" type="text" placeholder="Back to the yard…" />
        </div>

        {isJob && (
          <div className="field">
            <label htmlFor="meet_time">Crew meets at</label>
            <input id="meet_time" name="meet_time" type="time" />
          </div>
        )}

        <div className="field">
          <label htmlFor="driver">Driver</label>
          {/* Typed rather than picked: half the drivers on a busy Saturday are
              a hire company's and have no login. A name that matches a staff
              member still attaches to them, so the who-drove search keeps
              working. */}
          <input
            id="driver"
            name="driver"
            type="text"
            list="driver-names"
            placeholder="Whoever is driving"
          />
        </div>

        {isJob && (
          <div className="field">
            <label htmlFor="meeting_on_site">Meeting on site</label>
            <input
              id="meeting_on_site"
              name="meeting_on_site"
              type="text"
              list="driver-names"
              placeholder="Who the crew finds there"
            />
          </div>
        )}

        {isJob && (
          <div className="field">
            <label htmlFor="crew">Crew</label>
            <input id="crew" name="crew" type="text" placeholder="Whoever is on it" />
          </div>
        )}

        <div className="field">
          <label htmlFor="keys_with">Keys with</label>
          <input id="keys_with" name="keys_with" type="text" placeholder="Whoever has them" />
        </div>
      </div>

      <fieldset className="field-choice">
        <legend>Are the keys at the shop already?</legend>
        {/* Two radios rather than a checkbox: one of them is always checked, so
            the answer is always posted. A hidden default alongside them would
            be read *instead* of the radio — formData.get returns the first
            entry with the name, and the hidden one comes first. */}
        <label>
          <input
            type="radio"
            name="keys_at_shop"
            value="yes"
            checked={keysAtShop}
            onChange={() => setKeysAtShop(true)}
          />
          Yes
        </label>
        <label>
          <input
            type="radio"
            name="keys_at_shop"
            value="no"
            checked={!keysAtShop}
            onChange={() => setKeysAtShop(false)}
          />
          No
        </label>
        {keysAtShop && (
          <span className="small warn-text">
            The show will carry a keys-at-the-shop warning on every board.
          </span>
        )}
      </fieldset>

      {extraDays.length > 0 && (
        <fieldset className="run-days">
          <legend>
            {extraDays.length + 1} days out — {formatDayHeading(startsOn)} to{" "}
            {formatDayHeading(endsOn)}
          </legend>

          <label className="field-check">
            <input
              type="checkbox"
              name="days_same"
              value="yes"
              checked={sameEachDay}
              onChange={(e) => setSameEachDay(e.target.checked)}
            />
            Every day the same as the first
          </label>

          {!sameEachDay && (
            <div className="run-days-list">
              {extraDays.map((day) => (
                <div key={day} className="run-day">
                  <div className="run-day-name">{formatDayHeading(day)}</div>
                  <div className="form-grid cols-3">
                    <div className="field">
                      <label htmlFor={`day_${day}_pickup_from`}>Pick-up location</label>
                      <input
                        id={`day_${day}_pickup_from`}
                        name={`day_${day}_pickup_from`}
                        type="text"
                        placeholder="Same as the first day"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`day_${day}_dropoff_to`}>Drop-off location</label>
                      <input
                        id={`day_${day}_dropoff_to`}
                        name={`day_${day}_dropoff_to`}
                        type="text"
                        placeholder="Same as the first day"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`day_${day}_pickup_time`}>Pick-up time</label>
                      <input
                        id={`day_${day}_pickup_time`}
                        name={`day_${day}_pickup_time`}
                        type="time"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`day_${day}_driver`}>Driver</label>
                      <input
                        id={`day_${day}_driver`}
                        name={`day_${day}_driver`}
                        type="text"
                        list="driver-names"
                        placeholder="Same as the first day"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`day_${day}_meeting_on_site`}>Meeting on site</label>
                      <input
                        id={`day_${day}_meeting_on_site`}
                        name={`day_${day}_meeting_on_site`}
                        type="text"
                        list="driver-names"
                        placeholder="Same as the first day"
                      />
                    </div>
                    <label className="field-check">
                      <input
                        type="checkbox"
                        name={`day_${day}_keys_at_shop`}
                        value="yes"
                      />
                      Keys at the shop
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </fieldset>
      )}

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
