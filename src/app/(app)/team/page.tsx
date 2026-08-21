import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { listUsers } from "@/lib/team";
import AddMemberForm from "./AddMemberForm";
import MemberCard from "./MemberCard";
import { toggleMember } from "./actions";

function assignmentCounts(): Map<number, number> {
  const rows = db()
    .prepare(
      `SELECT assigned_dj_id AS id, COUNT(*) AS n FROM events
       WHERE assigned_dj_id IS NOT NULL AND status != 'cancelled' GROUP BY assigned_dj_id`,
    )
    .all() as { id: number; n: number }[];
  return new Map(rows.map((r) => [r.id, r.n]));
}

export default async function TeamPage() {
  const admin = await requireAdmin();
  const members = listUsers(true);
  const counts = assignmentCounts();

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Team</h1>
          <div className="topbar-sub">
            Admins see and edit everything. DJs see only the events they&rsquo;re assigned to.
          </div>
        </div>
      </header>

      <div className="content">
        <div className="card">
          <div className="card-head">
            <h2>Add someone</h2>
          </div>
          <div className="card-body">
            <AddMemberForm />
          </div>
        </div>

        {members.map((member) => (
          <div key={member.id}>
            <MemberCard member={member} eventCount={counts.get(member.id) ?? 0} />
            {member.id !== admin.id && (
              <div className="card" style={{ marginTop: "-0.6rem" }}>
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
        ))}
      </div>
    </>
  );
}
