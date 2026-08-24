"use client";

import { useActionState } from "react";
import { saveStaffRecord, type TeamState } from "../actions";
import type { User } from "@/lib/auth";

export default function StaffRecordForm({ member }: { member: User }) {
  const [state, formAction, pending] = useActionState<TeamState, FormData>(saveStaffRecord, {});
  const kept = state.values ?? {};

  return (
    <form action={formAction} key={state.stamp ?? 0}>
      <input type="hidden" name="id" value={member.id} />
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.ok && <div className="alert alert-ok">{state.ok}</div>}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="start_date">Started with you</label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={kept.start_date ?? member.start_date ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor="emergency_contact">Emergency contact</label>
          <input
            id="emergency_contact"
            name="emergency_contact"
            type="text"
            placeholder="Name and number"
            defaultValue={kept.emergency_contact ?? member.emergency_contact ?? ""}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="gear">Gear issued</label>
        <textarea
          id="gear"
          name="gear"
          rows={3}
          placeholder="Controller, speakers, wireless mics, cases — whatever of yours they hold."
          defaultValue={kept.gear ?? member.gear ?? ""}
        />
      </div>

      <div className="field">
        <label htmlFor="staff_notes">Notes</label>
        <textarea
          id="staff_notes"
          name="staff_notes"
          rows={4}
          placeholder="Strengths, preferred kinds of wedding, anything you want on file. Only admins see this."
          defaultValue={kept.staff_notes ?? member.staff_notes ?? ""}
        />
        <span className="help">Private to admins — never shown to the person themselves.</span>
      </div>

      <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save staff record"}
      </button>
    </form>
  );
}
