"use client";

import { useActionState } from "react";
import { saveSupplier, type RentalsState } from "./actions";

/**
 * A place gear is hired from.
 *
 * Kept to four fields on purpose. This is a phone book, not a vendor record —
 * what somebody needs at four on a Friday is the name, who to ask for and the
 * number. Anything more and adding a supplier becomes a job in itself, and
 * people go back to keeping it in a thread.
 */
export type EditableSupplier = {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  notes: string | null;
};

export default function SupplierForm({ supplier }: { supplier?: EditableSupplier }) {
  const [state, formAction, pending] = useActionState<RentalsState, FormData>(saveSupplier, {});

  return (
    <form action={formAction} className="card-body">
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}

      {supplier && <input type="hidden" name="id" value={supplier.id} />}

      <div className="form-grid cols-3">
        <div className="field">
          <label htmlFor={`name-${supplier?.id ?? "new"}`}>Name *</label>
          <input
            id={`name-${supplier?.id ?? "new"}`}
            name="name"
            type="text"
            defaultValue={supplier?.name ?? ""}
            placeholder="System2Go"
            required
          />
        </div>
        <div className="field">
          <label htmlFor={`contact-${supplier?.id ?? "new"}`}>Ask for</label>
          <input
            id={`contact-${supplier?.id ?? "new"}`}
            name="contact"
            type="text"
            defaultValue={supplier?.contact ?? ""}
            placeholder="Who picks up"
          />
        </div>
        <div className="field">
          <label htmlFor={`phone-${supplier?.id ?? "new"}`}>Phone</label>
          <input
            id={`phone-${supplier?.id ?? "new"}`}
            name="phone"
            type="text"
            defaultValue={supplier?.phone ?? ""}
            placeholder="905-555-0100"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor={`notes-${supplier?.id ?? "new"}`}>Notes</label>
        <input
          id={`notes-${supplier?.id ?? "new"}`}
          name="notes"
          type="text"
          defaultValue={supplier?.notes ?? ""}
          placeholder="Account number, opening hours, anything worth remembering"
        />
      </div>

      <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
        {pending ? "Saving…" : supplier ? "Save changes" : "Add the place"}
      </button>
    </form>
  );
}
