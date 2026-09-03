"use client";

import { useActionState, useMemo, useState } from "react";
import { daysBetween, formatDayHeading } from "@/lib/dates";
import { saveRun, type DispatchState } from "./actions";

export type RunFormVehicle = { id: number; name: string };
export type RunFormDriver = { id: number; name: string };

/**
 * Where a vehicle is collected from and returned to.
 *
 * Two places cover almost every run — the shop's own warehouse and the hire
 * company — so they are offered, but the field stays typable: a one-off hire
 * from somewhere else is still a run, and a list that refuses it is a list
 * people work around.
 */
const PLACES = ["Pynx Warehouse", "Pencar"];

/**
 * Books a vehicle out for a show.
 *
 * Deliberately short. Everything here is something somebody has to know before
 * they can leave the building — which vehicle, what for, when it is collected
 * and from where, who is driving, who they are meeting, and what happens to
 * the keys at each end. Anything that could be worked out afterwards was taken
 * out, because a form with twenty fields is a form filled in badly.
 *
 * The show and the vehicle are two different spans: a Saturday wedding can be
 * a Friday pick-up and a Monday return, so the pick-up and drop-off dates are
 * what the board draws.
 *
 * When those dates cover more than one day, each day after the first can be
 * given its own pick-up, driver and meeting — or, far more often, left alone.
 * "Same as the first day" is on by default and the per-day fields stay out of
 * the way until somebody turns it off.
 */
export default function RunForm({
  vehicles,
  drivers,
  defaultDate,
}: {
  vehicles: RunFormVehicle[];
  drivers: RunFormDriver[];
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState<DispatchState, FormData>(saveRun, {});
  const [startsOn, setStartsOn] = useState(defaultDate);
  const [endsOn, setEndsOn] = useState("");
  const [keysAtShop, setKeysAtShop] = useState(false);
  const [keysBack, setKeysBack] = useState(false);
  const [keysPencar, setKeysPencar] = useState(false);
  const [sameEachDay, setSameEachDay] = useState(true);

  // The days after the first, which are the ones that can differ. A drop-off
  // before the pick-up is a typo somebody is mid-way through fixing, so it
  // simply shows nothing rather than an error.
  const extraDays = useMemo(
    () => (endsOn && endsOn > startsOn ? daysBetween(startsOn, endsOn).slice(1) : []),
    [startsOn, endsOn],
  );

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
      <datalist id="pickup-places">
        {PLACES.map((place) => (
          <option key={place} value={place} />
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
          <label htmlFor="label">Show name *</label>
          <input
            id="label"
            name="label"
            type="text"
            required
            placeholder="Service, warehouse move, a wedding…"
          />
        </div>

        <div className="field">
          <label htmlFor="pickup_time">Vehicle pick-up time</label>
          <input id="pickup_time" name="pickup_time" type="time" />
        </div>

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

        <div className="field">
          <label htmlFor="pickup_from">Pick-up location</label>
          <input
            id="pickup_from"
            name="pickup_from"
            type="text"
            list="pickup-places"
            placeholder="Pynx Warehouse, Pencar…"
          />
        </div>

        <div className="field">
          <label htmlFor="dropoff_to">Drop-off location</label>
          <input
            id="dropoff_to"
            name="dropoff_to"
            type="text"
            list="pickup-places"
            placeholder="Where it goes back"
          />
        </div>

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

        <div className="field">
          <label htmlFor="crew">Crew</label>
          <input id="crew" name="crew" type="text" placeholder="Whoever is on it" />
        </div>
      </div>

      <div className="form-grid cols-3">
        {/* Two radios rather than a checkbox: one of them is always checked, so
            the answer is always posted. A hidden default alongside them would
            be read *instead* of the radio — formData.get returns the first
            entry with the name, and the hidden one comes first. */}
        <fieldset className="field-choice">
          <legend>Are the keys at the shop already?</legend>
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
        </fieldset>

        <fieldset className="field-choice">
          <legend>Take keys back to shop?</legend>
          <label>
            <input
              type="radio"
              name="keys_back_to_shop"
              value="yes"
              checked={keysBack}
              onChange={() => setKeysBack(true)}
            />
            Yes
          </label>
          <label>
            <input
              type="radio"
              name="keys_back_to_shop"
              value="no"
              checked={!keysBack}
              onChange={() => setKeysBack(false)}
            />
            No
          </label>
        </fieldset>

        <fieldset className="field-choice">
          <legend>Take keys back to Pencar?</legend>
          <label>
            <input
              type="radio"
              name="keys_back_to_pencar"
              value="yes"
              checked={keysPencar}
              onChange={() => setKeysPencar(true)}
            />
            Yes
          </label>
          <label>
            <input
              type="radio"
              name="keys_back_to_pencar"
              value="no"
              checked={!keysPencar}
              onChange={() => setKeysPencar(false)}
            />
            No
          </label>
        </fieldset>
      </div>

      {(keysAtShop || keysBack || keysPencar) && (
        <p className="small warn-text">
          The show will carry a keys warning on every board — one per errand,
          each its own colour.
        </p>
      )}

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
                        list="pickup-places"
                        placeholder="Same as the first day"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`day_${day}_dropoff_to`}>Drop-off location</label>
                      <input
                        id={`day_${day}_dropoff_to`}
                        name={`day_${day}_dropoff_to`}
                        type="text"
                        list="pickup-places"
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
                    {/* Checkboxes here, not radios: a day that says nothing
                        about the keys is a day that follows the first one, and
                        a radio pair would force an answer out of every day. */}
                    <div className="field field-checks">
                      <label className="field-check">
                        <input type="checkbox" name={`day_${day}_keys_at_shop`} value="yes" />
                        Keys at the shop
                      </label>
                      <label className="field-check">
                        <input type="checkbox" name={`day_${day}_keys_back_to_shop`} value="yes" />
                        Keys back to the shop
                      </label>
                      <label className="field-check">
                        <input type="checkbox" name={`day_${day}_keys_back_to_pencar`} value="yes" />
                        Keys back to Pencar
                      </label>
                    </div>
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
        {pending ? "Saving…" : "Send it out"}
      </button>
    </form>
  );
}
