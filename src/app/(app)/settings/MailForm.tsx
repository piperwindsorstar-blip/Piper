"use client";

import { useActionState, useState } from "react";
import { MAIL_PORTS, type MailSettingsView } from "@/lib/settings-types";
import {
  clearMailSettings,
  saveMailSettings,
  testMailSettings,
  type SettingsState,
} from "./actions";

/**
 * SMTP settings, so email can be set up without an ssh session.
 *
 * The password is never sent to the browser — the form knows only whether one
 * is stored, and an empty box means "keep the one you have" rather than
 * "delete it". A password that round-trips through a form is a password in the
 * page source, in the browser's history, and in any screenshot of this screen.
 *
 * When /etc/piper.env is supplying the settings, the form goes read-only and
 * says so. Two sources of truth silently disagreeing is worse than one that
 * refuses to be edited.
 */
export default function MailForm({ mail }: { mail: MailSettingsView }) {
  const [saveState, save, saving] = useActionState<SettingsState, FormData>(saveMailSettings, {});
  const [testState, test, testing] = useActionState<SettingsState, FormData>(testMailSettings, {});
  const [clearState, clear, clearing] = useActionState<SettingsState, FormData>(
    clearMailSettings,
    {},
  );
  const [port, setPort] = useState(mail.port);

  // A rejected save hands back what was typed. Without this the form re-renders
  // with empty defaults, so "you forgot the password" also eats the server name.
  const kept = saveState.values ?? testState.values ?? {};
  const keep = (name: string, fallback: string) => kept[name] ?? fallback;

  if (mail.fromEnvironment) {
    return (
      <>
        <div className="alert alert-ok">
          Mail is configured on the server, in <code>/etc/piper.env</code>.
        </div>
        <p className="small muted">
          Those settings win over anything set here, which is the right way round — a
          password in that file is readable only by root and stays out of every database
          backup. To change them, edit the file and restart Piper.
        </p>
        <dl className="shop-list">
          <div>
            <dt>Server</dt>
            <dd>
              {mail.host}:{mail.port}
            </dd>
          </div>
          <div>
            <dt>Sends as</dt>
            <dd>{mail.from}</dd>
          </div>
        </dl>
      </>
    );
  }

  return (
    <>
      {saveState.error && <div className="alert alert-error">{saveState.error}</div>}
      {saveState.ok && <div className="alert alert-ok">{saveState.ok}</div>}
      {testState.error && <div className="alert alert-error">{testState.error}</div>}
      {testState.ok && <div className="alert alert-ok">{testState.ok}</div>}
      {clearState.ok && <div className="alert alert-ok">{clearState.ok}</div>}

      <form action={save} id="mail-form" key={saveState.stamp ?? testState.stamp ?? 0}>
        <div className="form-grid cols-2">
          <div className="field">
            <label htmlFor="host">Server</label>
            <input
              id="host"
              name="host"
              type="text"
              defaultValue={keep("host", mail.host)}
              placeholder="smtp.gmail.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="port">Port</label>
            <select
              id="port"
              name="port"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
            >
              {MAIL_PORTS.map((p) => (
                <option key={p.port} value={p.port}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="user">Username</label>
            <input
              id="user"
              name="user"
              type="text"
              autoComplete="off"
              defaultValue={keep("user", mail.user)}
              placeholder="office@pynxpro.ca"
            />
          </div>

          <div className="field">
            <label htmlFor="pass">Password</label>
            <input
              id="pass"
              name="pass"
              type="password"
              autoComplete="new-password"
              placeholder={mail.hasPassword ? "Stored — leave blank to keep it" : ""}
            />
            <div className="small faint">
              {mail.hasPassword
                ? "Blank keeps the stored one."
                : "Most providers need an app password, not your normal one."}
            </div>
          </div>

          <div className="field">
            <label htmlFor="from">Sends as</label>
            <input
              id="from"
              name="from"
              type="text"
              defaultValue={keep("from", mail.from)}
              placeholder="Pynx Productions &lt;office@pynxpro.ca&gt;"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="replyTo">Replies go to</label>
            <input
              id="replyTo"
              name="replyTo"
              type="email"
              defaultValue={keep("replyTo", mail.replyTo)}
              placeholder="Optional"
            />
          </div>
        </div>

        {/* The test lives in this form rather than its own, so it sees the
            fields as typed. A second form cannot read the first one's inputs,
            and mirroring them into hidden copies would be a second place for
            the values to drift out of step. */}
        <div className="field">
          <label htmlFor="to">Send a test to</label>
          <input id="to" name="to" type="email" defaultValue={keep("to", "")} placeholder="you@pynxpro.ca" />
          <div className="small faint">
            Uses what is typed above, saved or not — so a password can be proved before
            it replaces one that already works.
          </div>
        </div>

        <div className="btn-row">
          <button className="btn btn-primary" type="submit" disabled={saving || testing}>
            {saving ? "Saving…" : "Save mail settings"}
          </button>
          <button
            className="btn"
            type="submit"
            formAction={test}
            formNoValidate
            disabled={saving || testing}
          >
            {testing ? "Sending…" : "Send a test"}
          </button>

          {/* Saving refuses a blank server, so emptying the boxes is not a way
              out of a wrong one. This is. */}
          {(mail.host || mail.hasPassword) && (
            <button
              className="btn btn-danger"
              type="submit"
              formAction={clear}
              formNoValidate
              disabled={saving || testing || clearing}
            >
              {clearing ? "Clearing…" : "Stop sending email"}
            </button>
          )}
        </div>
      </form>
    </>
  );
}
