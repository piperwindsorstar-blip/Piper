"use client";

import { useActionState, useState } from "react";
import type { RentalNotify } from "@/lib/settings-types";
import { saveRentalNotify, type SettingsState } from "./actions";

/**
 * Where word goes when somebody books a hire.
 *
 * One address rather than a list. A hire is arranged in a minute by whoever is
 * standing in the warehouse, and the person who has to pay for it and plan
 * around it is one person — sending it to everybody would make it something
 * everybody assumes somebody else has read.
 */
export default function RentalNotifyForm({
  notify,
  mailReady,
}: {
  notify: RentalNotify;
  mailReady: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(
    saveRentalNotify,
    {},
  );
  const [on, setOn] = useState(notify.on);

  const kept = state.values ?? {};

  return (
    <form action={formAction} key={state.stamp ?? 0}>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}

      {!mailReady && (
        <div className="alert alert-warn">
          Email is not set up yet, so nothing will be sent. Fill in the Email section
          above first — this can be saved either way and will start working once it is.
        </div>
      )}

      <p className="small muted">
        Sent the moment a hire is booked, with the place, the pick-up and drop-off
        dates and what is on it. It goes straight out rather than waiting in the
        outbox — a heads-up that needs approving arrives after the van has left.
      </p>

      <div className="field">
        <label className="check-row">
          <input
            name="on"
            type="checkbox"
            checked={on}
            onChange={(e) => setOn(e.target.checked)}
          />
          <span>Tell somebody when a hire is booked</span>
        </label>
      </div>

      <div className="field">
        <label htmlFor="notify_to">Send it to</label>
        <input
          id="notify_to"
          name="to"
          type="text"
          defaultValue={kept.to ?? notify.to.join(", ")}
          placeholder="martinp@pynxpro.ca, diegot@pynxpro.ca"
        />
        <div className="small faint">
          More than one is fine — separate them with commas. Nothing is sent to
          whoever booked it, so if they are on this list the others still hear
          about it; being emailed about something you did ten seconds ago only
          teaches people to ignore the emails.
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
