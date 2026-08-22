import { requireAdmin } from "@/lib/auth";
import { groupEntries, liveEventIds, recentActivity } from "@/lib/audit";
import History from "@/components/History";

/**
 * Everything that has happened to the bookings, newest first.
 *
 * Admin-only: entries carry the before and after text of every field, the
 * internal notes among them. This is also the only place a deleted booking's
 * history can still be read, since audit rows deliberately outlive their event.
 */
export default async function ActivityPage() {
  await requireAdmin();

  const groups = groupEntries(recentActivity(200));
  const live = liveEventIds();
  const deleted = groups.filter((g) => g.action === "deleted").length;

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Activity</h1>
          <div className="topbar-sub">
            Who changed what, across every booking
            {deleted > 0 && ` · ${deleted} deleted booking${deleted === 1 ? "" : "s"}`}
          </div>
        </div>
      </header>

      <div className="content">
        <div className="card">
          <div className="card-head">
            <h2>Recent changes</h2>
            <span className="small muted">Last {groups.length} · newest first</span>
          </div>
          <History
            groups={groups}
            showEvent
            liveEventIds={live}
            empty="Nothing has changed yet."
          />
        </div>
      </div>
    </>
  );
}
