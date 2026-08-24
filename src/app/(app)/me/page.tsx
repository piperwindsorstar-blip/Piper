import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { eventsAssignedTo } from "@/lib/events";
import { staffStats } from "@/lib/team";
import { countdownLabel, formatDate, formatTime, todayIso } from "@/lib/dates";
import StaffStatsRow from "@/components/StaffStatsRow";
import StaffEventList from "@/components/StaffEventList";
import OwnDetailsForm from "./OwnDetailsForm";

export default async function MyPage() {
  const user = await requireUser();

  const stats = staffStats(user.id);
  const events = eventsAssignedTo(user.id);
  const today = todayIso();
  const isUpcoming = (e: (typeof events)[number]) =>
    e.event_date >= today && e.status !== "cancelled";

  const upcoming = events.filter(isUpcoming).reverse();
  const past = events.filter((e) => !isUpcoming(e));
  const next = upcoming[0];

  return (
    <>
      <header className="topbar">
        <div>
          <h1>My page</h1>
          <div className="topbar-sub">
            {user.role === "admin" ? "Your details and anything assigned to you" : "Your gigs and details"}
          </div>
        </div>
      </header>

      <div className="content">
        {next && (
          <div className="card">
            <div className="card-head">
              <h2>Next gig — {countdownLabel(next.event_date)}</h2>
              <Link className="btn btn-sm" href={`/events/${next.id}`}>
                Open wedding
              </Link>
            </div>
            <div className="card-body">
              <h3 style={{ fontSize: "1.1rem", marginBottom: "0.15rem" }}>
                {next.partner_one_name}
                {next.partner_two_name ? ` & ${next.partner_two_name}` : ""}
              </h3>
              <div className="muted small" style={{ marginBottom: "1rem" }}>
                {formatDate(next.event_date)}
                {next.venue_name ? ` · ${next.venue_name}` : ""}
              </div>
              <div className="meta-list">
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
                  <div className="meta-label">Music off</div>
                  <div className="meta-value">{formatTime(next.end_time)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <h2>Your record</h2>
          </div>
          <div className="card-body">
            <StaffStatsRow stats={stats} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Your upcoming weddings</h2>
            <span className="badge badge-plain">{upcoming.length}</span>
          </div>
          <StaffEventList
            events={upcoming}
            empty="Nothing assigned to you yet. Your admin books the weddings."
          />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Weddings you've played</h2>
            <span className="badge badge-plain">{past.length}</span>
          </div>
          <StaffEventList events={past} empty="No past weddings on record yet." />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Your details</h2>
          </div>
          <div className="card-body">
            <OwnDetailsForm user={{ name: user.name, phone: user.phone }} />
            {user.emergency_contact && (
              <div style={{ marginTop: "1rem" }}>
                <div className="meta-label">Emergency contact on file</div>
                <div className="meta-value">{user.emergency_contact}</div>
              </div>
            )}
            {user.gear && (
              <div style={{ marginTop: "1rem" }}>
                <div className="meta-label">Gear signed out to you</div>
                <div className="small muted" style={{ whiteSpace: "pre-wrap" }}>
                  {user.gear}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
