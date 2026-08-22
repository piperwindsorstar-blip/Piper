import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listEvents, overbookedDates } from "@/lib/events";
import { countdownLabel, formatDateLong, formatTime, monthBounds, todayIso } from "@/lib/dates";
import StatusBadge from "@/components/StatusBadge";
import Cell from "@/components/Cell";
import AvailabilityAsks from "@/components/AvailabilityAsks";
import { openRequestsFor } from "@/lib/availability";
import DispatchToday from "@/components/DispatchToday";

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const upcoming = listEvents(user, { status: "upcoming" });
  const next = upcoming[0];
  const today = todayIso();
  const now = new Date();
  const { start, end } = monthBounds(now.getFullYear(), now.getMonth());

  const thisMonth = upcoming.filter((e) => e.event_date >= start && e.event_date <= end);
  const unassigned = upcoming.filter((e) => e.assigned_dj_id == null);
  const awaitingPlans = upcoming.filter((e) => e.plan_submitted_at == null);
  const clashes = isAdmin ? overbookedDates(today, "9999-12-31") : new Set<string>();
  const clashingSoon = upcoming.filter((e) => clashes.has(e.event_date));

  // Dates this DJ has been asked about and not yet answered.
  const asks = isAdmin ? [] : openRequestsFor(user.id);

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Dashboard</h1>
          <div className="topbar-sub">
            {isAdmin ? "Everything on the books" : "Your assigned events"}
          </div>
        </div>
        {isAdmin && (
          <Link className="btn btn-primary" href="/events/new">
            New event
          </Link>
        )}
      </header>

      <div className="content">
        {asks.length > 0 && <AvailabilityAsks asks={asks} />}
        {clashingSoon.length > 0 && (
          <div className="alert alert-warn">
            <strong>Heads up:</strong> {clashes.size} upcoming date
            {clashes.size === 1 ? " has" : "s have"} more than one event booked. Check the{" "}
            <Link href="/calendar">calendar</Link> to confirm you have the staff.
          </div>
        )}

        <div className="grid cols-4">
          <div className="card stat">
            <div className="stat-label">Upcoming</div>
            <div className="stat-value">{upcoming.length}</div>
            <div className="stat-note">events on the books</div>
          </div>
          <div className="card stat">
            <div className="stat-label">This month</div>
            <div className="stat-value">{thisMonth.length}</div>
            <div className="stat-note">still to play</div>
          </div>
          <div className="card stat">
            <div className="stat-label">{isAdmin ? "Unassigned" : "Next up"}</div>
            <div className="stat-value">
              {isAdmin ? unassigned.length : next ? countdownLabel(next.event_date) : "—"}
            </div>
            <div className="stat-note">{isAdmin ? "need a DJ" : "your next gig"}</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Plans open</div>
            <div className="stat-value">{awaitingPlans.length}</div>
            <div className="stat-note">couples haven&rsquo;t submitted</div>
          </div>
        </div>

        {isAdmin && (
          <div style={{ marginTop: "1.1rem" }}>
            <DispatchToday />
          </div>
        )}

        {next && (
          <div className="card" style={{ marginTop: "1.1rem" }}>
            <div className="card-head">
              <h2>Next event — {countdownLabel(next.event_date)}</h2>
              <StatusBadge status={next.status} />
            </div>
            <div className="card-body">
              <div className="row-between" style={{ marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.15rem" }}>
                    <Link href={`/events/${next.id}`}>
                      {next.partner_one_name}
                      {next.partner_two_name ? ` & ${next.partner_two_name}` : ""}
                    </Link>
                  </h3>
                  <div className="muted small">{formatDateLong(next.event_date)}</div>
                </div>
                <div className="btn-row">
                  <Link className="btn btn-sm" href={`/events/${next.id}/music`}>
                    Music
                  </Link>
                  <Link className="btn btn-sm" href={`/events/${next.id}/timeline`}>
                    Timeline
                  </Link>
                </div>
              </div>

              <div className="meta-list">
                <div className="meta-item">
                  <div className="meta-label">Venue</div>
                  <div className="meta-value">{next.venue_name ?? "—"}</div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">Load in</div>
                  <div className="meta-value">{formatTime(next.load_in_time)}</div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">Ceremony</div>
                  <div className="meta-value">{formatTime(next.ceremony_time)}</div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">Reception</div>
                  <div className="meta-value">{formatTime(next.reception_time)}</div>
                </div>
                <div className="meta-item">
                  <div className="meta-label">DJ</div>
                  <div className="meta-value">{next.dj_name ?? "Unassigned"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <h2>Coming up</h2>
            <Link className="small" href="/events">
              All events →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="empty">
              Nothing on the books yet.
              {isAdmin && (
                <>
                  {" "}
                  <Link href="/events/new">Add your first event</Link>.
                </>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="stacking">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Couple</th>
                    <th>Venue</th>
                    <th>DJ</th>
                    <th>Status</th>
                    <th>Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.slice(0, 10).map((event) => (
                    <tr key={event.id}>
                      <Cell label="Date" nowrap>
                        <div>{formatDateLong(event.event_date).replace(/,\s\d{4}$/, "")}</div>
                        <div className="faint small">{countdownLabel(event.event_date)}</div>
                      </Cell>
                      <Cell label="Couple">
                        <Link href={`/events/${event.id}`}>
                          {event.partner_one_name}
                          {event.partner_two_name ? ` & ${event.partner_two_name}` : ""}
                        </Link>
                      </Cell>
                      <Cell label="Venue" className="muted">{event.venue_name ?? "—"}</Cell>
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
