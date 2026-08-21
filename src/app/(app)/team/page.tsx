import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listUsers, statsForAll } from "@/lib/team";
import { countdownLabel, formatDate } from "@/lib/dates";
import AddMemberForm from "./AddMemberForm";

export default async function StaffPage() {
  await requireAdmin();
  const members = listUsers(true);
  const stats = statsForAll();

  const active = members.filter((m) => m.active);
  const inactive = members.filter((m) => !m.active);
  const unassignedWarning = active.filter(
    (m) => m.role === "dj" && (stats.get(m.id)?.upcoming ?? 0) === 0,
  );

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Staff</h1>
          <div className="topbar-sub">
            {active.length} active · admins see everything, DJs see only their own events
          </div>
        </div>
      </header>

      <div className="content">
        {unassignedWarning.length > 0 && (
          <div className="alert alert-info">
            <strong>Free right now:</strong>{" "}
            {unassignedWarning.map((m) => m.name).join(", ")} — no upcoming events booked.
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <h2>Roster</h2>
          </div>
          <div className="card-body tight">
            {active.map((member) => {
              const s = stats.get(member.id);
              return (
                <Link key={member.id} href={`/team/${member.id}`} className="staff-row">
                  <div className="staff-avatar">
                    {member.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="staff-main">
                    <div className="staff-name">
                      {member.name}{" "}
                      <span className={`badge ${member.role === "admin" ? "badge-accent" : "badge-plain"}`}>
                        {member.role === "admin" ? "Admin" : "DJ"}
                      </span>
                    </div>
                    <div className="staff-meta">
                      {member.email}
                      {member.phone ? ` · ${member.phone}` : ""}
                    </div>
                  </div>
                  <div className="staff-stats">
                    <div>
                      <strong>{s?.upcoming ?? 0}</strong> upcoming
                    </div>
                    <div className="faint small">
                      {s?.nextDate
                        ? `Next ${formatDate(s.nextDate)} · ${countdownLabel(s.nextDate)}`
                        : "Nothing booked"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {inactive.length > 0 && (
          <div className="card">
            <div className="card-head">
              <h2>Deactivated</h2>
              <span className="badge badge-plain">{inactive.length}</span>
            </div>
            <div className="card-body tight">
              {inactive.map((member) => (
                <Link key={member.id} href={`/team/${member.id}`} className="staff-row">
                  <div className="staff-avatar muted">
                    {member.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="staff-main">
                    <div className="staff-name">{member.name}</div>
                    <div className="staff-meta">
                      {member.email} · kept on past events, cannot sign in
                    </div>
                  </div>
                  <span className="badge badge-cancelled">Deactivated</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <h2>Add someone</h2>
          </div>
          <div className="card-body">
            <AddMemberForm />
          </div>
        </div>
      </div>
    </>
  );
}
