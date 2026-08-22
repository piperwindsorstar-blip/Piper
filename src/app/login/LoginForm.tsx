"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginForm({ justReset = false }: { justReset?: boolean }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction}>
      {justReset && !state.error && (
        <div className="alert alert-ok">
          Password saved. Sign in with the new one.
        </div>
      )}
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending} style={{ width: "100%" }}>
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="small muted" style={{ marginTop: "0.75rem", marginBottom: 0, textAlign: "center" }}>
        <Link href="/forgot">Forgotten your password?</Link>
      </p>
    </form>
  );
}
