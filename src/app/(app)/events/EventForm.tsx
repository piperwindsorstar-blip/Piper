"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveEvent, type FormState } from "./actions";
import { EVENT_STATUSES, STATUS_LABELS, type EventWithRefs, type Venue } from "@/lib/types";

type Props = {
  event?: EventWithRefs;
  venues: Venue[];
  djs: { id: number; name: string; role: string }[];
};

export default function EventForm({ event, venues, djs }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveEvent, {});

  /**
   * After a rejected submit, fall back to what was typed rather than the saved
   * event, and remount (via key) so the restored values survive React's own
   * post-action form reset.
   */
  const fallbacks = {
    partner_one_name: event?.partner_one_name ?? "",
    partner_two_name: event?.partner_two_name ?? "",
    contact_email: event?.contact_email ?? "",
    contact_phone: event?.contact_phone ?? "",
    event_date: event?.event_date ?? "",
    status: event?.status ?? "tentative",
    guest_count: event?.guest_count != null ? String(event.guest_count) : "",
    load_in_time: event?.load_in_time ?? "",
    ceremony_time: event?.ceremony_time ?? "",
    cocktail_time: event?.cocktail_time ?? "",
    reception_time: event?.reception_time ?? "",
    end_time: event?.end_time ?? "",
    venue_id: event?.venue_id != null ? String(event.venue_id) : "",
    venue_room: event?.venue_room ?? "",
    assigned_dj_id: event?.assigned_dj_id != null ? String(event.assigned_dj_id) : "",
    package_name: event?.package_name ?? "",
    internal_notes: event?.internal_notes ?? "",
  };

  const kept = state.values;
  const field = (name: keyof typeof fallbacks): string =>
    kept && name in kept ? (kept[name] ?? "") : fallbacks[name];

  return (
    <form action={formAction} key={state.stamp ?? 0}>
      {event && <input type="hidden" name="id" value={event.id} />}
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="fieldset-title">The couple</div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="partner_one_name">Partner one *</label>
          <input
            id="partner_one_name"
            name="partner_one_name"
            type="text"
            required
            defaultValue={field("partner_one_name")}
          />
        </div>
        <div className="field">
          <label htmlFor="partner_two_name">Partner two</label>
          <input
            id="partner_two_name"
            name="partner_two_name"
            type="text"
            defaultValue={field("partner_two_name")}
          />
        </div>
        <div className="field">
          <label htmlFor="contact_email">Contact email</label>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            defaultValue={field("contact_email")}
          />
        </div>
        <div className="field">
          <label htmlFor="contact_phone">Contact phone</label>
          <input
            id="contact_phone"
            name="contact_phone"
            type="tel"
            defaultValue={field("contact_phone")}
          />
        </div>
      </div>

      <div className="fieldset-title">Date &amp; run of day</div>
      <div className="form-grid cols-3">
        <div className="field">
          <label htmlFor="event_date">Wedding date *</label>
          <input
            id="event_date"
            name="event_date"
            type="date"
            required
            defaultValue={field("event_date")}
          />
        </div>
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={field("status")}>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="guest_count">Guest count</label>
          <input
            id="guest_count"
            name="guest_count"
            type="number"
            min={0}
            defaultValue={field("guest_count")}
          />
        </div>
      </div>

      <div className="form-grid cols-4">
        <div className="field">
          <label htmlFor="load_in_time">Load in</label>
          <input id="load_in_time" name="load_in_time" type="time" defaultValue={field("load_in_time")} />
        </div>
        <div className="field">
          <label htmlFor="ceremony_time">Ceremony</label>
          <input id="ceremony_time" name="ceremony_time" type="time" defaultValue={field("ceremony_time")} />
        </div>
        <div className="field">
          <label htmlFor="cocktail_time">Cocktails</label>
          <input id="cocktail_time" name="cocktail_time" type="time" defaultValue={field("cocktail_time")} />
        </div>
        <div className="field">
          <label htmlFor="reception_time">Reception</label>
          <input id="reception_time" name="reception_time" type="time" defaultValue={field("reception_time")} />
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="end_time">Music off</label>
          <input id="end_time" name="end_time" type="time" defaultValue={field("end_time")} />
        </div>
      </div>

      <div className="fieldset-title">Venue &amp; staffing</div>
      <div className="form-grid cols-3">
        <div className="field">
          <label htmlFor="venue_id">Venue</label>
          <select id="venue_id" name="venue_id" defaultValue={field("venue_id")}>
            <option value="">— Not set —</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
                {venue.city ? ` (${venue.city})` : ""}
              </option>
            ))}
          </select>
          <span className="help">
            Add new venues under <Link href="/venues">Venues</Link>.
          </span>
        </div>
        <div className="field">
          <label htmlFor="venue_room">Room / space</label>
          <input id="venue_room" name="venue_room" type="text" defaultValue={field("venue_room")} />
        </div>
        <div className="field">
          <label htmlFor="assigned_dj_id">Assigned DJ</label>
          <select id="assigned_dj_id" name="assigned_dj_id" defaultValue={field("assigned_dj_id")}>
            <option value="">— Unassigned —</option>
            {djs.map((dj) => (
              <option key={dj.id} value={dj.id}>
                {dj.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="package_name">Package</label>
          <input
            id="package_name"
            name="package_name"
            type="text"
            placeholder="e.g. Ceremony + Reception, uplighting"
            defaultValue={field("package_name")}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="internal_notes">Internal notes</label>
        <textarea
          id="internal_notes"
          name="internal_notes"
          rows={4}
          placeholder="Anything the team should know. The couple never sees this."
          defaultValue={field("internal_notes")}
        />
      </div>

      <div className="btn-row">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : event ? "Save changes" : "Create wedding"}
        </button>
        <Link className="btn" href={event ? `/events/${event.id}` : "/events"}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
