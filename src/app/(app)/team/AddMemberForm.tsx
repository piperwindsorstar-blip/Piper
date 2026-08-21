"use client";

import { useActionState } from "react";
import { addMember, type TeamState } from "./actions";

export default function AddMemberForm() {
  const [state, formAction, pending] = useActionState<TeamState, FormData>(addMember, {});
  const kept = state.values ?? {};

  return (
    <form action={formAction} key={state.stamp ?? 0}>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}

      <div className="form-grid cols-3">
        <div className="field">
          <label htmlFor="name">Name *</label>
          <input id="name" name="name" type="text" defaultValue={kept.name ?? ""} required />
        </div>
        <div className="field">
          <label htmlFor="email">Email *</label>
          <input id="email" name="email" type="email" defaultValue={kept.email ?? ""} required />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" defaultValue={kept.phone ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="role">Role *</label>
          <select id="role" name="role" defaultValue={kept.role ?? "dj"}>
            <option value="dj">DJ — sees only their own events</option>
            <option value="admin">Admin — full access</option>
          </select>
        </div>
        <div className="field span-2">
          <label htmlFor="password">Temporary password *</label>
          <input id="password" name="password" type="text" minLength={8} required />
          <span className="help">At least 8 characters. Share it with them to change later.</span>
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add team member"}
      </button>
    </form>
  );
}
