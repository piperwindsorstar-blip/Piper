import Link from "next/link";
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth";
import { eventsAssignedTo } from "@/lib/events";
import { getUser, staffStats } from "@/lib/team";
import { changesBy, signInsForUser } from "@/lib/activity";
import { pendingReset } from "@/lib/password-reset";
import { baseUrl } from "@/lib/urls";
import CopyLink from "@/components/CopyLink";
import { liveEventIds } from "@/lib/audit";
import { formatDate, formatStoredTimestamp, todayIso } from "@/lib/dates";
import StaffStatsRow from "@/components/StaffStatsRow";
import StaffEventList from "@/components/StaffEventList";
import StaffActivity from "@/components/StaffActivity";
import MemberCard from "../MemberCard";
import StaffRecordForm from "./StaffRecordForm";
import PermissionsForm from "./PermissionsForm";
import { permissionsFor } from "@/lib/permissions";
import { toggleMember } from "../actions";

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireArea("team", "view");
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

  const signIns = signInsForUser(member.id, 25);
  const changes = changesBy(member.id, 60);

  // A link they asked for and haven't used. Shown so it can be handed over by
  // phone or text when mail isn't working — which is the exact situation where
  // a locked-out person cannot receive the email that would help them.
  const reset = pendingReset(member.id);
  const resetLink = reset ? `${await baseUrl()}/reset/${reset.token}` : null;

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
            <h2>Upcoming weddings</h2>
            <span className="badge badge-plain">{upcoming.length}</span>
          </div>
          <StaffEventList events={upcoming} empty="Nothing booked for them yet." />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>History</h2>
            <span className="badge badge-plain">{past.length}</span>
          </div>
          <StaffEventList events={past} empty="No past weddings on record." />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Staff record</h2>
          </div>
          <div className="card-body">
            <StaffRecordForm member={member} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>What they can reach</h2>
            <span className="small muted">Section by section</span>
          </div>
          <PermissionsForm
            userId={member.id}
            role={member.role}
            current={permissionsFor(member)}
            isSelf={member.id === admin.id}
          />
        </div>

        {reset && resetLink && (
          <div className="card">
            <div className="card-head">
              <h2>Password reset in progress</h2>
              <span className="small muted">Expires {formatStoredTimestamp(reset.expires_at)}</span>
            </div>
            <div className="card-body">
              <p className="small muted">
                {member.name} asked for a reset link. If the email hasn&rsquo;t arrived,
                read them this link instead — it works once, and only for them.
              </p>
              <CopyLink value={resetLink} />
            </div>
          </div>
        )}

        <MemberCard member={member} title="Login &amp; role" />

        <StaffActivity signIns={signIns} changes={changes} liveEventIds={liveEventIds()} />

        {member.id !== admin.id && (
          <div className="card">
            <div className="card-body row-between">
              <div className="small muted">
                {member.active
                  ? "Deactivating signs them out and blocks access, but keeps their name on past weddings."
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
