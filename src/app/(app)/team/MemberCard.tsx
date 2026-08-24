"use client";

import { useActionState } from "react";
import { editMember, type TeamState } from "./actions";
import type { User } from "@/lib/auth";

export default function MemberCard({ member, title }: { member: User; title?: string }) {
  const [state, formAction, pending] = useActionState<TeamState, FormData>(editMember, {});
  const kept = state.values ?? {};

  return (
    <details className="card">
      <summary className="card-head" style={{ listStyle: "none", cursor: "pointer" }}>
        <div>
          <h2>
            {title ?? member.name}{" "}
            <span className={`badge ${member.role === "admin" ? "badge-accent" : "badge-plain"}`}>
              {member.role === "admin" ? "Admin" : "DJ"}
            </span>
            {!member.active && (
              <span className="badge badge-cancelled" style={{ marginLeft: "0.4rem" }}>
                Deactivated
              </span>
            )}
          </h2>
          <div className="faint small">Email, phone, role and password</div>
        </div>
        <span className="badge badge-plain">Edit</span>
      </summary>

      <div className="card-body">
        {state.error && <div className="alert alert-error">{state.error}</div>}
        {state.ok && <div className="alert alert-ok">{state.ok}</div>}

        <form action={formAction} key={state.stamp ?? 0}>
          <input type="hidden" name="id" value={member.id} />
          <div className="form-grid cols-3">
            <div className="field">
              <label>Name *</label>
              <input name="name" type="text" defaultValue={kept.name ?? member.name} required />
            </div>
            <div className="field">
              <label>Email *</label>
              <input name="email" type="email" defaultValue={kept.email ?? member.email} required />
            </div>
            <div className="field">
              <label>Phone</label>
              <input name="phone" type="tel" defaultValue={kept.phone ?? member.phone ?? ""} />
            </div>
            <div className="field">
              <label>Role *</label>
              <select name="role" defaultValue={kept.role ?? member.role}>
                <option value="dj">DJ — sees only their own weddings</option>
                <option value="admin">Admin — full access</option>
              </select>
            </div>
            <div className="field span-2">
              <label>Set a new password</label>
              <input name="password" type="text" placeholder="Leave blank to keep the current one" />
            </div>
          </div>

          <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      </div>
    </details>
  );
}
