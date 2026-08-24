import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { eventsBetween, overbookedDates } from "@/lib/events";
import {
  addMonths,
  calendarGrid,
  formatTime,
  monthBounds,
  monthLabel,
  parseIso,
  todayIso,
  WEEKDAY_INITIALS,
} from "@/lib/dates";
import type { EventWithRefs } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

type Search = { year?: string; month?: string };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();

  const year = Number(params.year) || now.getFullYear();
  const month = Number.isFinite(Number(params.month)) && params.month !== undefined
    ? Number(params.month)
    : now.getMonth();

  const grid = calendarGrid(year, month);
  // The grid spills into neighbouring months, so query the full visible span.
  const rangeStart = grid[0].iso;
  const rangeEnd = grid[grid.length - 1].iso;

  const events = eventsBetween(user, rangeStart, rangeEnd);
  const clashes = overbookedDates(rangeStart, rangeEnd);
  const today = todayIso();

  const byDate = new Map<string, EventWithRefs[]>();
  for (const event of events) {
    const list = byDate.get(event.event_date) ?? [];
    list.push(event);
    byDate.set(event.event_date, list);
  }

  const monthEvents = events
    .filter((e) => e.event_date >= monthBounds(year, month).start && e.event_date <= monthBounds(year, month).end)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);
  const { start, end } = monthBounds(year, month);
  const monthCount = events.filter(
    (e) => e.event_date >= start && e.event_date <= end && e.status !== "cancelled",
  ).length;

  return (
    <>
      <header className="topbar">
        <div>
          <h1>{monthLabel(year, month)}</h1>
          <div className="topbar-sub">
            {monthCount} wedding{monthCount === 1 ? "" : "s"} this month
          </div>
        </div>
        <div className="btn-row">
          <Link className="btn btn-sm" href={`/calendar?year=${prev.year}&month=${prev.month}`}>
            ← Prev
          </Link>
          <Link className="btn btn-sm" href="/calendar">
            Today
          </Link>
          <Link className="btn btn-sm" href={`/calendar?year=${next.year}&month=${next.month}`}>
            Next →
          </Link>
          {user.role === "admin" && (
            <Link className="btn btn-primary btn-sm" href="/events/new">
              New wedding
            </Link>
          )}
        </div>
      </header>

      <div className="content">
        {clashes.size > 0 && (
          <div className="alert alert-warn">
            <strong>Double-booked dates</strong> are outlined in amber — more than one live wedding
            that day. Make sure each has its own DJ.
          </div>
        )}

        <div className="card cal-month">
          <div className="cal-grid">
            {WEEKDAY_INITIALS.map((day) => (
              <div key={day} className="cal-head">
                {day}
              </div>
            ))}

            {grid.map((cell) => {
              const dayEvents = byDate.get(cell.iso) ?? [];
              const classes = [
                "cal-cell",
                cell.inMonth ? "" : "out",
                cell.iso === today ? "today" : "",
                clashes.has(cell.iso) ? "overbooked" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div key={cell.iso} className={classes}>
                  <span className="cal-date">{parseIso(cell.iso).getDate()}</span>
                  {dayEvents.map((event) => (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className={`cal-event ${event.status}`}
                      title={`${event.partner_one_name}${
                        event.partner_two_name ? ` & ${event.partner_two_name}` : ""
                      } — ${event.venue_name ?? "venue TBD"} — ${
                        event.dj_name ?? "unassigned"
                      }`}
                    >
                      {event.reception_time ? `${formatTime(event.reception_time)} ` : ""}
                      {event.partner_one_name}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Phones get a readable agenda instead of seven squeezed columns. */}
        <div className="card cal-agenda">
          {monthEvents.length === 0 ? (
            <div className="empty">Nothing booked this month.</div>
          ) : (
            <div className="card-body">
              {monthEvents.map((event) => (
                <Link key={event.id} href={`/events/${event.id}`} className="agenda-row">
                  <div className="agenda-date">
                    <span className="agenda-dow">{WEEKDAY_INITIALS[parseIso(event.event_date).getDay()]}</span>
                    <span className="agenda-day">{parseIso(event.event_date).getDate()}</span>
                  </div>
                  <div className="agenda-main">
                    <div className="agenda-couple">
                      {event.partner_one_name}
                      {event.partner_two_name ? ` & ${event.partner_two_name}` : ""}
                    </div>
                    <div className="agenda-meta">
                      {formatTime(event.reception_time ?? event.ceremony_time)} ·{" "}
                      {event.venue_name ?? "Venue TBD"}
                    </div>
                    <div className="agenda-meta">
                      {event.dj_name ?? "Unassigned"}
                      {clashes.has(event.event_date) && (
                        <span className="badge badge-tentative" style={{ marginLeft: "0.4rem" }}>
                          Shared date
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={event.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card cal-month">
          <div className="card-head">
            <h2>Legend</h2>
          </div>
          <div className="card-body btn-row">
            <span className="cal-event" style={{ padding: "3px 8px" }}>
              Confirmed
            </span>
            <span className="cal-event tentative" style={{ padding: "3px 8px" }}>
              Tentative
            </span>
            <span className="cal-event completed" style={{ padding: "3px 8px" }}>
              Completed
            </span>
            <span className="cal-event cancelled" style={{ padding: "3px 8px" }}>
              Cancelled
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
