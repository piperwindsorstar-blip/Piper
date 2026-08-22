"use client";

import { useActionState, useState } from "react";
import { RULES_MAX, SHOP_LABELS, type ShopDetails } from "@/lib/settings-types";
import { saveShop, type SettingsState } from "./actions";

/**
 * The shop's own details, for the crew board.
 *
 * Two switches rather than one. Publishing an address and a phone number is
 * publishing contact details; publishing a gate code is publishing a key, and
 * it opens a yard full of equipment for anybody who has the link. Those are
 * not the same decision, so they are not the same tick box, and the codes stay
 * off until somebody deliberately turns them on.
 */
export default function ShopForm({ shop }: { shop: ShopDetails }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveShop, {});
  const [showOnBoard, setShowOnBoard] = useState(shop.showOnBoard);
  const [showCodes, setShowCodes] = useState(shop.showCodes);

  const field = (key: keyof typeof SHOP_LABELS, placeholder?: string) => (
    <div className="field" key={key}>
      <label htmlFor={key}>{SHOP_LABELS[key]}</label>
      <input id={key} name={key} type="text" defaultValue={shop[key]} placeholder={placeholder} />
    </div>
  );

  return (
    <form action={formAction}>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}

      <p className="small muted">
        What a crew needs at six in the morning when the office is shut. Anything left
        blank simply doesn&rsquo;t appear.
      </p>

      <div className="form-grid cols-2">
        {field("location", "12 Industrial Rd, unit 4")}
        {field("city", "Windsor")}
        {field("phone", "519-555-0100")}
        {field("emergency", "Out of hours")}
        {field("yard", "Behind the shop, second gate")}
        {field("gate", "Code for the gate")}
        {field("lockBox", "Where the keys live")}
      </div>

      <div className="field">
        <label htmlFor="rules">Standing rules</label>
        <textarea
          id="rules"
          name="rules"
          rows={4}
          maxLength={RULES_MAX}
          defaultValue={shop.rules}
          placeholder={"Fuel up before you bring it back.\nKeys go in the lock box, not your pocket.\nCall the shop before 7am if you're stuck."}
        />
      </div>

      <div className="field">
        <label>On the crew board</label>
        <label className="check-row">
          <input
            name="showOnBoard"
            type="checkbox"
            checked={showOnBoard}
            onChange={(e) => setShowOnBoard(e.target.checked)}
          />
          <span>Show the shop details and standing rules there</span>
        </label>
        <label className="check-row">
          <input
            name="showCodes"
            type="checkbox"
            checked={showCodes}
            disabled={!showOnBoard}
            onChange={(e) => setShowCodes(e.target.checked)}
          />
          <span>Include the gate code and lock box</span>
        </label>
      </div>

      {showOnBoard && showCodes && (
        <div className="alert alert-warn">
          <strong>Read this one twice.</strong> The crew board needs no sign-in, so the
          gate code and lock box will be readable by anyone who has the address — a
          forwarded text, an old phone, a former crew member. Publish the address and the
          phone number if it helps; think harder about the codes.
        </div>
      )}

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save shop details"}
      </button>
    </form>
  );
}
