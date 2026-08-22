"use client";

import { useActionState } from "react";
import { setNewPassword, type ResetState } from "./actions";

export default function ResetForm({ token, name }: { token: string; name: string }) {
  const [state, formAction, pending] = useActionState<ResetState, FormData>(setNewPassword, {});

  return (
    <form action={formAction}>
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <p className="small muted">
        Choose a new password for <strong>{name}</strong>. Saving it signs you out
        everywhere, including your phone.
      </p>

      <input type="hidden" name="token" value={token} />

      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          autoFocus
        />
      </div>

      <div className="field">
        <label htmlFor="confirm">New password again</label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Saving…" : "Save and sign in"}
      </button>
    </form>
  );
}
