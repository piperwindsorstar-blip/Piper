"use client";

import { useActionState } from "react";
import { saveOwnDetails, type TeamState } from "../team/actions";

/**
 * Takes only the two fields it edits. Props to a Client Component end up in the
 * page HTML, so handing it a whole user row would publish that row.
 */
export default function OwnDetailsForm({ user }: { user: { name: string; phone: string | null } }) {
  const [state, formAction, pending] = useActionState<TeamState, FormData>(saveOwnDetails, {});
  const kept = state.values ?? {};

  return (
    <form action={formAction} key={state.stamp ?? 0}>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" defaultValue={kept.name ?? user.name} required />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" defaultValue={kept.phone ?? user.phone ?? ""} />
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <span className="help">
          Your email, role and password are managed by an admin — ask them to change those.
        </span>
      </div>
    </form>
  );
}
