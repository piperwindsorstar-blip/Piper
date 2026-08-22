import { requireAdmin } from "@/lib/auth";
import { groupChanges, recentChanges } from "@/lib/activity";
import { liveEventIds } from "@/lib/audit";
import ChangeFeed from "@/components/ChangeFeed";

/**
 * Everything that has changed, newest first — bookings, staff records, venues
 * and settings in one feed.
 *
 * Admin-only: entries carry the before and after text of every field, internal
 * notes and staff notes among them. This is also the only place a deleted
 * booking's history can still be read, since audit rows outlive their subject.
 */
export default async function ActivityPage() {
  await requireAdmin();

  const groups = groupChanges(recentChanges(200));
  const live = liveEventIds();
  const deleted = groups.filter(
    (g) => g.action === "deleted" || g.action === "removed",
  ).length;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Recent changes</h2>
        <span className="small muted">
          Last {groups.length} · newest first
          {deleted > 0 && ` · ${deleted} deletion${deleted === 1 ? "" : "s"}`}
        </span>
      </div>
      <ChangeFeed groups={groups} liveEventIds={live} empty="Nothing has changed yet." />
    </div>
  );
}
