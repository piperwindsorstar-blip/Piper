"use client";

import { useActionState } from "react";
import { testConnection, type OutboxState } from "./actions";

/**
 * Whether a mail server is wired up, and a way to prove it without sending
 * anything to a real person.
 *
 * Queueing works with no mail server at all, so this is not an error state —
 * you can use Piper and read exactly what it would send long before you set
 * up sending. It only stops you at the final tap.
 */
export default function MailStatus({ configured }: { configured: boolean }) {
  const [state, test, testing] = useActionState(testConnection, {} as OutboxState);

  if (!configured) {
    return (
      <div className="card mail-status">
        <div className="card-body">
          <strong>No mail server is set up yet</strong>
          <p className="small muted">
            Piper is still writing the emails and holding them here, so nothing is lost —
            you just can&rsquo;t send them yet. To turn sending on, add these to{" "}
            <code>/etc/piper.env</code> on the droplet and restart with{" "}
            <code>sudo systemctl restart piper</code>:
          </p>
          <pre className="mail-config">{`PIPER_SMTP_HOST=smtp.gmail.com
PIPER_SMTP_PORT=587
PIPER_SMTP_USER=you@pynxpro.ca
PIPER_SMTP_PASS=your-app-password
PIPER_MAIL_FROM="Pynx Productions <you@pynxpro.ca>"
PIPER_MAIL_REPLY_TO=you@pynxpro.ca`}</pre>
          <p className="small muted">
            Those settings are for Google Workspace, which needs an app password rather
            than your normal one. Any SMTP provider works the same way.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card mail-status">
      <div className="card-body row-between">
        <div>
          <strong>Mail server connected</strong>
          <div className="small muted">
            Sending is on. Each email still waits for you to approve it.
          </div>
          {state.error && <p className="alert-error">{state.error}</p>}
          {state.ok && <p className="alert-ok">{state.ok}</p>}
        </div>
        <form action={test}>
          <button className="btn btn-sm" type="submit" disabled={testing}>
            {testing ? "Checking…" : "Test the connection"}
          </button>
        </form>
      </div>
    </div>
  );
}
