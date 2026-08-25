"use client";

import { useActionState } from "react";
import {
  AREAS,
  AREA_LABELS,
  AREA_NOTES,
  LEVELS,
  LEVEL_LABELS,
  ROLE_DEFAULTS,
  type Area,
  type Level,
} from "@/lib/permissions-types";
import { savePermissions, type TeamState } from "../actions";

/**
 * What one person can reach.
 *
 * Every section is shown with its current level rather than only the ones that
 * have been changed, because the question somebody opens this to answer is
 * "what can they get at?" — and a list of overrides does not answer it.
 *
 * The role default is named next to each. A level equal to it is stored as
 * nothing at all, so somebody left on the defaults moves with the role rather
 * than being frozen at whatever it happened to be the day their record was
 * saved.
 */
export default function PermissionsForm({
  userId,
  role,
  current,
  isSelf,
}: {
  userId: number;
  role: "admin" | "dj";
  current: Record<Area, Level>;
  isSelf: boolean;
}) {
  const [state, formAction, pending] = useActionState<TeamState, FormData>(savePermissions, {});
  const defaults = ROLE_DEFAULTS[role];

  if (isSelf) {
    return (
      <div className="card-body">
        <div className="alert alert-info">
          <strong>These are your own.</strong> Nobody can change their own access — it
          is the one edit that can lock the app out of its own administration with no
          way back. Ask another admin.
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="card-body">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}

      <input type="hidden" name="id" value={userId} />

      <p className="small muted">
        Anything left on the default follows the {role === "admin" ? "admin" : "DJ"} role,
        so changing what that role gets later reaches them too.
      </p>

      <div className="perm-grid">
        {AREAS.map((area) => (
          <div className="perm-row" key={area}>
            <div>
              <label htmlFor={`perm-${area}`}>{AREA_LABELS[area]}</label>
              <div className="small faint">{AREA_NOTES[area]}</div>
            </div>
            <select id={`perm-${area}`} name={area} defaultValue={current[area]}>
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level]}
                  {level === defaults[area] ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save access"}
      </button>
    </form>
  );
}
