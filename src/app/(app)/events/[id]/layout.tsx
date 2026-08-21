import Link from "next/link";
import { countdownLabel, formatDateLong } from "@/lib/dates";
import StatusBadge from "@/components/StatusBadge";
import EventTabs from "./EventTabs";
import { loadEvent } from "./guard";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, event } = await loadEvent(id);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>
            {event.partner_one_name}
            {event.partner_two_name ? ` & ${event.partner_two_name}` : ""}{" "}
            <StatusBadge status={event.status} />
          </h1>
          <div className="topbar-sub">
            {formatDateLong(event.event_date)} · {countdownLabel(event.event_date)}
            {event.venue_name ? ` · ${event.venue_name}` : ""}
          </div>
        </div>
        {user.role === "admin" && (
          <Link className="btn" href={`/events/${event.id}/edit`}>
            Edit details
          </Link>
        )}
      </header>

      <div className="content">
        <EventTabs eventId={event.id} />
        {children}
      </div>
    </>
  );
}
