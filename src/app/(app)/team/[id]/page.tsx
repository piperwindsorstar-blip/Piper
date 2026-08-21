import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { eventsAssignedTo } from "@/lib/events";
import { getUser, staffStats } from "@/lib/team";
import { formatDate, todayIso } from "@/lib/dates";
import StaffStatsRow from "@/components/StaffStatsRow";
import StaffEventList from "@/components/StaffEventList";
import MemberCard from "../MemberCard";
import StaffRecordForm from "./StaffRecordForm";
import { toggleMember } from "../actions";

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;

  const memberId = Number(id);
  if (!Number.isInteger(memberId)) notFound();

  const member = getUser(memberId);
  if (!member) notFound();

  const stats = staffStats(member.id);
  const events = eventsAssignedTo(member.id);
  const today = todayIso();
  const isUpcoming = (e: (typeof events)[number]) =>
    e.event_date >= today && e.status !== "cancelled";
  const upcoming = events.filter(isUpcoming).reverse();
  const past = events.filter((e) => !isUpcoming(e));

  return (
    <>
      <header className="topbar">
        <div>
          <h1>
            {member.name}{" "}
            <span className={`badge ${member.role === "admin" ? "badge-accent" : "badge-plain"}`}>
              {member.role === "admin" ? "Admin" : "DJ"}
            </span>
            {!member.active && <span className="badge badge-cancelled"> Deactivated</span>}
          </h1>
          <div className="topbar-sub">
            {member.email}
            {member.phone ? ` · ${member.phone}` : ""}
            {member.start_date ? ` · with you since ${formatDate(member.start_date)}` : ""}
          </div>
        </div>
        <Link className="btn" href="/team">
          ← All staff
        </Link>
      </header>

      <div className="content">
        <div className="card">
          <div className="card-head">
            <h2>Workload</h2>
          </div>
          <div className="card-body">
            <StaffStatsRow stats={stats} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Upcoming events</h2>
            <span className="badge badge-plain">{upcoming.length}</span>
          </div>
          <StaffEventList events={upcoming} empty="Nothing booked for them yet." />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>History</h2>
            <span className="badge badge-plain">{past.length}</span>
          </div>
          <StaffEventList events={past} empty="No past events on record." />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Staff record</h2>
          </div>
          <div className="card-body">
            <StaffRecordForm member={member} />
          </div>
        </div>

        <MemberCard member={member} title="Login &amp; role" />

        {member.id !== admin.id && (
          <div className="card">
            <div className="card-body row-between">
              <div className="small muted">
                {member.active
                  ? "Deactivating signs them out and blocks access, but keeps their name on past events."
                  : "Reactivating restores their sign-in."}
              </div>
              <form action={toggleMember}>
                <input type="hidden" name="id" value={member.id} />
                <input type="hidden" name="activate" value={member.active ? "0" : "1"} />
                <button className={`btn btn-sm ${member.active ? "btn-danger" : ""}`} type="submit">
                  {member.active ? "Deactivate" : "Reactivate"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
