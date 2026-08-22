"use client";

import { useActionState, useState } from "react";
import { BANNER_MAX, TONE_LABELS, type LoginBanner } from "@/lib/settings-types";
import { saveBanner, type SettingsState } from "./actions";

/**
 * The banner editor, with the banner itself shown above it as you type.
 *
 * A preview matters more here than in most forms: this is the one thing in
 * Piper an admin cannot check by looking, because signing out to see it is the
 * only way to see it, and signing out to check a typo is a poor trade.
 */
export default function BannerForm({ banner }: { banner: LoginBanner }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveBanner, {});
  const [message, setMessage] = useState(banner.message);
  const [tone, setTone] = useState(banner.tone);
  const [on, setOn] = useState(banner.on);

  const left = BANNER_MAX - message.length;

  return (
    <form action={formAction}>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}

      <div className="banner-preview">
        <div className="small faint">How it will look</div>
        {on && message.trim() ? (
          <div className={`login-banner login-banner-${tone}`}>{message}</div>
        ) : (
          <div className="empty" style={{ padding: "1rem" }}>
            {message.trim() ? "Switched off — nobody sees it." : "Nothing to show yet."}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={BANNER_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Office closed Monday — texts still get through."
        />
        <div className="small faint">{left} characters left</div>
      </div>

      <div className="form-grid cols-2">
        <div className="field">
          <label htmlFor="tone">Tone</label>
          <select
            id="tone"
            name="tone"
            value={tone}
            onChange={(e) => setTone(e.target.value as LoginBanner["tone"])}
          >
            {Object.entries(TONE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="on">Showing</label>
          <label className="check-row">
            <input
              id="on"
              name="on"
              type="checkbox"
              checked={on}
              onChange={(e) => setOn(e.target.checked)}
            />
            <span>Show this on the sign-in page</span>
          </label>
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save banner"}
      </button>

      <p className="small muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
        Everyone who reaches the sign-in page sees this, including people who never
        sign in. Keep it to things you would say to a stranger.
      </p>
    </form>
  );
}
