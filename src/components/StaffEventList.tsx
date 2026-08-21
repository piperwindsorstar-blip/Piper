import Link from "next/link";
import { countdownLabel, formatDate } from "@/lib/dates";
import StatusBadge from "@/components/StatusBadge";
import Cell from "@/components/Cell";
import type { EventWithRefs } from "@/lib/types";

export default function StaffEventList({
  events,
  empty,
}: {
  events: EventWithRefs[];
  empty: string;
}) {
  if (events.length === 0) return <div className="empty">{empty}</div>;

  return (
    <div className="table-wrap">
      <table className="stacking">
        <thead>
          <tr>
            <th>Date</th>
            <th>Couple</th>
            <th>Venue</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <Cell label="Date" nowrap>
                <div>{formatDate(event.event_date)}</div>
                <div className="faint small">{countdownLabel(event.event_date)}</div>
              </Cell>
              <Cell label="Couple">
                <Link href={`/events/${event.id}`}>
                  {event.partner_one_name}
                  {event.partner_two_name ? ` & ${event.partner_two_name}` : ""}
                </Link>
              </Cell>
              <Cell label="Venue" className="muted">
                {event.venue_name ?? "—"}
              </Cell>
              <Cell label="Status">
                <StatusBadge status={event.status} />
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
