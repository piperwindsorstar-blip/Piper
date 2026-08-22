"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestReset, type ForgotState } from "./actions";

export default function ForgotForm() {
  const [state, formAction, pending] = useActionState<ForgotState, FormData>(requestReset, {});

  if (state.sent) {
    return (
      <>
        <div className="alert alert-ok">
          If that address has an account, a reset link is on its way.
        </div>
        <p className="small muted">
          It expires in two hours and works once. Check your junk folder if it hasn&rsquo;t
          arrived in a few minutes.
        </p>
        <Link className="btn" href="/login" style={{ width: "100%", textAlign: "center" }}>
          Back to sign in
        </Link>
      </>
    );
  }

  return (
    <form action={formAction}>
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <p className="small muted">
        Enter the address you sign in with and Piper will email you a link to choose a
        new password.
      </p>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Sending…" : "Email me a link"}
      </button>

      <p className="small muted" style={{ marginTop: "0.75rem", marginBottom: 0, textAlign: "center" }}>
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  );
}
