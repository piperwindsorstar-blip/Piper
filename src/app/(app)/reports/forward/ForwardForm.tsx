"use client";

import { useActionState } from "react";
import { fileForwardedReport, type ForwardState } from "./actions";

/**
 * Paste a forwarded crew report and file it.
 *
 * The address-based route needs a mailbox and a DNS record; this needs
 * neither, and it is the same parser either way — so whatever gets set up
 * later, this keeps working as the manual path for the one that arrived at
 * somebody's personal address at midnight.
 */
export default function ForwardForm() {
  const [state, formAction, pending] = useActionState<ForwardState, FormData>(
    fileForwardedReport,
    {},
  );

  return (
    <>
      <form action={formAction}>
        {state.error && <div className="alert alert-error">{state.error}</div>}
        {state.ok && <div className="alert alert-ok">{state.ok}</div>}
        {state.warnings?.map((w) => (
          <div className="alert alert-warn" key={w}>
            {w}
          </div>
        ))}

        <div className="field">
          <label htmlFor="raw">The forwarded email</label>
          <textarea
            id="raw"
            name="raw"
            rows={14}
            defaultValue={state.raw ?? ""}
            placeholder={
              "Forward the report to yourself, then paste the whole thing here — headers included.\n\n" +
              "---------- Forwarded message ---------\n" +
              "From: PYNX Forms <pynxsmtp@gmail.com>\n" +
              "Date: Mon, Aug 24, 2026 at 12:20 PM\n" +
              "Subject: Warehouse Report Crew Manager Report\n..."
            }
            required
          />
          <div className="small faint">
            Keep the <strong>Date:</strong> line. It is what stops the same report filing twice.
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Reading…" : "File this report"}
        </button>
      </form>

      {state.fields && state.fields.length > 0 && (
        <div className="card-body" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <h3 className="small muted">What Piper read</h3>
          <dl className="shop-list">
            {state.fields.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value.length > 300 ? `${f.value.slice(0, 300)}…` : f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}
