import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listEvents } from "@/lib/events";
import { listDjs } from "@/lib/team";
import { countdownLabel, formatDate, formatTime } from "@/lib/dates";
import { EVENT_STATUSES, STATUS_LABELS, type EventStatus } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import Cell from "@/components/Cell";

type Search = { status?: string; q?: string; dj?: string };

export default async function EventsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const params = await searchParams;

  const status = (params.status ?? "upcoming") as EventStatus | "all" | "upcoming";
  const search = params.q ?? "";
  const djId = params.dj ? Number(params.dj) : undefined;

  const events = listEvents(user, { status, search, djId });
  const djs = user.role === "admin" ? listDjs() : [];

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Weddings</h1>
          <div className="topbar-sub">
            {events.length} wedding{events.length === 1 ? "" : "s"}
            {status === "upcoming" ? " coming up" : ""}
          </div>
        </div>
        {user.role === "admin" && (
          <Link className="btn btn-primary" href="/events/new">
            New wedding
          </Link>
        )}
      </header>

      <div className="content">
        <div className="card">
          <div className="card-body">
            <form className="btn-row" method="get">
              <input
                type="search"
                name="q"
                placeholder="Search couple, venue or email…"
                defaultValue={search}
                style={{ maxWidth: 280 }}
              />
              <select name="status" defaultValue={status} style={{ width: "auto" }}>
                <option value="upcoming">Upcoming</option>
                <option value="all">All</option>
                {EVENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              {user.role === "admin" && (
                <select name="dj" defaultValue={params.dj ?? ""} style={{ width: "auto" }}>
                  <option value="">Any DJ</option>
                  {djs.map((dj) => (
                    <option key={dj.id} value={dj.id}>
                      {dj.name}
                    </option>
                  ))}
                </select>
              )}
              <button className="btn" type="submit">
                Filter
              </button>
              <Link className="btn" href="/events">
                Reset
              </Link>
            </form>
          </div>
        </div>

        <div className="card">
          {events.length === 0 ? (
            <div className="empty">No weddings match those filters.</div>
          ) : (
            <div className="table-wrap">
              <table className="stacking">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Couple</th>
                    <th>Venue</th>
                    <th>Start</th>
                    <th>DJ</th>
                    <th>Status</th>
                    <th>Plan</th>
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
                        {event.package_name && (
                          <div className="faint small">{event.package_name}</div>
                        )}
                      </Cell>
                      <Cell label="Venue" className="muted">
                        {event.venue_name ?? "—"}
                        {event.venue_city && <div className="faint small">{event.venue_city}</div>}
                      </Cell>
                      <Cell label="Start" className="muted">
                        {formatTime(event.reception_time ?? event.ceremony_time)}
                      </Cell>
                      <Cell label="DJ" className={event.dj_name ? "" : "faint"}>
                        {event.dj_name ?? "Unassigned"}
                      </Cell>
                      <Cell label="Status">
                        <StatusBadge status={event.status} />
                      </Cell>
                      <Cell label="Plan">
                        {event.plan_submitted_at ? (
                          <span className="badge badge-confirmed">Submitted</span>
                        ) : (
                          <span className="badge badge-plain">Open</span>
                        )}
                      </Cell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
